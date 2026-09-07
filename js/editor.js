/* The studio: a list of aesthetics, a form generated from the schema, and the
   demo — which is the whole page, because the aesthetic is painted onto the
   document root and everything reads its tokens.

   The committed files in library/ are the source of truth. The studio never
   writes them — it can't, it is a static page — so edits live in localStorage
   as a working copy per id, and shipping a change means exporting the JSON
   and committing it (or telling a session to). Revert throws the working copy
   away and the file shows through again. */

import { SECTIONS, ROLES, MODES, blank, upgrade, get, set, rolesOf, variantsOf } from './schema.js';
import { apply, fill, replay } from './preview.js';
import { asJSON, asCSS, asGuide, asTokens } from './export.js';

const KEY = 'aestheticsStudio.v1';
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let LIB = {};            // id → aesthetic, as committed
let ORDER = [];          // library order, then anything born here
let S = { edits: {}, order: [], selected: null, variant: 0, plain: false, tab: 'guide', rack: 'half' };

function load () {
  try { S = { ...S, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch (e) { /* a bad save is a fresh start, not a crash */ }
}
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

const ids = () => [...ORDER, ...S.order.filter((id) => !ORDER.includes(id))];
const current = () => S.edits[S.selected] || LIB[S.selected];
const edited = (id) => !!S.edits[id];

/* First touch forks the committed copy; after that, edits land in the fork. */
function editable () {
  if (!S.edits[S.selected]) S.edits[S.selected] = structuredClone(LIB[S.selected]);
  return S.edits[S.selected];
}

/* ---- the list ---------------------------------------------------------- */

function renderList () {
  $('#list').innerHTML = ids().map((id) => {
    const a = S.edits[id] || LIB[id];
    if (!a) return '';
    return `<button class="who${id === S.selected ? ' on' : ''}" data-id="${esc(id)}">
      <span class="dot" style="background:${esc(rolesOf(a, 0).accent)}"></span>
      <span class="who-name">${esc(a.name)}</span>
      <span class="who-tags">${a.status === 'draft' ? 'draft' : ''}${edited(id) ? ' ·edited' : ''}</span>
    </button>`;
  }).join('');
}

/* ---- the form ---------------------------------------------------------- */

function fieldHTML (f, a) {
  const val = get(a, f.path);
  const id = 'f-' + f.path.replace(/\./g, '-');
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  const label = `<label for="${id}">${esc(f.label)}${hint}</label>`;
  if (f.kind === 'text') {
    return `<div class="field">${label}<input id="${id}" data-path="${f.path}" type="text"
      ${f.mono ? 'class="mono"' : ''} value="${esc(val ?? '')}"></div>`;
  }
  if (f.kind === 'textarea') {
    return `<div class="field">${label}<textarea id="${id}" data-path="${f.path}"
      rows="${f.rows || 3}">${esc(val ?? '')}</textarea></div>`;
  }
  if (f.kind === 'select') {
    return `<div class="field">${label}<select id="${id}" data-path="${f.path}">
      ${f.options.map((o) => `<option${String(o) === String(val) ? ' selected' : ''}>${esc(o)}</option>`).join('')}
    </select></div>`;
  }
  if (f.kind === 'range') {
    return `<div class="field">${label}<span class="rangerow">
      <input id="${id}" data-path="${f.path}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${val}">
      <output>${val}${f.unit || ''}</output></span></div>`;
  }
  if (f.kind === 'color') {
    return `<div class="field">${label}<span class="colorrow">
      <input data-path="${f.path}" type="color" value="${esc(val || '#000000')}">
      <input id="${id}" data-path="${f.path}" class="mono hex" type="text" value="${esc(val ?? '')}">
    </span></div>`;
  }
  if (f.kind === 'lines') {
    return `<div class="field">${label}<textarea id="${id}" data-path="${f.path}" data-kind="lines"
      rows="${Math.max(3, (val || []).length + 1)}">${esc((val || []).join('\n'))}</textarea></div>`;
  }
  if (f.kind === 'swatches') return swatchesHTML(f, a, label);
  if (f.kind === 'variants') return variantsHTML(f, a, label);
  return '';
}

function swatchesHTML (f, a, label) {
  const rows = (a.color.palette || []).map((s, i) => `
    <span class="swrow" data-i="${i}">
      <input type="color" data-sw="hex" data-i="${i}" value="${esc(s.hex)}">
      <input type="text" data-sw="name" data-i="${i}" value="${esc(s.name)}" placeholder="name">
      <input type="text" class="mono hex" data-sw="hex" data-i="${i}" value="${esc(s.hex)}">
      <button class="mini" data-act="sw-del" data-i="${i}" title="remove">×</button>
    </span>`).join('');
  return `<div class="field" id="swatches">${label}${rows}
    <button class="mini wide" data-act="sw-add">Add a colour</button></div>`;
}

/* Every colourway, each with its seven. The first is the default and can't
   be removed — an aesthetic with no colours is not an aesthetic. */
function variantsHTML (f, a, label) {
  const vs = variantsOf(a);
  const block = (v, i) => `
    <div class="variant">
      <span class="vhead">
        <input type="text" data-path="color.variants.${i}.name" value="${esc(v.name)}" placeholder="name">
        <select data-path="color.variants.${i}.mode">
          ${MODES.map((m) => `<option${m === v.mode ? ' selected' : ''}>${m}</option>`).join('')}
        </select>
        ${i ? `<button class="mini" data-act="v-del" data-i="${i}" title="remove this variant">×</button>` : '<span class="hint">default</span>'}
      </span>
      ${ROLES.map(([k, name]) => `
        <span class="swrow">
          <input type="color" data-path="color.variants.${i}.roles.${k}" value="${esc(v.roles[k])}">
          <span class="who-name">${esc(name)}</span>
          <input type="text" class="mono hex" data-path="color.variants.${i}.roles.${k}" value="${esc(v.roles[k])}">
        </span>`).join('')}
      ${['a', 'b'].map((k) => `
        <span class="swrow">
          <input type="color" data-path="color.variants.${i}.texture.${k}" value="${esc((v.texture || a.texture)[k])}">
          <span class="who-name">Backdrop ${k.toUpperCase()}</span>
          <input type="text" class="mono hex" data-path="color.variants.${i}.texture.${k}" value="${esc((v.texture || a.texture)[k])}">
        </span>`).join('')}
    </div>`;
  return `<div class="field" id="variants-field">${label}
    ${vs.map(block).join('')}
    <button class="mini wide" data-act="v-add">Add a variant</button></div>`;
}

function renderForm () {
  const a = current();
  $('#form').innerHTML = SECTIONS.map((sec, i) => `
    <details class="sec"${i < 2 ? ' open' : ''}>
      <summary>${esc(sec.title)}<span class="hint">${esc(sec.blurb)}</span></summary>
      <div class="fields">${sec.fields.map((f) => fieldHTML(f, a)).join('')}</div>
    </details>`).join('');
}

/* ---- the rack ----------------------------------------------------------
   Phone only, and CSS owns the actual heights — this just names the state on
   <html> and keeps the grip's arrow pointing where the next tap goes. The
   demo pane reads the same variable, so both panes move together. */

const RACK = ['half', 'up', 'down'];

function setRack () {
  if (!RACK.includes(S.rack)) S.rack = 'half';
  document.documentElement.dataset.rack = S.rack;
  const g = $('.grip-arrow');
  if (g) g.textContent = S.rack === 'up' ? '▼' : '▲';
  const b = $('.grip');
  if (b) b.setAttribute('aria-label', S.rack === 'up' ? 'Fold the controls away' : 'Open the controls further');
}

/* On a phone the aesthetic list is a horizontal strip, so the selected one
   can sit off-screen. Scroll the strip itself — never scrollIntoView, which
   would move the page and the panes with it. */
function revealSelected () {
  const list = $('#list'); const el = $('.who.on');
  if (!list || !el || list.scrollWidth <= list.clientWidth + 4) return;
  list.scrollTo({ left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
}

/* The demo pane hangs off the bottom of the header, whose height changes when
   the buttons wrap — so measure it rather than guess. */
function measureTop () {
  const t = $('.top');
  if (t) document.documentElement.style.setProperty('--top-h', t.offsetHeight + 'px');
}

/* ---- painting & exports ------------------------------------------------ */

function refresh () {
  const a = current();
  const vs = variantsOf(a);
  if (S.variant >= vs.length) S.variant = 0;
  apply(document.documentElement, a, S.variant);
  document.documentElement.toggleAttribute('data-plain', !!S.plain);
  fill($('#demo'), a, S.variant);
  /* one variant is just the aesthetic; several and the name says which */
  $('#title').textContent = vs.length > 1 ? `${a.name} ${vs[S.variant].name}` : a.name;
  $('#subtitle').textContent = a.tagline || '';
  $('#revert').hidden = !(edited(S.selected) && LIB[S.selected]);
  $('#variants').innerHTML = vs.length > 1
    ? vs.map((v, i) => `<button class="vbtn${i === S.variant ? ' on' : ''}" data-act="variant" data-i="${i}">${esc(v.name)}</button>`).join('')
    : '';
  $('#plainbtn').classList.toggle('on', !!S.plain);
  renderExport();
}

function renderExport () {
  const a = current();
  const text = S.tab === 'json' ? asJSON(a) : S.tab === 'css' ? asCSS(a)
    : S.tab === 'tokens' ? asTokens(a) : asGuide(a);
  $('#out').value = text;
  for (const b of document.querySelectorAll('[data-tab]')) {
    b.classList.toggle('on', b.dataset.tab === S.tab);
  }
}

function download () {
  const a = current();
  const name = S.tab === 'json' ? `${a.id}.aesthetic.json`
    : S.tab === 'css' ? `${a.id}.css`
    : S.tab === 'tokens' ? `${a.id}.tokens.json` : `${a.id}.md`;
  const blob = new Blob([$('#out').value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const el = Object.assign(document.createElement('a'), { href: url, download: name });
  el.click();
  URL.revokeObjectURL(url);
}

/* ---- events ------------------------------------------------------------ */

function onInput (e) {
  const t = e.target;
  if (!t.dataset.sw && !t.dataset.path) return;
  const a = editable();
  if (t.dataset.sw) {                       // palette rows
    const i = +t.dataset.i;
    a.color.palette[i][t.dataset.sw] = t.value;
    syncTwin(t);
  } else {
    let v = t.value;
    if (t.dataset.kind === 'lines') v = v.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (t.type === 'range') { v = +v; const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.value + (unitOf(t.dataset.path) || ''); }
    set(a, t.dataset.path, v);
    if (t.type === 'color' || t.classList.contains('hex')) syncTwin(t);
  }
  save();
  renderList();      // cheap, and the first edit has to raise the ·edited flag
  refresh();
}

/* a colour swatch and its hex text edit the same value; keep them agreeing */
function syncTwin (t) {
  const row = t.closest('.colorrow, .swrow');
  if (!row) return;
  for (const other of row.querySelectorAll('input')) {
    if (other !== t && other.dataset.path === t.dataset.path &&
        (other.type === 'color' ? /^#[0-9a-f]{6}$/i.test(t.value) : true)) other.value = t.value;
    if (t.dataset.sw && other !== t && other.dataset.sw === t.dataset.sw &&
        (other.type === 'color' ? /^#[0-9a-f]{6}$/i.test(t.value) : true)) other.value = t.value;
  }
}

function unitOf (path) {
  for (const sec of SECTIONS) for (const f of sec.fields) if (f.path === path) return f.unit;
  return '';
}

function onClick (e) {
  const t = e.target.closest('[data-act], [data-id], [data-tab]');
  if (!t) return;
  if (t.dataset.id) { S.selected = t.dataset.id; S.variant = 0; save(); boot2(); return; }
  if (t.dataset.tab) { S.tab = t.dataset.tab; save(); renderExport(); return; }
  const a = () => editable();
  switch (t.dataset.act) {
    case 'sw-add':
      a().color.palette.push({ name: 'Untitled', hex: '#888888' });
      break;
    case 'sw-del':
      a().color.palette.splice(+t.dataset.i, 1);
      break;
    case 'variant':
      S.variant = +t.dataset.i; save(); refresh(); return;
    case 'v-add': {
      const vs = variantsOf(a());
      vs.push({ name: 'Untitled', mode: vs[0].mode, roles: { ...vs[0].roles } });
      S.variant = vs.length - 1;
      break;
    }
    case 'v-del':
      variantsOf(a()).splice(+t.dataset.i, 1);
      S.variant = 0;
      break;
    case 'plain':
      S.plain = !S.plain; save(); refresh(); return;
    case 'rack':
      S.rack = RACK[(RACK.indexOf(S.rack) + 1) % RACK.length];
      save(); setRack(); return;
    case 'replay':
      replay($('#demo')); return;
    case 'revert':
      if (!confirm('Throw away every change to this aesthetic and go back to the committed file?')) return;
      delete S.edits[S.selected]; save(); boot2(); return;
    case 'new': {
      const id = 'untitled-' + Math.random().toString(36).slice(2, 7);
      S.edits[id] = blank(id); S.order.push(id); S.selected = id; S.variant = 0;
      save(); boot2(); return;
    }
    case 'fork': {
      const src = current();
      const id = src.id + '-fork';
      S.edits[id] = structuredClone(src);
      S.edits[id].id = id; S.edits[id].name = src.name + ' fork'; S.edits[id].status = 'draft';
      S.order.push(id); S.selected = id; save(); boot2(); return;
    }
    case 'delete':
      if (LIB[S.selected]) return;          // committed ones only revert
      if (!confirm('Delete this aesthetic? It exists nowhere but this browser.')) return;
      delete S.edits[S.selected];
      S.order = S.order.filter((x) => x !== S.selected);
      S.selected = ids()[0]; save(); boot2(); return;
    case 'copy':
      navigator.clipboard.writeText($('#out').value);
      t.textContent = 'Copied'; setTimeout(() => { t.textContent = 'Copy'; }, 1200);
      return;
    case 'download': download(); return;
    case 'import': $('#file').click(); return;
    default: return;
  }
  save();
  renderForm();                             // structural changes redraw the form
  refresh();
}

function onImport (e) {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then((text) => {
    let a;
    try { a = upgrade(JSON.parse(text)); }
    catch (err) { alert('Not an aesthetic: ' + err.message); return; }
    S.edits[a.id] = a;
    if (!ORDER.includes(a.id) && !S.order.includes(a.id)) S.order.push(a.id);
    S.selected = a.id; save(); boot2();
  });
  e.target.value = '';
}

/* ---- boot -------------------------------------------------------------- */

function boot2 () {
  $('#deletebtn').hidden = !!LIB[S.selected];
  renderList(); renderForm(); refresh();
  revealSelected();
  replay($('#demo'));
}

async function boot () {
  load();
  /* working copies saved under an older format get the new fields filled in,
     so a control never comes up reading `undefined` */
  for (const id of Object.keys(S.edits)) S.edits[id] = upgrade(S.edits[id]);
  let index = [];
  try {
    index = await (await fetch('library/index.json')).json();
    const all = await Promise.all(index.map((id) =>
      fetch(`library/${id}.aesthetic.json`).then((r) => r.json())));
    all.forEach((a, i) => { LIB[index[i]] = upgrade(a); });
  } catch (e) {
    $('#list').innerHTML = '<p class="hint">The library didn’t load — serve this over http, not file://.</p>';
  }
  ORDER = index;
  if (!S.selected || !(S.edits[S.selected] || LIB[S.selected])) S.selected = ids()[0];
  setRack();
  measureTop();
  if (globalThis.ResizeObserver) new ResizeObserver(measureTop).observe($('.top'));
  else globalThis.addEventListener('resize', measureTop);
  document.addEventListener('input', onInput);
  document.addEventListener('click', onClick);
  document.addEventListener('change', (e) => {
    if (e.target.id === 'file') onImport(e);
  });
  boot2();
}

boot();
