#!/usr/bin/env node
/**
 * ETBZ-49 — source- and asset-mutation proofs for the visual-system guards.
 *
 * For each guard listed below: weaken it in exactly one place, run the suites
 * that claim to protect it, and require them to turn RED. A guard whose removal
 * leaves the suite green is decoration. The unmutated baseline must be GREEN
 * first — otherwise "red" proves nothing.
 *
 * RED means a TEST failed an ASSERTION. A mutant that only makes a run time
 * out, or that breaks loading or collection, proves nothing about the guard and
 * is reported as an error, never as a kill. A mutant that names its killer is
 * killed only by that test failing an assertion.
 *
 * Three mutation kinds, because this slice guards TypeScript, text assets and
 * binary assets alike:
 *
 *   text    find/replace in a UTF-8 file, restored from the original string
 *   bytes   flip one byte of a binary asset, restored from the original Buffer
 *   create  add a file that must not exist, removed again afterwards
 *
 * Every file is restored from bytes held in memory rather than by `git
 * checkout`, which would also discard any uncommitted repair made while the run
 * was in flight. The run fails if the working tree is not clean at the end.
 *
 *   npm run guards:etbz49
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SYS = 'src/application/visual/visualSystem.ts';
const TOKENS = 'src/application/visual/tokens.ts';
const GLYPHS = 'src/application/visual/glyphs.ts';
const SVG = 'assets/visual-system-v1/glyphs/u7532-jia.svg';
const FONT = 'assets/visual-system-v1/fonts/Inter-Regular.ttf';

const T = {
  unit: 'tests/unit/etbz49-visual-system.test.ts',
  negative: 'tests/negative/etbz49-visual-system.negative.test.ts',
  contract: 'tests/contract/etbz49-visual-assets.contract.test.ts',
  architecture: 'tests/architecture/etbz49-visual-boundary.test.ts',
};

/**
 * [name, kind, file, find|offset|contents, replace, tests, killer?]
 *   kind 'text'   — `find` must occur exactly once
 *   kind 'bytes'  — `find` is a byte offset, `replace` is unused
 *   kind 'create' — `find` is the file contents, `replace` is unused
 */
const MUTANTS = [
  // --- the twenty-seven-asset set is closed -------------------------------------------------
  ['GLYPH: an unknown codepoint silently falls back to a glyph', 'text', SYS,
    "  if (glyph === undefined) {\n    throw new VisualContractError(\n      'DISPLAY_GLYPH_OUT_OF_CONTRACT',",
    "  if (glyph === undefined) {\n    return DISPLAY_GLYPH_SET[0];\n    throw new VisualContractError(\n      'DISPLAY_GLYPH_OUT_OF_CONTRACT',",
    [T.negative], 'refuses'],
  ['GLYPH: a malformed outline is accepted', 'text', SYS,
    "  if (glyph.path.trim() === '' || !glyph.path.trimStart().startsWith('M')) {",
    "  if (false) {",
    [T.negative], 'refuses an empty outline'],
  ['GLYPH: the ink margin is dropped, so a stroke over the edge reads as safe', 'text', SYS,
    '  const margin = DISPLAY_GLYPH_MANIFEST.inkPass.strokeUnits / 2;',
    '  const margin = 0;',
    [T.negative], 'refuses a glyph whose STROKE crosses the edge'],
  ['GLYPH: the clipping check is inverted to non-strict bounds', 'text', SYS,
    '    xMin - margin > vx &&',
    '    xMin - margin >= vx - 1000 &&',
    [T.negative], 'refuses a bounding box that leaves the common box'],

  // --- a phase classifies one region, never a column -----------------------------------------
  ['PHASE: any scope is accepted', 'text', SYS,
    "  if (!(PHASE_SCOPES as readonly string[]).includes(scope)) {",
    "  if (false) {",
    [T.negative], 'refuses scope'],
  ['PHASE: "pillar" is added to the allowed scopes', 'text', SYS,
    "const PHASE_SCOPES: readonly PhaseRegionScope[] = ['stem', 'branch', 'hiddenStem'] as const;",
    "const PHASE_SCOPES = ['stem', 'branch', 'hiddenStem', 'pillar'] as readonly PhaseRegionScope[];",
    [T.negative], 'refuses scope "pillar"'],
  ['PHASE: the pillar container takes the stem phase — a whole-column tint', 'text', SYS,
    "    container: pillar.isDayMaster ? 'paper-200' : 'paper-100',",
    "    container: `phase-${pillar.stemPhase}-field` as CanonicalColorTokenName,",
    [T.unit], 'keeps the pillar container neutral'],
  ['PHASE: Day Master selection becomes a sixth phase', 'text', SYS,
    "  return { container: 'paper-200', edge: 'gold-500', edgeWidthMm: 0.35, isPhase: false };",
    "  return { container: 'paper-200', edge: 'gold-500', edgeWidthMm: 0.35, isPhase: true as false };",
    [T.unit], 'marks the Day pillar by neutral ground and a gold edge'],

  // --- Wu Xing: supplied counts, nothing derived ---------------------------------------------
  ['WUXING: a derived quantity is ignored instead of refused', 'text', SYS,
    '  if (derived.length > 0) {',
    '  if (false) {',
    [T.negative], 'refuses a vector carrying a derived'],
  ['WUXING: the derived-key list is emptied', 'text', SYS,
    "const DERIVED_WU_XING_KEYS = [\n  'dominant',",
    "const DERIVED_WU_XING_KEYS = [\n  '__never__',",
    [T.negative], 'refuses a vector carrying a derived'],
  ['WUXING: the schema tolerates unknown keys', 'text', SYS,
    '  })\n  .strict();',
    '  });',
    [T.negative], 'refuses'],
  ['WUXING: a count may be fractional or negative', 'text', SYS,
    'const WU_XING_COUNT = z.number().int().nonnegative().finite();',
    'const WU_XING_COUNT = z.number();',
    [T.negative], 'refuses'],
  ['WUXING: the transform is no longer monotonic', 'text', SYS,
    '    PHASES.map((phase) => [phase, max === 0 ? 0 : vector[phase] / max]),',
    '    PHASES.map((phase) => [phase, max === 0 ? 0 : 1 - vector[phase] / max]),',
    [T.unit], 'is monotonic'],
  ['WUXING: zero phases are dropped instead of labelled', 'text', SYS,
    '    zeroPhases: PHASES.filter((phase) => vector[phase] === 0),',
    '    zeroPhases: [],',
    [T.unit], 'reports zero as zero in this distribution'],
  ['WUXING: the untouched vector no longer travels with the ratios', 'text', SYS,
    '    transformId: \'pt.linear-max-v1\',\n    vector,',
    '    transformId: \'pt.linear-max-v1\',\n    vector: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },',
    [T.unit], 'carries the untouched vector alongside'],

  // --- excluded semantics ---------------------------------------------------------------------
  ['SHENGKE: a relation is returned instead of refused', 'text', SYS,
    "export function resolveShengKeRelation(from: Phase, to: Phase): never {\n  throw new VisualContractError(",
    "export function resolveShengKeRelation(from: Phase, to: Phase): never {\n  return { from, to } as unknown as never;\n  throw new VisualContractError(",
    [T.negative], 'refuses every relation'],
  ['TYPE: an unknown component resolves through the prototype chain', 'text', SYS,
    '  const component = Object.prototype.hasOwnProperty.call(VISUAL_COMPONENTS, id)\n    ? VISUAL_COMPONENTS[id]\n    : undefined;',
    '  const component = (VISUAL_COMPONENTS as Record<string, unknown>)[id] ?? {};',
    [T.negative], 'refuses'],
  ['SLOT: an unknown slot resolves to an empty binding', 'text', SYS,
    '  if (found === undefined) {',
    '  if (false) {',
    [T.negative], 'refuses'],

  // --- long form ---------------------------------------------------------------------------------
  ['LONGFORM: shrink-to-fit is accepted', 'text', SYS,
    '  if (placement.shrinkToFitApplied === true) {',
    '  if (false) {',
    [T.negative], 'refuses shrink-to-fit'],
  ['LONGFORM: clipping is accepted', 'text', SYS,
    '  if ((placement.clippedRegions?.length ?? 0) > 0) {',
    '  if (false) {',
    [T.negative], 'refuses clipping'],
  ['LONGFORM: overlap is accepted', 'text', SYS,
    '  if ((placement.overlappingRegions?.length ?? 0) > 0) {',
    '  if (false) {',
    [T.negative], 'refuses overlap'],
  ['LONGFORM: dropped words are accepted', 'text', SYS,
    '  if ((placement.droppedWords?.length ?? 0) > 0) {',
    '  if (false) {',
    [T.negative], 'refuses a dropped word'],
  ['LONGFORM: word order is no longer checked, only the count', 'text', SYS,
    '    if (sourceWords[index] !== placedWords[index]) {',
    '    if (false) {',
    [T.negative], 'refuses a layout that placed the words in a different order'],
  ['LONGFORM: the page budget is widened', 'text', SYS,
    '    placement.pages.length < LONG_FORM_PAGE_BUDGET.min ||\n    placement.pages.length > LONG_FORM_PAGE_BUDGET.max',
    '    false',
    [T.negative], 'refuses a chapter laid out across'],
  ['LONGFORM: the widow floor is removed', 'text', SYS,
    '    if (page.lines.length > 0 && page.lines.length < PAGINATION_RULES.orphanMinLines) {',
    '    if (false) {',
    [T.negative], 'refuses a widow page carrying a single line'],

  // --- customer surface -----------------------------------------------------------------------------
  ['CHROME: the hash pattern is removed', 'text', SYS,
    "  { label: 'hash', pattern: /\\bsha256[:=]|\\b[0-9a-f]{40,}\\b/i },",
    "  { label: 'hash', pattern: /__never_matches__/ },",
    [T.negative], 'refuses'],
  ['CHROME: the rule-id pattern is removed, so a future rule id ships', 'text', SYS,
    "  { label: 'rule id', pattern: /\\bpt\\.[a-z0-9-]+-v\\d+\\b/i },",
    "  { label: 'rule id', pattern: /__never_matches__/ },",
    [T.negative], 'catches an unknown rule id'],
  ['CHROME: findings are collected but never raised', 'text', SYS,
    '  if (findings.length > 0) {',
    '  if (false) {',
    [T.negative], 'refuses'],

  // --- the contract equals the assets -------------------------------------------------------------------
  ['CONTRACT: a canonical colour is changed by one digit', 'text', TOKENS,
    '"light": "#FBF9F4"',
    '"light": "#FBF9F5"',
    [T.contract], 'matches every Confluence hex value'],
  ['CONTRACT: a canonical colour token is deleted (19 -> 18)', 'text', TOKENS,
    '  {\n    "name": "rule-200",',
    '  {\n    "name": "__deleted__",',
    [T.contract], 'matches every Confluence hex value'],
  ['CONTRACT: the declared glyph count is lowered', 'text', GLYPHS,
    '"glyphCount": 27,',
    '"glyphCount": 26,',
    [T.contract], 'carries exactly twenty-seven glyphs'],
  ['CONTRACT: a per-glyph digest is altered by one hex character', 'text', GLYPHS,
    '9d118e3b4fb3a2de9c1fc69aead86fe8217407dba9606683cffa01c5c0ef13b6',
    '9d118e3b4fb3a2de9c1fc69aead86fe8217407dba9606683cffa01c5c0ef13b7',
    [T.contract], 'RECOMPUTES every per-glyph digest'],
  ['CONTRACT: a glyph outline is altered', 'text', GLYPHS,
    '"path": "M427 -662L427 -574L258 -574L258 -662Z',
    '"path": "M427 -663L427 -574L258 -574L258 -662Z',
    [T.contract], 'RECOMPUTES every per-glyph digest'],
  ['ASSET: an SVG asset no longer matches the outline the contract carries', 'text', SVG,
    'aria-label="U+7532 CJK UNIFIED IDEOGRAPH-7532"',
    'aria-label="U+7532 CJK UNIFIED IDEOGRAPH-7533"',
    [T.contract], 'rebuilds every SVG asset'],
  ['ASSET: a font binary is no longer the upstream release', 'bytes', FONT,
    200000, null,
    [T.contract], 'is byte-identical to rsms/inter v4.1'],

  // --- the boundary ------------------------------------------------------------------------------------------
  ['BOUNDARY: the HTTP layer imports the visual system', 'create',
    'src/http/__mutation_visual_import__.ts',
    "// TEMPORARY MUTATION - scripts/verify-etbz49-visual-system.mjs, never committed.\nimport { PAGE_FAMILY } from '../application/visual/index.js';\nexport const mutationPages = PAGE_FAMILY.length;\n",
    null, [T.architecture], 'is imported by no module under src/http'],
  ['BOUNDARY: another application module imports the visual system', 'create',
    'src/application/__mutation_visual_consumer__.ts',
    "// TEMPORARY MUTATION - scripts/verify-etbz49-visual-system.mjs, never committed.\nimport { PAGE_FAMILY } from './visual/index.js';\nexport const mutationPages = PAGE_FAMILY.length;\n",
    null, [T.architecture], 'is imported by no OTHER application module'],
  ['PURITY: the visual system reads a clock', 'create',
    'src/application/visual/__mutation_impure__.ts',
    '// TEMPORARY MUTATION - scripts/verify-etbz49-visual-system.mjs, never committed.\nexport const mutationStamp = Date.now();\n',
    null, [T.architecture], 'does not reach for a clock'],
  ['PURITY: the visual system reads the filesystem', 'create',
    'src/application/visual/__mutation_fs__.ts',
    "// TEMPORARY MUTATION - scripts/verify-etbz49-visual-system.mjs, never committed.\nexport const mutationRead = 'readFileSync';\n",
    null, [T.architecture], 'does not reach for the filesystem'],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz49-mutants-'));
const REPORT = join(REPORT_DIR, 'vitest.json');

function run(tests) {
  rmSync(REPORT, { force: true });
  const result = spawnSync(
    'npx',
    ['vitest', 'run', ...tests, '--reporter=json', `--outputFile=${REPORT}`],
    { encoding: 'utf8' },
  );
  if (result.status === null || result.error !== undefined) return { outcome: 'DID_NOT_FINISH' };
  if (result.status === 0) return { outcome: 'GREEN' };
  let report;
  try {
    report = JSON.parse(readFileSync(REPORT, 'utf8'));
  } catch {
    return { outcome: 'NO_REPORT' };
  }
  const failed = (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? []).filter((test) => test.status === 'failed'),
  );
  if (failed.length === 0) return { outcome: 'NO_ASSERTION_FAILED' };
  if (
    failed.some((test) =>
      (test.failureMessages ?? []).some((message) => /timed out/iu.test(message)),
    )
  ) {
    return { outcome: 'TIMEOUT' };
  }
  return {
    outcome: 'RED',
    failed: failed.map((test) => ({
      fullName: test.fullName,
      asserted: (test.failureMessages ?? []).some((message) =>
        message.startsWith('AssertionError'),
      ),
    })),
  };
}

function verdictOf(verdict, killer) {
  if (verdict.outcome === 'GREEN') return 'STAYED GREEN — guard is decoration';
  if (verdict.outcome !== 'RED') return `RUN_ERROR (${verdict.outcome}) — not a proof`;
  if (killer === undefined || killer === null) {
    return `RED (guard holds) <- ${verdict.failed[0].fullName}`;
  }
  const named = verdict.failed.filter((test) => test.fullName.includes(killer));
  const by = named.find((test) => test.asserted);
  if (by !== undefined) return `RED (guard holds) <- ${by.fullName}`;
  return named.length > 0
    ? `RUN_ERROR (KILLER_DID_NOT_ASSERT: "${named[0].fullName}" threw instead of failing an assertion) — not a proof`
    : `RUN_ERROR (KILLED_BY_OTHER_TEST: "${verdict.failed[0].fullName}", expected "${killer}") — not a proof`;
}

/**
 * The working tree as it was BEFORE any mutation. Residue is the DELTA against
 * this, not "the tree is clean": the script has to be runnable on a branch whose
 * work is not committed yet, and a plain cleanliness check would then fail for a
 * reason that has nothing to do with a mutant.
 */
const trackedState = () =>
  execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests', 'assets', 'scripts'], {
    encoding: 'utf8',
  }).trim();
const stateBefore = trackedState();

const ALL_SUITES = [T.unit, T.negative, T.contract, T.architecture];
const baseline = run(ALL_SUITES);
if (baseline.outcome !== 'GREEN') {
  process.stdout.write(
    `BASELINE_NOT_GREEN (${baseline.outcome}): the unmutated suites fail, so a red mutant would prove nothing\n`,
  );
  process.exit(1);
}
process.stdout.write('BASELINE GREEN (unmutated)\n');

const results = [];
for (const [name, kind, file, find, replace, tests, killer] of MUTANTS) {
  let restore;
  try {
    if (kind === 'text') {
      const original = readFileSync(file, 'utf8');
      const occurrences = original.split(find).length - 1;
      if (occurrences !== 1) {
        results.push([name, `SETUP_ERROR (pattern occurs ${occurrences}x in ${file})`]);
        continue;
      }
      writeFileSync(file, original.replace(find, replace));
      restore = () => writeFileSync(file, original);
    } else if (kind === 'bytes') {
      const original = readFileSync(file);
      if (find >= original.length) {
        results.push([name, `SETUP_ERROR (offset ${find} past end of ${file})`]);
        continue;
      }
      const mutated = Buffer.from(original);
      mutated[find] = (mutated[find] + 1) % 256;
      writeFileSync(file, mutated);
      restore = () => writeFileSync(file, original);
    } else if (kind === 'create') {
      if (existsSync(file)) {
        results.push([name, `SETUP_ERROR (${file} already exists)`]);
        continue;
      }
      writeFileSync(file, find);
      restore = () => rmSync(file, { force: true });
    } else {
      results.push([name, `SETUP_ERROR (unknown mutation kind "${kind}")`]);
      continue;
    }

    let verdict;
    try {
      verdict = run(tests);
    } finally {
      restore();
    }
    results.push([name, verdictOf(verdict, killer)]);
  } catch (error) {
    if (restore !== undefined) restore();
    results.push([name, `SETUP_ERROR (${error.message})`]);
  }
}
rmSync(REPORT_DIR, { recursive: true, force: true });

let killed = 0;
for (const [name, outcome] of results) {
  if (outcome.startsWith('RED')) killed += 1;
  process.stdout.write(`${name}\n    ${outcome}\n`);
}

const stateAfter = trackedState();
const residue = stateAfter === stateBefore ? '' : stateAfter;
if (residue.length > 0) {
  process.stdout.write(`MUTATION_RESIDUE (tree differs from before the run):\n${residue}\n`);
}

const after = run(ALL_SUITES);
process.stdout.write(
  `\n${killed}/${MUTANTS.length} mutants killed · baseline after restore: ${after.outcome}\n`,
);

if (killed !== MUTANTS.length || after.outcome !== 'GREEN' || residue.length > 0) {
  process.exit(1);
}
