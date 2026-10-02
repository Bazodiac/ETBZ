#!/usr/bin/env node
/**
 * ETBZ-60 - source-mutation proofs for READING_POSITION_UNGROUNDED (PO decisions D-59-5, D-59-6): each form of a
 * statement about the chart's positions as a whole, the defining-clause and "nicht nur" exemptions, the every-pillar
 * coverage and the call in the paragraph pass of acceptSkillReading. Each is weakened in exactly one place, and the
 * named test must fail an assertion (the ETBZ-30B semantics). Files are restored from bytes in memory.
 *
 *   npm run guards:etbz60
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const READING = 'src/application/skill/skill-reading.ts';

const T = {
  positions: 'tests/negative/etbz60-position-statements.negative.test.ts',
  reading: 'tests/negative/etbz52-skill-reading.negative.test.ts',
  voice: 'tests/negative/etbz57-voice.negative.test.ts',
  evidence: 'tests/contract/etbz60-rereading-evidence.contract.test.ts',
};
const REREAD = 'tests/support/etbz60Rereading.ts';
const R2_JUDGEMENTS = 'docs/evidence/etbz-60/round-2/judgements.json';
const R2_TOOL_CALLS = 'docs/evidence/etbz-60/round-2/judge/tool-calls.txt';

/** [name, kind, file, find, replace, tests, killer] - kind 'text' (find occurs exactly once). */
const MUTANTS = [
  ["FORM: 'auf keiner Säule' is not a position statement", 'text', READING,
    '(?:kein|keine|keiner|keinem|keinen)',
    '(?:keinZ)',
    [T.positions], "finds each form in the sentence the ETBZ-59 readings wrote"],
  ["FORM: 'nicht auf einer Säule' is not a position statement", 'text', READING,
    '(?:einer|einem|eines)',
    '(?:einerZ)',
    [T.positions], "finds each form in the sentence the ETBZ-59 readings wrote"],
  ["FORM: 'ohne an die Oberfläche' is not a position statement", 'text', READING,
    '(?:ohne|nie|niemals|nirgends|nirgendwo)',
    '(?:ohneZ)',
    [T.positions], "finds each form in the sentence the ETBZ-59 readings wrote"],
  ["FORM: 'nur im Monatszweig' is not a position statement", 'text', READING,
    '(?:nur|ausschließlich|einzig)',
    '(?:nurZ)',
    [T.positions], "finds each form in the sentence the ETBZ-59 readings wrote"],
  ["EXEMPT: a defining clause about stems counts as a statement about this chart", 'text', READING,
    '    if (DEFINING_CLAUSE.test(sentence)) continue;',
    '    if (DEFINING_CLAUSE.test(sentence) && sentence === "") continue;',
    [T.positions], "leaves framework sentences alone"],
  ["EXEMPT: 'nicht nur im ...' counts as a restriction", 'text', READING,
    '(?<!\\\\bnicht\\\\s)',
    '',
    [T.positions], "leaves framework sentences alone"],
  ["EXEMPT: 'nicht nur an einer Position' counts as a statement of every position", 'text', READING,
    '(?!nur\\\\b)',
    '',
    [T.positions], "leaves framework sentences alone"],
  ["COVER: a position statement passes without a fact of every pillar", 'text', READING,
    '  if (missing.length > 0) {\n    throw new SkillRunError(\'READING_POSITION_UNGROUNDED\'',
    '  if (missing.length > 99) {\n    throw new SkillRunError(\'READING_POSITION_UNGROUNDED\'',
    [T.positions], "every refusal is READING_POSITION_UNGROUNDED, at exactly the measured paragraphs"],
  ["COVER: two pillars count as every pillar", 'text', READING,
    "const PILLAR_NAMES = ['year', 'month', 'day', 'hour'] as const;",
    "const PILLAR_NAMES = ['year', 'month'] as const;",
    [T.positions], "names the phrase and the pillars no cited fact covers"],
  ["COVER: a fact of every pillar does not ground the statement", 'text', READING,
    '  const cited = new Set(facts.map((fact) => fact.pillar));',
    '  const cited = new Set<string | null>();',
    [T.positions], "accepts it in a paragraph that cites a fact of all four pillars"],
  ["EVIDENCE: round 2 records a BLOCKING code", 'text', R2_JUDGEMENTS,
    '"codes": ["FIXED_METAPHOR_REUSE"],',
    '"codes": ["STOCK_PARAGRAPH_REUSE"],',
    [T.evidence], "raises no BLOCKING code (AC5)"],
  ["EVIDENCE: a round-2 quote is not what the reading says", 'text', R2_JUDGEMENTS,
    '"text": "Kein sichtbarer Himmelsstamm wirkt fordernd auf Xin ein."',
    '"text": "Kein Himmelsstamm wirkt fordernd auf Xin ein."',
    [T.evidence], "finds every quote verbatim at its path in the accepted reading"],
  ["EVIDENCE: the round-2 judge read another file", 'text', R2_TOOL_CALLS,
    'round-2/judge/candidates.json',
    'round-2/cases/source/skill-input.json',
    [T.evidence], "shows the judge reading its packet and nothing else"],
  ["EVIDENCE: the record drops the round-2 cones", 'text', REREAD,
    "...(round === 'round-2' && existsSync(resolve(root, ROUND2_CONES))",
    "...(round === 'never' && existsSync(resolve(root, ROUND2_CONES))",
    [T.evidence], "re-derives the run record byte for byte from the committed files"],
  ["EVIDENCE: the packet stops listing position statements", 'text', REREAD,
    '    positionStatements: ETBZ60_LABELS.flatMap(',
    '    positionStatements: [].flatMap(',
    [T.evidence], "re-derives every file the judge read, byte for byte"],
  ["CALL: the paragraph pass does not check position statements", 'text', READING,
    '      checkPositions(paragraph.text, at, coveredFacts);\n',
    '',
    [T.positions], "every refusal is READING_POSITION_UNGROUNDED, at exactly the measured paragraphs"],
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

const ALL_SUITES = [T.positions, T.reading, T.voice, T.evidence];
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
