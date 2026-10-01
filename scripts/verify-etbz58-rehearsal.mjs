#!/usr/bin/env node
/**
 * ETBZ-58 — source-mutation proofs for the Pre-Golden rehearsal orchestrator (tests/support/etbz58Rehearsal.ts).
 *
 * For each check the orchestrator adds - the live stage's attestation, readiness and credential gates, the
 * replay's integrity checks, the production-eligibility check and the pin of the facts the reviewed drafts cite -
 * weaken it in exactly one place, run the suites that claim to protect it, and require them to turn RED. The
 * unmutated baseline must be GREEN first.
 *
 * RED means a TEST failed an ASSERTION (the ETBZ-30B semantics): a mutant names its killer and is killed only by
 * that test failing an assertion; a timeout, a load error or a throw inside a test body is not a kill.
 *
 * Not mutated here, each for a stated reason:
 *  - the product chain the orchestrator composes (use case, InterpretationInput, graph, plan, package, acceptance,
 *    projection): its own guards are guards:etbz34/30a/30b/51/52/55/56/57;
 *  - the operator commands (run-etbz58-live.ts, run-etbz58-assemble.ts): they only write what the functions return,
 *    and the contract suite requires the committed files to equal a fresh derivation.
 *
 * Every file is restored from bytes held in memory; the run fails if the tree differs from before.
 *
 *   npm run guards:etbz58
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REHEARSAL = 'tests/support/etbz58Rehearsal.ts';

const T = {
  negative: 'tests/negative/etbz58-rehearsal.negative.test.ts',
  contract: 'tests/contract/etbz58-rehearsal-evidence.contract.test.ts',
};

/** [name, kind, file, find, replace, tests, killer] — kind 'text' (find occurs exactly once) or 'create'. */
const MUTANTS = [
  ["LIVE: a runtime whose attestation did not pass is calculated against", 'text', REHEARSAL,
    "  if (verdict?.status !== 'PASS' || verdict.observation.openapi.status !== 'OBSERVED') {",
    "  if (verdict === null || verdict.observation.openapi.status !== 'OBSERVED') {",
    [T.negative], "sends no calculation to a runtime whose source revision is not the expected one"],
  ["LIVE: readiness is not required", 'text', REHEARSAL,
    "  if (health.status !== 200 || ready.status !== 200) {",
    "  if (health.status !== 200) {",
    [T.negative], "sends no calculation to a runtime that is not ready"],
  ["LIVE: a call without credentials may be answered", 'text', REHEARSAL,
    "  const refused = unauthorisedProbe.status === 401 || unauthorisedProbe.status === 403;",
    "  const refused = unauthorisedProbe.status !== 500;",
    [T.negative], "refuses a runtime that answers a call without credentials"],
  ["REPLAY: response bytes are checked by length only", 'text', REHEARSAL,
    "      if (sha256Of(bytes) !== exchange.responseSha256 || bytes.byteLength !== exchange.byteLength) {",
    "      if (bytes.byteLength !== exchange.byteLength) {",
    [T.negative], "refuses response bytes that are not the recorded ones"],
  ["REPLAY: any request body is answered", 'text', REHEARSAL,
    "      if (sha256Of(body) !== exchange.requestSha256) return refuse(",
    "      if (sha256Of(body) === '') return refuse(",
    [T.negative], "refuses a request body other than the recorded one"],
  ["REPLAY: an unrecorded call is answered with another recording", 'text', REHEARSAL,
    "      const exchange = readback.exchanges.find((candidate) => candidate.path === path);\n      if (exchange === undefined) return refuse(",
    "      const exchange = readback.exchanges.find((candidate) => candidate.path === path) ?? readback.exchanges[0];\n      if (exchange === undefined) return refuse(",
    [T.negative], "refuses a call the run did not record"],
  ["REPLAY: the rehearsal's own refusal is lost in the client's network error", 'text', REHEARSAL,
    "  if (violation !== undefined) throw violation;",
    "  void violation;",
    [T.negative], "refuses response bytes that are not the recorded ones"],
  ["HAND-OFF: an input that is not production-eligible is handed off", 'text', REHEARSAL,
    "  if (!input.productionEligibility.eligible) {",
    "  if (input.productionEligibility.blockers.includes('UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED')) {",
    [T.negative], "does not hand off a chart whose runtime attestation did not pass"],
  ["DRAFTS: the cited facts are not checked on the live chart", 'text', REHEARSAL,
    "  assertDraftFactsHold(model);\n",
    "  void assertDraftFactsHold;\n",
    [T.negative], "refuses a live chart on which a fact the reviewed drafts cite has another value"],
  ["DRAFTS: a cited fact need only exist, not hold its reviewed value", 'text', REHEARSAL,
    "filter(([id, value]) => live.get(id) !== value)",
    "filter(([id]) => !live.has(id))",
    [T.negative], "refuses a live chart on which a fact the reviewed drafts cite has another value"],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz58-mutants-'));
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

const ALL_SUITES = [T.negative, T.contract];
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
