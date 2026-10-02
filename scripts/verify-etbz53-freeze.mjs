#!/usr/bin/env node
/**
 * ETBZ-53 — source-mutation proofs for the Golden freeze (tests/support/etbz53GoldenFreeze.ts).
 *
 * Each check the freeze adds - the BirthInput field set, validity and known time before any call, private archive and
 * input, the archived gates, archive drift, the key, keyed digests, the oracle's exit, coverage and agreement before a
 * record exists, and the value guard over the record (with the public pseudonym exempt) - is
 * weakened in exactly one place, and the named negative test must fail an assertion (the ETBZ-30B semantics). The
 * live stage and the replay are ETBZ-58's and proven by guards:etbz58. Files are restored from bytes in memory.
 *
 *   npm run guards:etbz53
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FREEZE = 'tests/support/etbz53GoldenFreeze.ts';

const T = {
  negative: 'tests/negative/etbz53-golden-freeze.negative.test.ts',
  contract: 'tests/contract/etbz53-freeze-record.contract.test.ts',
};

/** [name, kind, file, find, replace, tests, killer] — kind 'text' (find occurs exactly once) or 'create'. */
const MUTANTS = [
  ["INPUT: fields beyond the BirthInput pass", 'text', FREEZE,
    "  if (extra.length > 0) throw new FreezeError('FREEZE_INPUT_EXTRA_FIELDS',",
    "  if (extra.length > 99) throw new FreezeError('FREEZE_INPUT_EXTRA_FIELDS',",
    [T.negative], "refuses a field beyond the BirthInput (a biographical hint) and sends nothing"],
  ["INPUT: an invalid BirthInput reaches the runtime", 'text', FREEZE,
    "  if (!result.ok) {\n    throw new FreezeError('FREEZE_INPUT_INVALID',",
    "  if (!result.ok && extra.length > 99) {\n    throw new FreezeError('FREEZE_INPUT_INVALID',",
    [T.negative], "refuses an invalid BirthInput and sends nothing"],
  ["INPUT: an unknown-time case is frozen", 'text', FREEZE,
    "  if (!result.value.birthTimeKnown) throw new FreezeError('FREEZE_INPUT_NOT_KNOWN_TIME',",
    "  if (result.ok && extra.length > 99) throw new FreezeError('FREEZE_INPUT_NOT_KNOWN_TIME',",
    [T.negative], "refuses an unknown-time BirthInput and sends nothing"],
  ["PRIVATE: a readable archive or input file passes", 'text', FREEZE,
    "  if (loose.length > 0) throw new FreezeError('FREEZE_NOT_PRIVATE',",
    "  if (loose.length > 99) throw new FreezeError('FREEZE_NOT_PRIVATE',",
    [T.negative], "refuses an input file that group or other may read"],
  ["PRIVATE: a key is created in a readable archive", 'text', FREEZE,
    "  if ((statSync(archiveDir).mode & 0o077) !== 0) throw new FreezeError('FREEZE_NOT_PRIVATE', 'group or other may access the archive directory');",
    "  if ((statSync(archiveDir).mode & 0o077) === 0o077) throw new FreezeError('FREEZE_NOT_PRIVATE', 'group or other may access the archive directory');",
    [T.negative], "refuses an archive directory that group or other may read, before any call and before any key exists"],
  ["DRIFT: drifted archived oracle facts pass verify", 'text', FREEZE,
    "  if (archiveMode === 'check' && readFileSync(join(config.archiveDir, 'oracle-facts.json'), 'utf8') !== factsText) {",
    "  if (archiveMode === 'check' && readFileSync(join(config.archiveDir, 'oracle-facts.json'), 'utf8') === '\\u0000') {",
    [T.negative], "re-derives the record offline only from an archive whose gates passed, whose input did not drift, with its key"],
  ["GATES: an archived readback without readiness is recorded", 'text', FREEZE,
    "  if (attestation.status !== 'PASS' || probes.health.status !== 200 || probes.ready.status !== 200 || !probes.unauthorised.refused) {",
    "  if (attestation.status !== 'PASS' || probes.health.status !== 200 || !probes.unauthorised.refused) {",
    [T.negative], "re-derives the record offline only from an archive whose gates passed, whose input did not drift, with its key"],
  ["DRIFT: a drifted archived InterpretationInput passes verify", 'text', FREEZE,
    "  else if (readFileSync(inputPath, 'utf8') !== inputText) throw",
    "  else if (readFileSync(inputPath, 'utf8') === '\\u0000') throw",
    [T.negative], "re-derives the record offline only from an archive whose gates passed, whose input did not drift, with its key"],
  ["KEY: verify creates a key instead of requiring it", 'text', FREEZE,
    "    if (!create) throw new FreezeError('FREEZE_KEY_MISSING',",
    "    if (!create && create) throw new FreezeError('FREEZE_KEY_MISSING',",
    [T.negative], "re-derives the record offline only from an archive whose gates passed, whose input did not drift, with its key"],
  ["KEYED: the response digests do not depend on the key", 'text', FREEZE,
    "  for (const label of EXCHANGE_LABELS) digests[`${label}.response.json`] = keyed(key, responses[label]);",
    "  for (const label of EXCHANGE_LABELS) digests[`${label}.response.json`] = keyed(Buffer.alloc(32), responses[label]);",
    [T.negative], "re-derives the record offline only from an archive whose gates passed, whose input did not drift, with its key"],
  ["ORACLE: a non-zero exit is accepted", 'text', FREEZE,
    "  if (oracle.exitStatus !== 0 || oracle.absent !== 0 || oracle.compared !== facts.length || oracle.equal !== oracle.compared) {",
    "  if (oracle.absent !== 0 || oracle.compared !== facts.length || oracle.equal !== oracle.compared) {",
    [T.negative], "exits non-zero"],
  ["ORACLE: absent facts are accepted", 'text', FREEZE,
    "  if (oracle.exitStatus !== 0 || oracle.absent !== 0 || oracle.compared !== facts.length || oracle.equal !== oracle.compared) {",
    "  if (oracle.exitStatus !== 0 || oracle.compared !== facts.length || oracle.equal !== oracle.compared) {",
    [T.negative], "derives a fact ETBZ did not hand it"],
  ["ORACLE: partial coverage is accepted", 'text', FREEZE,
    "  if (oracle.exitStatus !== 0 || oracle.absent !== 0 || oracle.compared !== facts.length || oracle.equal !== oracle.compared) {",
    "  if (oracle.exitStatus !== 0 || oracle.absent !== 0 || oracle.equal !== oracle.compared) {",
    [T.negative], "compares fewer facts than it was given"],
  ["ORACLE: a disagreement still yields a record", 'text', FREEZE,
    "  if (oracle.exitStatus !== 0 || oracle.absent !== 0 || oracle.compared !== facts.length || oracle.equal !== oracle.compared) {",
    "  if (oracle.exitStatus !== 0 || oracle.absent !== 0 || oracle.compared !== facts.length) {",
    [T.negative], "disagrees on a fact"],
  ["GUARD: the record is not checked for case values", 'text', FREEZE,
    "  assertRecordCarriesNoCaseValue(record, raw);\n",
    "  void assertRecordCarriesNoCaseValue;\n",
    [T.negative], "refuses to produce a record that would carry a value of the case"],
  ["GUARD: a value found in the record is let through", 'text', FREEZE,
    "      for (const { field, value: needle } of caseValues(raw)) if (text.includes(needle)) hits.push(",
    "      for (const { field, value: needle } of caseValues(raw)) if (text === needle + needle) hits.push(",
    [T.negative], "refuses a record that carries a value of the case, naming the field and the path, not the value"],
  ["GUARD: the archive is written readable by others", 'text', FREEZE,
    "  chmodSync(path, 0o600);",
    "  chmodSync(path, 0o644);",
    [T.negative], "freezes a known-time case: archive files mode 600, an eligible InterpretationInput, a record without its values"],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz53-mutants-'));
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
