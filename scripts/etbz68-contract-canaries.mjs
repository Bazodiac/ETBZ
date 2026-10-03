// =============================================================================
// ETBZ-68 — proves the design-review contract test can fail.
//
// Each canary changes one committed file (evidence, corpus, run record or the
// behaviour-map module), runs
// tests/contract/etbz68-design-review-evidence.contract.test.ts, and restores
// the file byte for byte. As in verify-etbz30b-mutations.mjs, a canary names
// its killer: it counts only when the test whose name contains that fragment
// failed with an AssertionError (a load error, a timeout or a thrown test body
// is not a kill). A canary aimed at a refusal of the fixture loader names the
// refusal instead, and counts only when the test file fails to load with that
// message and no test passed in its place.
//
// The run refuses to start on a dirty tree or a red baseline and refuses to
// finish with a dirty tree. The record, docs/evidence/etbz-68/contract-canaries.json,
// is set aside for the run (the child vitest gets ETBZ68_CANARY_RUN=1, the
// only condition under which the contract test accepts its absence) and is
// written at the end, bound to the digests of the contract test and of the
// fixture module it was proven against.
//
//   node scripts/etbz68-contract-canaries.mjs          # run and write the record
//   node scripts/etbz68-contract-canaries.mjs --check  # run; fail unless the record is unchanged (CI)
//
// It mutates repository files while it runs: never run it beside another
// suite in the same working tree.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const TEST = 'tests/contract/etbz68-design-review-evidence.contract.test.ts';
const FIXTURE = 'tests/support/designReviewFixture.ts';
const E = 'docs/evidence/etbz-68';
const CORPUS = `${E}/fixture/placeholder-corpus.v1.json`;
const RECORD = `${E}/contract-canaries.json`;
const CHECK = process.argv.includes('--check');
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function replaceOnce(text, find, replace) {
  const first = text.indexOf(find);
  if (first < 0 || text.indexOf(find, first + 1) >= 0) throw new Error(`"${find.slice(0, 60)}" must occur exactly once`);
  return text.slice(0, first) + replace + text.slice(first + find.length);
}

const text = (find, replace) => (bytes) => Buffer.from(replaceOnce(bytes.toString('utf8'), find, replace), 'utf8');
const corpusEdit = (edit) => (bytes) => {
  const corpus = JSON.parse(bytes.toString('utf8'));
  edit(corpus);
  return Buffer.from(`${JSON.stringify(corpus, null, 2)}\n`, 'utf8');
};

// [name, file, mutation, { killer } | { refusal }]
const CANARIES = [
  ['pdf byte flipped', `${E}/synthetic-design-review.pdf`, (bytes) => { const copy = Buffer.from(bytes); copy[copy.length - 200] ^= 1; return copy; }, { killer: 'binds the PDF' }],
  ['manifest page count edited', `${E}/artifact-manifest.json`, text('"pageCount": 30', '"pageCount": 31'), { killer: 'binds the PDF' }],
  ['page image altered', `${E}/pages/16-chapter-02-p2.png`, (bytes) => Buffer.concat([bytes, Buffer.from([0])]), { killer: 'every committed page image is the one the QA report hashed' }],
  ['corpus sentence edited', CORPUS, text('Weißraum ist kein Rest.', 'Weißraum ist kein Rest!'), { killer: 'regenerates the content, the projection and the behaviour map' }],
  ['chapter 1 cut to two pages', CORPUS, corpusEdit((corpus) => { corpus.composition.chapters[0].paragraphs = corpus.composition.chapters[0].paragraphs.slice(0, 11); }), { killer: 'lays the fixture out on exactly the 30 pages' }],
  ['symbolic word in the corpus', CORPUS, text('Handwerk braucht Zeit.', 'Handwerk braucht Zeit wie ein Pferd.'), { killer: 'hand-authors no symbolic value' }],
  ['toneless pinyin in the corpus', CORPUS, text('Handwerk braucht Zeit.', 'Handwerk braucht Zeit, sagt man in Xin.'), { killer: 'hand-authors no symbolic value' }],
  ['a paragraph recurs in two chapters', CORPUS, corpusEdit((corpus) => {
    const n = corpus.sentences.length;
    const third = corpus.composition.chapters[2];
    let pick = 0;
    for (let p = 0; p < 2; p += 1) pick += third.paragraphs[p];
    // Make chapter 4 open with the one-sentence paragraph chapter 3 prints third.
    const target = (third.offset + pick * third.stride) % n;
    corpus.composition.chapters[3].offset = target;
    corpus.composition.chapters[3].paragraphs = [1, ...corpus.composition.chapters[3].paragraphs];
  }), { killer: 'keeps the chapters from repeating each other' }],
  ['two chapters share a stride', CORPUS, text('"stride": 11,', '"stride": 7,'), { refusal: 'two chapters share a stride' }],
  ['a sentence points back', CORPUS, text('Handwerk braucht Zeit.', 'Danach braucht Handwerk Zeit.'), { refusal: 'starts with an anaphoric connective' }],
  ['moved-whole detector loosened to one baseline', FIXTURE, text('>= 1;\n}', '>= 0;\n}'), { killer: 'regenerates the content, the projection and the behaviour map' }],
  ['carry-over rule narrowed to chapter page 1 blocks', FIXTURE, text(" ||\n        (pageContent.chapterPage === 2 && i === 0 && !fragment.continuedFromPreviousPage)", ''), { killer: 'regenerates the content, the projection and the behaviour map' }],
  ['checklist verdict outside the vocabulary', `${E}/visual-review-checklist.md`, text('Verdict: _pending_', 'Verdict: LOOKS_GOOD'), { killer: 'leaves the verdict to the Product Owner' }],
  ['inside network control never ran', `${E}/run-record.json`, (bytes) => {
    const record = JSON.parse(bytes.toString('utf8'));
    record.networkDenied.controls.inside.pythonIp = { exit: null, output: '' };
    return Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
  }, { killer: 'records the network denial' }],
  ['outside network control failed', `${E}/run-record.json`, text('"output": "connected"', '"output": "error ENOTFOUND"'), { killer: 'records the network denial' }],
];

function runTest() {
  const run = spawnSync('npx', ['vitest', 'run', TEST, '--reporter=json'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, ETBZ68_CANARY_RUN: '1' },
  });
  const output = `${run.stdout}${run.stderr}`;
  const start = run.stdout.indexOf('{');
  if (start < 0) return { exit: run.status, passed: 0, failed: [], loaded: false, output };
  const report = JSON.parse(run.stdout.slice(start));
  const results = report.testResults.flatMap((file) => file.assertionResults);
  const failed = results
    .filter((a) => a.status === 'failed')
    .map((a) => ({ test: a.title, assertion: /AssertionError/u.test(a.failureMessages.join('\n')) }));
  return { exit: run.status, passed: results.filter((a) => a.status === 'passed').length, failed, loaded: results.length > 0, output };
}

function dirtyLines() {
  return spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.split('\n').filter((line) => line !== '');
}

if (dirtyLines().length > 0) throw new Error(`the tree must be clean before the canaries run:\n${dirtyLines().join('\n')}`);
const previous = existsSync(RECORD) ? readFileSync(RECORD) : null;
if (previous !== null) rmSync(RECORD);

let record;
try {
  const baseline = runTest();
  if (baseline.exit !== 0 || baseline.failed.length > 0 || !baseline.loaded) throw new Error(`baseline is red, refusing to run: exit ${String(baseline.exit)}`);

  const results = [];
  for (const [name, file, mutate, expectation] of CANARIES) {
    const original = readFileSync(file);
    const mutated = mutate(original);
    if (digest(mutated) === digest(original)) throw new Error(`${name}: the mutation did not change the file`);
    writeFileSync(file, mutated);
    try {
      const run = runTest();
      if (expectation.refusal !== undefined) {
        results.push({ canary: name, file, expectedRefusal: expectation.refusal, killed: !run.loaded && run.exit !== 0 && run.output.includes(expectation.refusal) });
      } else {
        const killers = run.failed.filter((f) => f.assertion).map((f) => f.test);
        results.push({ canary: name, file, killer: expectation.killer, killed: run.loaded && killers.some((test) => test.includes(expectation.killer)), failedTests: killers });
      }
    } finally {
      writeFileSync(file, original);
      if (digest(readFileSync(file)) !== digest(original)) throw new Error(`${name}: restore failed for ${file}`);
    }
  }
  record = {
    recordVersion: 'etbz68-contract-canaries.v2',
    contractTestSha256: digest(readFileSync(TEST)),
    fixtureModuleSha256: digest(readFileSync(FIXTURE)),
    baseline: 'GREEN',
    canaries: results,
  };
} catch (error) {
  if (previous !== null) writeFileSync(RECORD, previous);
  throw error;
}

const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
if (CHECK) {
  if (previous !== null) writeFileSync(RECORD, previous);
  if (previous === null || digest(previous) !== digest(bytes)) {
    process.stdout.write('the committed canary record differs from this run\n');
    process.exitCode = 1;
  }
} else {
  writeFileSync(RECORD, bytes);
}
const stray = dirtyLines().filter((line) => !line.endsWith(RECORD));
if (stray.length > 0) throw new Error(`the tree is dirty after the run:\n${stray.join('\n')}`);
const survivors = record.canaries.filter((r) => !r.killed);
process.stdout.write(`${String(record.canaries.length - survivors.length)}/${String(record.canaries.length)} canaries killed by their named test or refusal\n`);
if (survivors.length > 0) {
  process.stdout.write(`${JSON.stringify(survivors, null, 2)}\n`);
  process.exitCode = 1;
}
