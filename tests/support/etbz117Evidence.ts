/**
 * ETBZ-117 — the machine-derived record of the Canon v2 forward fix (R0):
 * Lens and Lexicon 2.1.0 on C1 and C5 page version 2 beside the A1 2.0.0
 * pair, the current context's answer to each binding a run might bring, the
 * historical 2.0 context's answer to the 2.1.0 pair, the page-version delta
 * the 2.1.0 content carries, the A1 byte baseline and the method scope. The
 * contract suite re-derives `docs/evidence/etbz-117/canon-v2-1/canon-v2-1.json`
 * from this byte for byte; `npm run etbz117:evidence` only saves what that
 * suite checks.
 *
 * The A1 baseline and the scope baseline are NOT derived from the working
 * tree: they are the SHA-256 of each file as `main@9362f4e2` (the merge of
 * ETBZ-77, PR #31) holds it, written out here once (re-derive with
 * `git cat-file blob 9362f4e2:<path> | shasum -a 256`). The suite compares the
 * working tree against them, so an in-place edit of A1 or of the method
 * registry cannot be laundered by regenerating the evidence.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { BAZI_METHOD_REGISTRY_V1, RELEASED_REGISTRY_HASHES } from '../../src/application/interpretation/method-registry.js';
import { PLAN_CONTRACT_BINDINGS_V1_0, PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import {
  CANON_V2_CONTRACT_KEYS,
  CANON_V2_LINE_VERSIONS,
  CURRENT_CANON_V2_VERSION,
  PLAN_CONTRACT_BINDINGS_V2_0,
  PLAN_CONTRACT_BINDINGS_V2_1,
  RELEASED_CANON_V2_1_CONTRACT_HASHES,
  RELEASED_CANON_V2_CONTRACT_HASHES,
  SEMANTIC_ENVELOPE_V2,
  SEMANTIC_ENVELOPE_V2_1,
  STYLE_GUIDE_V3_BLOCKS_V2_1,
  WORDING_BOUNDARIES_V2,
  WORDING_BOUNDARIES_V2_1,
  assertCanonV2ContractBindings,
  assertCanonV2ContractSet,
  assertCurrentCanonContractBindings,
  assertCurrentCanonContractSet,
  buildCanonV2Contract,
  resolveCanonV2Contract,
  resolveCurrentCanonContract,
  styleGuideV3Text,
} from '../../src/application/skill/index.js';
import { contractCodeOf } from './etbz77Evidence.js';

export const ETBZ117_EVIDENCE_PATH = 'docs/evidence/etbz-117/canon-v2-1/canon-v2-1.json';
export const ETBZ117_BASE_COMMIT = '9362f4e21504bc5e01e8ef7ab29507778a8582cc';
export const ETBZ117_ADR = 'docs/adr/0020-canon-v2-forward-fix-lens-lexicon-2-1.md';

/** The A1 2.0.0 hashes as ETBZ-77 released them (ADR 0019, Jira ETBZ-77 comment 17277): the immutability oracle, never a target. */
export const A1_RELEASED_HASHES: Readonly<Record<string, string>> = {
  'grounded-reflective-synthesis-lens@2.0.0': 'sha256:638eef2dcb822ed94f70002947c642fcf112f8d23f58390825a5c5fdd59178ea',
  'terminology-wording-lexicon@2.0.0': 'sha256:f6c40f7a2383690225b684c89cda4bd3d146c97383c59c78531e33b7a05b67d6',
};

/**
 * A1 as main@9362f4e2 holds it: the three 2.0.0 value modules and the freeze
 * helper they rely on, the ETBZ-77 evidence directory, and the ETBZ-77 suites
 * and guard script that define what 2.0.0 released. The shared machinery
 * (`canon-v2-contracts.ts`, `index.ts`) is not pinned by bytes - ETBZ-117
 * extends it with the 2.1 line; what it binds for 2.0.0 is held by the two
 * released hashes, the 2.0 context's answers and the unchanged ETBZ-77 suites.
 */
export const A1_BASELINE_SHA256: Readonly<Record<string, string>> = {
  'src/application/skill/contract-sources-v2.ts': 'b56f448305cae558337dd091c15541e3eb6b0dee6f979ce1c377200d8cc94841',
  'src/application/skill/semantic-envelope-v2.ts': '29b04690fdc8f119b9a99cc91cd21726f94af4d87775e5bfcfebef466295d247',
  'src/application/skill/wording-boundaries-v2.ts': '901af666308982bed8b79e92b9e1042b1e439e8403bae62846bb30b7be5963c3',
  'src/application/skill/deep-freeze.ts': 'c0a130bfa27bb9a01f4d4a7751393bde07a70d25394cb6ad0cadcb709c93394c',
  'docs/evidence/etbz-77/contracts-v2/README.md': '7f11d2f0fd079c49c6d059e42edeb467c4080d7bb90244ec8dcf7f35e0bc580f',
  'docs/evidence/etbz-77/contracts-v2/clause-sweep.txt': '2c6af4a759e9b6f9375d6ac149647b1652fd0cd7f6aa7054a4c7646eec792cfe',
  'docs/evidence/etbz-77/contracts-v2/contracts-v2.json': '148521c7d9c9d8d38935b235fe951642ac3986bd06818d13b072e4925e49afca',
  'docs/evidence/etbz-77/contracts-v2/local-gate.txt': '79bf5c9c1958de04839bb04d8e0e3eca08db79fdcee4d6ef508575541f6223a1',
  'docs/evidence/etbz-77/contracts-v2/mutation-proof.txt': '2ec5a7aa87803f43fe6940d0779d767ff355b1026ceeb3ebffdf3d48598613e0',
  'docs/evidence/etbz-77/contracts-v2/sweeps/clause-sweep.mjs': '9e56554b10bf9642b54a6eea47b57c9b98b6c4a35de8abfdc034c096b4ca7eda',
  'docs/evidence/etbz-77/contracts-v2/sweeps/throw-sweep.mjs': '24c531190f35ad5745ea3c8d62b0f929868480233e74108cc692575061e7e3ef',
  'docs/evidence/etbz-77/contracts-v2/throw-sweep.txt': '35dc77347243f33373d200ca16187825fe68274de7d2c50493297b358e964a9e',
  'tests/unit/etbz77-contracts-v2.test.ts': '942504491c6cc64cecdcd1094f0ffc2f0ed31bf21e5288136b4a485000b3c05b',
  'tests/negative/etbz77-contracts-v2.negative.test.ts': '7508f83e9fac1d5bad2b4c4c1abffba88dc940a3d7d851754175f68ee1721cc3',
  'tests/contract/etbz77-contracts-v2.contract.test.ts': '6e2544ac2cb022f2ec50d41489c274b374322a59ca4facebed032ba1a576b8a8',
  'tests/support/etbz77Evidence.ts': '02fbde381f63b74ed2ba34eaeff242f3948814a834154b41c9f2b889ca0c52cd',
  'tests/support/emit-etbz77-evidence.ts': '9db3a11ace5a68ec3af22d0811074ae34b46dc9b752b9863f112496b2504ffb0',
  'scripts/verify-etbz77-contracts-v2.mjs': '6ed33c71c6e9a4699293b8f3a256e0439f2b1bd05726a05bc191b48206757ac2',
};

/**
 * The method scope as main@9362f4e2 holds it: ETBZ-117 adds no method, method
 * key, operation or mapping (Method Profile v2 is ETBZ-78). The registry's
 * released hash table is pinned beside it.
 */
export const METHOD_SCOPE_BASELINE_SHA256: Readonly<Record<string, string>> = {
  'src/application/interpretation/method-registry.ts': '723580cb3adc1055fedc793a085272ab9c435a041a6d4c764855829e68dacf27',
  'src/application/interpretation/method-scope.ts': '91f8ddeb4410585710c0b2715454fab6bf555ab80d8d2fdb4c6af60a29723a6f',
};
export const RELEASED_REGISTRY_HASHES_AT_BASE: Readonly<Record<string, string>> = {
  '1.0.0': 'sha256:77545607f6e547f67df14ec9936ff66a9f90d643b51302e614c7bc0922085224',
};

/**
 * ADR 0019 as main@9362f4e2 holds it, and every edit the ETBZ-117 closeout
 * makes to it. The closeout is exactly these replacements: undoing each
 * (closeout -> base, each closeout text present once) must give back the base
 * bytes. So a changed identity, page version, hash, base, date, drop inventory
 * or release fact anywhere in ADR 0019 - or any further wording, such as an
 * open reflection question in other words - turns the contract suite red.
 * Re-derive the base with `git cat-file blob 9362f4e2:docs/adr/0019-canon-v2-contracts.md | shasum -a 256`.
 */
export const ADR_0019_BASE_SHA256 = '8c9c375debbe0917dc4bce9db4cb41a2a50a9b915bf3ba4a6f490991b02cb140';
export const ADR_0019_CLOSEOUT_EDITS: readonly { readonly base: string; readonly closeout: string }[] = [
  {
    base: "- **Status:** Proposed — the ETBZ-77 candidate. Following the repository's ADR convention (CLAUDE.md, \"Working\n  notes\"), the merge commit is recorded in this line by a docs closeout after the merge. Until then Jira ETBZ-77\n  records the merge commit, its CI run and the Product Owner's merge authorisation.",
    closeout: "- **Status:** Accepted — merged to `main` as `9362f4e2` (PR #31, head `eaeb3ada`, 2026-10-05). Merged under the\n  Product Owner's authorisation of 2026-10-05 (\"Push, PR, merge if green\", Jira ETBZ-77 comment 17277) after the\n  exact-head CI run 37249568719; post-merge CI run 37253260353 green. The released 2.0.0 identities, their page\n  bindings (C1 v1, C5 v1) and their hashes below are unchanged. On 2026-10-05 the Product Owner revised C1 and C5 to\n  page version 2 (ETBZ-116 decided, see Consequences); the forward fix is Lens and Lexicon 2.1.0 beside 2.0.0,\n  ADR 0020 (ETBZ-117), which records this closeout.",
  },
  {
    base: "name as its plan bindings. `assertCanonV2ContractBindings` accepts a pair for that context or refuses it. The",
    closeout: "name as its plan bindings. (Superseded for new work on 2026-10-05, ETBZ-117: since C1 and C5 moved to page version 2,\na Canon v2 run and bundle 2.0.0 bind the current context, `PLAN_CONTRACT_BINDINGS_V2_1` through\n`current-canon-contracts.ts`, ADR 0020. This pair stays the A1 context, and the 2.0 context answers as described\nhere.) `assertCanonV2ContractBindings` accepts a pair for that context or refuses it. The",
  },
  {
    base: "  The 2.0-line module accepts only the two keys and only 2.0.0 today, so those slices extend it or add their own:",
    closeout: "  The 2.0-line module accepts only the two keys and only 2.0.0 today, so those slices extend it or add their own\n  (since 2026-10-05 it also releases 2.1.0 of the same two keys as a second line, ETBZ-117, ADR 0020):",
  },
  {
    base: "  already satisfies the bundle's own data guard: strings only, and none of its refused keys.",
    closeout: "  already satisfies the bundle's own data guard: strings only, and none of its refused keys. (Superseded on\n  2026-10-05, ETBZ-117: bundle 2.0.0 composes the 2.1.0 pair - `CANON_V2_1_CONTRACT_SOURCES`,\n  `SEMANTIC_ENVELOPE_V2_1`, `WORDING_BOUNDARIES_V2_1` and `PLAN_CONTRACT_BINDINGS_V2_1`, through\n  `current-canon-contracts.ts` - not the 2.0.0 values, ADR 0020.)",
  },
  {
    base: "- **ETBZ-116.** It leaves open whether the text-level Prüffrage (C1 Vorstoß part 5, C5 REFLEXIONSFRAGE) stays. This\n  slice binds C1 v1 and C5 v1 as they are. If the Product Owner changes either page, the result is a new page\n  version and a new contract version with a new hash. The pair moves together: each v2 contract binds the other's\n  page version (the Lens's voice authority, the Lexicon's red-lines binding), so a new C5 version also gives the\n  Lens a new version. 2.0.0 is never edited.",
    closeout: "- **ETBZ-116 (decided 2026-10-05, after this release).** When this slice was released, ETBZ-116 still held the\n  question whether the text-level Prüffrage (C1 Vorstoß part 5, C5 REFLEXIONSFRAGE) stays; 2.0.0 binds C1 v1 and\n  C5 v1 as they were. The Product Owner has since decided it (Jira ETBZ-116, Canon v2 hub v3 \"Pre-A2 reconcile\n  decision\"): the reflection question stays as a non-interactive text impulse, with no mandatory Ja / Nein /\n  Teilweise answer and no answer affordance, and C1 and C5 carry that at page version 2. As this record foresaw,\n  the change is a new contract version with a new hash, never an edit of 2.0.0, and the pair moved together (each v2\n  contract binds the other's page version): Lens and Lexicon 2.1.0, ADR 0020 (ETBZ-117). 2.0.0 stays the historical\n  A1 release, bound to C1 v1 and C5 v1, resolvable in its own 2.0 context.",
  },
  {
    base: "is added or changed. Whether the text-level Prüffrage stays (ETBZ-116) and the WIP question for Epic E remain with\nthe Product Owner. The Golden run (ETBZ-33/54) stays frozen.",
    closeout: "is added or changed. The WIP question for Epic E remains with the Product Owner; the text-level reflection question\n(ETBZ-116) is decided, see Consequences. The Golden run (ETBZ-33/54) stays frozen.",
  },
];

/** ADR 0019 with every closeout edit undone, or the first closeout text that is not present exactly once. */
export function adr0019WithoutCloseout(text: string): { text: string; missing: string | null } {
  let reverted = text;
  for (const edit of ADR_0019_CLOSEOUT_EDITS) {
    if (reverted.split(edit.closeout).length !== 2) return { text: reverted, missing: edit.closeout.slice(0, 80) };
    reverted = reverted.replace(edit.closeout, () => edit.base);
  }
  return { text: reverted, missing: null };
}

/**
 * Where the repository keeps method content today, listed as main@9362f4e2
 * holds it: the module of the Method Registry and the method scope
 * (`src/application/interpretation`) and the import-free tables
 * (`src/domain`). `src/application/skill/` is pinned by
 * tests/architecture/etbz51-skill-boundary.test.ts. ETBZ-117 adds no file to
 * either; a method placed anywhere else is outside what this gate measures.
 * Like every scope fence of this repository, the slice that brings Method
 * Profile v2 (ETBZ-78) re-pins this deliberately, with its own ADR.
 */
export const METHOD_SCOPE_DIRECTORIES_AT_BASE: Readonly<Record<string, readonly string[]>> = {
  'src/application/interpretation': [
    'chart-symbol-lexicon.ts', 'deterministic-narrative-provider.ts', 'errors.ts', 'feature-set.ts', 'interpretation-input.ts',
    'interpretive-claim-graph.ts', 'interpretive-claim.ts', 'meta-narrative-plan.ts', 'method-registry.ts', 'method-scope.ts',
    'narrative-brief.ts', 'primary-theme.ts', 'report-model.ts', 'specificity-policy.ts', 'theme-graph.ts',
  ],
  'src/domain': ['README.md', 'birth-input.ts', 'canonical-json.ts', 'sizhu.ts', 'structural-hash.ts'],
};

/** The entries of each listed directory as the working tree holds them now, sorted. */
export function currentDirectoryListings(): Record<string, string[]> {
  const listings: Record<string, string[]> = {};
  for (const directory of Object.keys(METHOD_SCOPE_DIRECTORIES_AT_BASE)) {
    listings[directory] = readdirSync(resolve(process.cwd(), directory)).filter((entry) => entry !== '.DS_Store').sort();
  }
  return listings;
}

export const sha256Hex = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');

/** The SHA-256 of each listed file as the working tree holds it now. */
export function currentSha256(table: Readonly<Record<string, string>>): Record<string, string> {
  const current: Record<string, string> = {};
  for (const path of Object.keys(table)) current[path] = sha256Hex(readFileSync(resolve(process.cwd(), path)));
  return current;
}

/** Every path at which two JSON values differ, `+` for a path only the second has, `-` for one only the first has. */
export function jsonDelta(before: unknown, after: unknown, path = ''): string[] {
  if (before === after) return [];
  const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) return [`~${path}`];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => {
    const at = Array.isArray(after) ? `${path}[${key}]` : `${path}.${key}`;
    if (!Object.hasOwn(after, key)) return [`-${at}`];
    if (!Object.hasOwn(before, key)) return [`+${at}`];
    return jsonDelta(before[key], after[key], at);
  });
}

const pair = (interpretationLens: unknown, terminologyLexicon: unknown): unknown => ({ interpretationLens, terminologyLexicon });

/** The current Canon context's answer to each binding a Canon v2 run might bring - the AC4 record. */
function currentContextCases(): readonly { case: string; code: string }[] {
  const lens = PLAN_CONTRACT_BINDINGS_V2_1.interpretationLens;
  const lexicon = PLAN_CONTRACT_BINDINGS_V2_1.terminologyLexicon;
  const a1Lens = PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens;
  const a1Lexicon = PLAN_CONTRACT_BINDINGS_V2_0.terminologyLexicon;
  const cases: readonly [string, () => unknown][] = [
    ['2.1.0 pair on C1/C5 page version 2 (the repository binding)', () => assertCurrentCanonContractBindings(pair(lens, lexicon))],
    ['the A1 2.0.0 pair on C1/C5 page version 1', () => assertCurrentCanonContractBindings(pair(a1Lens, a1Lexicon))],
    ['the A1 2.0.0 Lens on C1 page version 1', () => assertCurrentCanonContractBindings(pair(a1Lens, lexicon))],
    ['the A1 2.0.0 Lexicon on C5 page version 1', () => assertCurrentCanonContractBindings(pair(lens, a1Lexicon))],
    ['the A1 2.0.0 Lens identity on C1 page version 2', () => assertCurrentCanonContractBindings(pair({ ...a1Lens, confluencePageVersion: '2' }, lexicon))],
    ['the whole 1.1.0 pair', () => assertCurrentCanonContractBindings(PLAN_CONTRACT_BINDINGS_V1_1)],
    ['the whole 1.0.0 pair', () => assertCurrentCanonContractBindings(PLAN_CONTRACT_BINDINGS_V1_0)],
    ['the Lens 1.1.0 beside the Lexicon 2.1.0', () => assertCurrentCanonContractBindings(pair(PLAN_CONTRACT_BINDINGS_V1_1.interpretationLens, lexicon))],
    ['the 2.1.0 Lens on C1 page version 1', () => assertCurrentCanonContractBindings(pair({ ...lens, confluencePageVersion: '1' }, lexicon))],
    ['the 2.1.0 Lexicon on C5 page version 1', () => assertCurrentCanonContractBindings(pair(lens, { ...lexicon, confluencePageVersion: '1' }))],
    ['the 2.1.0 Lens on the C5 page', () => assertCurrentCanonContractBindings(pair({ ...lens, confluencePageId: '85164034' }, lexicon))],
    ['Lens and Lexicon swapped', () => assertCurrentCanonContractBindings(pair(lexicon, lens))],
    ['the A1 2.0.0 Lexicon in the Lens slot', () => assertCurrentCanonContractBindings(pair(a1Lexicon, lexicon))],
    ['no Lens slot', () => assertCurrentCanonContractBindings({ terminologyLexicon: lexicon })],
    ['an unknown contract name', () => assertCurrentCanonContractBindings(pair({ ...lens, contractRef: 'interpretation-lens@2.1.0' }, lexicon))],
    ['the Lens lineage with a malformed version', () => assertCurrentCanonContractBindings(pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.1' }, lexicon))],
    ['an unreleased 2.1.1 Lens', () => assertCurrentCanonContractBindings(pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.1.1' }, lexicon))],
    ['an unreleased 3.0.0 Lexicon', () => assertCurrentCanonContractBindings(pair(lens, { ...lexicon, contractRef: 'terminology-wording-lexicon@3.0.0' }))],
    ['an extra key in a binding', () => assertCurrentCanonContractBindings(pair({ ...lens, status: 'CURRENT' }, lexicon))],
    ['resolve Lens 2.1.0', () => resolveCurrentCanonContract('grounded-reflective-synthesis-lens@2.1.0')],
    ['resolve Lexicon 2.1.0', () => resolveCurrentCanonContract('terminology-wording-lexicon@2.1.0')],
    ['resolve the A1 Lens 2.0.0', () => resolveCurrentCanonContract('grounded-reflective-synthesis-lens@2.0.0')],
    ['resolve the A1 Lexicon 2.0.0', () => resolveCurrentCanonContract('terminology-wording-lexicon@2.0.0')],
    ['resolve Lens 1.1.0', () => resolveCurrentCanonContract('grounded-reflective-synthesis-lens@1.1.0')],
    ['resolve the Method Profile 1.0.0', () => resolveCurrentCanonContract('bazi-method-profile@1.0.0')],
  ];
  return cases.map(([label, action]) => ({ case: label, code: contractCodeOf(action) }));
}

/** The historical 2.0 context after ETBZ-117: it still accepts the A1 pair and only it. */
function historicalContextCases(): readonly { case: string; code: string }[] {
  const cases: readonly [string, () => unknown][] = [
    ['the A1 2.0.0 pair (released ETBZ-77 binding)', () => assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_0))],
    ['the 2.1.0 pair', () => assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_1))],
    ['the 2.1.0 Lens beside the A1 Lexicon', () => assertCanonV2ContractBindings(pair(PLAN_CONTRACT_BINDINGS_V2_1.interpretationLens, PLAN_CONTRACT_BINDINGS_V2_0.terminologyLexicon))],
    ['resolve the A1 Lens 2.0.0', () => resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.0.0')],
    ['resolve Lens 2.1.0', () => resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.1.0')],
  ];
  return cases.map(([label, action]) => ({ case: label, code: contractCodeOf(action) }));
}

export function deriveEtbz117Evidence(): Record<string, unknown> {
  const current = assertCurrentCanonContractSet();
  const historical = assertCanonV2ContractSet();
  const text = styleGuideV3Text(STYLE_GUIDE_V3_BLOCKS_V2_1);
  return {
    slice: 'ETBZ-117',
    adr: ETBZ117_ADR,
    base: `main@${ETBZ117_BASE_COMMIT}`,
    canon: { confluencePageId: current.canon.confluencePageId, decisionDate: current.canon.decisionDate, title: current.canon.title },
    lineVersions: CANON_V2_LINE_VERSIONS,
    currentContext: CURRENT_CANON_V2_VERSION,
    contractKeys: CANON_V2_CONTRACT_KEYS,
    contracts: current.contracts.map((contract) => ({
      key: contract.source.key,
      identity: contract.source.identity,
      title: contract.source.title,
      confluencePageId: contract.source.confluencePageId,
      confluencePageVersion: contract.source.confluencePageVersion,
      status: contract.source.status,
      releasedOn: contract.source.releasedOn,
      owns: contract.source.owns,
      dependsOn: contract.source.dependsOn,
      supersedes: contract.supersedes.contractRefs,
      supersedesRebaselineSections: contract.supersedes.rebaselineSections.map((section) => `${section.confluencePageId}#${section.section}`),
      movesForward: (contract.supersedes as { priorCanonVersions?: { contractRefs: readonly string[] } }).priorCanonVersions?.contractRefs ?? null,
      structuralHash: contract.structuralHash,
      releasedHash: RELEASED_CANON_V2_1_CONTRACT_HASHES[contract.source.identity ?? ''],
    })),
    planBindingsV2_1: current.planBindings,
    styleGuideV3PageVersion2: { sha256: sha256Hex(text), utf8Bytes: Buffer.byteLength(text, 'utf8'), lines: text.split('\n').length - 1 },
    pageVersionDelta: {
      lens: jsonDelta(SEMANTIC_ENVELOPE_V2, SEMANTIC_ENVELOPE_V2_1),
      lexicon: jsonDelta(WORDING_BOUNDARIES_V2, WORDING_BOUNDARIES_V2_1),
    },
    currentContextAnswers: currentContextCases(),
    historicalContextAnswers: historicalContextCases(),
    a1: {
      releasedHashes: RELEASED_CANON_V2_CONTRACT_HASHES,
      rebuiltHashes: Object.fromEntries(historical.contracts.map((contract) => [contract.source.identity ?? '', contract.structuralHash])),
      planBindingsV2_0: historical.planBindings,
      byteBaseline: { commit: ETBZ117_BASE_COMMIT, sha256: A1_BASELINE_SHA256 },
    },
    methodScope: {
      byteBaseline: { commit: ETBZ117_BASE_COMMIT, sha256: METHOD_SCOPE_BASELINE_SHA256 },
      releasedRegistryHashes: RELEASED_REGISTRY_HASHES,
      registryHash: structuralHash(BAZI_METHOD_REGISTRY_V1),
      methodKeyOnLine: CANON_V2_CONTRACT_KEYS.includes('METHOD_PROFILE' as never),
      methodProfileOnCurrentLine: contractCodeOf(() => buildCanonV2Contract('METHOD_PROFILE', CURRENT_CANON_V2_VERSION)),
    },
  };
}

export function renderJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}
