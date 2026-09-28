#!/usr/bin/env node
/**
 * ETBZ-55 — source-mutation proofs for the PresentationProjection.
 *
 * For each guard of `buildPresentationProjection`, the long-form paginator, the
 * line measurer and the template: weaken it in exactly one place, run the suite
 * that claims to protect it, and require that suite to turn RED. A guard whose
 * removal leaves the suite green is decoration. Where a guard only defends
 * against a defect of the algorithm itself (the paginator's orphan rule, the
 * tolerance, the rounding), the mutant introduces the defect and the killer is
 * the line-for-line oracle against the canonical ETBZ-49 layout. The unmutated
 * baseline must be GREEN first — otherwise "red" proves nothing.
 *
 * RED means a TEST failed an ASSERTION (the ETBZ-30B semantics). A mutant that
 * names its killer is killed only by that test failing an assertion; a run that
 * times out, fails to load, or throws inside a test body is an error, not a kill.
 *
 * Every file is restored from bytes held in memory; the run fails if the tree
 * differs from before. `assertEveryWordPlaced` in the projection has no mutant:
 * it is defence in depth behind the paginator's own every-word check, whose
 * defect mutant ("the last line of a paragraph is dropped") is below.
 *
 *   npm run guards:etbz55
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECTION = 'src/application/presentation/projection.ts';
const LONG_FORM = 'src/application/presentation/long-form.ts';
const MEASURE = 'src/application/presentation/text-measure.ts';
const TEMPLATE = 'src/application/presentation/template.ts';

const T = {
  unit: 'tests/unit/etbz55-presentation.test.ts',
  longForm: 'tests/unit/etbz55-long-form.test.ts',
  negative: 'tests/negative/etbz55-presentation.negative.test.ts',
  contract: 'tests/contract/etbz55-presentation-evidence.contract.test.ts',
};

/** [name, kind, file, find|contents, replace, tests, killer?] — kind 'text' (find occurs exactly once) or 'create'. */
const MUTANTS = [
  // --- the content payload ---------------------------------------------------------------------------------
  ['CONTENT: the payload schema tolerates unknown keys', 'text', PROJECTION,
    'const contentSchema = z.strictObject({', 'const contentSchema = z.object({',
    [T.negative], 'refuses a missing title, an extra key and an empty chapter list'],
  ['CONTENT: double spaces and padding are accepted', 'text', PROJECTION,
    ' && !/ {2}/u.test(text) && text.trim() === text, {', ', {',
    [T.negative], 'refuses text the layout would have to normalise'],
  ['CONTENT: a padded display name is accepted', 'text', PROJECTION,
    "  if (model.displayName.trim() === '' || model.displayName.trim() !== model.displayName) {", '  if (false) {',
    [T.negative], 'refuses a padded or empty display name'],
  ['TIME: an unknown birth time is rendered', 'text', PROJECTION,
    '    !model.birth.birthTimeKnown ||\n    !model.precision.birthTimeKnown ||\n    !model.natal.precision.birthTimeKnown ||',
    '    false ||',
    [T.negative], 'refuses an unknown or provisional birth time'],

  // --- chart values that disagree ------------------------------------------------------------------------------
  ['FACT: BaZi and natal characters may differ', 'text', PROJECTION,
    '    if (pillar.stemHanzi !== natal.stemCn || pillar.branchHanzi !== natal.branchCn) {', '    if (false) {',
    [T.negative], 'refuses a pillar whose BaZi and natal characters differ'],
  ['FACT: the stem element may differ between BaZi and natal', 'text', PROJECTION,
    '    if (natal.stemElement !== stemPhase) mismatch(', '    if (false) mismatch(',
    [T.negative], 'refuses a stem element that differs between the BaZi and natal answers'],
  ['FACT: a stem phase the glyph contract contradicts is accepted', 'text', PROJECTION,
    '  if (glyph.phase !== phase) mismatch(`${where}: the chart places ${character} in ${phase}', '  if (false) mismatch(`${where}: the chart places ${character} in ${phase}',
    [T.negative], 'refuses a stem phase the glyph contract does not give that character'],
  ['FACT: a polarity the glyph contract contradicts is accepted', 'text', PROJECTION,
    '  if (glyph.polarity !== polarity) mismatch(', '  if (false) mismatch(',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a stem pinyin the glyph contract contradicts is accepted', 'text', PROJECTION,
    '  if (glyph.pinyin !== pinyin) mismatch(', '  if (false) mismatch(',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a branch phase the glyph contract contradicts is accepted', 'text', PROJECTION,
    '    if (branchGlyph.phase !== branchPhase) {', '    if (false) {',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a branch pinyin the glyph contract contradicts is accepted', 'text', PROJECTION,
    '    if (branchGlyph.pinyin !== pillar.branchPinyin) mismatch(', '    if (false) mismatch(',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a hidden-stem phase the glyph contract contradicts is accepted', 'text', PROJECTION,
    '      if (glyph.phase !== phase) mismatch(`${at}:', '      if (false) mismatch(`${at}:',
    [T.negative], 'refuses a branch phase, a hidden-stem phase, a polarity or a pinyin'],
  ['FACT: a day pillar with a relation to itself is accepted', 'text', PROJECTION,
    '      if (natal.tenGod !== null) mismatch(', '      if (false) mismatch(',
    [T.negative], 'refuses a day pillar that carries a relation to itself'],
  ['FACT: a Day Master that is not the day stem is accepted', 'text', PROJECTION,
    '  if (dm.stemHanzi !== day.stem.character || model.natal.dayMaster.stemCn !== dm.stemHanzi) {', '  if (false) {',
    [T.negative], 'a Day Master that is not the day stem'],
  ['FACT: a Day Master element or pinyin that differs from the day stem is accepted', 'text', PROJECTION,
    "  if (phaseOfGerman(dm.elementDe, 'dayMaster.elementDe') !== day.stem.phase || dm.stemPinyin !== day.stem.pinyin) {", '  if (false) {',
    [T.negative], 'a Day Master that is not the day stem'],

  // --- chart values that are missing ---------------------------------------------------------------------------
  ['MISSING: a branch without its animal is accepted', 'text', PROJECTION,
    "    if (pillar.tierDe.trim() === '') missing(", '    if (false) missing(',
    [T.negative], 'refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal'],
  ['MISSING: a pillar without hidden stems is accepted', 'text', PROJECTION,
    '    if (natal.hiddenStems.length < 1 || natal.hiddenStems.length > 3) missing(', '    if (false) missing(',
    [T.negative], 'refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal'],
  ['MISSING: a visible stem without its relation is accepted', 'text', PROJECTION,
    '      if (natal.tenGod === null) missing(', '      if (false) missing(',
    [T.negative], 'refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal'],
  ['MISSING: a Wu Xing distribution of four phases is accepted', 'text', PROJECTION,
    '  if (suppliedKeys.length !== PHASES.length) missing(', '  if (false) missing(',
    [T.negative], 'refuses a Wu Xing distribution of four phases'],

  // --- released contracts -----------------------------------------------------------------------------------------
  ['LEXICON: a Ten-God relation without exactly one Lexicon entry is accepted', 'text', PROJECTION,
    '  if (matches.length !== 1) {', '  if (matches.length === 0 && false) {',
    [T.negative], 'refuses a Ten-God relation the Lexicon does not carry'],
  ['LEXICON: the traditional Hanzi form is printed instead of the simplified one', 'text', PROJECTION,
    '  return forms[forms.length - 1] ?? hanzi;', '  return forms[0] ?? hanzi;',
    [T.unit], 'names every Ten-God relation with the Lexicon Hanzi'],
  ['TEMPLATE: the released-identity check compares nothing', 'text', TEMPLATE,
    '  if (released !== binding.structuralHash) {', '  if (false) {',
    [T.negative], 'refuses a template that no longer hashes to its released identity'],
  ['TEMPLATE: a label is edited without a new template version', 'text', TEMPLATE,
    "  continued: ui('Fortsetzung'),", "  continued: ui('weiter'),",
    [T.unit], 'frozen by its released hash'],

  // --- customer text -----------------------------------------------------------------------------------------------
  ['TEXT: prohibited wording is accepted', 'text', PROJECTION,
    '  if (prohibited !== null) {', '  if (false) {',
    [T.negative], 'refuses wording the Lexicon prohibits'],
  ['TEXT: a deferred method is accepted', 'text', PROJECTION,
    '  if (method !== null) {', '  if (false) {',
    [T.negative], 'refuses wording the Lexicon prohibits and a method the profile defers'],
  ['TEXT: evidence chrome is accepted', 'text', PROJECTION,
    '  assertCustomerSurfaceClean(text);\n', '  void text;\n',
    [T.negative], 'refuses evidence chrome on the customer surface'],

  // --- the long form ---------------------------------------------------------------------------------------------------
  ['LONG FORM: the visual contract no longer judges the chapter budget', 'text', PROJECTION,
    '    validateLongFormPlacement(placement);\n', '    void placement;\n',
    [T.negative], 'refuses a chapter outside the long-form word budget'],
  ['LONG FORM: the short final page no longer receives the reference panel', 'text', PROJECTION,
    '      const shortFinal = page.pageNumber === lastPage && fill < 0.6;', '      const shortFinal = page.pageNumber === lastPage && fill < 0;',
    [T.contract], 'regenerates the projection byte for byte'],
  ['LONG FORM: the data note no longer points at the method page', 'text', PROJECTION,
    '  if (model.sourceWarnings.length > 0 && identity !== undefined', '  if (false && identity !== undefined',
    [T.unit], 'points the data note at the method page'],
  ['MEASURE: a word wider than the measure is set anyway', 'text', MEASURE,
    '    if (textWidth(word, styleId) > limit) {', '    if (false) {',
    [T.negative], 'refuses a word wider than its measure'],
  ['MEASURE: an unmeasurable character is measured as a CJK ideograph', 'text', MEASURE,
    '    if (isCjkIdeograph(codepoint)) {', '    if (true) {',
    [T.negative], 'refuses a character the pinned face cannot measure'],
  ['MEASURE: a CJK ideograph is measured narrower than one em', 'text', MEASURE,
    'export const CJK_IDEOGRAPH_ADVANCE_EM = 1;', 'export const CJK_IDEOGRAPH_ADVANCE_EM = 0.9;',
    [T.longForm], 'sets a CJK ideograph in running text one em wide'],
  ['MEASURE: rounding is half-up instead of Python half-even', 'text', MEASURE,
    '  return floor % 2 === 0 ? floor : floor + 1;', '  return floor + 1;',
    [T.longForm], 'rounds like Python'],
  ['MEASURE: a line may run into the tolerance', 'text', MEASURE,
    'export const LINE_TOLERANCE_CP = 300;', 'export const LINE_TOLERANCE_CP = 0;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['MEASURE: the last line of a paragraph is dropped', 'text', MEASURE,
    "  if (current !== '') lines.push(current);\n  return lines;", '  return lines;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['PAGINATE: the widow rule no longer keeps two lines together', 'text', LONG_FORM,
    '        if (remaining - take < 2) take = remaining - 2;', '        if (remaining - take < 0) take = remaining - 2;',
    [T.longForm], 'reproduces the canonical layout of'],
  ['PAGINATE: a subhead no longer keeps with the next two lines', 'text', LONG_FORM,
    '          if (fit < remaining || c.bottom - (y0 + remaining * lead) < 2 * bodyLead) {', '          if (fit < remaining) {',
    [T.longForm], 'reproduces the canonical layout of'],
  ['PAGINATE: the opener band is no longer balanced around an atomic module', 'text', LONG_FORM,
    '    if (page.colmode !== 2) return;', '    return;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['PAGINATE: the opener header band loses its bottom space', 'text', LONG_FORM,
    '  return height + 3 * BASELINE_CP;', '  return height + 2 * BASELINE_CP;',
    [T.longForm], 'lays out fixture-customer-chapter.json exactly'],
  ['PAGINATE: a layout that breaks its own geometry is returned', 'text', LONG_FORM,
    '  if (findings.length > 0) {', '  if (false) {',
    [T.negative], 'refuses a layout that breaks its own geometry'],

  // --- the evidence on disk ---------------------------------------------------------------------------------------------
  ['DATA: a stray file appears in the evidence folder', 'create',
    'docs/evidence/etbz-55/NOTES.md',
    '# TEMPORARY MUTATION - scripts/verify-etbz55-presentation.mjs, never committed.\n',
    null, [T.contract], 'holds exactly the declared files'],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz55-mutants-'));
const REPORT = join(REPORT_DIR, 'vitest.json');

function run(tests) {
  rmSync(REPORT, { force: true });
  const result = spawnSync('npx', ['vitest', 'run', ...tests, '--reporter=json', `--outputFile=${REPORT}`], { encoding: 'utf8' });
  if (result.status === null || result.error !== undefined) return { outcome: 'DID_NOT_FINISH' };
  if (result.status === 0) return { outcome: 'GREEN' };
  let report;
  try {
    report = JSON.parse(readFileSync(REPORT, 'utf8'));
  } catch {
    return { outcome: 'NO_REPORT' };
  }
  const failed = (report.testResults ?? []).flatMap((file) => (file.assertionResults ?? []).filter((test) => test.status === 'failed'));
  if (failed.length === 0) return { outcome: 'NO_ASSERTION_FAILED' };
  if (failed.some((test) => (test.failureMessages ?? []).some((message) => /timed out/iu.test(message)))) return { outcome: 'TIMEOUT' };
  return {
    outcome: 'RED',
    failed: failed.map((test) => ({
      fullName: test.fullName,
      asserted: (test.failureMessages ?? []).some((message) => message.startsWith('AssertionError')),
    })),
  };
}

function verdictOf(verdict, killer) {
  if (verdict.outcome === 'GREEN') return 'STAYED GREEN — guard is decoration';
  if (verdict.outcome !== 'RED') return `RUN_ERROR (${verdict.outcome}) — not a proof`;
  if (killer === undefined || killer === null) return `RED (guard holds) <- ${verdict.failed[0].fullName}`;
  const named = verdict.failed.filter((test) => test.fullName.includes(killer));
  const by = named.find((test) => test.asserted);
  if (by !== undefined) return `RED (guard holds) <- ${by.fullName}`;
  return named.length > 0
    ? `RUN_ERROR (KILLER_DID_NOT_ASSERT: "${named[0].fullName}" threw instead of failing an assertion) — not a proof`
    : `RUN_ERROR (KILLED_BY_OTHER_TEST: "${verdict.failed[0].fullName}", expected "${killer}") — not a proof`;
}

const trackedState = () =>
  execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests', 'scripts', 'docs', 'tools'], { encoding: 'utf8' }).trim();
const stateBefore = trackedState();

const ALL_SUITES = [T.unit, T.longForm, T.negative, T.contract];
const baseline = run(ALL_SUITES);
if (baseline.outcome !== 'GREEN') {
  process.stdout.write(`BASELINE_NOT_GREEN (${baseline.outcome}): the unmutated suites fail, so a red mutant would prove nothing\n`);
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
if (residue.length > 0) process.stdout.write(`MUTATION_RESIDUE (tree differs from before the run):\n${residue}\n`);
const after = run(ALL_SUITES);
process.stdout.write(`\n${killed}/${MUTANTS.length} mutants killed · baseline after restore: ${after.outcome}\n`);
if (killed !== MUTANTS.length || after.outcome !== 'GREEN' || residue.length > 0) process.exit(1);
