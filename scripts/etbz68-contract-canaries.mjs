// =============================================================================
// ETBZ-68 — proves the design-review contract test can fail.
//
// Each canary changes one committed file (evidence, corpus or the behaviour-map
// module), runs tests/contract/etbz68-design-review-evidence.contract.test.ts,
// and restores the file byte for byte. A canary counts as killed only when at
// least one test failed with an AssertionError (a load error, a timeout or a
// thrown test body is not a kill). A canary aimed at a refusal of the fixture
// loader instead names the refusal it expects; it counts only when the test file
// fails to load with exactly that message. The run refuses to start on a red baseline
// and refuses to finish with a dirty tree.
//
// The record, docs/evidence/etbz-68/contract-canaries.json, is removed for the
// duration of the run (the contract test treats it as optional) and written at
// the end, bound to the digests of the contract test and of the fixture module
// it was proven against. Run: node scripts/etbz68-contract-canaries.mjs
// It mutates repository files while it runs: never run it beside another
// suite in the same working tree.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const TEST = 'tests/contract/etbz68-design-review-evidence.contract.test.ts';
const FIXTURE = 'tests/support/designReviewFixture.ts';
const E = 'docs/evidence/etbz-68';
const RECORD = `${E}/contract-canaries.json`;
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function replaceOnce(text, find, replace) {
  const first = text.indexOf(find);
  if (first < 0 || text.indexOf(find, first + 1) >= 0) throw new Error(`"${find.slice(0, 60)}" must occur exactly once`);
  return text.slice(0, first) + replace + text.slice(first + find.length);
}

const text = (find, replace) => (bytes) => Buffer.from(replaceOnce(bytes.toString('utf8'), find, replace), 'utf8');

const CANARIES = [
  ['pdf byte flipped', `${E}/synthetic-design-review.pdf`, (bytes) => { const copy = Buffer.from(bytes); copy[copy.length - 200] ^= 1; return copy; }],
  ['page image altered', `${E}/pages/16-chapter-02-p2.png`, (bytes) => Buffer.concat([bytes, Buffer.from([0])])],
  ['corpus sentence edited', `${E}/fixture/placeholder-corpus.v1.json`, text('Weißraum ist kein Rest.', 'Weißraum ist kein Rest!')],
  ['chapter 1 cut to two pages', `${E}/fixture/placeholder-corpus.v1.json`, text('"offset": 0,', '"offset": 0, "paragraphs-cut": true,')],
  ['symbolic word in the corpus', `${E}/fixture/placeholder-corpus.v1.json`, text('Handwerk braucht Zeit.', 'Handwerk braucht Zeit wie ein Pferd.')],
  ['two chapters share a stride', `${E}/fixture/placeholder-corpus.v1.json`, text('"stride": 11,', '"stride": 7,'), 'two chapters share a stride'],
  ['moved-whole detector loosened to one baseline', FIXTURE, text('>= 1;\n}', '>= 0;\n}')],
  ['checklist verdict outside the vocabulary', `${E}/visual-review-checklist.md`, text('Verdict: _pending_', 'Verdict: LOOKS_GOOD')],
  ['manifest page count edited', `${E}/artifact-manifest.json`, text('"pageCount": 30', '"pageCount": 31')],
];

function runTest() {
  const run = spawnSync('npx', ['vitest', 'run', TEST, '--reporter=json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const start = run.stdout.indexOf('{');
  const output = `${run.stdout}${run.stderr}`;
  if (start < 0) return { exit: run.status, failed: [], loadError: output.slice(-400), output };
  const report = JSON.parse(run.stdout.slice(start));
  const failed = report.testResults.flatMap((file) =>
    file.assertionResults.filter((a) => a.status === 'failed').map((a) => ({ test: a.title, assertion: /AssertionError/u.test(a.failureMessages.join('\n')) })),
  );
  const loadError = report.testResults.some((file) => file.status === 'failed' && file.assertionResults.length === 0) ? 'test file failed to load' : null;
  return { exit: run.status, failed, loadError, output };
}

function treeStatus() {
  return spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim();
}

const previous = existsSync(RECORD) ? readFileSync(RECORD) : null;
if (previous !== null) rmSync(RECORD);
if (treeStatus().split('\n').filter((line) => line !== '' && !line.endsWith(RECORD)).length > 0) {
  throw new Error(`the tree must be clean before the canaries run:\n${treeStatus()}`);
}

const baseline = runTest();
if (baseline.exit !== 0 || baseline.failed.length > 0) {
  if (previous !== null) writeFileSync(RECORD, previous);
  throw new Error(`baseline is red, refusing to run: ${JSON.stringify(baseline)}`);
}

const results = [];
for (const [name, file, mutate, refusal] of CANARIES) {
  const original = readFileSync(file);
  const mutated = mutate(original);
  if (digest(mutated) === digest(original)) throw new Error(`${name}: the mutation did not change the file`);
  writeFileSync(file, mutated);
  try {
    const run = runTest();
    const killers = run.failed.filter((f) => f.assertion).map((f) => f.test);
    const killed = refusal === undefined ? run.loadError === null && killers.length > 0 : run.failed.length === 0 && run.output.includes(refusal);
    results.push({ canary: name, file, killed, ...(refusal === undefined ? { failedTests: killers, loadError: run.loadError } : { expectedRefusal: refusal }) });
  } finally {
    writeFileSync(file, original);
    if (digest(readFileSync(file)) !== digest(original)) throw new Error(`${name}: restore failed for ${file}`);
  }
}

const dirty = treeStatus();
if (dirty !== '' && !(dirty.split('\n').every((line) => line.endsWith(RECORD)))) throw new Error(`the tree is dirty after the run:\n${dirty}`);

const record = {
  recordVersion: 'etbz68-contract-canaries.v1',
  contractTestSha256: digest(readFileSync(TEST)),
  fixtureModuleSha256: digest(readFileSync(FIXTURE)),
  baseline: 'GREEN',
  canaries: results,
};
writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`);
const survivors = results.filter((r) => !r.killed);
process.stdout.write(`${results.length - survivors.length}/${results.length} canaries killed by assertion\n`);
if (survivors.length > 0) {
  process.stdout.write(`${JSON.stringify(survivors, null, 2)}\n`);
  process.exitCode = 1;
}
