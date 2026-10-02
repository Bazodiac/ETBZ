#!/usr/bin/env node
/**
 * ETBZ-59 — source-mutation proofs for the Anti-Boilerplate fixture rehearsal: the evaluation withdrawal
 * (src/application/interpretation/feature-set.ts and its input, model and claim consequences; PO decision D-59-1),
 * the deterministic checks (tests/support/etbz59Individuality.ts), the reviewed pins of the case drafts and the bar-C
 * byte pin of an exempted variant readback, and the acceptance boundary naming every chapter outside the word budget
 * (PO decision D-59-3). Each is weakened in exactly one place, and the named test must fail an
 * assertion (the ETBZ-30B semantics). Files are restored from bytes in memory.
 *
 *   npm run guards:etbz59
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FS = 'src/application/interpretation/feature-set.ts';
const INPUT = 'src/application/interpretation/interpretation-input.ts';
const MODEL = 'src/application/horoscope-model.ts';
const CLAIM = 'src/application/interpretation/interpretive-claim.ts';
const IND = 'tests/support/etbz59Individuality.ts';
const CASES = 'tests/support/etbz59Cases.ts';
const READING = 'src/application/skill/skill-reading.ts';
const NEAR_READBACK = 'docs/evidence/etbz-59/variants/near/runtime-readback.json';

const T = {
  withdrawal: 'tests/unit/evaluation-withdrawal.test.ts',
  negative: 'tests/negative/etbz59-individuality.negative.test.ts',
  contract: 'tests/contract/etbz59-individuality-evidence.contract.test.ts',
  reading: 'tests/negative/etbz52-skill-reading.negative.test.ts',
};

/** [name, kind, file, find, replace, tests, killer] — kind 'text' (find occurs exactly once). */
const MUTANTS = [
  ["WITHDRAW: a withdrawn fact stays interpretable", 'text', FS,
    "withdrawn.has(fact.id) ? { ...fact, provisional: true, interpretable: false,",
    "withdrawn.has(fact.id) ? { ...fact, provisional: true, interpretable: true,",
    [T.withdrawal], "excludes exactly the named facts, as provisional, with the withdrawal as the reason"],
  ["WITHDRAW: a theme anchor may be withdrawn", 'text', FS,
    "  if (anchors.length > 0) {",
    "  if (anchors.length > 99) {",
    [T.withdrawal], "refuses the day master, a theme anchor"],
  ["WITHDRAW: an id twice passes", 'text', FS,
    "    if (seen.has(id)) throw new InterpretationError('WITHDRAWAL_DUPLICATE_FACT',",
    "    if (seen.has(id) && id === '') throw new InterpretationError('WITHDRAWAL_DUPLICATE_FACT',",
    [T.withdrawal], "refuses the same id twice"],
  ["WITHDRAW: an unknown-time chart is withdrawn from", 'text', FS,
    "  if (!model.precision.birthTimeKnown || !model.birth.birthTimeKnown) {",
    "  if (!model.precision.birthTimeKnown && model.birth.birthTimeKnown === 'never') {",
    [T.withdrawal], "refuses an unknown-time chart"],
  ["WITHDRAW: withdrawals are stacked", 'text', FS,
    "  if (model.evaluationWithdrawal !== undefined) {",
    "  if (model.evaluationWithdrawal === null) {",
    [T.withdrawal], "refuses a second withdrawal on a withdrawn chart"],
  ["WITHDRAW: no decision reference passes", 'text', FS,
    "  if (reference.trim() === '') {",
    "  if (reference === 'never') {",
    [T.withdrawal], "refuses no reference to the decision"],
  ["WITHDRAW: an id the chart does not carry passes", 'text', FS,
    "    throw new InterpretationError('WITHDRAWAL_UNKNOWN_FACT', `the evaluation withdrawal names",
    "    if (unknown.length > 99) throw new InterpretationError('WITHDRAWAL_UNKNOWN_FACT', `the evaluation withdrawal names",
    [T.withdrawal], "refuses an id the chart does not carry"],
  ["DERIVE: a hand-built withdrawal on an unknown-time chart passes", 'text', FS,
    "  if (!model.precision.birthTimeKnown) {",
    "  if (!model.precision.birthTimeKnown && withdrawal.reference === 'never') {",
    [T.withdrawal], "refuses a hand-built withdrawal on an unknown-time chart"],
  ["DERIVE: a hand-built withdrawal of an unknown fact passes", 'text', FS,
    "    throw new InterpretationError('WITHDRAWAL_UNKNOWN_FACT', `the recorded evaluation withdrawal names",
    "    if (unknown.length > 99) throw new InterpretationError('WITHDRAWAL_UNKNOWN_FACT', `the recorded evaluation withdrawal names",
    [T.withdrawal], "refuses a hand-built model whose recorded withdrawal names a fact the chart does not carry"],
  ["INPUT: a withdrawn chart is production-eligible", 'text', INPUT,
    "  if (model.evaluationWithdrawal !== undefined) {\n    blockers.push('EVALUATION_WITHDRAWAL_PRESENT');",
    "  if (model.evaluationWithdrawal === null) {\n    blockers.push('EVALUATION_WITHDRAWAL_PRESENT');",
    [T.withdrawal], "builds an input that names the withdrawal and is never production-eligible"],
  ["INPUT: a withdrawal is recorded as an assumed time", 'text', INPUT,
    "            ? ('WITHDRAWN_FOR_EVALUATION' as const)",
    "            ? ('ASSUMED_TIME_DERIVED' as const)",
    [T.withdrawal], "builds an input that names the withdrawal and is never production-eligible"],
  ["MODEL: the withdrawal is not part of the canonical text", 'text', MODEL,
    "    ...(model.evaluationWithdrawal === undefined ? {} : { evaluationWithdrawal: model.evaluationWithdrawal }),",
    "    ...({}),",
    [T.withdrawal], "records the withdrawal in the model and its canonical text"],
  ["CLAIM: a withdrawn fact is refused as an assumed time", 'text', CLAIM,
    "          fact.exclusionReason === 'WITHDRAWN_FOR_EVALUATION'",
    "          fact.exclusionReason === 'NEVER'",
    [T.withdrawal], "refuses a claim that cites a withdrawn fact, naming the withdrawal and not an assumed time"],
  ["SWAP: the run binding is not rebound", 'text', IND,
    "    graph = buildInterpretiveClaimGraph({ ...claimGraphDraftOf(source.graph), sourceBriefStructuralHash: context.brief.structuralHash }, context);",
    "    graph = buildInterpretiveClaimGraph(claimGraphDraftOf(source.graph), context);",
    [T.negative], "raises it for the removal case's reading on the source chart"],
  ["SWAP: an accepted re-validation raises no finding", 'text', IND,
    "'the claim graph and plan re-validate against the foil\\'s facts')],",
    "'the claim graph and plan re-validate against the foil\\'s facts')].slice(1),",
    [T.negative], "raises READING_VALIDATES_AGAINST_FOIL for a reading that cites nothing the foil changes"],
  ["SWAP: the plan is not re-validated", 'text', IND,
    "  try {\n    buildMetaNarrativePlan(",
    "  try {\n    if (source.plan === null) buildMetaNarrativePlan(",
    [T.negative], "raises it for the removal case's reading on the source chart"],
  ["6.1: a Δ-dependent claim whose statement survives passes", 'text', IND,
    "statementSurvives: variantStatements.has(statementOf(source.graph, claimId)) }));",
    "statementSurvives: false && variantStatements.has(statementOf(source.graph, claimId)) }));",
    [T.negative], "raises the blocking codes when the variant is the source itself"],
  ["6.1: shared claims are not recorded", 'text', IND,
    "    if (carried.length > 0) findings.push(finding('6.1', 'LEGITIMATE_SHARED_CLAIM',",
    "    if (carried.length > 999) findings.push(finding('6.1', 'LEGITIMATE_SHARED_CLAIM',",
    [T.negative], "passes S against N: the hour claim and the tally claim are recomposed"],
  ["6.3: out-of-cone drift is not seen", 'text', IND,
    "    for (const drifted of sharedClaims.filter((entry) => !entry.carried)) {",
    "    for (const drifted of sharedClaims.filter((entry) => entry.carried && !entry.carried)) {",
    [T.negative], "raises UNRELATED_CLAIM_DRIFTED when an out-of-cone claim is not carried by the variant"],
  ["6.3: an unmoved thesis under a central mutation passes", 'text', IND,
    "  if (cone.thesis && sameStatements(sourceThesis, variantThesis)) {",
    "  if (cone.thesis && !sameStatements(sourceThesis, variantThesis)) {",
    [T.negative], "raises THESIS_UNCHANGED_UNDER_CENTRAL_MUTATION"],
  ["6.1: a coinciding motif core passes", 'text', IND,
    "      if (variantCores.some((other) => sameStatements(core, other))) {",
    "      if (variantCores.some((other) => !sameStatements(core, other) && sameStatements(core, other))) {",
    [T.negative], "raises SHARED_PRIMITIVE_THESIS and SHARED_PRIMITIVE_MOTIF"],
  ["6.1: identical claim graphs pass as individual", 'text', IND,
    "    if (facts.length > 0 && sameStatements(sourceAll, variantAll)) {",
    "    if (facts.length > 99999 && sameStatements(sourceAll, variantAll)) {",
    [T.negative], "raises the blocking codes when the variant is the source itself"],
  ["6.4: a dependent claim counts as blocked without a refusal", 'text', IND,
    "      blockedCode = codeOf(error);",
    "      blockedCode = codeOf(error) === '' ? null : null;",
    [T.negative], "passes S against S⁻: the claim citing the withdrawn relation is blocked and absent"],
  ["6.4: rescue candidates need no position term", 'text', IND,
    "subjectTerms.some((term) => containsTerm(passage.text, term)) && positionTerms.some(",
    "subjectTerms.some((term) => containsTerm(passage.text, term)) || positionTerms.some(",
    [T.negative], "finds a passage only where a withdrawn subject and its position co-occur"],
  ["TERMS: a term matches inside a word", 'text', IND,
    "  return new RegExp(`(?<![\\\\p{L}\\\\p{N}])${escaped}(?![\\\\p{L}\\\\p{N}])`, 'iu').test(text);",
    "  return new RegExp(`${escaped}`, 'iu').test(text);",
    [T.negative], "matches whole words only"],
  ["6.7: short framing counts as a reused sentence", 'text', IND,
    "filter((sentence) => sentence.split(' ').length >= 6);",
    "filter((sentence) => sentence.split(' ').length >= 1);",
    [T.negative], "finds a verbatim interpretive sentence shared by two readings, and ignores short framing"],
  ["PINS: a drifted cited value passes", 'text', CASES,
    "  if (drifted.length > 0) {\n    throw new RehearsalError('REHEARSAL_DRAFT_FACTS_DRIFTED',",
    "  if (drifted.length > 999) {\n    throw new RehearsalError('REHEARSAL_DRAFT_FACTS_DRIFTED',",
    [T.negative], "refuses a chart on which a cited fact has another value than the drafts were reviewed against"],
  ["D-59-3: a length refusal names only the first chapter", 'text', READING,
    "        .filter((entry) => entry.count < CHAPTER_WORD_BUDGET.min || entry.count > CHAPTER_WORD_BUDGET.max);",
    "        .filter((entry) => entry.at === where);",
    [T.reading], "names every chapter outside the budget in one refusal"],
  ["BAR C: an exempted readback changes", 'text', NEAR_READBACK,
    "\"readbackVersion\":\"etbz58-runtime-readback.v1\"",
    "\"readbackVersion\":\"etbz58-runtime-readback.v9\"",
    [T.contract], "pins the exempted files byte for byte"],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz59-mutants-'));
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

const ALL_SUITES = [T.withdrawal, T.negative, T.contract, T.reading];
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
