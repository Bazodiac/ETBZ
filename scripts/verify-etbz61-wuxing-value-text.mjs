#!/usr/bin/env node
/**
 * ETBZ-61 - source-mutation proofs for the Wu Xing weight display text (PO decision D-54-2, Jira ETBZ-54 comment
 * 17123): the projection prints a weight without binary floating-point noise and never rounds a real decimal. Each
 * check is weakened in exactly one place, and the named test must fail an assertion (the ETBZ-30B semantics). Files
 * are restored from bytes in memory.
 *
 * Not listed: removing the guard call from wuXingValueText alone is an equivalent mutant for every finite value (the
 * vector schema admits no other, src/application/visual/visualSystem.ts) - the formatter never produces a text the
 * guard refuses, so the call is its postcondition; ROUND and LOOSE show the guard refusing a formatter that rounds.
 *
 *   npm run guards:etbz61
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECTION = 'src/application/presentation/projection.ts';

const T = {
  value: 'tests/unit/etbz61-wuxing-value-text.test.ts',
  presentation: 'tests/unit/etbz55-presentation.test.ts',
};

/** [name, kind, file, find, replace, tests, killer] - kind 'text' (find occurs exactly once). */
const LOOP = '    if (Math.abs(Number(candidate) - value) <= WUXING_VALUE_NOISE * Math.abs(value)) {';
const MUTANTS = [
  ["PAGES: the projection prints String(value) again", 'text', PROJECTION,
    '        valueText: wuXingValueText(presentation.vector[phase], phase),',
    '        valueText: String(presentation.vector[phase]),',
    [T.value], 'prints the noise-free text on every page that shows a weight'],
  ["NOISE: the formatter keeps every digit", 'text', PROJECTION,
    '  for (let digits = 1; digits < 17; digits += 1) {',
    '  for (let digits = 17; digits < 17; digits += 1) {',
    [T.value], 'drops the representation noise of a floating-point sum'],
  ["GUARD: a text five hundredths off passes as the delivered value", 'text', PROJECTION,
    '|| Math.abs(printed - value) > WUXING_VALUE_NOISE * Math.abs(value)) {',
    '|| Math.abs(printed - value) > 0.05 * Math.max(1, Math.abs(value))) {',
    [T.value], 'refuses a printed text further from the delivered value than representation noise'],
  ["GUARD ABSOLUTE: the guard's bound is absolute below 1", 'text', PROJECTION,
    '|| Math.abs(printed - value) > WUXING_VALUE_NOISE * Math.abs(value)) {',
    '|| Math.abs(printed - value) > WUXING_VALUE_NOISE * Math.max(1, Math.abs(value))) {',
    [T.value], 'refuses a printed text further from the delivered value than representation noise'],
  ["CANON: a text in another form (' 2 ', '2e0', '') passes", 'text', PROJECTION,
    '  if (!Number.isFinite(printed) || String(printed) !== text || ',
    '  if (!Number.isFinite(printed) || ',
    [T.value], 'refuses a text that is not the canonical text of its number'],
  ["ROUND: the formatter rounds to two decimals (the guard must refuse it)", 'text', PROJECTION,
    LOOP,
    '    if (Math.abs(Number(candidate) - value) <= 0.01 * Math.abs(value)) {',
    [T.value], 'prints a weight without noise exactly as String(value), real decimals included'],
  ["LOOSE: the formatter's bound swallows the seventh digit (the guard must refuse it)", 'text', PROJECTION,
    LOOP,
    '    if (Math.abs(Number(candidate) - value) <= 1e-6 * Math.abs(value)) {',
    [T.value], 'keeps every real digit near the bound, small values and fourteen-digit decimals included'],
  ["ABSOLUTE: the formatter's bound is absolute below 1", 'text', PROJECTION,
    LOOP,
    '    if (Math.abs(Number(candidate) - value) <= WUXING_VALUE_NOISE * Math.max(1, Math.abs(value))) {',
    [T.value], 'keeps every real digit near the bound, small values and fourteen-digit decimals included'],
  ["TIGHT: the bound is tighter than the noise of a sum", 'text', PROJECTION,
    'export const WUXING_VALUE_NOISE = 2 ** -48;',
    'export const WUXING_VALUE_NOISE = 2 ** -60;',
    [T.value], 'prints every sum of short decimals as its exact decimal (deterministic sweep)'],
  ["LOOSE CONSTANT: the bound is loose enough to swallow a real digit", 'text', PROJECTION,
    'export const WUXING_VALUE_NOISE = 2 ** -48;',
    'export const WUXING_VALUE_NOISE = 2 ** -20;',
    [T.value], 'bounds the noise relative to the value, at sixteen units in the last place'],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz61-mutants-'));
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

const ALL_SUITES = [T.value, T.presentation];
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
