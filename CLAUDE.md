# Aesthetics — working notes for Claude Code

A workbench for Timothy's aesthetics. Each one is a full style guide kept as
JSON; the studio edits them and wears whichever is selected.

**Start here each session: `README.md` is the reference** — the format, the
studio, the deploy, the tests, the file map. Read it before changing
behaviour.

## Running it

```bash
scripts/serve.sh                # http://localhost:8020
node test/smoke.mjs             # headless check, needs the server running
node test/library.mjs           # every library file against the format — no browser
```

Run the smoke test after any non-trivial change and **look at the
screenshots** in `test/shots/`. This is an app whose entire job is how things
look; a passing assertion has never once meant it looked right. Two real bugs
were caught that way already — a strength slider wired to nothing, and a
room that stayed daylight while the desk went dark.

## Building something in an aesthetic

When Timothy says "build this in Aeros" (or Alyssian, Starprint, Golf 97,
Girando, Stelaine, Carca, Fantaccio, Hikari), read
`library/<id>.aesthetic.json` and follow it.
**The story, philosophy, do/don't and voice in the file are instructions, not
flavour** — the numbers say what to use, those say what for. The guide export
(`asGuide` in `js/export.js`) is the same content written out to hand over
whole; `asTokens` writes the numbers alone as a DTCG token file, for handing
to a tool rather than a person.

## The library is checked against the format, and the check reads schema.js

`node test/library.mjs` validates every `library/*.aesthetic.json` — no browser,
no server. The rules are **not written out again**: it walks `SECTIONS`, which
is the actual source of truth, so a field added to the form is a field checked
here the same day. It catches a `select` value the form cannot show, a range
outside its own slider, a malformed hex, a missing colour role, an index entry
with no file, a file missing from the index, and `none` where a shadowless
aesthetic needs a zero shadow.

It also asks whether two entries **share a tagline**, which sounds trivial and
is the mistake that is easiest to make here: the library is Timothy's aesthetics
under the names *this repo* gave them, and several grew up in Bureau under
different ones. A second file for an aesthetic that is already on the shelf
looks perfectly valid on its own and only shows up next to its twin.

## The names have drifted, and that is Timothy's to settle

Three of these were renamed here and the apps never followed:

| Here | Bureau calls it | Elsewhere |
| --- | --- | --- |
| **Alyssian** | Victoria | — |
| **Starprint** | Starful Gothic | — |
| **Girando** | Girando | Tilemakers renamed it **Soffiando** |

Each file's `lineage` records its own half of this, so nothing is lost — but a
request to "build this in Victoria" will not find a file, and Girando now has
two names in two repos. **Don't unilaterally rename anything to fix it**: which
name wins is a decision, not a tidy-up, and it wants making once across all
three repos rather than three times by accident.

## The three rules easiest to forget

- **`library/*.aesthetic.json` is the source of truth.** The studio is a
  static page and cannot write it; edits live in localStorage until exported
  and committed. A change nobody committed does not exist tomorrow.
- **A shadowless aesthetic stores a zero shadow, never `none`.** Shadows get
  composed into lists (`inset …, var(--shadow)`), and `none` is only legal as
  the sole value of the property. Starprint is the one this bit.

- **Colour lives in `color.variants`, never `color.roles`.** An aesthetic has
  one or more named colourways; light/dark is the commonest shape but not the
  only one (Starprint is four papers). Read them with `rolesOf(a, i)` and
  `variantAt(a, i)` from `js/schema.js`; `color.roles` no longer exists, and
  `upgrade()` migrates any file that still has it.
- **`js/schema.js` owns both the format and the form.** Add a field to
  `blank()` *and* to `SECTIONS`, or you get a value nobody can edit or a knob
  wired to nothing. `upgrade()` backfills older files and saved working
  copies, so adding a field is safe.

## How the painting works

`apply()` in `js/preview.js` sets `--v-*` custom properties and a few
`data-*` attributes (corner, enter, hover, ambient, dividers, underline) on
`<html>`. Everything visual reads those: the demo site straight, the editor
chrome through a `--c-*` mapping that the plain-room toggle re-points at
neutral greys. Nothing is styled per-aesthetic in CSS — if something needs a
special case, the format is missing a parameter. That is the test the whole
thing is built to pass.

Cut corners are a `clip-path`, and a clip cuts the shadow off too; in a
cut-corner aesthetic, depth comes from borders.

## Style

No dependencies, no build step, no framework. Two-space indent, single quotes,
template literals for HTML. Comments explain *why*. Copy is plain, specific and
unexcited — "On the list", not "Added successfully!".
