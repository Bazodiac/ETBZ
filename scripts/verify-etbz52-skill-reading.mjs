#!/usr/bin/env node
/**
 * ETBZ-52 — source-mutation proofs for the Skill run boundary.
 *
 * For each guard of `acceptSkillReading`, `projectCustomerReading` and
 * `buildSkillInputPackage`: weaken it in exactly one place, run the suites that
 * claim to protect it, and require them to turn RED. A guard whose removal
 * leaves the suite green is decoration. The unmutated baseline must be GREEN
 * first — otherwise "red" proves nothing.
 *
 * RED means a TEST failed an ASSERTION (the ETBZ-30B semantics). A mutant that
 * names its killer is killed only by that test failing an assertion; a run that
 * times out, fails to load, or throws inside a test body is an error, not a kill.
 *
 * Every file is restored from bytes held in memory; the run fails if the tree
 * differs from before.
 *
 *   npm run guards:etbz52
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const READING = 'src/application/skill/skill-reading.ts';
const PACKAGE = 'src/application/skill/skill-package.ts';

const T = {
  unit: 'tests/unit/etbz52-skill-reading.test.ts',
  negative: 'tests/negative/etbz52-skill-reading.negative.test.ts',
  contract: 'tests/contract/etbz52-skill-fixture-run.contract.test.ts',
};

/** [name, kind, file, find|contents, replace, tests, killer?] — kind 'text' (find occurs exactly once) or 'create'. */
const MUTANTS = [
  // --- shape and bindings -------------------------------------------------------------------------
  ['READING: the schema tolerates unknown keys', 'text', READING,
    'const readingDraftSchema = z.strictObject({', 'const readingDraftSchema = z.object({',
    [T.negative], 'refuses an extra top-level key'],
  ['READING: another skill identity is accepted', 'text', READING,
    '  if (reading.skillRef !== SKILL_REF || reading.skillRef !== inputPackage.skillRef) {', '  if (false) {',
    [T.negative], 'refuses another skill identity'],
  ['READING: another bundle identity or hash is accepted', 'text', READING,
    '  if (reading.bundleRef !== bundle.bundleRef || reading.bundleStructuralHash !== bundle.structuralHash || inputPackage.bundleRef !== bundle.bundleRef || inputPackage.bundleStructuralHash !== bundle.structuralHash) {',
    '  if (false) {',
    [T.negative], 'refuses another bundle identity or hash'],
  ['READING: another package, graph or plan is accepted', 'text', READING,
    '    reading.inputPackageStructuralHash !== inputPackage.structuralHash ||\n    reading.claimGraphStructuralHash !== inputPackage.claimGraph.structuralHash ||\n    reading.planStructuralHash !== inputPackage.plan.structuralHash',
    '    false',
    [T.negative], 'refuses a reading produced from another'],
  ['READING: the contract set is no longer checked for drift', 'text', READING,
    '  assertRunEvidenceBound(bundle, { bundleRef: reading.bundleRef, contracts: reading.contracts });',
    '  void bundle;',
    [T.negative], 'refuses a drifted contract set'],

  // --- chapters are the plan ------------------------------------------------------------------------
  ['READING: the chapter count is not compared to the plan', 'text', READING,
    '  if (reading.chapters.length !== planChapters.length) {', '  if (false) {',
    [T.negative], 'refuses a missing chapter'],
  ['READING: chapter id and operation are not compared to the plan', 'text', READING,
    "    if (planned_ === undefined || chapter.chapterRef !== planned_.chapterId || chapter.narrativeOperation !== planned_.narrativeOperation) {",
    '    if (planned_ === undefined) {',
    [T.negative], 'refuses chapters out of order'],
  ['READING: an unknown claim resolves to the first accepted claim', 'text', READING,
    '    const claim = claimById.get(id);\n    if (claim === undefined) {',
    '    const claim = claimById.get(id) ?? inputPackage.claimGraph.claims[0];\n    if (claim === undefined) {',
    [T.negative], 'refuses a claim the accepted graph does not carry'],
  ['READING: a claim outside the chapter plan is accepted', 'text', READING,
    '        if (!chapterClaims.has(claim.claimId)) {', '        if (false) {',
    [T.negative], 'refuses a claim the plan does not place in this chapter'],
  ['READING: an unrendered planned claim is accepted', 'text', READING,
    "      if (!renderedHere.has(claimId)) {\n        throw new SkillRunError('READING_CHAPTER_CLAIM_UNRENDERED'",
    "      if (false) {\n        throw new SkillRunError('READING_CHAPTER_CLAIM_UNRENDERED'",
    [T.negative], 'refuses a chapter that leaves one of its planned claims unrendered'],

  // --- facts ------------------------------------------------------------------------------------------
  ['READING: an unknown fact resolves to the first fact', 'text', READING,
    '    const fact = factById.get(id);\n    if (fact === undefined) {',
    '    const fact = factById.get(id) ?? inputPackage.facts[0];\n    if (fact === undefined) {',
    [T.negative], 'refuses a fact the validated chart does not carry'],
  ['READING: an excluded fact is accepted', 'text', READING,
    '    if (excluded.has(id)) {', '    if (false) {',
    [T.negative], 'refuses a fact the input excludes'],
  ['READING: an ungrounded fact in an interpretive paragraph is accepted', 'text', READING,
    '          if (!grounding.has(fact.id)) {', '          if (false) {',
    [T.negative], 'refuses an interpretive paragraph citing a fact none of its claims'],
  ['READING: an interpretation without claims is accepted', 'text', READING,
    '      if (interpretive && paragraph.claimRefs.length === 0) {', '      if (false) {',
    [T.negative], 'refuses a FACT paragraph without facts, an INTERPRETATION without claims'],
  ['READING: a FACT paragraph without facts is accepted', 'text', READING,
    "      if (paragraph.kind === 'FACT' && paragraph.factRefs.length === 0) {", '      if (false) {',
    [T.negative], 'refuses a FACT paragraph without facts, an INTERPRETATION without claims'],
  ['READING: the posture is not checked against the kind', 'text', READING,
    "      if (interpretive ? paragraph.posture === 'NONE' : paragraph.posture !== 'NONE') {", '      if (false) {',
    [T.negative], 'refuses a posture that does not fit the kind'],
  ['READING: provisionality laundering is accepted', 'text', READING,
    "      if (tentative && paragraph.posture !== 'TENTATIVE') {", '      if (false) {',
    [T.negative], 'refuses a paragraph written as certain over a provisional fact'],

  // --- text -------------------------------------------------------------------------------------------
  ['READING: uncited symbols are accepted', 'text', READING,
    '      if (uncitedSymbols.length > 0) {', '      if (false) {',
    [T.negative], 'refuses a chart symbol no cited fact carries'],
  ['READING: uncited numerals are accepted', 'text', READING,
    '      if (uncitedNumerals.length > 0) {', '      if (false) {',
    [T.negative], 'refuses a number no cited fact carries'],
  ['READING: prohibited wording is accepted', 'text', READING,
    '  if (prohibited !== null) {', '  if (false) {',
    [T.negative], 'refuses prohibited wording'],
  ['READING: deferred-method vocabulary is accepted', 'text', READING,
    '  if (method !== null) {', '  if (false) {',
    [T.negative], 'refuses the vocabulary of a deferred method'],
  ['READING: evidence chrome on the customer surface is accepted', 'text', READING,
    "  if (chrome !== null) {\n    throw new SkillRunError('READING_EVIDENCE_CHROME', `${where} carries",
    "  if (false) {\n    throw new SkillRunError('READING_EVIDENCE_CHROME', `${where} carries",
    [T.negative], 'refuses evidence chrome on the customer surface'],
  ['READING: the word budget is not enforced', 'text', READING,
    '    if (words < CHAPTER_WORD_BUDGET.min || words > CHAPTER_WORD_BUDGET.max) {', '    if (false) {',
    [T.negative], 'refuses a chapter under and over the long-form word budget'],

  // --- narrative discipline ------------------------------------------------------------------------------
  ['READING: a chapter without semantic delta is accepted', 'text', READING,
    '    if (chapter.semanticDelta.length === 0) {', '    if (false) {',
    [T.negative], 'refuses a chapter without a declared semantic delta'],
  ['READING: a delta over an unrendered claim is accepted', 'text', READING,
    "        if (!renderedHere.has(claimId)) {\n          throw new SkillRunError('READING_DELTA_CLAIM_NOT_RENDERED'",
    "        if (false) {\n          throw new SkillRunError('READING_DELTA_CLAIM_NOT_RENDERED'",
    [T.negative], 'refuses a delta over a claim the chapter does not render'],
  ['READING: NEW_CLAIM after an earlier rendering is accepted', 'text', READING,
    "        if (delta.kind === 'NEW_CLAIM' && renderedBefore.has(claimId)) {", '        if (false) {',
    [T.negative], 'refuses NEW_CLAIM for a claim an earlier chapter already rendered'],
  ['READING: a NEW_CLAIM callback is accepted', 'text', READING,
    "      if (callback.deltaKind === 'NEW_CLAIM') {", '      if (false) {',
    [T.negative], 'refuses NEW_CLAIM for a claim an earlier chapter already rendered'],
  ['READING: a callback without a prior rendering is accepted', 'text', READING,
    '      if (!renderedBefore.has(callback.claimRef) || !renderedHere.has(callback.claimRef)) {', '      if (false) {',
    [T.negative], 'refuses a callback of a claim no earlier chapter rendered'],
  ['READING: re-rendering without a callback is accepted', 'text', READING,
    '      if (renderedBefore.has(claimId) && !callbackClaims.has(claimId)) {', '      if (false) {',
    [T.negative], 'refuses a claim rendered again without a declared callback delta'],
  ['READING: thesis coverage is not checked', 'text', READING,
    '    if (!renderedAnywhere.has(claimId)) {', '    if (false) {',
    [T.negative], 'refuses a thesis claim no chapter renders'],
  ['READING: a reflection over an unplanned claim is accepted', 'text', READING,
    "      if (!planned.has(claim.claimId)) {\n        throw new SkillRunError('READING_CLAIM_NOT_PLANNED_HERE', `${at} rests on",
    "      if (false) {\n        throw new SkillRunError('READING_CLAIM_NOT_PLANNED_HERE', `${at} rests on",
    [T.negative], 'refuses a reflection question resting on an unplanned claim'],
  ['READING: reflection symbols are not checked', 'text', READING,
    '    if (findUncitedSymbols(question.text, covered).length > 0 || findUncitedNumerals(question.text, covered).length > 0) {',
    '    if (false) {',
    [T.negative], 'refuses a reflection question resting on an unknown claim or naming a symbol'],
  ['READING: the warnings are no longer compared verbatim', 'text', READING,
    '  if (!sameList(reading.methodNote.warningCodes, inputPackage.warnings)) {', '  if (false) {',
    [T.negative], 'refuses a method note that does not carry the source warnings verbatim'],

  // --- visual bindings -----------------------------------------------------------------------------------
  ['READING: an unknown slot is accepted', 'text', READING,
    '    if (!slots.has(spec.slotId)) {', '    if (false) {',
    [T.negative], 'refuses a slot the presentation contract does not declare'],
  ['READING: a spec over an unknown or excluded fact is accepted', 'text', READING,
    '      if (excluded.has(id) || !factById.has(id)) {', '      if (false) {',
    [T.negative], 'refuses a spec over an unknown fact or an unknown claim'],
  ['READING: a spec over an unknown or unplanned claim is accepted', 'text', READING,
    '      if (!claimById.has(id) || !planned.has(id)) {', '      if (false) {',
    [T.negative], 'refuses a spec over an unknown fact or an unknown claim'],
  ['READING: duplicate spec ids are accepted', 'text', READING,
    '    if (specIds.has(spec.specId)) {', '    if (false) {',
    [T.negative], 'refuses two specs with one id'],
  ['PROJECTION: chrome in the customer projection is accepted', 'text', READING,
    "    if (chrome !== null) {\n      throw new SkillRunError('READING_EVIDENCE_CHROME', `the customer projection carries",
    "    if (false) {\n      throw new SkillRunError('READING_EVIDENCE_CHROME', `the customer projection carries",
    [T.negative], 'refuses a forged accepted reading with chrome in the projection'],

  // --- the input package ----------------------------------------------------------------------------------
  ['PACKAGE: a graph under another Method Profile is accepted', 'text', PACKAGE,
    '  if (graph.methodProfileRef !== bundle.repository.methodProfileRef || graph.methodRegistryStructuralHash !== bundle.repository.methodRegistryStructuralHash) {',
    '  if (false) {',
    [T.negative], 'refuses a claim graph accepted under another Method Profile'],
  ['PACKAGE: a graph or plan version the bundle does not bind is accepted', 'text', PACKAGE,
    '  if (graph.graphVersion !== bundle.repository.interpretiveClaimGraphVersion || plan.planVersion !== bundle.repository.metaNarrativePlanVersion) {',
    '  if (false) {',
    [T.negative], 'refuses a claim graph or plan version the bundle does not bind'],
  ['PACKAGE: a plan against another graph is accepted', 'text', PACKAGE,
    '  if (plan.claimGraphStructuralHash !== graph.structuralHash || plan.sourceBriefStructuralHash !== graph.sourceBriefStructuralHash) {',
    '  if (false) {',
    [T.negative], 'refuses a plan accepted against another claim graph'],
  ['PACKAGE: an input of another feature set is accepted', 'text', PACKAGE,
    '  if (input.validatedChart.featureSetStructuralHash !== graph.featureSetStructuralHash) {', '  if (false) {',
    [T.negative], 'refuses an interpretation input whose feature set'],
  ['PACKAGE: an input under another Method Profile is accepted', 'text', PACKAGE,
    '  if (input.methodProfile.ref !== bundle.repository.methodProfileRef || input.methodProfile.registryStructuralHash !== bundle.repository.methodRegistryStructuralHash) {',
    '  if (false) {',
    [T.negative], 'refuses an interpretation input built under another Method Profile'],
  ['PACKAGE: the Lexicon binding of the plan is no longer compared', 'text', PACKAGE,
    '    plan.terminologyLexicon.contractRef !== lexicon.identity ||\n    plan.terminologyLexicon.confluencePageId !== lexicon.confluencePageId ||\n    plan.terminologyLexicon.confluencePageVersion !== lexicon.confluencePageVersion ||',
    '    false ||',
    [T.negative], 'refuses a plan bound to another Lexicon release'],
  ['PACKAGE: a subject contradicting the input is accepted', 'text', PACKAGE,
    '  if (input.input.birthTimeKnown !== subject.birthTimeKnown || input.precision.birthTimeKnown !== subject.birthTimeKnown) {', '  if (false) {',
    [T.negative], 'refuses a subject that contradicts the input'],
  ['PACKAGE: an empty display name is accepted', 'text', PACKAGE,
    "  if (subject.displayName.trim() === '') {", '  if (false) {',
    [T.negative], 'refuses a subject that contradicts the input'],
  ['PACKAGE: duplicated slot ids are accepted', 'text', PACKAGE,
    '    if (!ID_PATTERN.test(slotId) || seenSlots.has(slotId)) {', '    if (false) {',
    [T.negative], 'refuses a subject that contradicts the input'],
  ['PACKAGE: the raw producer bodies travel with the package', 'text', PACKAGE,
    '    interpretationInputStructuralHash: input.structuralHash,\n    facts,',
    '    interpretationInputStructuralHash: input.structuralHash,\n    fufire: input.fufire,\n    facts,',
    [T.unit], 'carries no raw producer body'],

  // --- the package on disk ---------------------------------------------------------------------------------
  ['DATA: a stray file appears in the skill package', 'create',
    'skill/bazodiac-interpretation-skill-v1/NOTES.md',
    '# TEMPORARY MUTATION - scripts/verify-etbz52-skill-reading.mjs, never committed.\n',
    null, [T.contract], 'ships exactly the declared files'],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz52-mutants-'));
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

const ALL_SUITES = [T.unit, T.negative, T.contract];
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
