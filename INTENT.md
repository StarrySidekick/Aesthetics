# Intent

What this is for, and what to build next. Recorded **2026-09-06** from Timothy's
own answers to a direct set of questions, so this is *stated* intent rather than
intent inferred from the code.

**Read this before choosing what to build.** Where it disagrees with the rest of
the docs about **direction**, this file is newer and wins. Where it disagrees
about **mechanics** — how the code works, what was decided deliberately, the
invariants — the other docs win, always.

When something here is done, or turns out to be wrong, **edit it**. A stale
intent file is worse than no intent file.

## What it is for

**The source the other repos refer to and update against.**

That is the important answer, and it reframes the project. This is not a
standalone workbench that happens to describe Timothy's aesthetics; it is meant
to be **upstream** of Bureau, Tilemakers Workshop and Doppelganger, with those
repos pulling from it rather than each keeping its own drifted copy.

## The names are settled

Timothy settled this on 2026-09-06:

| Canonical | Also seen as | Verdict |
|---|---|---|
| **Alyssian** | Bureau's "Victoria" | Alyssian wins |
| **Starprint** | Bureau's "Starful Gothic" | Starprint wins |
| **Girando** | Tilemakers' "Soffiando" | **Not a conflict.** Soffiando is the name of a *game mode* in Tilemakers, not a rename of this aesthetic. Girando stays Girando here. |

Propagating the canonical names into Bureau's prose is welcome work. **The
stored CSS keys and `data-style` hooks are a different question** and must not
be renamed without a migration — a desk left on a key that no longer resolves
looks right while storing something unreachable.

## What is next

Two halves of the same job.

**1. The studio should be able to save, not only export.** Export-to-JSON is for
handing an aesthetic *out*. Timothy wants his edits to persist as committed
files, so that a change he makes in the studio is a change that exists tomorrow.
Doppelganger's editor already commits to git from the browser
(`src/lib/publish.js`, git data API, one commit for everything); that mechanism
is the obvious model and it is already in this account's own code.

**2. A way for the other repos to pull from here.** ~~Design it and write the
design down before building it.~~ **Designed and built 2026-09-06.**
`scripts/dist.mjs` emits `dist/` — a manifest with a content hash per aesthetic,
plus DTCG tokens and a CSS file each — and
**[`docs/CONSUMING.md`](docs/CONSUMING.md)** is the contract.

The decision that shaped it: **a consumer vendors a copy and commits it, and
never fetches this library at runtime.** Bureau is an offline-first PWA and must
not grow a network dependency on another origin; an aesthetic changing should be
a diff somebody reads next to the tiles it affects; and three apps that break
when a fourth repo's deploy fails is a worse system than three apps carrying a
copy. The published tree exists so vendoring can be scripted and so a person can
look, not as an API.

Also settled there: **ids are the contract, and a consumer's own stored keys are
its own problem.** Bureau keeps `style: 'victoria'` in every desk ever saved and
hooks CSS on `html[data-style="victoria"]`, so it keeps a small table pointing at
`alyssian` rather than taking a migration that buys nothing here.

**Still to do: nobody consumes it yet.** The producing half exists; wiring
Bureau, Tilemakers or Doppelganger to actually vendor from it is the next step,
and doing one of them would prove the format before the other two copy it.

## Deliberately not next

- **New aesthetics.** Nine is enough for now. Timothy will add more himself when
  he wants them.

## Audience

Him and his apps, for now. **Eventually the aesthetics get shared as tokens
other people can use**, so `asTokens` in `js/export.js` is not wasted work.
