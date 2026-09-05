/* The three ways an aesthetic leaves the studio.

   JSON is the aesthetic — the file that lives in library/ and the one a future
   session is pointed at. CSS is the same numbers wearing tokens, for dropping
   into a project. Markdown is the guide: the story, the philosophy and the
   tokens in one document a person (or a Claude) can read top to bottom and
   then build in the style without asking anything else. */

import { ROLES, rolesOf, variantsOf } from './schema.js';

export const asJSON = (a) => JSON.stringify(a, null, 2) + '\n';

/* Token names are prefixed with the aesthetic's id so two of them can coexist
   on one page — swapping aesthetics is swapping one attribute, not a war over
   --accent. */
const vslug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function asCSS (a) {
  const p = '--' + a.id.replace(/[^a-z0-9-]/g, '');
  const vs = variantsOf(a);
  const r = vs[0].roles;
  const t = a.type;
  const line = (k, v) => `  ${p}-${k}: ${v};`;
  const roles = (set) => ROLES.map(([k]) => line(k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), set[k]));
  const out = [
    `/* ${a.name} — ${a.tagline || 'an aesthetic'} */`,
    `/* Generated from ${a.id}.aesthetic.json — edit the aesthetic, not this. */`,
    ':root {',
    ...roles(r),
    ...a.color.palette.map((s) => line('p-' + s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), s.hex)),
    line('display', t.display.stack),
    line('body', t.body.stack),
    line('mono', t.mono.stack),
    line('display-weight', t.display.weight),
    line('display-style', t.display.style || 'normal'),
    line('display-tracking', t.display.tracking),
    line('display-transform', t.display.transform),
    line('body-weight', t.body.weight),
    line('leading', t.body.lineHeight),
    line('size', t.baseSize + 'px'),
    line('scale', t.scale),
    line('corner', a.shape.corner || 'round'),
    line('r-sm', a.shape.radiusSm + 'px'),
    line('r-md', a.shape.radiusMd + 'px'),
    line('r-lg', a.shape.radiusLg + 'px'),
    line('border', a.shape.border + 'px'),
    line('border-style', a.shape.borderStyle || 'solid'),
    line('unit', a.space.unit + 'px'),
    line('density', a.space.density),
    line('shadow', a.elevation.shadow),
    line('shadow-lg', a.elevation.shadowLg),
    line('gloss', a.effects.gloss),
    line('glass', a.effects.glass + 'px'),
    line('grain', a.effects.grain),
    line('ornament', JSON.stringify(a.decor.ornament || '')),
    line('dividers', a.decor.dividers),
    line('underline', a.decor.underline),
    line('speed', a.motion.speed + 'ms'),
    line('ease', a.motion.easing),
    line('entrance', a.motion.entrance),
    line('stagger', a.motion.stagger + 'ms'),
    line('hover', a.motion.hover),
    line('ambient', a.motion.ambient),
    '}',
  ];
  /* Every variant past the first is a data-variant block, so a page swaps
     colourway by swapping one attribute. The first variant that calls itself
     dark also answers prefers-color-scheme, which is the only thing a browser
     can ask on its own. */
  for (const v of vs.slice(1)) {
    out.push('', `[data-${a.id}-variant="${vslug(v.name)}"] {`, ...roles(v.roles), '}');
  }
  const night = vs.slice(1).find((v) => v.mode === 'dark');
  if (night) {
    out.push('', `/* ${night.name} */`, '@media (prefers-color-scheme: dark) {', '  :root {',
      ...roles(night.roles).map((l) => '  ' + l), '  }', '}');
  }
  return out.join('\n') + '\n';
}

/* The guide. Written to be handed over whole: “build this in Girando” should
   need nothing but this document. */
export function asGuide (a) {
  const vs = variantsOf(a);
  const r = vs[0].roles;
  const list = (xs) => xs.filter(Boolean).map((x) => `- ${x}`).join('\n');
  const roleRows = (set) => ROLES
    .map(([k, label, hint]) => `| ${label} | \`${set[k]}\` | ${hint} |`).join('\n');
  const s = [];
  s.push(`# ${a.name}`);
  if (a.tagline) s.push(`\n*${a.tagline}*`);
  s.push(`\n> Status: ${a.status}${a.lineage ? ` · ${a.lineage}` : ''}`);
  if (a.story) s.push(`\n## The place\n\n${a.story}`);
  if (a.mood.length) s.push(`\nMood: ${a.mood.join(' · ')}`);
  if (a.principles.length) s.push(`\n## Philosophy\n\n${list(a.principles)}`);
  if (a.do.length) s.push(`\n**Do**\n\n${list(a.do)}`);
  if (a.dont.length) s.push(`\n**Don’t**\n\n${list(a.dont)}`);
  if (a.voice.tone || a.voice.samples.length) {
    s.push('\n## Voice');
    if (a.voice.tone) s.push(`\n${a.voice.tone}`);
    if (a.voice.samples.length) s.push(`\nIt would say:\n\n${list(a.voice.samples.map((x) => `“${x}”`))}`);
  }
  s.push('\n## Colour');
  if (vs.length > 1) s.push(`\n${a.name} comes in ${vs.length}: ${vs.map((v) => `**${v.name}** (${v.mode})`).join(', ')}.`);
  for (const v of vs) {
    s.push(`\n### ${vs.length > 1 ? `${a.name} ${v.name}` : 'Roles'}${vs.length > 1 ? ` — ${v.mode}` : ''}\n\n| Role | Hex | Used for |\n| --- | --- | --- |\n${roleRows(v.roles)}`);
  }
  if (a.color.palette.length) {
    s.push(`\nPalette — what things get painted in:\n\n| Name | Hex |\n| --- | --- |\n` +
      a.color.palette.map((p) => `| ${p.name} | \`${p.hex}\` |`).join('\n'));
  }
  s.push(`\n## Type\n
- Display: \`${a.type.display.stack}\` — weight ${a.type.display.weight}${a.type.display.style === 'italic' ? ', italic' : ''}, tracking ${a.type.display.tracking}, ${a.type.display.transform === 'none' ? 'as written' : a.type.display.transform}
- Body: \`${a.type.body.stack}\` — weight ${a.type.body.weight}, line height ${a.type.body.lineHeight}
- Mono: \`${a.type.mono.stack}\`
- Base ${a.type.baseSize}px, scale ${a.type.scale}`);
  s.push(`\n## Shape, space, depth\n
- ${a.shape.corner === 'cut' ? 'Cut (chamfered) corners' : 'Rounded corners'}; radii ${a.shape.radiusSm} / ${a.shape.radiusMd} / ${a.shape.radiusLg} px; borders ${a.shape.border}px ${a.shape.borderStyle}
- Space unit ${a.space.unit}px at density ×${a.space.density}
- Shadow: \`${a.elevation.shadow}\`; lifted: \`${a.elevation.shadowLg}\`
- Effects: gloss ${a.effects.gloss}, glass ${a.effects.glass}px, grain ${a.effects.grain}
- Backdrop: ${a.texture.kind}${a.texture.kind !== 'none' ? ` (\`${a.texture.a}\` / \`${a.texture.b}\` at ${a.texture.alpha})` : ''}${a.texture.notes ? ` — ${a.texture.notes}` : ''}`);
  s.push(`\n## Decor\n
- Ornament: ${a.decor.ornament ? `“${a.decor.ornament}”` : 'none'}; dividers: ${a.decor.dividers}; links underline: ${a.decor.underline}`);
  s.push(`\n## Motion\n
- ${a.motion.speed}ms, \`${a.motion.easing}\`
- Entrance: ${a.motion.entrance}, staggered ${a.motion.stagger}ms apart
- On touch: ${a.motion.hover}; ambient: ${a.motion.ambient}${a.motion.character ? `\n- ${a.motion.character}` : ''}`);
  if (a.notes) s.push(`\n## Notes\n\n${a.notes}`);
  s.push(`\n---\n\nCSS tokens:\n\n\`\`\`css\n${asCSS(a)}\`\`\``);
  s.push(`\nGenerated by the aesthetics studio from \`${a.id}.aesthetic.json\` — the JSON is the source of truth.`);
  return s.join('\n') + '\n';
}

/* ---- design tokens (DTCG) ---------------------------------------------
   A fourth export: the aesthetic as a Design Tokens Community Group file,
   the format Figma, Tokens Studio and Style Dictionary all read. This is a
   generated view, exactly like the CSS — `.aesthetic.json` stays the source
   of truth, and this is lossy on purpose.

   What it carries: colour, type, shape, space, elevation and motion, which
   the spec has real types for. What it doesn't: the story, philosophy, voice
   and do/don't. The spec has no document-level prose — only a `$description`
   per token — and shoving a philosophy into `$extensions`, the bucket the
   spec defines as "the part tools may ignore", would be the wrong home for
   the most load-bearing half of an aesthetic. Hand someone the guide for
   that; hand them this for the numbers.

   The discrete choices (corner, entrance, hover, ambient, dividers, texture)
   *do* go in `$extensions`. They are typeless values rather than prose, and
   a person rebuilding the aesthetic from this file needs them.

   Written against the stable spec (2025.10), where a colour is an object
   with a colourspace and components — not a hex string — and a dimension is
   {value, unit}. Getting that wrong produces a file that looks right and
   validates nowhere. */

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const hex3 = (h) => '#' + h.slice(1).split('').map((c) => c + c).join('');

/* A colour token value. `alpha` is only written when it isn't 1, because the
   spec treats it as optional and a file full of "alpha": 1 reads as noise. */
function colorValue (r, g, b, a = 1) {
  const round = (n) => Math.round(n * 10000) / 10000;
  const hh = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  const out = { colorSpace: 'srgb', components: [round(r), round(g), round(b)], hex: '#' + hh(r) + hh(g) + hh(b) };
  if (a !== 1) out.alpha = round(a);
  return out;
}

/* Parse anything the format actually stores in a colour position: the hexes
   the roles and palette hold, and the rgba()/transparent that turn up inside
   shadow strings. Anything else falls back to opaque black rather than
   emitting a malformed token. */
function cssColor (str) {
  const s = String(str).trim().toLowerCase();
  if (s === 'transparent') return colorValue(0, 0, 0, 0);
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return cssColor(hex3(s));
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) {
    const n = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
    return colorValue(n[0], n[1], n[2]);
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[,/\s]+/).filter(Boolean).map(parseFloat);
    return colorValue(p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1);
  }
  return colorValue(0, 0, 0);
}

const dim = (value, unit = 'px') => ({ value, unit });

/* "12px" / "0" / "-1px" → a dimension. A bare 0 is 0px. */
function len (str) {
  const m = /^(-?[\d.]+)(px|rem)?$/.exec(String(str).trim());
  if (!m) return dim(0);
  return dim(parseFloat(m[1]), m[2] || 'px');
}

/* Tracking is authored in em, which `dimension` doesn't have — it allows px
   and rem only. em on the display face is close enough to rem for a value
   this small, so it converts 1:1 and says so in the token's description. */
function tracking (str) {
  const m = /^(-?[\d.]*)(em|rem|px)?$/.exec(String(str || '0').trim());
  if (!m) return dim(0, 'rem');
  const n = parseFloat(m[1] || '0') || 0;
  return m[2] === 'px' ? dim(n, 'px') : dim(n, 'rem');
}

/* A CSS font stack is one string here and an array in the spec. */
const family = (stack) => String(stack).split(',')
  .map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);

/* The five CSS keywords, plus whatever cubic-bezier() already says. The spec
   has no keyword form — an easing is four numbers or it is nothing. */
const EASINGS = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};
function bezier (str) {
  const s = String(str || 'ease').trim().toLowerCase();
  if (EASINGS[s]) return EASINGS[s];
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    if (p.length === 4 && p.every((n) => !Number.isNaN(n))) return p;
  }
  return EASINGS.ease;
}

/* Split a shadow list on its top-level commas — the ones inside rgba() are
   not separators, which is the whole reason this can't be a .split(','). */
function splitList (str) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of String(str)) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/* One CSS shadow → the spec's five properties. `inset` is not among them, so
   an inset shadow is reported in the token's description and in $extensions
   rather than smuggled into the object as a sixth key — a file that lies
   about which spec it follows is worse than one that loses a bevel. */
function shadowValue (one) {
  const inset = /(^|\s)inset(\s|$)/.test(one);
  let rest = one.replace(/(^|\s)inset(\s|$)/, ' ').trim();
  const cm = /rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|\b[a-z]+\b(?!\s*\()/i.exec(rest);
  const color = cssColor(cm ? cm[0] : '#000000');
  if (cm) rest = (rest.slice(0, cm.index) + rest.slice(cm.index + cm[0].length)).trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  return {
    inset,
    value: {
      color,
      offsetX: len(parts[0] ?? 0),
      offsetY: len(parts[1] ?? 0),
      blur: len(parts[2] ?? 0),
      spread: len(parts[3] ?? 0),
    },
  };
}

/* A shadow token: one object, or an array when the aesthetic composes several
   (Golf 97's bevel is two). */
function shadowToken (str) {
  const parts = splitList(str).map(shadowValue);
  const token = { $value: parts.length === 1 ? parts[0].value : parts.map((p) => p.value) };
  if (parts.some((p) => p.inset)) {
    token.$description = parts.length === 1
      ? 'Authored as an inset shadow; the spec has no inset flag, so it reads here as an outer shadow.'
      : `Authored as ${parts.length} shadows, ${parts.filter((p) => p.inset).length} of them inset — a bevel. The spec has no inset flag.`;
  }
  return token;
}

export function asTokens (a) {
  const vs = variantsOf(a);
  const r = vs[0].roles;
  const t = a.type;

  /* Palette first, so the roles can point at it. A role whose hex is exactly
     a palette colour is emitted as an alias instead of a second copy of the
     same number — which is the tier-1/tier-2 link the format doesn't have
     anywhere else, and the reason it's worth making them match. */
  const palette = {};
  const byHex = {};
  for (const p of a.color.palette || []) {
    const key = slug(p.name) || 'untitled';
    palette[key] = { $value: cssColor(p.hex), $description: p.name };
    if (!byHex[String(p.hex).toLowerCase()]) byHex[String(p.hex).toLowerCase()] = key;
  }

  const role = {};
  for (const [k, label, hint] of ROLES) {
    const hex = String(r[k] || '').toLowerCase();
    const alias = byHex[hex];
    role[slug(k)] = {
      $value: alias ? `{color.palette.${alias}}` : cssColor(r[k]),
      $description: `${label} — ${hint}`,
    };
  }

  const doc = {
    $description: `${a.name}${a.tagline ? ' — ' + a.tagline : ''}. Generated from ${a.id}.aesthetic.json (${a.format}); that file is the source of truth. Colour, type, shape, space, depth and motion are here; the story, philosophy and voice are not — the guide export carries those.`,
    color: { $type: 'color', palette, role },
    font: {
      family: {
        $type: 'fontFamily',
        display: { $value: family(t.display.stack) },
        body: { $value: family(t.body.stack) },
        mono: { $value: family(t.mono.stack) },
      },
      weight: {
        $type: 'fontWeight',
        display: { $value: Number(t.display.weight) || 400 },
        body: { $value: Number(t.body.weight) || 400 },
      },
      size: {
        $type: 'dimension',
        base: { $value: dim(t.baseSize) },
        ...Object.fromEntries([1, 2, 3].map((i) => [`step-${i}`, {
          $value: dim(Math.round(t.baseSize * Math.pow(t.scale, i) * 10) / 10),
          $description: `Base × ${t.scale}^${i} — heading level ${4 - i}.`,
        }])),
      },
      tracking: {
        $type: 'dimension',
        display: { $value: tracking(t.display.tracking), $description: `Authored as ${t.display.tracking || '0em'}; em has no dimension unit in the spec, so it is written here as rem.` },
      },
      'line-height': { $type: 'number', body: { $value: Number(t.body.lineHeight) } },
      scale: { $type: 'number', ratio: { $value: Number(t.scale), $description: 'The ratio each heading step multiplies by.' } },
    },
    radius: {
      $type: 'dimension',
      sm: { $value: dim(a.shape.radiusSm) },
      md: { $value: dim(a.shape.radiusMd) },
      lg: { $value: dim(a.shape.radiusLg) },
    },
    border: {
      width: { $type: 'dimension', $value: dim(a.shape.border) },
      style: { $type: 'strokeStyle', $value: a.shape.borderStyle || 'solid' },
    },
    space: {
      $type: 'dimension',
      unit: { $value: dim(a.space.unit), $description: 'The base spacing step.' },
      gap: { $value: dim(Math.round(a.space.unit * a.space.density * 10) / 10), $description: `Unit × density (${a.space.density}) — the gap actually painted.` },
    },
    elevation: {
      $type: 'shadow',
      shadow: shadowToken(a.elevation.shadow),
      'shadow-lg': shadowToken(a.elevation.shadowLg),
    },
    motion: {
      duration: {
        $type: 'duration',
        speed: { $value: { value: a.motion.speed, unit: 'ms' } },
        stagger: { $value: { value: a.motion.stagger == null ? 40 : a.motion.stagger, unit: 'ms' } },
      },
      easing: {
        $type: 'cubicBezier',
        default: { $value: bezier(a.motion.easing), $description: `Authored as \`${a.motion.easing}\`.` },
      },
    },
    $extensions: {
      /* Everything the spec has no type for. Namespaced, and safe for any
         conforming tool to ignore — but enough to rebuild the aesthetic. */
      'com.timothyvlangas.aesthetics': {
        format: a.format,
        id: a.id,
        name: a.name,
        status: a.status,
        corner: a.shape.corner || 'round',
        effects: { ...a.effects },
        decor: { ...a.decor },
        motion: {
          entrance: a.motion.entrance,
          hover: a.motion.hover,
          ambient: a.motion.ambient,
          easing: a.motion.easing,
        },
        texture: { ...a.texture },
        source: `${a.id}.aesthetic.json`,
      },
    },
  };
  if (vs.length > 1) {
    /* The spec has no modes and no colourways. A file per variant is the
       honest answer, so the rest ride along under the extension rather than
       pretending to be a theme the format can express. `color.role` above is
       the first variant, which is the one a tool will actually read. */
    doc.$extensions['com.timothyvlangas.aesthetics'].variants =
      vs.map((v) => ({ name: v.name, mode: v.mode, roles: { ...v.roles } }));
  }
  return JSON.stringify(doc, null, 2) + '\n';
}
