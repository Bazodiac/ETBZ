#!/usr/bin/env node
/**
 * ETBZ-117 (Canon v2, R0) - source-mutation proofs for the forward fix: Lens and
 * Lexicon 2.1.0 on C1 and C5 page version 2 beside the immutable A1 2.0.0 pair,
 * the current Canon context that binds them, the method scope and the ADR 0019
 * closeout (ADR 0020). Each protection is weakened in exactly one place, and the
 * named test must fail an assertion (the ETBZ-30B semantics: a thrown test
 * body, a timeout or a load error is not a kill). Files are restored from bytes
 * in memory, never by `git checkout`.
 *
 * The mutant classes are the minimum list of Jira ETBZ-117: the current binding
 * back to A1 2.0.0, a page version back to v1, the frozen A1 content and hash
 * changed in place, the source/drift guards weakened, an unknown or malformed
 * reference accepted, a method pulled into the line, and an ADR 0019 closeout
 * that leaves "Proposed" or the open reflection question standing.
 *
 *   npm run guards:etbz117
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONTRACTS = 'src/application/skill/canon-v2-contracts.ts';
const CURRENT = 'src/application/skill/current-canon-contracts.ts';
const SOURCES_V2_1 = 'src/application/skill/contract-sources-v2-1.ts';
const LENS_V2_1 = 'src/application/skill/semantic-envelope-v2-1.ts';
const LEXICON_V2_1 = 'src/application/skill/wording-boundaries-v2-1.ts';
const LENS_V2 = 'src/application/skill/semantic-envelope-v2.ts';
const A1_EVIDENCE = 'docs/evidence/etbz-77/contracts-v2/README.md';
const REGISTRY = 'src/application/interpretation/method-registry.ts';
const ADR_0019 = 'docs/adr/0019-canon-v2-contracts.md';

const T = {
  unit: 'tests/unit/etbz117-canon-v2-1.test.ts',
  negative: 'tests/negative/etbz117-canon-v2-1.negative.test.ts',
  contract: 'tests/contract/etbz117-canon-v2-1.contract.test.ts',
};
const BINDS_CURRENT = 'binds Lens and Lexicon 2.1.0 on C1 and C5 page version 2 in the current context, never the A1 2.0.0 pair';
const A1_BYTES = 'leaves the A1 value modules, its evidence, its suites and its guard script byte-identical';
const A1_HASHES = 'keeps the A1 2.0.0 hashes at their released values';
const SCOPE = 'adds no method: the line releases exactly the Lens and the Lexicon';
const ADR_CLOSED = 'closes ADR 0019: Accepted with its merge, no open reflection-question decision, its A1 facts intact';

/** [name, kind, file, find, replace, tests, killer] - kind 'text' (find occurs exactly once). */
const MUTANTS = [
  ['CURRENT -> A1: the current Canon context is pointed back at 2.0.0', 'text', CURRENT,
    'export const CURRENT_CANON_V2_VERSION: CanonV2LineVersion = CANON_V2_1_CONTRACT_VERSION;',
    "export const CURRENT_CANON_V2_VERSION: CanonV2LineVersion = '2.0.0';",
    [T.contract], BINDS_CURRENT],
  ['PAIR -> A1: the 2.1 pair binds the Lens 2.0.0 on C1 page version 1', 'text', CONTRACTS,
    "  interpretationLens: {\n    contractRef: 'grounded-reflective-synthesis-lens@2.1.0',\n    confluencePageId: '85229569',\n    confluencePageVersion: '2',\n  },",
    "  interpretationLens: {\n    contractRef: 'grounded-reflective-synthesis-lens@2.0.0',\n    confluencePageId: '85229569',\n    confluencePageVersion: '1',\n  },",
    [T.contract], BINDS_CURRENT],
  ['PAGE -> v1: the Lexicon 2.1.0 source is bound to C5 page version 1', 'text', SOURCES_V2_1,
    "  identity: 'terminology-wording-lexicon@2.1.0',\n  confluencePageVersion: '2',",
    "  identity: 'terminology-wording-lexicon@2.1.0',\n  confluencePageVersion: '1',",
    [T.contract], BINDS_CURRENT],
  ['VOICE -> v1: the Lens 2.1.0 hands voice to C5 page version 1', 'text', LENS_V2_1,
    "    contractRef: 'terminology-wording-lexicon@2.1.0',\n    confluencePageId: '85164034',\n    confluencePageVersion: '2',",
    "    contractRef: 'terminology-wording-lexicon@2.1.0',\n    confluencePageId: '85164034',\n    confluencePageVersion: '1',",
    [T.unit], 'has the Lens 2.1.0 hand voice to exactly the Lexicon 2.1.0'],
  ['FREEZE 2.1: the Lexicon 2.1.0 ZIEL block is reworded (no hash sees a re-release)', 'text', LEXICON_V2_1,
    "      'Der Text soll klare Resonanz oder klaren Widerspruch auslösen. Beides ist Erfolg. Lauwarm ist Misserfolg.',",
    "      'Der Text soll klare Resonanz auslösen. Beides ist Erfolg. Lauwarm ist Misserfolg.',",
    [T.unit], 'freezes Lens and Lexicon 2.1.0 by content hash'],
  ['A1 CONTENT: the frozen 2.0.0 Lens is edited in place to the page version 2 rule', 'text', LENS_V2,
    "    { partId: 'PRUEFFRAGE', text: 'eine Prüffrage, beantwortbar mit Ja / Nein / Teilweise.' },",
    "    { partId: 'PRUEFFRAGE', text: 'eine Reflexionsfrage als rhetorischen Textimpuls, ohne verpflichtendes Antwortformat oder Antwortoptionen.' },",
    [T.contract], A1_BYTES],
  ['A1 EVIDENCE: the released ETBZ-77 evidence record is edited in place', 'text', A1_EVIDENCE,
    '# ETBZ-77 — Canon v2 contracts: Interpretation Lens v2 and Terminology & Wording Lexicon v2',
    '# ETBZ-77 — Canon v2 contracts: Interpretation Lens v2 and Terminology & Wording Lexicon v2 (amended)',
    [T.contract], A1_BYTES],
  ['A1 HASH: the frozen 2.0.0 Lens hash is replaced by the 2.1.0 one', 'text', CONTRACTS,
    "  'grounded-reflective-synthesis-lens@2.0.0': 'sha256:638eef2dcb822ed94f70002947c642fcf112f8d23f58390825a5c5fdd59178ea',",
    "  'grounded-reflective-synthesis-lens@2.0.0': 'sha256:b931ae4e2e0f5c8c64f9b4cc143a189247e74d62a99a79952b8822da74d8f983',",
    [T.contract], A1_HASHES],
  ['DRIFT GUARD: another version of the lineage is let through', 'text', CONTRACTS,
    "    if (found.kind === 'OTHER_VERSION') {\n      throw new SkillContractError(\n        'CONTRACT_DRIFT',",
    "    if (found.kind === 'OTHER_VERSION') {\n      continue;\n      throw new SkillContractError(\n        'CONTRACT_DRIFT',",
    [T.negative], 'refuses the A1 2.0.0 binding in the current context as drift'],
  ['SOURCE GUARD: the page-version half of the source check is dropped', 'text', CONTRACTS,
    '    if (binding.confluencePageId !== found.source.confluencePageId || binding.confluencePageVersion !== found.source.confluencePageVersion) {',
    '    if (binding.confluencePageId !== found.source.confluencePageId) {',
    [T.negative], 'refuses a wrong page or page version: the 2.1.0 Lens on C1 page version 1'],
  ['CONTEXT GUARD: a context also resolves the identities of its earlier lines', 'text', CONTRACTS,
    "  for (const source of line.sources) {\n    if (source.identity === ref) return { kind: 'RELEASED', source };",
    "  for (const source of [...line.sources, ...line.earlier.flatMap((earlier) => earlier.sources)]) {\n    if (source.identity === ref) return { kind: 'RELEASED', source };",
    [T.negative], 'the whole A1 2.0.0 pair on C1/C5 page version 1'],
  ['MALFORMED: a reference that only starts with a released identity is accepted', 'text', CONTRACTS,
    "    if (source.identity === ref) return { kind: 'RELEASED', source };",
    "    if (source.identity !== null && ref.startsWith(source.identity)) return { kind: 'RELEASED', source };",
    [T.negative], 'the 2.1.0 Lens identity with a trailing space'],
  ['UNKNOWN VERSION: an unreleased context version falls back to the 2.0 line', 'text', CONTRACTS,
    "  if (typeof version !== 'string' || !Object.hasOwn(LINES, version)) {",
    "  if (typeof version !== 'string' || !Object.hasOwn(LINES, version)) {\n    return LINE_2_0;",
    [T.negative], 'refuses the version 2.2.0 at every function that takes one'],
  ['SCOPE: the Method Profile key joins the Canon v2 line', 'text', CONTRACTS,
    "export const CANON_V2_CONTRACT_KEYS = deepFreeze(['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON'] as const);",
    "export const CANON_V2_CONTRACT_KEYS = deepFreeze(['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON', 'METHOD_PROFILE'] as const);",
    [T.contract], SCOPE],
  ['SCOPE: the method registry is edited inside this slice', 'text', REGISTRY,
    'export const RELEASED_REGISTRY_HASHES: Readonly<Record<string, string>> = {',
    '// ETBZ-78 preview\nexport const RELEASED_REGISTRY_HASHES: Readonly<Record<string, string>> = {',
    [T.contract], SCOPE],
  ['ADR PROPOSED: the ADR 0019 closeout leaves the status Proposed', 'text', ADR_0019,
    '- **Status:** Accepted — merged to `main` as `9362f4e2`',
    '- **Status:** Proposed — merged to `main` as `9362f4e2`',
    [T.contract], ADR_CLOSED],
  ['ADR OPEN QUESTION: the ADR 0019 closeout keeps the reflection question open', 'text', ADR_0019,
    'is added or changed. The WIP question for Epic E remains with the Product Owner;',
    'is added or changed. Whether the text-level Prüffrage stays (ETBZ-116) and the WIP question for Epic E remain with the Product Owner;',
    [T.contract], ADR_CLOSED],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz117-mutants-'));
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
