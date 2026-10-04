/**
 * ETBZ-77 — the machine-derived record of the Canon v2 contract release (A1):
 * identities, page bindings, content hashes, the 2.0 context's refusals, the
 * historical 1.x resolution and the 1.x byte baseline. The contract suite
 * re-derives `docs/evidence/etbz-77/contracts-v2/contracts-v2.json` from this
 * byte for byte; `npm run etbz77:evidence` only saves what that suite checks.
 *
 * The 1.x baseline is NOT derived from the working tree: it is the SHA-256 of
 * each 1.x contract VALUE module (the Lens, Lexicon and Anti-Boilerplate tables
 * 1.0/1.1) and of both 1.x Skill packages as `main@cb7605e5` holds them, written out here once (re-derive it
 * with `git cat-file blob cb7605e5:<path> | shasum -a 256`). The suite compares
 * the working tree against it, so an in-place edit of a 1.x file cannot be
 * laundered by regenerating the evidence.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { BAZI_METHOD_REGISTRY_V1 } from '../../src/application/interpretation/method-registry.js';
import {
  CANON_V2_CONTRACT_VERSION,
  PLAN_CONTRACT_BINDINGS_V2_0,
  RELEASED_BUNDLE_HASHES,
  RELEASED_CANON_V2_CONTRACT_HASHES,
  SkillContractError,
  assertCanonV2ContractBindings,
  assertCanonV2ContractSet,
  buildSkillContractBundle,
  contractBindingRef,
  resolveCanonV2Contract,
  resolveContract,
  styleGuideV3Text,
} from '../../src/application/skill/index.js';
import { PLAN_CONTRACT_BINDINGS_V1_0, PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';

export const ETBZ77_EVIDENCE_PATH = 'docs/evidence/etbz-77/contracts-v2/contracts-v2.json';
export const ETBZ77_BASE_COMMIT = 'cb7605e58bee57cfff68c2a3b0a6a889ca1634c6';

/**
 * The 1.x contract value modules and both 1.x Skill packages, as main@cb7605e5
 * holds them. Shared machinery that later slices must extend - the bundle
 * builder, the plan module, the source tables - is not pinned by bytes: what
 * it binds for 1.x is frozen by RELEASED_BUNDLE_HASHES (sources, envelopes,
 * wording, plan bindings, tiers, repository markers are all in that hash).
 */
export const V1_BASELINE_SHA256: Readonly<Record<string, string>> = {
  'src/application/skill/individuality-contract.ts': '3932aaea05a99b80a39be183fcf8441172fd7ea014ab22dc98f88f863670d667',
  'src/application/skill/semantic-envelope-v1-1.ts': '234390e1e2461eee13023b9820fa12a1978364a6e3a05889d700c2942e307371',
  'src/application/skill/semantic-envelope.ts': '1bf0aec0e0a9da10b10ca705eafb2c50b2abc2f27d01842ad2511f27545198e2',
  'src/application/skill/wording-boundaries-v1-1.ts': '07b2770805b7706b169dd8121311a7150dcd8af5e587ce1ae2757ba922028b53',
  'src/application/skill/wording-boundaries.ts': '6f02bf51d72a88a8b993d481a7868c9e9b4315e62fdd3f26218e739c60a57b41',
  'skill/bazodiac-interpretation-skill-v1.1/MANIFEST.json': '92e23ba8f7afbf5dac0b64f36d9227a9a07dbb7c903e9f363bc47fbacc854c5f',
  'skill/bazodiac-interpretation-skill-v1.1/README.md': '8912ee7b89ef00555644fb8cef66c8fb57b62debf2b15dcefdf2151d6c35d702',
  'skill/bazodiac-interpretation-skill-v1.1/SKILL.md': 'b0c780438470c59ac868e12df78f7bd6aa03ccbd023226f18ce4ca6b6c0e4bb3',
  'skill/bazodiac-interpretation-skill-v1.1/contract-bundle.json': '20d68cebba8948deaec04fd4526d8be2463a7f5d7c62f32b41f80066fe39e63c',
  'skill/bazodiac-interpretation-skill-v1.1/reading-schema.json': '93eaa3ae1dab1b49d7fdd261a634d5b12ac036e387e715e484880cd5a3e56bbc',
  'skill/bazodiac-interpretation-skill-v1.1/wrappers/chatgpt.md': 'ab14ca693fa36a55da46f4ab7a0ff77ec5764d76698fe37eeb5242b3d4fe57b5',
  'skill/bazodiac-interpretation-skill-v1.1/wrappers/claude.md': '5fdfb608cc1d763b91841c4bcb6b70c64fb7da6ca9dbdb6131a1710478cc58c5',
  'skill/bazodiac-interpretation-skill-v1/MANIFEST.json': '534c6183c1f73d77379b9596217a14e7f20c1ae291b923d70d03f1ead5079da6',
  'skill/bazodiac-interpretation-skill-v1/README.md': 'd67139d7e1d8f210e996370e29236d1c6c294e9abad79d988f871ca1fe725544',
  'skill/bazodiac-interpretation-skill-v1/SKILL.md': 'd11f973e5010fc0186940e922c12d2ab7da119fced86f00597fc61d185e96bb6',
  'skill/bazodiac-interpretation-skill-v1/contract-bundle.json': '2785156f9ccbe168bffc37f4627b93dff500e6f9b9995879083ad57c697d3d22',
  'skill/bazodiac-interpretation-skill-v1/reading-schema.json': '93eaa3ae1dab1b49d7fdd261a634d5b12ac036e387e715e484880cd5a3e56bbc',
  'skill/bazodiac-interpretation-skill-v1/wrappers/chatgpt.md': 'df6b8c75fa874e1326de9e603478a436227e3b5a6cb19815172abab553938536',
  'skill/bazodiac-interpretation-skill-v1/wrappers/claude.md': '026c555d1eecaaa39d3dc1eaf05e74e1c9789592c834100798c5a4921337b5f3',
};

export const sha256Hex = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');

/** The SHA-256 of each baseline file as the working tree holds it now. */
export function currentV1Sha256(): Record<string, string> {
  const current: Record<string, string> = {};
  for (const path of Object.keys(V1_BASELINE_SHA256)) current[path] = sha256Hex(readFileSync(resolve(process.cwd(), path)));
  return current;
}

/** The refusal code of an action, or ACCEPTED. Anything but a SkillContractError is a defect and propagates. */
export function contractCodeOf(action: () => unknown): string {
  try {
    action();
    return 'ACCEPTED';
  } catch (error) {
    if (error instanceof SkillContractError) return error.code;
    throw error;
  }
}

/** The 2.0 context's answer to each binding a Canon v2 run might bring - the AC2 record. */
function identitySeparation(): readonly { case: string; code: string }[] {
  const lens = PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens;
  const lexicon = PLAN_CONTRACT_BINDINGS_V2_0.terminologyLexicon;
  const pair = (interpretationLens: unknown, terminologyLexicon: unknown): unknown => ({ interpretationLens, terminologyLexicon });
  const cases: readonly [string, () => unknown][] = [
    ['2.0.0 pair (the repository binding)', () => assertCanonV2ContractBindings(pair(lens, lexicon))],
    ['Lens 1.1.0 in the 2.0 context', () => assertCanonV2ContractBindings(pair(PLAN_CONTRACT_BINDINGS_V1_1.interpretationLens, lexicon))],
    ['Lexicon 1.1.0 in the 2.0 context', () => assertCanonV2ContractBindings(pair(lens, PLAN_CONTRACT_BINDINGS_V1_1.terminologyLexicon))],
    ['Lens 1.0.0 in the 2.0 context', () => assertCanonV2ContractBindings(pair(PLAN_CONTRACT_BINDINGS_V1_0.interpretationLens, lexicon))],
    ['Lexicon 1.0.0 in the 2.0 context', () => assertCanonV2ContractBindings(pair(lens, PLAN_CONTRACT_BINDINGS_V1_0.terminologyLexicon))],
    ['the whole 1.1.0 pair in the 2.0 context', () => assertCanonV2ContractBindings(PLAN_CONTRACT_BINDINGS_V1_1)],
    ['an unreleased 2.0.1 Lens', () => assertCanonV2ContractBindings(pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.0.1' }, lexicon))],
    ['an unknown contract name', () => assertCanonV2ContractBindings(pair({ ...lens, contractRef: 'interpretation-lens@2.0.0' }, lexicon))],
    ['Lens and Lexicon swapped', () => assertCanonV2ContractBindings(pair(lexicon, lens))],
    ['Lens 2.0.0 on another page version', () => assertCanonV2ContractBindings(pair({ ...lens, confluencePageVersion: '2' }, lexicon))],
    ['no Lens slot', () => assertCanonV2ContractBindings({ terminologyLexicon: lexicon })],
    ['resolve Lens 1.1.0 in the 2.0 context', () => resolveCanonV2Contract('grounded-reflective-synthesis-lens@1.1.0')],
    ['resolve Lexicon 1.1.0 in the 2.0 context', () => resolveCanonV2Contract('terminology-wording-lexicon@1.1.0')],
    ['resolve Lens 2.0.0 in the 2.0 context', () => resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.0.0')],
  ];
  return cases.map(([label, action]) => ({ case: label, code: contractCodeOf(action) }));
}

export function deriveEtbz77Evidence(): Record<string, unknown> {
  const set = assertCanonV2ContractSet();
  const text = styleGuideV3Text();
  const historical = (['1.0.0', '1.1.0'] as const).map((version) => {
    const bundle = buildSkillContractBundle(BAZI_METHOD_REGISTRY_V1, version);
    return {
      bundleRef: bundle.bundleRef,
      structuralHash: bundle.structuralHash,
      releasedHash: RELEASED_BUNDLE_HASHES[version],
      lensResolves: contractBindingRef(resolveContract(bundle, version === '1.0.0' ? 'grounded-reflective-synthesis-lens@1.0.0' : 'grounded-reflective-synthesis-lens@1.1.0')),
      lexiconResolves: contractBindingRef(resolveContract(bundle, version === '1.0.0' ? 'terminology-wording-lexicon@1.0.0' : 'terminology-wording-lexicon@1.1.0')),
    };
  });
  return {
    slice: 'ETBZ-77',
    adr: 'docs/adr/0019-canon-v2-contracts.md',
    base: `main@${ETBZ77_BASE_COMMIT}`,
    canon: { confluencePageId: set.canon.confluencePageId, decisionDate: set.canon.decisionDate, title: set.canon.title },
    contractVersion: CANON_V2_CONTRACT_VERSION,
    contracts: set.contracts.map((contract) => ({
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
      structuralHash: contract.structuralHash,
      releasedHash: RELEASED_CANON_V2_CONTRACT_HASHES[contract.source.identity ?? ''],
    })),
    planBindingsV2_0: set.planBindings,
    styleGuideV3: { sha256: sha256Hex(text), utf8Bytes: Buffer.byteLength(text, 'utf8'), lines: text.split('\n').length - 1 },
    identitySeparation: identitySeparation(),
    historicalBundles: historical,
    v1Baseline: { commit: ETBZ77_BASE_COMMIT, sha256: V1_BASELINE_SHA256 },
  };
}

export function renderJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}
