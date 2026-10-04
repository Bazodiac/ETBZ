#!/usr/bin/env node
/**
 * ETBZ-77 (Canon v2, A1) - source-mutation proofs for the 2.0 contract line: the
 * Interpretation Lens v2 and the Terminology & Wording Lexicon v2 beside the
 * unchanged 1.x line (ADR 0019). Each guard is weakened in exactly one place,
 * and the named test must fail an assertion (the ETBZ-30B semantics: a thrown
 * test body, a timeout or a load error is not a kill). Files are restored from
 * bytes in memory, never by `git checkout`.
 *
 * The first three mutants are the ticket's "v2 contract ref -> 1.1 contract ref"
 * (Jira ETBZ-77 DoD), at each place the 2.0 line names its identity.
 *
 *   npm run guards:etbz77
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONTRACTS = 'src/application/skill/canon-v2-contracts.ts';
const SOURCES = 'src/application/skill/contract-sources-v2.ts';
const LENS = 'src/application/skill/semantic-envelope-v2.ts';
const LEXICON_V1_1 = 'src/application/skill/wording-boundaries-v1-1.ts';

const T = {
  unit: 'tests/unit/etbz77-contracts-v2.test.ts',
  negative: 'tests/negative/etbz77-contracts-v2.negative.test.ts',
  contract: 'tests/contract/etbz77-contracts-v2.contract.test.ts',
};
const BINDS_V2 = 'binds the Lens v2 and the Lexicon v2 at their 2.0.0 identities in the 2.0 context, never a 1.x one';

/** [name, kind, file, find, replace, tests, killer] - kind 'text' (find occurs exactly once). */
const MUTANTS = [
  ['LENS REF: the 2.0 context binds the Lens 1.1.0 (v2 ref -> 1.1 ref)', 'text', CONTRACTS,
    "  interpretationLens: {\n    contractRef: 'grounded-reflective-synthesis-lens@2.0.0',\n    confluencePageId: '85229569',\n    confluencePageVersion: '1',\n  },",
    "  interpretationLens: {\n    contractRef: 'grounded-reflective-synthesis-lens@1.1.0',\n    confluencePageId: '77561858',\n    confluencePageVersion: '6',\n  },",
    [T.contract], BINDS_V2],
  ['LEXICON REF: the 2.0 context binds the Lexicon 1.1.0 (v2 ref -> 1.1 ref)', 'text', CONTRACTS,
    "  terminologyLexicon: {\n    contractRef: 'terminology-wording-lexicon@2.0.0',\n    confluencePageId: '85164034',\n    confluencePageVersion: '1',\n  },",
    "  terminologyLexicon: {\n    contractRef: 'terminology-wording-lexicon@1.1.0',\n    confluencePageId: '77529091',\n    confluencePageVersion: '4',\n  },",
    [T.contract], BINDS_V2],
  ['SOURCE REF: the Lens v2 source carries the 1.1.0 identity (v2 ref -> 1.1 ref)', 'text', SOURCES,
    "  identity: 'grounded-reflective-synthesis-lens@2.0.0',",
    "  identity: 'grounded-reflective-synthesis-lens@1.1.0',",
    [T.contract], BINDS_V2],
  ['GATE: a 1.x identity in a 2.0 slot is let through', 'text', CONTRACTS,
    "    if (found.kind === 'OTHER_VERSION') {\n      throw new SkillContractError(\n        'CONTRACT_DRIFT',",
    "    if (found.kind === 'OTHER_VERSION') {\n      continue;\n      throw new SkillContractError(\n        'CONTRACT_DRIFT',",
    [T.negative], 'refuses a 1.1 Lens reference in the 2.0 context'],
  ['IN PLACE: a 1.1 contract file is edited (a comment only - no bundle hash sees it)', 'text', LEXICON_V1_1,
    '// ETBZ-57 - the Terminology & Wording Lexicon customer-voice revision as values.',
    '// ETBZ-57 - the Terminology & Wording Lexicon customer-voice revision as values (edited in place).',
    [T.contract], 'leaves every 1.x contract file byte-identical to main'],
  ['FREEZE: the Lens v2 loses a red line', 'text', LENS,
    "    { lineId: 'RL-8', text: 'Schattensätze greifen nie den Wert der Person an.' },\n",
    '',
    [T.unit], 'freezes Lens v2 and Lexicon v2 by content hash'],
  ['VOICE: the Lens v2 hands voice to another C5 page version', 'text', LENS,
    "    contractRef: 'terminology-wording-lexicon@2.0.0',\n    confluencePageId: '85164034',\n    confluencePageVersion: '1',",
    "    contractRef: 'terminology-wording-lexicon@2.0.0',\n    confluencePageId: '85164034',\n    confluencePageVersion: '2',",
    [T.unit], 'has the Lens hand voice to exactly the Lexicon v2 it is released with'],
  ['COVERAGE: a page section carried by no block passes', 'text', CONTRACTS,
    '  if (uncited.length > 0) {',
    '  if (uncited.length > 99) {',
    [T.negative], 'refuses a C1 section carried by no block'],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz77-mutants-'));
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
    if (kind !== 'text') {
      results.push([name, `SETUP_ERROR (unknown mutation kind "${kind}")`]);
      continue;
    }
    if (!existsSync(file)) {
      results.push([name, `SETUP_ERROR (${file} does not exist)`]);
      continue;
    }
    const original = readFileSync(file, 'utf8');
    const occurrences = original.split(find).length - 1;
    if (occurrences !== 1) {
      results.push([name, `SETUP_ERROR (pattern occurs ${occurrences}x in ${file})`]);
      continue;
    }
    writeFileSync(file, original.replace(find, replace));
    restore = () => writeFileSync(file, original);
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
