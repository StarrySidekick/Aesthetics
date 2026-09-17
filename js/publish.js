/* Commit an aesthetic back to the repository from the browser.

   GitHub Pages is static — there is no backend to POST to — so the studio
   talks to the GitHub API directly with a token pasted in once. Pushing to
   the default branch is what makes the library change for every session that
   reads it: `library/<id>.aesthetic.json` becomes the committed file, no
   "hand it to a session and say commit this" step in between.

   Ported from Doppelganger's `src/lib/publish.js` (this account's own code,
   already solving the same problem) rather than re-derived — INTENT.md names
   it as the obvious model. Two aesthetics-specific differences: the path is
   `library/<id>.aesthetic.json`, and a *new* aesthetic also has to add its id
   to `library/index.json` in the same commit, or the file exists but nothing
   ever fetches it.

   **One commit, however many files.** A new aesthetic's JSON and its entry in
   the index have to land together, or a reload between them would show a page
   that can fetch a file the index never mentions. So this uses the git data
   API — blobs, a tree, a commit, then move the branch — for one commit and
   one rebuild, exactly as Doppelganger's does.

   On the token, because it is a real credential:
     - Use a FINE-GRAINED token limited to this one repository, with
       Contents: read and write. Nothing else. Not a classic token.
     - It is kept in localStorage so you do not retype it. Anything running on
       this origin could read it. Give it a short expiry and use "Forget
       token" when you are done.
     - It is never logged, never put in a URL, and only ever sent to
       api.github.com over https, in the Authorization header. */

const API = 'https://api.github.com';

/** Where the studio publishes. The Pages workflow watches this branch. */
export const TARGET = {
  owner: 'StarrySidekick',
  repo: 'Aesthetics',
  branch: 'main',
};

export const pathFor = (id) => `library/${id}.aesthetic.json`;

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

/** Turn an API failure into something worth reading. */
async function explain (res, what) {
  let detail = '';
  try { detail = (await res.json())?.message ?? ''; } catch { /* no body */ }
  if (res.status === 401) return 'Token rejected — it may be expired or mistyped.';
  if (res.status === 403) return `Forbidden — the token needs Contents: read and write on this repo. ${detail}`;
  if (res.status === 404) return 'Not found — check the token can see this repository.';
  if (res.status === 409 || res.status === 422) {
    return 'Something else pushed to the repo while you were editing, so this was not applied. Reload and publish again.';
  }
  return `GitHub returned ${res.status} on ${what}. ${detail}`;
}

/** One API call, with the token in the header and nowhere else. */
async function call (fetchImpl, token, url, what, init = {}) {
  const res = await fetchImpl(url, {
    ...init,
    headers: headers(token),
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new Error(await explain(res, what));
  return res.json();
}

/**
 * Commit a set of files as one commit.
 *
 * @param {object} o
 * @param {string} o.token
 * @param {Array<{path:string, text:string}>} o.files  text only — an
 *        aesthetic and its index are both JSON, never bytes.
 * @param {string} o.message
 * @returns {Promise<{url:string, sha:string, paths:string[]}>}
 */
export async function publishFiles ({ token, files, message, target = TARGET, fetchImpl = fetch }) {
  if (!token) throw new Error('No token.');
  if (!files?.length) throw new Error('Nothing to publish.');

  const repo = `${API}/repos/${target.owner}/${target.repo}`;
  const ref = `heads/${target.branch}`;

  // Where the branch is now. Everything below is built on top of this exact
  // commit, and the ref update at the end refuses if it has moved since.
  const head = await call(fetchImpl, token, `${repo}/git/ref/${ref}`, 'reading the branch');
  const baseSha = head.object.sha;
  const baseCommit = await call(fetchImpl, token, `${repo}/git/commits/${baseSha}`, 'reading the last commit');

  const blobs = [];
  for (const f of files) {
    const blob = await call(fetchImpl, token, `${repo}/git/blobs`, `uploading ${f.path}`, {
      method: 'POST',
      body: { content: f.text, encoding: 'utf-8' },
    });
    blobs.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // base_tree means "everything else stays as it is" — without it this would
  // commit a tree containing only these files and delete the rest of the repo.
  const tree = await call(fetchImpl, token, `${repo}/git/trees`, 'building the tree', {
    method: 'POST',
    body: { base_tree: baseCommit.tree.sha, tree: blobs },
  });

  const commit = await call(fetchImpl, token, `${repo}/git/commits`, 'writing the commit', {
    method: 'POST',
    body: { message, tree: tree.sha, parents: [baseSha] },
  });

  // Not forced. If anything else pushed while this was being assembled, this
  // fails and the other change survives.
  await call(fetchImpl, token, `${repo}/git/refs/${ref}`, 'moving the branch', {
    method: 'PATCH',
    body: { sha: commit.sha, force: false },
  });

  return { url: commit.html_url, sha: commit.sha, paths: files.map((f) => f.path) };
}

/**
 * Write one aesthetic, and its index entry if it is new, in a single commit.
 *
 * The caller is expected to have already run it through `upgrade()` and the
 * form — this will happily commit nonsense, and `node test/library.mjs`
 * (run in CI, not here) is what would then fail.
 *
 * @param {object}   o
 * @param {string}   o.token
 * @param {object}   o.aesthetic   the full aesthetic object (already upgraded)
 * @param {boolean}  o.isNew       true when this id has no committed file yet
 * @param {string[]} [o.order]     the current library/index.json order —
 *        required when isNew, so the new id can be appended to it
 * @param {string}   [o.message]
 * @returns {Promise<{url:string, sha:string, paths:string[]}>}
 */
export async function publishAesthetic ({
  token, aesthetic, isNew, order = [], message, target = TARGET, fetchImpl = fetch,
}) {
  if (!token) throw new Error('No token.');
  const body = JSON.stringify(aesthetic, null, 2) + '\n';
  const files = [{ path: pathFor(aesthetic.id), text: body }];
  if (isNew) {
    const next = order.includes(aesthetic.id) ? order : [...order, aesthetic.id];
    files.push({ path: 'library/index.json', text: JSON.stringify(next, null, 2) + '\n' });
  }
  const what = message ||
    (isNew ? `Add ${aesthetic.name} to the library` : `Update ${aesthetic.name} from the studio`);
  const out = await publishFiles({ token, files, message: what, target, fetchImpl });
  return { ...out, path: pathFor(aesthetic.id) };
}
