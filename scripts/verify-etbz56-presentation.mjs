#!/usr/bin/env node
/**
 * ETBZ-56 — source-mutation proofs for the Skill-reading presentation.
 *
 * For each gate of `buildSkillReadingProjection` (bundle identity, the reading
 * accepted again, the package bound to the chart, the visualization specs), the
 * Earthly-Branch animal labels and the every-word check over quotation marks:
 * weaken it in exactly one place, run the suites that claim to protect it, and
 * require them to turn RED. A guard whose removal leaves the suite green is
 * decoration. The unmutated baseline must be GREEN first — otherwise "red"
 * proves nothing.
 *
 * RED means a TEST failed an ASSERTION (the ETBZ-30B semantics). A mutant that
 * names its killer is killed only by that test failing an assertion; a run that
 * times out, fails to load, or throws inside a test body is an error, not a kill.
 *
 * Not mutated here: the renderer (Python, local only) - its gates are proven by
 * tools/pdf-renderer/qa/run_canaries.py, whose record the contract suite checks;
 * and the projection's every-word call (`assertEveryWordPlaced` over
 * `placedBlockText`), which is equivalent to `blockWords` for the paragraphs a
 * payload can carry - the paginator's own check, which does see pull quotes, is
 * mutated instead.
 *
 * Every file is restored from bytes held in memory; the run fails if the tree
 * differs from before.
 *
 *   npm run guards:etbz56
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKILL = 'src/application/presentation/skill-presentation.ts';
const PROJECTION = 'src/application/presentation/projection.ts';
const ANIMALS = 'src/application/presentation/branch-animals.ts';
const LONG_FORM = 'src/application/presentation/long-form.ts';

const T = {
  negative: 'tests/negative/etbz56-skill-presentation.negative.test.ts',
  unit: 'tests/unit/etbz56-branch-animals.test.ts',
  architecture: 'tests/architecture/etbz56-skill-presentation-boundary.test.ts',
  contract: 'tests/contract/etbz56-skill-presentation-evidence.contract.test.ts',
};

/** [name, kind, file, find, replace, tests, killer] — kind 'text' (find occurs exactly once) or 'create'. */
const MUTANTS = [
  ["IDENTITY: the superseded 1.0.0 bundle is presented", 'text', SKILL,
    "export const PRESENTED_SKILL_BUNDLE_VERSIONS = ['1.1.0'] as const;",
    "export const PRESENTED_SKILL_BUNDLE_VERSIONS = ['1.0.0', '1.1.0'] as const;",
    [T.negative], "refuses the superseded 1.0.0 bundle"],
  ["IDENTITY: a bundle need not be its released identity", 'text', SKILL,
    "    assertReleasedSkillContractBundle(bundle);\n",
    "    void bundle;\n",
    [T.negative], "refuses a 1.1.0 bundle that is not its released identity"],
  ["IDENTITY: other Ten-God wording than the template prints passes", 'text', SKILL,
    "  if (structuralHash(bundle.wordingBoundaries.tenGodRelationWording) !== structuralHash(TEN_GOD_RELATION_WORDING)) {",
    "  if (false) {",
    [T.negative], "refuses a bundle whose Ten-God wording or chart terms are not the ones the template prints"],
  ["IDENTITY: a chart term the bundle lacks passes", 'text', SKILL,
    "  const missingTerm = CHART_TERMINOLOGY.find((entry) => !bundleTerms.has(entry.term));",
    "  const missingTerm = CHART_TERMINOLOGY.find((entry) => entry.term === '' && !bundleTerms.has(entry.term));",
    [T.negative], "refuses a bundle whose Ten-God wording or chart terms are not the ones the template prints"],
  ["READING: the recorded hash is not compared", 'text', SKILL,
    "  if (accepted.structuralHash !== recorded) {",
    "  if (false) {",
    [T.negative], "refuses a reading whose content no longer hashes to its recorded hash"],
  ["READING: the reading is not accepted again", 'text', SKILL,
    "  const accepted = acceptSkillReading(draft, { bundle, inputPackage });",
    "  const accepted = { ...(draft as unknown as AcceptedSkillReading), structuralHash: recorded };",
    [T.negative], "surfaces the run boundary refusal unchanged"],
  ["CHART: a package fact may differ from the chart", 'text', SKILL,
    "    if (text === null || text !== fact.value) {",
    "    if (false) {",
    [T.negative], "refuses a chart whose value differs from a package fact"],
  ["CHART: the package and the chart are not bound at all", 'text', SKILL,
    "  assertPackageIsTheChart(model, inputPackage);\n",
    "\n",
    [T.negative], "refuses a chart whose value differs from a package fact"],
  ["CHART: the package may name another subject", 'text', SKILL,
    "  if (inputPackage.subject.displayName !== model.displayName || inputPackage.subject.birthTimeKnown !== model.birth.birthTimeKnown) {",
    "  if (false) {",
    [T.negative], "refuses a chart of another subject"],
  ["CHART: the package may carry another slot vocabulary", 'text', SKILL,
    "  if (structuralHash(allowed) !== structuralHash(template)) {",
    "  if (false) {",
    [T.negative], "refuses a package whose slot vocabulary is not the template's"],
  ["SPECS: a spec may bind a slot no page draws", 'text', SKILL,
    "    if (pageNumbers.length === 0 && empty === undefined) {",
    "    if (false) {",
    [T.negative], "refuses a spec over a slot no page draws"],
  ["SPECS: a fact kind the vocabulary does not know passes", 'text', SKILL,
    "      if (!Object.hasOwn(SKILL_FACT_KIND_TO_PAGE_KIND, fact.kind)) {",
    "      if (false) {",
    [T.negative], "refuses a spec over a slot no page draws"],
  ["SPECS: the dominant phase counts as shown", 'text', SKILL,
    "  wu_xing_dominant: null,",
    "  wu_xing_dominant: 'wu_xing_vector',",
    [T.negative], "records where each slot is drawn"],
  ["PROVENANCE: the Skill path records the 1.0.0 Lexicon", 'text', SKILL,
    "    lexicon,\n    skill: { ...identities, visualBindings: bindVisualSpecs",
    "    lexicon: { contractRef: 'terminology-wording-lexicon@1.0.0', confluencePageId: '67600385', confluencePageVersion: '1' },\n    skill: { ...identities, visualBindings: bindVisualSpecs",
    [T.negative], "projects 29 pages recorded under bundle, Skill, Lexicon and reading 1.1.0"],
  ["PROVENANCE: the reading hash is not recorded", 'text', SKILL,
    "    readingStructuralHash: reading.structuralHash,",
    "    readingStructuralHash: '',",
    [T.negative], "projects 29 pages recorded under bundle, Skill, Lexicon and reading 1.1.0"],
  ["BOUNDARY: a third caller builds a bound projection", 'create', 'scripts/etbz56-bypass-mutant.mjs',
    // Assembled, so this script itself is not a caller the boundary test finds.
    `${'project'}${'Presentation'}(model, content, binding);\n`,
    null,
    [T.architecture], "is called only by projection.ts and skill-presentation.ts"],
  ["ANIMALS: the glance page drops the branch animals", 'text', PROJECTION,
    "branch: branchText(pillar.branch) })),",
    "branch: { ...glyphText(pillar.branch), animalLabel: '' } })),",
    [T.unit], "prints the animal of every branch a page shows"],
  ["ANIMALS: the five-phase page prints one word for every branch", 'text', PROJECTION,
    "animalLabel: branchAnimalLabel(glyph.character, 'de'),",
    "animalLabel: 'Tier',",
    [T.unit], "binds each drawn branch glyph to its own animal"],
  ["ANIMALS: the chart's animal label is not held to the table", 'text', PROJECTION,
    "    if (animalLabel !== pillar.tierDe) {",
    "    if (false) {",
    [T.unit], "refuses a chart whose animal label differs from the released table"],
  ["ANIMALS: the table is not held to its released hash", 'text', ANIMALS,
    "  if (released === undefined || released !== actual) {",
    "  if (false) {",
    [T.unit], "refuses a changed label, a reordered table and a label the Sizhu table does not carry"],
  ["ANIMALS: an unknown output language is not refused", 'text', ANIMALS,
    "  if (!(BRANCH_ANIMAL_LOCALES as readonly string[]).includes(locale)) {",
    "  if (false) {",
    [T.unit], "answers each of the twelve branches in German and refuses anything else"],
  ["QUOTES: the paginator strips quotation marks from the placed lines again", 'text', LONG_FORM,
    "    .join(' ')\n    .split(/\\s+/u)\n    .filter((word) => word.length > 0);",
    "    .join(' ')\n    .replace(/[\\u201C\\u201D]/gu, '')\n    .split(/\\s+/u)\n    .filter((word) => word.length > 0);",
    [T.unit], "places a pull quote and German quotation marks and passes the check"],
  ["QUOTES: a pull quote is compared without the marks it is placed in", 'text', LONG_FORM,
    "  return block.kind === 'pullQuote' ? `\\u201C${block.text}\\u201D` : blockWords(block);",
    "  return blockWords(block);",
    [T.unit], "places a pull quote and German quotation marks and passes the check"],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz56-mutants-'));
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
  execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests', 'scripts', 'skill', 'docs'], { encoding: 'utf8' }).trim();
const stateBefore = trackedState();

const ALL_SUITES = [T.negative, T.unit, T.architecture, T.contract];
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
