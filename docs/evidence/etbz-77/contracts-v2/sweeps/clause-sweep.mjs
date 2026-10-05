// ETBZ-77 one-time clause sweep (complements the throw sweep): guards that are not throw statements -
// condition clauses, guard calls, schema refinements, list entries, freezes - each weakened in turn;
// the three ETBZ-77 suites (plus the skill boundary suite) run; the kill must be an AssertionError.
// Derived from the round-4 reviewer's harness (45 mutants) and extended. Restores bytes after each mutant.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
const C = 'src/application/skill/canon-v2-contracts.ts';
const L = 'src/application/skill/semantic-envelope-v2.ts';
const W = 'src/application/skill/wording-boundaries-v2.ts';
const SRC = 'src/application/skill/contract-sources-v2.ts';
const REPORT = process.argv[2];
const D = 'const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/u;';
const V = '/^[a-z][a-z0-9-]*@\\d+\\.\\d+\\.\\d+$/u';
const SUITES = ['tests/unit/etbz77-contracts-v2.test.ts', 'tests/negative/etbz77-contracts-v2.negative.test.ts', 'tests/contract/etbz77-contracts-v2.contract.test.ts'];
const M = [
  ['K00 freeze: shape check call removed', C, '  refuseMalformedCore({ canon: contract.canon, source: contract.source, supersedes: contract.supersedes, content: contract.content });\n', ''],
  ['K01 walk source: contract-name clause removed', C, "|| source['contract'] !== key ||", '||'],
  ['K02 walk source: section-is-string clause removed', C, "|| typeof section !== 'string' ||", '||'],
  ['K03 walk source: section-in-page clause removed', C, ' || !sections.includes(section)) {', ') {'],
  ['K04 walk: blank-rule check without trim', C, "if (value.trim() === '') {", "if (value === '') {"],
  ['K05 page id clause removed', C, '!PAGE_ID_PATTERN.test(source.confluencePageId) || ', ''],
  ['K06 page version clause removed', C, ' || !PAGE_ID_PATTERN.test(source.confluencePageVersion)', ''],
  ['K07 title clause removed', C, "source.title.trim() === '' || ", ''],
  ['K08 releasedOn null clause removed', C, 'source.releasedOn === null || !isCalendarDate', '!isCalendarDate'],
  ['K09 isCalendarDate: month/day range removed', C, '  if (month < 1 || month > 12 || day < 1) return false;\n', ''],
  ['K10 isCalendarDate: day-of-month bound removed', C, '  return day <= (lengths[month - 1] ?? 0);', '  return true;'],
  ['K11 isCalendarDate: leap rule -> every 4th year', C, '(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0', 'year % 4 === 0'],
  ['K12 owns duplicate clause removed', C, ' || new Set(source.owns).size !== source.owns.length) {', ') {'],
  ['K13 dependsOn duplicate clause removed', C, 'new Set(source.dependsOn).size !== source.dependsOn.length || ', ''],
  ['K14 dependsOn self clause removed', C, 'dependency === key || ', ''],
  ['K15 dependsOn known-key clause removed', C, ' || !(CONTRACT_KEYS as readonly string[]).includes(dependency))', ')'],
  ['K16 supersedes blank statement clause removed', C, " || core.supersedes.statement.trim() === ''", ''],
  ['K17 rebaseline page clause removed', C, 'section.confluencePageId !== PARENT_DECISION.confluencePageId || ', ''],
  ['K18 rebaseline section clause removed', C, " || section.section.trim() === ''", ''],
  ['K19 rebaseline scope clause removed', C, " || section.scope.trim() === ''", ''],
  ['K20 chapter owners: not-a-list clause removed', C, '!Array.isArray(owners) || owners.some', 'owners.some'],
  ['K21 chapter owners: owner-is-string clause removed', C, "return typeof owner !== 'string' || owner === key", 'return owner === key'],
  ['K22 chapter owners: owner-is-Lens clause removed', C, "owner !== 'string' || owner === key || !(", "owner !== 'string' || !("],
  ['K23 chapter owners: known-owner clause removed', C, " || !(CONTRACT_KEYS as readonly string[]).includes(owner);", ';'],
  ['K24 freeze: prototype clause removed', C, ' || Object.getPrototypeOf(contract) !== Object.prototype\n', '\n'],
  ['K25 freeze: exact-keys clause removed', C, "\n    || Object.keys(contract).sort().join(',') !== 'canon,content,source,structuralHash,supersedes') {", ') {'],
  ['K26 freeze: hash-is-string clause removed', C, "typeof contract.structuralHash !== 'string' || ", ''],
  ['K27 freeze: hash-pattern clause removed', C, '!HASH_PATTERN.test(contract.structuralHash) || ', ''],
  ['K28 freeze: published==actual clause removed', C, 'actual !== contract.structuralHash || ', ''],
  ['K29 freeze: released==actual clause removed', C, ' || released !== actual) {', ') {'],
  ['K30 freeze: released undefined clause removed', C, 'released === undefined || released !== actual', 'released !== actual'],
  ['K31 pair: hasOwn slot clause removed', C, '!Object.hasOwn(input, slot) || ', ''],
  ['K32 pair: undefined slot clause removed', C, ' || (input as Record<string, unknown>)[slot] === undefined) {', ') {'],
  ['K33 pair: page id clause removed', C, 'binding.confluencePageId !== found.source.confluencePageId || ', ''],
  ['K34 pair: page version clause removed', C, ' || binding.confluencePageVersion !== found.source.confluencePageVersion) {', ') {'],
  ['K35 bindingSchema contractRef min(1) removed', C, '  contractRef: z.string().min(1),', '  contractRef: z.string(),'],
  ['K36 bindingSchema page id min(1) removed', C, '  confluencePageId: z.string().min(1),\n  confluencePageVersion: z.string().min(1),\n});\nconst bindingPairSchema', '  confluencePageId: z.string(),\n  confluencePageVersion: z.string().min(1),\n});\nconst bindingPairSchema'],
  ['K37 bindingSchema page version min(1) removed', C, '  confluencePageVersion: z.string().min(1),\n});\nconst bindingPairSchema', '  confluencePageVersion: z.string(),\n});\nconst bindingPairSchema'],
  ['K38 symbolic keys: lookupTable dropped', C, "'mappings', 'mapping', 'lookupTable', 'lookup',", "'mappings', 'mapping', 'lookup',"],
  ['K39 symbolic keys: operations dropped', C, "  'operations', 'operation',", "  'operation',"],
  ['K40 symbolic keys: facts dropped', C, " 'facts', 'fact',", " 'fact',"],
  ['K41 coded: SkillContractError passthrough removed', C, '    if (error instanceof SkillContractError) throw error;\n    const cause', '    const cause'],
  ['K42 resolve: typeof guard removed', C, "  if (typeof ref !== 'string') {\n    throw new SkillContractError('UNKNOWN_CONTRACT_IDENTITY', `a reference of type ${ref === null ? 'null' : typeof ref} is not a contract reference`, {});\n  }\n", ''],
  ['K43 version regex: patch part optional', C, '@\\d+\\.\\d+\\.\\d+$/u', '@\\d+\\.\\d+(\\.\\d+)?$/u'],
  ['K44 shown: echo not capped', C, "  return ref.length <= 80 ? ref : `${ref.slice(0, 80)}… (${ref.length} characters)`;", '  return ref;'],
  ['K45 resolve: not wrapped', C, "  return coded('the reference', () => resolveRef(ref));", '  return resolveRef(ref);'],
  ['K46 pair: not wrapped', C, "  return coded('the binding pair', () => checkBindingPair(parseBindingPair(input)));", '  return checkBindingPair(parseBindingPair(input));'],
  ['K47 validator: not wrapped', C, "  coded('the contract core', () => validateCore(core));", '  validateCore(core);'],
  ['K48 freeze path: not wrapped', C, "  coded('the contract', () => assertReleased(contract));", '  assertReleased(contract);'],
  ['K49 pair: root plain-object check removed', C, "    if (Object.getPrototypeOf(input) !== Object.prototype) {", '    if (false) {'],
  ['K50 pair: slot plain-object check removed', C, "      if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) !== Object.prototype) {", '      if (false) {'],
  ['K51 cycle check removed', C, '  if (reaches(key, key, new Set())) {', '  if (false) {'],
  ['K52 freeze: hash table not frozen', C, 'export const RELEASED_CANON_V2_CONTRACT_HASHES: Readonly<Record<string, string>> = deepFreeze({', 'export const RELEASED_CANON_V2_CONTRACT_HASHES: Readonly<Record<string, string>> = ({'],
  ['K53 freeze: pair not frozen', C, 'export const PLAN_CONTRACT_BINDINGS_V2_0: PlanContractBindings = deepFreeze({', 'export const PLAN_CONTRACT_BINDINGS_V2_0: PlanContractBindings = ({'],
  ['K54 freeze: keys not frozen', C, "export const CANON_V2_CONTRACT_KEYS = deepFreeze(['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON'] as const);", "export const CANON_V2_CONTRACT_KEYS = (['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON'] as const);"],
  ['K55 freeze: Lens content not frozen', L, 'deepFreeze(SEMANTIC_ENVELOPE_V2);\n', ''],
  ['K56 freeze: C1 sections not frozen', L, 'deepFreeze(C1_SECTIONS);\n', ''],
  ['K57 freeze: Lexicon content not frozen', W, 'deepFreeze(WORDING_BOUNDARIES_V2);\n', ''],
  ['K58 freeze: block names not frozen', W, 'deepFreeze(STYLE_GUIDE_V3_BLOCK_NAMES);\n', ''],
  ['K59 freeze: C5 sections not frozen', W, 'deepFreeze(C5_SECTIONS);\n', ''],
  ['K60 freeze: decision not frozen', SRC, 'deepFreeze(CANON_V2_DECISION);\n', ''],
  ['K61 freeze: sources not frozen', SRC, 'deepFreeze(CANON_V2_CONTRACT_SOURCES);\n', ''],
  ['K62 freeze: supersessions not frozen', SRC, 'deepFreeze(CANON_V2_SUPERSESSIONS);\n', ''],
  ['K63 style-guide block-names check removed', C, "    if (!sameJson(names, STYLE_GUIDE_V3_BLOCK_NAMES)) {", '    if (false) {'],
  ['K64 lexicon red-lines binding check removed', C, "    if (!sameJson(fieldAt(core.content, ['authority', 'redLinesBinding']), bindingOf(v2SourceFor('INTERPRETATION_LENS')))) {", '    if (false) {'],
  ['K65 canon decision check removed', C, '  if (!sameJson(core.canon, CANON_V2_DECISION)) {', '  if (false) {'],
  ['K66 supersedes refs check removed', C, "  if (!sameJson(core.supersedes.contractRefs, expectedRefs) || core.supersedes.statement.trim() === '') {", "  if (core.supersedes.statement.trim() === '') {"],
  ['K67 status check removed', C, "  if (source.status !== 'CURRENT') {", '  if (false) {'],
  ['K68 methodRefs refusal removed', C, "    if (name === 'methodRefs') {", '    if (false) {'],
  ['K69 core: not wrapped', C, "  return coded('the key', () => coreFor(key));", '  return coreFor(key);'],
  ['K70 build: not wrapped', C, "  return coded('the key', () => buildContract(key));", '  return buildContract(key);'],
  ['K71 released: not wrapped', C, "  return coded('the key', () => {\n    const contract = buildContract(key);\n    assertReleased(contract);\n    return contract;\n  });", '  const contract = buildContract(key);\n  assertReleased(contract);\n  return contract;'],
  ['K72 keyText: strings not bounded', C, "  return typeof value === 'string' ? shown(value) : ", "  return typeof value === 'string' ? value : "],
  ['K73 key check: type clause removed', C, "  if (typeof key !== 'string' || !isCanonV2Key(key)) {", '  if (!isCanonV2Key(key as string)) {'],
  ['K74 core: unreleased-key check removed', C, '  refuseUnreleasedKey(key);\n  return {\n', '  return {\n'],
  ['K75 RX07 page id + -> *', C, 'const PAGE_ID_PATTERN = /^\\d+$/u;', 'const PAGE_ID_PATTERN = /^\\d*$/u;'],
  ['K76 RX10 month {2} -> {1,2}', C, D, 'const DATE_PATTERN = /^\\d{4}-\\d{1,2}-\\d{2}$/u;'],
  ['K77 RX11 month {2} -> +', C, D, 'const DATE_PATTERN = /^\\d{4}-\\d+-\\d{2}$/u;'],
  ['K78 RX12 day {2} -> {1,2}', C, D, 'const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{1,2}$/u;'],
  ['K79 RX13 day {2} -> +', C, D, 'const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d+$/u;'],
  ['K80 RX14 month \\d -> .', C, D, 'const DATE_PATTERN = /^\\d{4}-.{2}-\\d{2}$/u;'],
  ['K81 RX15 day \\d -> .', C, D, 'const DATE_PATTERN = /^\\d{4}-\\d{2}-.{2}$/u;'],
  ['K82 RX16 year \\d -> .', C, D, 'const DATE_PATTERN = /^.{4}-\\d{2}-\\d{2}$/u;'],
  ['K83 RX22 major optional', C, V, '/^[a-z][a-z0-9-]*@\\d*\\.\\d+\\.\\d+$/u'],
  ['K84 RX23 minor optional', C, V, '/^[a-z][a-z0-9-]*@\\d+\\.\\d*\\.\\d+$/u'],
  ['K85 RX24 patch optional', C, V, '/^[a-z][a-z0-9-]*@\\d+\\.\\d+\\.\\d*$/u'],
  ['K86 RX26 second dot unescaped', C, V, '/^[a-z][a-z0-9-]*@\\d+\\.\\d+.\\d+$/u'],
  ['K87 S01 source.key unknown', C, '  key: z.string(),\n  title: z.string(),', '  key: z.unknown(),\n  title: z.string(),'],
  ['K88 S11 contractRefs unknown', C, '  contractRefs: z.array(z.string()),', '  contractRefs: z.unknown(),'],
  ['K89 S13 rebaseline page id unknown', C, 'z.strictObject({ confluencePageId: z.string(), section: z.string(), title: z.string(), scope: z.string() })', 'z.strictObject({ confluencePageId: z.unknown(), section: z.string(), title: z.string(), scope: z.string() })'],
  ['K90 S15 rebaseline title unknown', C, 'z.strictObject({ confluencePageId: z.string(), section: z.string(), title: z.string(), scope: z.string() })', 'z.strictObject({ confluencePageId: z.string(), section: z.string(), title: z.unknown(), scope: z.string() })'],
  ['K91 S16 rebaseline scope unknown', C, 'z.strictObject({ confluencePageId: z.string(), section: z.string(), title: z.string(), scope: z.string() })', 'z.strictObject({ confluencePageId: z.string(), section: z.string(), title: z.string(), scope: z.unknown() })'],
  ['K92 S21 rebaseline row loose', C, 'z.strictObject({ confluencePageId: z.string(), section: z.string(), title: z.string(), scope: z.string() })', 'z.object({ confluencePageId: z.string(), section: z.string(), title: z.string(), scope: z.string() })'],
  ['K93 E1 status echoed whole', C, 'has status "${keyText(source.status)}"; only', 'has status "${String(source.status)}"; only'],
  ['K94 E2 owns echoed whole', C, 'owns ${shown(source.owns.join(\', \')) || \'nothing\'}', 'owns ${source.owns.join(\', \') || \'nothing\'}'],
  ['K95 E3 content path echoed whole (number)', C, '`${shown(path)} is a ${value === null', '`${path} is a ${value === null'],
  ['K96 E4 schema path echoed whole', C, "throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${shown(path)}: ${issue?.code ?? 'invalid'}`, { path });\n  }\n}\n\n/**", "throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${path}: ${issue?.code ?? 'invalid'}`, { path });\n  }\n}\n\n/**"],
];
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
console.log(`clause sweep at ${head}: ${M.length} mutants`);
let killed = 0;
for (const [name, file, find, repl] of M) {
  const original = readFileSync(file, 'utf8');
  const n = original.split(find).length - 1;
  if (n !== 1) { console.log(`${name}\n    SETUP_ERROR occurrences=${n}`); continue; }
  writeFileSync(file, original.replace(find, repl));
  rmSync(REPORT, { force: true });
  let r;
  try { r = spawnSync('npx', ['vitest', 'run', ...SUITES, '--reporter=json', `--outputFile=${REPORT}`], { encoding: 'utf8' }); }
  finally { writeFileSync(file, original); }
  let failed = [];
  try { failed = JSON.parse(readFileSync(REPORT, 'utf8')).testResults.flatMap((f) => f.assertionResults.filter((t) => t.status === 'failed')); } catch {}
  const asserted = failed.filter((t) => t.failureMessages.some((m) => m.startsWith('AssertionError')));
  const verdict = r.status === 0 ? 'SURVIVED' : asserted.length > 0 ? `KILLED_BY_ASSERTION <- ${asserted[0].fullName}` : `RED_NOT_BY_ASSERTION status=${r.status} failed=${failed.length}`;
  if (verdict.startsWith('KILLED')) killed += 1;
  console.log(`${name}\n    ${verdict}`);
}
const clean = execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim();
console.log(`\n${killed}/${M.length} clause mutants killed by assertion · src tree after restore: ${clean === '' ? 'clean' : clean}`);
