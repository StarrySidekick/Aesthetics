/* Does every file in library/ still answer to the format?
   ------------------------------------------------------
   `js/schema.js` owns both the format and the form, so that a control and the
   value it edits cannot drift apart. Nothing checked the *library* against it
   — the files are hand-edited, exported from a browser, and committed by
   hand, which is three ways to land a value the form cannot show or the
   preview cannot paint. A field the editor silently ignores is a knob wired to
   nothing, and you find out by wondering why a change did nothing.

   The rules here are not written out again: they are read off `SECTIONS`,
   which is the actual source of truth. A new field in the form is a new field
   checked here, for free, the day it is added.

   node test/library.mjs — no browser, no server.
*/
import { readFileSync, readdirSync } from 'node:fs';
import { SECTIONS, ROLES, MODES, FORMAT } from '../js/schema.js';

const DIR = new URL('../library/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);

const problems = [];
const bad = (id, msg) => problems.push(`${id}: ${msg}`);
const HEX = /^#[0-9a-f]{6}$/i;

// --- the shelf and the files have to be the same set ------------------------
const index = read('index.json');
const files = readdirSync(DIR).filter(f => f.endsWith('.aesthetic.json'))
                              .map(f => f.replace('.aesthetic.json', ''));
for (const id of index) {
  if (!files.includes(id)) bad('index.json', `lists "${id}", which has no file`);
}
for (const id of files) {
  // An unlisted file is invisible in the studio, which looks like it vanished.
  if (!index.includes(id)) bad(id, 'has a file but is not in index.json — the shelf will not show it');
}
if (new Set(index).size !== index.length) bad('index.json', 'lists the same id twice');

// --- every field the form knows about, checked against what it will accept ---
const FIELDS = SECTIONS.flatMap(s => s.fields);
const seen = new Map();

for (const id of files) {
  const a = read(`${id}.aesthetic.json`);

  if (a.format !== FORMAT) bad(id, `format is "${a.format}", expected "${FORMAT}"`);
  if (a.id !== id) bad(id, `id is "${a.id}" but the file is named ${id}.aesthetic.json`);

  for (const f of FIELDS) {
    // `variants` and `swatches` are their own shapes, checked below.
    if (f.kind === 'variants' || f.kind === 'swatches') continue;
    const v = get(a, f.path);
    if (v === undefined || v === null || v === '') { bad(id, `${f.path} is empty`); continue; }
    if (f.kind === 'select' && !f.options.includes(String(v))) {
      bad(id, `${f.path} is "${v}", which the form cannot show — expected one of ${f.options.join(', ')}`);
    }
    if (f.kind === 'range') {
      const n = Number(v);
      if (!Number.isFinite(n)) bad(id, `${f.path} is "${v}", not a number`);
      else if (n < f.min || n > f.max) bad(id, `${f.path} is ${n}, outside the slider's ${f.min}–${f.max}`);
    }
    if (f.kind === 'lines' && (!Array.isArray(v) || !v.length)) {
      bad(id, `${f.path} should be a non-empty list`);
    }
    if (f.kind === 'color' && !HEX.test(v)) bad(id, `${f.path} is "${v}", not a #rrggbb hex`);
  }

  // --- colour: the part every other value is painted with -------------------
  const variants = get(a, 'color.variants');
  if (!Array.isArray(variants) || !variants.length) bad(id, 'has no colour variants');
  else variants.forEach((v, i) => {
    const where = `color.variants[${i}]`;
    if (!v.name) bad(id, `${where} has no name`);
    if (!MODES.includes(v.mode)) bad(id, `${where}.mode is "${v.mode}", expected ${MODES.join(' or ')}`);
    for (const [role] of ROLES) {
      const hex = v.roles && v.roles[role];
      if (!hex) bad(id, `${where} is missing the "${role}" role`);
      else if (!HEX.test(hex)) bad(id, `${where}.roles.${role} is "${hex}", not a #rrggbb hex`);
    }
  });

  const palette = get(a, 'color.palette');
  if (!Array.isArray(palette) || !palette.length) bad(id, 'has an empty palette');
  else palette.forEach((c, i) => {
    if (!c.name) bad(id, `color.palette[${i}] has no name`);
    if (!HEX.test(c.hex)) bad(id, `color.palette[${i}] ("${c.name}") is "${c.hex}", not a #rrggbb hex`);
  });

  // A shadowless aesthetic stores a ZERO shadow, never `none`: shadows get
  // composed into lists, and `none` is only legal as the sole value of the
  // property. Starprint is the one this bit.
  for (const k of ['shadow', 'shadowLg']) {
    const s = String(get(a, `elevation.${k}`) || '');
    if (/\bnone\b/.test(s)) bad(id, `elevation.${k} is "${s}" — a shadowless aesthetic stores a zero shadow, never "none"`);
  }

  // Two entries for one aesthetic is the mistake that is easiest to make and
  // hardest to see: the second looks perfectly valid on its own.
  const key = String(a.tagline || '').trim().toLowerCase();
  if (key) {
    if (seen.has(key)) bad(id, `shares its tagline with "${seen.get(key)}" — are these the same aesthetic under two names?`);
    else seen.set(key, id);
  }
}

console.log(`${files.length} aesthetics, ${FIELDS.length} fields each, checked against schema.js`);
if (problems.length) {
  console.error('\n' + problems.map(p => '  ✕ ' + p).join('\n'));
  process.exit(1);
}
console.log('the library answers to the format');
