/* Build the distribution — what the OTHER repos read.
 *
 * `library/*.aesthetic.json` is the AUTHORING format. It carries the story, the
 * philosophy, the do/don't and the voice, because those are instructions for a
 * person or a Claude building something in the style. An app consuming an
 * aesthetic wants none of that; it wants the numbers. So this writes a second,
 * derived tree that is safe to depend on and cheap to diff.
 *
 * Everything here is generated. Never edit dist/ by hand; edit the aesthetic.
 *
 *   node scripts/dist.mjs          write dist/
 *   node scripts/dist.mjs --check  verify dist/ matches the library, write nothing
 *
 * The --check mode is what stops the published distribution drifting from the
 * files it claims to be built from, which is the failure this whole tree exists
 * to make visible.
 */

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { upgrade, variantsOf, isDark } from '../js/schema.js';
import { asCSS, asTokens } from '../js/export.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'library');
const DIST = join(ROOT, 'dist');

/* Bumped only when the SHAPE of dist changes in a way a consumer would have to
   react to. Adding a field is not a bump; moving or removing one is. */
const DIST_FORMAT = 'aesthetic-dist/1';

const stable = (v) => JSON.stringify(v, null, 2) + '\n';
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

async function loadLibrary () {
  const index = JSON.parse(await readFile(join(LIB, 'index.json'), 'utf8'));
  const files = (await readdir(LIB)).filter((f) => f.endsWith('.aesthetic.json'));

  /* The index is the order Timothy put them in, and order is meaning here, so
     it leads. But a file the index forgot would silently never ship, which is
     exactly the kind of quiet loss this repo keeps writing tests about — so
     anything unlisted is appended and named in the output rather than dropped. */
  const listed = index.map((id) => `${id}.aesthetic.json`);
  const orphans = files.filter((f) => !listed.includes(f)).sort();
  if (orphans.length) {
    console.warn(`  ! not in index.json, shipping at the end: ${orphans.join(', ')}`);
  }

  const out = [];
  for (const file of [...listed, ...orphans]) {
    const path = join(LIB, file);
    if (!existsSync(path)) {
      throw new Error(`index.json lists ${file}, which does not exist`);
    }
    out.push(upgrade(JSON.parse(await readFile(path, 'utf8'))));
  }
  return out;
}

function buildFiles (aesthetics) {
  const files = new Map();
  const entries = [];

  for (const a of aesthetics) {
    const tokens = stable(asTokens(a));
    const css = asCSS(a);

    files.set(`${a.id}.tokens.json`, tokens);
    files.set(`${a.id}.css`, css.endsWith('\n') ? css : css + '\n');

    entries.push({
      id: a.id,
      name: a.name,
      tagline: a.tagline || '',
      /* A consumer that has vendored this can compare one string and know
         whether the thing it copied has moved. Cheaper and more honest than a
         date, which changes when nothing did. */
      hash: hash(tokens),
      /* A variant carries `mode` and its roles, never a `dark` flag — so
         darkness is derived from the background the way the studio derives it,
         with the schema's own function. Reading v.dark gives false for
         everything, including Starprint, which is four dark papers. */
      variants: variantsOf(a).map((v) => ({
        name: v.name,
        mode: v.mode || (isDark(v.roles && v.roles.bg) ? 'dark' : 'light'),
        dark: isDark(v.roles && v.roles.bg)
      })),
      tokens: `${a.id}.tokens.json`,
      css: `${a.id}.css`
    });
  }

  const manifest = {
    format: DIST_FORMAT,
    /* Deliberately no build timestamp. A date changes on every deploy whether
       or not anything did, which makes every consumer's diff noise and trains
       people to ignore it. The per-aesthetic hashes carry the real answer. */
    count: entries.length,
    aesthetics: entries
  };
  files.set('manifest.json', stable(manifest));

  /* One request for a consumer that wants the lot — the manifest with every
     token set inlined. Costs a little duplication and saves N round trips. */
  files.set('aesthetics.json', stable({
    ...manifest,
    aesthetics: entries.map((e) => ({
      ...e,
      tokens: JSON.parse(files.get(`${e.id}.tokens.json`))
    }))
  }));

  return files;
}

const check = process.argv.includes('--check');

const aesthetics = await loadLibrary();
const files = buildFiles(aesthetics);

if (check) {
  let bad = 0;
  for (const [name, body] of files) {
    const path = join(DIST, name);
    const have = existsSync(path) ? await readFile(path, 'utf8') : null;
    if (have === null) { console.error(`  MISSING  dist/${name}`); bad++; }
    else if (have !== body) { console.error(`  STALE    dist/${name}`); bad++; }
  }
  const extra = existsSync(DIST)
    ? (await readdir(DIST)).filter((f) => !files.has(f))
    : [];
  for (const f of extra) { console.error(`  ORPHAN   dist/${f}`); bad++; }

  if (bad) {
    console.error(`\n${bad} problem${bad === 1 ? '' : 's'} — run \`node scripts/dist.mjs\` and commit the result.`);
    process.exit(1);
  }
  console.log(`ok — dist/ matches the library, ${aesthetics.length} aesthetics, ${files.size} files`);
} else {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const [name, body] of files) await writeFile(join(DIST, name), body);
  console.log(`dist/ written — ${aesthetics.length} aesthetics, ${files.size} files`);
  for (const e of JSON.parse(files.get('manifest.json')).aesthetics) {
    console.log(`  ${e.hash}  ${e.id}`);
  }
}
