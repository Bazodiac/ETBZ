#!/usr/bin/env node
// =============================================================================
// ETBZ-55 - project the pinned Inter faces into advance-width tables.
//
// The PresentationProjection decides every long-form line break itself, in
// integer centipoints, so that the page-break structure is a property of the
// projection (verified in CI) and never of a browser. Measuring a line needs
// the advance widths of the face that will set it. The application layer may
// not read files, so - exactly like the ETBZ-49 visual contract - the metrics
// travel as values: this script reads the committed TrueType binaries under
// assets/visual-system-v1/fonts/ and writes them into
// src/application/presentation/font-metrics.ts. Nothing is computed beyond
// reading the tables; the contract suite re-runs the script into a temporary
// directory and requires a byte-identical result.
//
// Only the codepoints a German / Latin customer text and tone-marked pinyin can
// use are projected (Basic Latin, Latin-1, Latin Extended-A/B, general
// punctuation, the euro sign) - and of those only the ones the face carries.
// A character outside the table is refused by the measurer, never guessed.
//
//   node scripts/etbz55-generate-font-metrics.mjs            # write
//   node scripts/etbz55-generate-font-metrics.mjs --out DIR  # write elsewhere
// =============================================================================

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = resolve(REPO_ROOT, 'assets/visual-system-v1/fonts');

const outFlagIndex = process.argv.indexOf('--out');
const OUT_DIR =
  outFlagIndex === -1
    ? resolve(REPO_ROOT, 'src/application/presentation')
    : resolve(process.cwd(), process.argv[outFlagIndex + 1] ?? '.');

/** The faces the long-form layout sets text in: face id -> committed file. */
const FACES = [
  ['regular', 'Inter', 400, 'Inter-Regular.ttf'],
  ['medium', 'Inter', 500, 'Inter-Medium.ttf'],
  ['displayLight', 'Inter Display', 300, 'InterDisplay-Light.ttf'],
];

const RANGES = [
  [0x0020, 0x007e],
  [0x00a0, 0x024f],
  [0x2010, 0x2027],
  [0x2030, 0x203a],
  [0x20ac, 0x20ac],
];

function tableDirectory(buffer) {
  const count = buffer.readUInt16BE(4);
  const tables = new Map();
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    const tag = buffer.toString('latin1', at, at + 4);
    tables.set(tag, { offset: buffer.readUInt32BE(at + 8), length: buffer.readUInt32BE(at + 12) });
  }
  return tables;
}

function requireTable(tables, tag, file) {
  const table = tables.get(tag);
  if (table === undefined) throw new Error(`${file}: table ${tag} missing`);
  return table;
}

/** Unicode cmap (format 4 or 12) -> Map<codepoint, glyphId>. */
function readCmap(buffer, table, file) {
  const base = table.offset;
  const subtables = buffer.readUInt16BE(base + 2);
  let chosen = null;
  for (let index = 0; index < subtables; index += 1) {
    const at = base + 4 + index * 8;
    const platform = buffer.readUInt16BE(at);
    const encoding = buffer.readUInt16BE(at + 2);
    const offset = base + buffer.readUInt32BE(at + 4);
    const format = buffer.readUInt16BE(offset);
    const unicode = (platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0;
    if (!unicode) continue;
    if (format === 12) {
      chosen = { format, offset };
      break;
    }
    if (format === 4 && chosen === null) chosen = { format, offset };
  }
  if (chosen === null) throw new Error(`${file}: no Unicode cmap subtable`);
  const map = new Map();
  const { format, offset } = chosen;
  if (format === 12) {
    const groups = buffer.readUInt32BE(offset + 12);
    for (let group = 0; group < groups; group += 1) {
      const at = offset + 16 + group * 12;
      const start = buffer.readUInt32BE(at);
      const end = buffer.readUInt32BE(at + 4);
      const glyph = buffer.readUInt32BE(at + 8);
      for (let codepoint = start; codepoint <= end; codepoint += 1) map.set(codepoint, glyph + (codepoint - start));
    }
    return map;
  }
  const segments = buffer.readUInt16BE(offset + 6) / 2;
  const endsAt = offset + 14;
  const startsAt = endsAt + segments * 2 + 2;
  const deltasAt = startsAt + segments * 2;
  const rangesAt = deltasAt + segments * 2;
  for (let segment = 0; segment < segments; segment += 1) {
    const end = buffer.readUInt16BE(endsAt + segment * 2);
    const start = buffer.readUInt16BE(startsAt + segment * 2);
    const delta = buffer.readInt16BE(deltasAt + segment * 2);
    const rangeOffset = buffer.readUInt16BE(rangesAt + segment * 2);
    for (let codepoint = start; codepoint <= end && codepoint !== 0xffff; codepoint += 1) {
      let glyph;
      if (rangeOffset === 0) {
        glyph = (codepoint + delta) & 0xffff;
      } else {
        const at = rangesAt + segment * 2 + rangeOffset + (codepoint - start) * 2;
        glyph = buffer.readUInt16BE(at);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) map.set(codepoint, glyph);
    }
  }
  return map;
}

function readFace(file) {
  const buffer = readFileSync(resolve(FONTS, file));
  const tables = tableDirectory(buffer);
  const head = requireTable(tables, 'head', file);
  const hhea = requireTable(tables, 'hhea', file);
  const hmtx = requireTable(tables, 'hmtx', file);
  const os2 = requireTable(tables, 'OS/2', file);
  const unitsPerEm = buffer.readUInt16BE(head.offset + 18);
  const numberOfHMetrics = buffer.readUInt16BE(hhea.offset + 34);
  const ascender = buffer.readInt16BE(os2.offset + 68);
  const descender = buffer.readInt16BE(os2.offset + 70);
  const advanceOf = (glyph) => {
    const index = Math.min(glyph, numberOfHMetrics - 1);
    return buffer.readUInt16BE(hmtx.offset + index * 4);
  };
  const cmap = readCmap(buffer, requireTable(tables, 'cmap', file), file);
  const advances = [];
  for (const [from, to] of RANGES) {
    for (let codepoint = from; codepoint <= to; codepoint += 1) {
      const glyph = cmap.get(codepoint);
      if (glyph === undefined) continue;
      advances.push([codepoint, advanceOf(glyph)]);
    }
  }
  return {
    sha256: `sha256:${createHash('sha256').update(buffer).digest('hex')}`,
    bytes: buffer.length,
    unitsPerEm,
    ascender,
    descender,
    advances,
  };
}

/** Consecutive codepoints collapse into runs: [firstCodepoint, [advance, ...]]. */
function runs(advances) {
  const out = [];
  for (const [codepoint, advance] of advances) {
    const last = out[out.length - 1];
    if (last !== undefined && last[0] + last[1].length === codepoint) last[1].push(advance);
    else out.push([codepoint, [advance]]);
  }
  return out;
}

const lines = [
  '// =============================================================================',
  '// ETBZ-55 - advance widths of the pinned Inter faces.',
  '//',
  '// The long-form layout measures every line against these tables (kerning off,',
  '// ligatures off - the renderer sets lines with the same features disabled), so',
  '// the page-break structure is decided here and verified in CI. A character the',
  '// table does not carry is refused, never replaced.',
  '//',
  '// GENERATED by scripts/etbz55-generate-font-metrics.mjs from',
  '// assets/visual-system-v1/fonts/. Do not edit by hand - re-run the script.',
  '// =============================================================================',
  '',
  "export type FaceId = 'regular' | 'medium' | 'displayLight';",
  '',
  'export interface FaceMetrics {',
  '  readonly family: string;',
  '  readonly weight: number;',
  '  /** Path under assets/visual-system-v1/. */',
  '  readonly file: string;',
  '  readonly sha256: string;',
  '  readonly bytes: number;',
  '  readonly unitsPerEm: number;',
  '  /** OS/2 sTypoAscender / sTypoDescender, font units. */',
  '  readonly ascender: number;',
  '  readonly descender: number;',
  '  /** Runs of consecutive codepoints: [first codepoint, advances in font units]. */',
  '  readonly advanceRuns: readonly (readonly [number, readonly number[]])[];',
  '}',
  '',
  'export const FONT_METRICS: Readonly<Record<FaceId, FaceMetrics>> = {',
];

for (const [id, family, weight, file] of FACES) {
  const face = readFace(file);
  lines.push(`  ${id}: {`);
  lines.push(`    family: ${JSON.stringify(family)},`);
  lines.push(`    weight: ${String(weight)},`);
  lines.push(`    file: ${JSON.stringify(`fonts/${file}`)},`);
  lines.push(`    sha256: ${JSON.stringify(face.sha256)},`);
  lines.push(`    bytes: ${String(face.bytes)},`);
  lines.push(`    unitsPerEm: ${String(face.unitsPerEm)},`);
  lines.push(`    ascender: ${String(face.ascender)},`);
  lines.push(`    descender: ${String(face.descender)},`);
  lines.push('    advanceRuns: [');
  for (const [first, advances] of runs(face.advances)) {
    const chunks = [];
    for (let index = 0; index < advances.length; index += 16) chunks.push(advances.slice(index, index + 16).join(', '));
    lines.push(`      [${String(first)}, [${chunks.join(',\n        ')}]],`);
  }
  lines.push('    ],');
  lines.push('  },');
}
lines.push('};', '');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'font-metrics.ts'), lines.join('\n'), 'utf8');
process.stdout.write(`font-metrics.ts written to ${OUT_DIR}\n`);
