/**
 * ETBZ-51 — the refusals of the Skill Contract Bundle.
 *
 * Pattern: the baseline is proven green first (N0), then each test changes as
 * little of it as the refusal needs. A refusal that belongs to the released
 * registry surfaces as the registry's own `MethodRegistryError`; everything a
 * bundle can see is a `SkillContractError` with the code the ticket names:
 * unknown contract id, wrong page/version, missing Method Profile / Lens /
 * Lexicon, precedence conflict, mutable draft override. Nothing partial is
 * ever returned.
 */
import { describe, expect, it } from 'vitest';
import { structuralHash } from '../../src/domain/structural-hash.js';
import { BAZI_METHOD_REGISTRY_V1, MethodRegistryError } from '../../src/application/interpretation/method-registry.js';
import type { MethodRegistry } from '../../src/application/interpretation/method-registry.js';
import {
  CONTRACT_KEYS,
  SkillContractError,
  acceptPortableSkillContractBundle,
  assertContractSource,
  assertReleasedSkillContractBundle,
  assertRunEvidenceBound,
  buildSkillContractBundle,
  contractBindingRef,
  contractByKey,
  renderPortableSkillContractBundle,
  resolveContract,
  validateSkillContractBundleCore,
} from '../../src/application/skill/index.js';
import type {
  ContractDomain,
  ContractKey,
  ContractSource,
  SkillContractBundle,
  SkillContractBundleCore,
  SkillContractErrorCode,
} from '../../src/application/skill/index.js';

const bundle: SkillContractBundle = buildSkillContractBundle();

function coreOf(source: SkillContractBundle): SkillContractBundleCore {
  const { structuralHash: published, ...core } = source;
  expect(published).toMatch(/^sha256:[0-9a-f]{64}$/u);
  return core;
}

/**
 * A refusal is proven by an ASSERTION, never by a thrown helper error: the
 * mutation proof (`scripts/verify-etbz51-skill-contract-bundle.mjs`) counts a
 * kill only when the named test fails an assertion, so "nothing was thrown"
 * and "the wrong error was thrown" both have to surface through `expect`.
 */
function refusal(action: () => unknown): SkillContractError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected a SkillContractError to be thrown').toBeInstanceOf(SkillContractError);
  return caught as SkillContractError;
}

function expectRefusal(action: () => unknown, code: SkillContractErrorCode): SkillContractError {
  const error = refusal(action);
  expect(error.code).toBe(code);
  return error;
}

function withContracts(core: SkillContractBundleCore, contracts: readonly ContractSource[]): SkillContractBundleCore {
  return { ...core, contracts };
}

function replaceContract(core: SkillContractBundleCore, key: ContractKey, patch: Partial<ContractSource>): SkillContractBundleCore {
  return withContracts(core, core.contracts.map((source) => (source.key === key ? { ...source, ...patch } : source)));
}

function portableCopy(): Record<string, unknown> {
  return JSON.parse(renderPortableSkillContractBundle(bundle)) as Record<string, unknown>;
}

function evidenceOf(source: SkillContractBundle) {
  return {
    bundleRef: source.bundleRef,
    contracts: source.contracts.map((contract) => ({
      contractRef: contractBindingRef(contract),
      confluencePageId: contract.confluencePageId,
      confluencePageVersion: contract.confluencePageVersion,
    })),
  };
}

describe('N0: the baseline is green', () => {
  it('builds, validates and is released', () => {
    expect(() => buildSkillContractBundle()).not.toThrow();
    expect(() => validateSkillContractBundleCore(coreOf(bundle), BAZI_METHOD_REGISTRY_V1)).not.toThrow();
    expect(() => assertReleasedSkillContractBundle(bundle)).not.toThrow();
    expect(() => acceptPortableSkillContractBundle(portableCopy())).not.toThrow();
    expect(() => assertRunEvidenceBound(bundle, evidenceOf(bundle))).not.toThrow();
  });
});

describe('N1: unknown contract identity', () => {
  it.each([
    'skill-output-contract@1.0.0',
    'terminology-wording-lexicon@2.0.0',
    'grounded-reflective-synthesis-lens@1.0.1',
    'bazi-method-profile@0.9.0',
    'confluence:57802765@3',
    'confluence:99999999@1',
    '',
  ])('refuses "%s"', (ref) => {
    expectRefusal(() => resolveContract(bundle, ref), 'UNKNOWN_CONTRACT_IDENTITY');
  });

  it('names the released contract when a known name is asked for at another version', () => {
    const error = expectRefusal(() => resolveContract(bundle, 'terminology-wording-lexicon@2.0.0'), 'UNKNOWN_CONTRACT_IDENTITY');
    expect(error.message).toContain('terminology-wording-lexicon@1.0.0');
  });
});

describe('N2/N3: wrong page or wrong page version for a released identity', () => {
  it('refuses the right identity on another page', () => {
    expectRefusal(
      () => assertContractSource(bundle, { contractRef: 'terminology-wording-lexicon@1.0.0', confluencePageId: '67600386', confluencePageVersion: '1' }),
      'CONTRACT_SOURCE_MISMATCH',
    );
  });

  it('refuses the right identity at another page version', () => {
    expectRefusal(
      () => assertContractSource(bundle, { contractRef: 'grounded-reflective-synthesis-lens@1.0.0', confluencePageId: '67371029', confluencePageVersion: '2' }),
      'CONTRACT_SOURCE_MISMATCH',
    );
  });

  it('refuses the Long-Form page address at another version', () => {
    expectRefusal(
      () => assertContractSource(bundle, { contractRef: 'confluence:57802765@2', confluencePageId: '57802765', confluencePageVersion: '3' }),
      'CONTRACT_SOURCE_MISMATCH',
    );
  });
});

describe('N4-N6: a required contract is missing', () => {
  it.each([...CONTRACT_KEYS])('refuses a bundle without %s', (key) => {
    const core = withContracts(coreOf(bundle), bundle.contracts.filter((source) => source.key !== key));
    const error = expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'REQUIRED_CONTRACT_MISSING');
    expect(error.detail).toEqual({ key });
  });

  it('refuses run evidence that omits a bound contract', () => {
    const evidence = evidenceOf(bundle);
    const without = { ...evidence, contracts: evidence.contracts.filter((binding) => !binding.contractRef.startsWith('cross-reading')) };
    expectRefusal(() => assertRunEvidenceBound(bundle, without), 'REQUIRED_CONTRACT_MISSING');
  });
});

describe('N7: precedence conflict', () => {
  it('refuses two owners of one domain', () => {
    const core = replaceContract(coreOf(bundle), 'TERMINOLOGY_LEXICON', { owns: ['CUSTOMER_WORDING', 'SEMANTIC_ENVELOPE'] });
    const error = expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'PRECEDENCE_CONFLICT');
    expect(error.detail).toEqual({ domain: 'SEMANTIC_ENVELOPE', owners: ['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON'] });
  });

  it('refuses a domain no contract owns', () => {
    const core = replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { owns: [] });
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'PRECEDENCE_CONFLICT');
  });

  it('refuses a contract in no tier', () => {
    const core = { ...coreOf(bundle), precedenceTiers: [['METHOD_PROFILE'], ['LONG_FORM'], ['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON']] as const };
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'PRECEDENCE_CONFLICT');
  });

  it('refuses a contract in two tiers', () => {
    const core = { ...coreOf(bundle), precedenceTiers: [['METHOD_PROFILE'], ['LONG_FORM', 'METHOD_PROFILE'], ['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON', 'ANTI_BOILERPLATE']] as const };
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'PRECEDENCE_CONFLICT');
  });

  it('refuses a domain list that is not the known domains', () => {
    const core = { ...coreOf(bundle), domains: ['SYMBOLIC_OPERATIONS'] as const };
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'PRECEDENCE_CONFLICT');
  });
});

describe('N8: a draft authorises nothing', () => {
  it('refuses a DRAFT contract entry in the core', () => {
    const core = replaceContract(coreOf(bundle), 'ANTI_BOILERPLATE', { status: 'DRAFT' });
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'DRAFT_CONTRACT_REFUSED');
  });

  it('refuses a portable copy in which one contract was set to DRAFT, before comparing anything else', () => {
    const copy = portableCopy();
    const contracts = copy['contracts'] as Record<string, unknown>[];
    const lens = contracts.find((source) => source['key'] === 'INTERPRETATION_LENS');
    if (lens === undefined) throw new Error('fixture: lens entry missing');
    lens['status'] = 'DRAFT';
    expectRefusal(() => acceptPortableSkillContractBundle(copy), 'DRAFT_CONTRACT_REFUSED');
  });
});

describe('N9: a mutable override of a portable copy', () => {
  it('refuses a copy that re-binds the Lexicon to page version 2, even with a recomputed hash', () => {
    const copy = portableCopy();
    const contracts = copy['contracts'] as Record<string, unknown>[];
    const lexicon = contracts.find((source) => source['key'] === 'TERMINOLOGY_LEXICON');
    if (lexicon === undefined) throw new Error('fixture: lexicon entry missing');
    lexicon['confluencePageVersion'] = '2';
    const { structuralHash: _dropped, ...core } = copy;
    copy['structuralHash'] = structuralHash(core);
    const error = expectRefusal(() => acceptPortableSkillContractBundle(copy), 'CONTRACT_OVERRIDE_REFUSED');
    expect(error.detail).toEqual({ path: 'bundle.contracts[3].confluencePageVersion' });
    expect(_dropped).toMatch(/^sha256:/u);
  });

  it('refuses a copy that widens the Barnum-risk pattern list', () => {
    const copy = portableCopy();
    const envelope = copy['semanticEnvelope'] as Record<string, unknown>;
    envelope['barnumRiskPatterns'] = [...(envelope['barnumRiskPatterns'] as string[]), 'anything the run finds inconvenient'];
    const { structuralHash: _dropped, ...core } = copy;
    copy['structuralHash'] = structuralHash(core);
    expectRefusal(() => acceptPortableSkillContractBundle(copy), 'CONTRACT_OVERRIDE_REFUSED');
    expect(_dropped).toMatch(/^sha256:/u);
  });

  it('refuses a copy that removes a prohibited wording class', () => {
    const copy = portableCopy();
    const wording = copy['wordingBoundaries'] as Record<string, unknown>;
    wording['prohibitedWordingClasses'] = (wording['prohibitedWordingClasses'] as unknown[]).slice(1);
    expectRefusal(() => acceptPortableSkillContractBundle(copy), 'CONTRACT_OVERRIDE_REFUSED');
  });

  it('refuses a copy whose only change is the published hash', () => {
    const copy = portableCopy();
    copy['structuralHash'] = 'sha256:' + 'ab'.repeat(32);
    expectRefusal(() => acceptPortableSkillContractBundle(copy), 'BUNDLE_NOT_RELEASED');
  });
});

describe('N10: the portable shape is closed', () => {
  it('refuses an extra top-level key, naming the path and never the value', () => {
    const copy = { ...portableCopy(), threshold: 'high' };
    const error = expectRefusal(() => acceptPortableSkillContractBundle(copy), 'BUNDLE_SCHEMA_INVALID');
    expect(error.message).not.toContain('high');
  });

  it('refuses a missing repository marker', () => {
    const copy = portableCopy();
    const repository = { ...(copy['repository'] as Record<string, unknown>) };
    delete repository['metaNarrativePlanVersion'];
    copy['repository'] = repository;
    expectRefusal(() => acceptPortableSkillContractBundle(copy), 'BUNDLE_SCHEMA_INVALID');
  });

  it('refuses a number anywhere in contract data - a contract weighs nothing', () => {
    const copy = portableCopy();
    (copy['individuality'] as Record<string, unknown>)['minimumOverlap'] = 3;
    const error = expectRefusal(() => acceptPortableSkillContractBundle(copy), 'BUNDLE_SCHEMA_INVALID');
    expect(error.message).toContain('is a number');
  });

  it('refuses a core whose bundleRef is not `<id>@<version>`', () => {
    const core = { ...coreOf(bundle), bundleRef: 'bazodiac-skill-contract-bundle@1.0.1' };
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'BUNDLE_SCHEMA_INVALID');
  });

  it('refuses a released identity that is not `<name>@<semver>`', () => {
    const core = replaceContract(coreOf(bundle), 'ANTI_BOILERPLATE', { identity: 'cross-reading-individuality-contract@v1' });
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'BUNDLE_SCHEMA_INVALID');
  });
});

describe('N11: a contract cannot widen the Method Profile', () => {
  it.each(['rooting', 'useful_god', 'day_master_strength', 'luck_pillars_da_yun', 'seasonal_tone'])(
    'refuses a near-neighbour feature bound to "%s"',
    (methodId) => {
      const base = coreOf(bundle);
      const core: SkillContractBundleCore = {
        ...base,
        semanticEnvelope: {
          ...base.semanticEnvelope,
          nearNeighbourFeatures: [...base.semanticEnvelope.nearNeighbourFeatures, { feature: 'a deeper reading', methodRefs: [methodId] }],
        },
      };
      const error = expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'METHOD_REF_OUT_OF_PROFILE');
      expect(error.detail).toMatchObject({ methodId });
    },
  );

  it('refuses a terminology row bound to a deferred method', () => {
    const base = coreOf(bundle);
    const core: SkillContractBundleCore = {
      ...base,
      wordingBoundaries: {
        ...base.wordingBoundaries,
        chartTerminology: base.wordingBoundaries.chartTerminology.map((term) =>
          term.term.startsWith('Month Command') ? { ...term, methodRefs: ['month_command', 'seasonal_strength'] } : term,
        ),
      },
    };
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'METHOD_REF_OUT_OF_PROFILE');
  });
});

describe('N12: a contract file carries no symbolic authority', () => {
  it('refuses an envelope that carries methods', () => {
    const base = coreOf(bundle);
    const core = {
      ...base,
      semanticEnvelope: { ...base.semanticEnvelope, methods: [{ methodId: 'rooting', status: 'APPROVED_MVP_V1' }] },
    } as unknown as SkillContractBundleCore;
    const error = expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'SYMBOLIC_AUTHORITY_REFUSED');
    expect(error.detail).toEqual({ path: 'bundle.semanticEnvelope.methods' });
  });

  it('refuses a wording table that carries fact kinds', () => {
    const copy = portableCopy();
    (copy['wordingBoundaries'] as Record<string, unknown>)['factKinds'] = ['pillar_stem_season'];
    expectRefusal(() => acceptPortableSkillContractBundle(copy), 'SYMBOLIC_AUTHORITY_REFUSED');
  });

  it('refuses an individuality block that carries a deterministic mapping', () => {
    const copy = portableCopy();
    (copy['individuality'] as Record<string, unknown>)['approvedDeterministicMappings'] = ['branch_to_season'];
    expectRefusal(() => acceptPortableSkillContractBundle(copy), 'SYMBOLIC_AUTHORITY_REFUSED');
  });
});

describe('N13: the registry release gate is composed, not re-implemented', () => {
  it('refuses to build against a registry that is not the released one', () => {
    const unreleased: MethodRegistry = { ...BAZI_METHOD_REGISTRY_V1, profileVersion: '1.0.1' };
    let caught: unknown;
    try {
      buildSkillContractBundle(unreleased);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MethodRegistryError);
    expect((caught as MethodRegistryError).code).toBe('REGISTRY_NOT_RELEASED');
  });
});

describe('N14: the bundle may not disagree with what the repository already binds', () => {
  it('refuses a Lexicon entry at another page version than the plan binding', () => {
    const core = replaceContract(coreOf(bundle), 'TERMINOLOGY_LEXICON', { confluencePageVersion: '2' });
    const error = expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'BUNDLE_BINDING_MISMATCH');
    expect(error.detail).toEqual({ key: 'TERMINOLOGY_LEXICON' });
  });

  it('refuses a Lens entry on another page than the plan binding', () => {
    const core = replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { confluencePageId: '67371030' });
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'BUNDLE_BINDING_MISMATCH');
  });

  it('refuses a Method Profile entry that is not the released profile ref', () => {
    const core = replaceContract(coreOf(bundle), 'METHOD_PROFILE', { identity: 'bazi-method-profile@1.0.1' });
    expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'BUNDLE_BINDING_MISMATCH');
  });

  it.each([
    'methodProfileRef', 'methodRegistryStructuralHash', 'interpretationInputSchemaVersion',
    'featureSetVersion', 'interpretiveClaimGraphVersion', 'metaNarrativePlanVersion',
  ] as const)('refuses a repository marker that is not the one this repository carries: %s', (field) => {
    const base = coreOf(bundle);
    const core: SkillContractBundleCore = { ...base, repository: { ...base.repository, [field]: `${base.repository[field]}-elsewhere` } };
    const error = expectRefusal(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1), 'BUNDLE_BINDING_MISMATCH');
    expect(error.detail).toEqual({ field });
  });
});

describe('N15: drift between a run and the bundle', () => {
  it('refuses evidence bound to another bundle version', () => {
    const evidence = { ...evidenceOf(bundle), bundleRef: 'bazodiac-skill-contract-bundle@2.0.0' };
    expectRefusal(() => assertRunEvidenceBound(bundle, evidence), 'CONTRACT_DRIFT');
  });

  it('refuses evidence that binds a known contract at another version', () => {
    const evidence = evidenceOf(bundle);
    const drifted = {
      ...evidence,
      contracts: evidence.contracts.map((binding) =>
        binding.contractRef === 'terminology-wording-lexicon@1.0.0'
          ? { contractRef: 'terminology-wording-lexicon@2.0.0', confluencePageId: '67600385', confluencePageVersion: '2' }
          : binding,
      ),
    };
    const error = expectRefusal(() => assertRunEvidenceBound(bundle, drifted), 'CONTRACT_DRIFT');
    expect(error.detail).toEqual({ recorded: 'terminology-wording-lexicon@2.0.0', bound: 'terminology-wording-lexicon@1.0.0' });
  });

  it('refuses evidence that binds the Long-Form page at another version', () => {
    const evidence = evidenceOf(bundle);
    const drifted = {
      ...evidence,
      contracts: evidence.contracts.map((binding) =>
        binding.contractRef === 'confluence:57802765@2'
          ? { contractRef: 'confluence:57802765@3', confluencePageId: '57802765', confluencePageVersion: '3' }
          : binding,
      ),
    };
    expectRefusal(() => assertRunEvidenceBound(bundle, drifted), 'CONTRACT_DRIFT');
  });

  it('refuses evidence naming a contract nothing released', () => {
    const evidence = evidenceOf(bundle);
    const unknown = { ...evidence, contracts: [...evidence.contracts, { contractRef: 'skill-output-contract@1.0.0', confluencePageId: '1', confluencePageVersion: '1' }] };
    expectRefusal(() => assertRunEvidenceBound(bundle, unknown), 'UNKNOWN_CONTRACT_IDENTITY');
  });

  it('refuses evidence with the right identity on the wrong page', () => {
    const evidence = evidenceOf(bundle);
    const wrongPage = {
      ...evidence,
      contracts: evidence.contracts.map((binding) =>
        binding.contractRef === 'cross-reading-individuality-contract@1.0.0' ? { ...binding, confluencePageId: '72056834' } : binding,
      ),
    };
    expectRefusal(() => assertRunEvidenceBound(bundle, wrongPage), 'CONTRACT_SOURCE_MISMATCH');
  });
});

describe('N16: a bundle that is not the released content', () => {
  it('refuses a published hash that is not the content hash', () => {
    const tampered: SkillContractBundle = { ...bundle, structuralHash: 'sha256:' + 'cd'.repeat(32) };
    expectRefusal(() => assertReleasedSkillContractBundle(tampered), 'BUNDLE_NOT_RELEASED');
  });

  it('refuses a self-consistent bundle whose content is not the released one', () => {
    const core = withContracts(coreOf(bundle), [...bundle.contracts].reverse());
    expect(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1)).not.toThrow();
    const reordered: SkillContractBundle = { ...core, structuralHash: structuralHash(core) };
    const error = expectRefusal(() => assertReleasedSkillContractBundle(reordered), 'BUNDLE_NOT_RELEASED');
    expect(error.message).toContain('not the released');
  });

  it('refuses an unknown bundle version outright', () => {
    const core = { ...coreOf(bundle), bundleVersion: '1.1.0', bundleRef: 'bazodiac-skill-contract-bundle@1.1.0' };
    const candidate: SkillContractBundle = { ...core, structuralHash: structuralHash(core) };
    const error = expectRefusal(() => assertReleasedSkillContractBundle(candidate), 'BUNDLE_NOT_RELEASED');
    expect(error.message).toContain('not a released version');
  });
});

describe('N17: guards the released content never exercises, on a crafted core', () => {
  const validate = (core: SkillContractBundleCore): void => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1);

  it('refuses a bundle version that is not a semver', () => {
    const core = { ...coreOf(bundle), bundleVersion: '1.0', bundleRef: 'bazodiac-skill-contract-bundle@1.0' };
    expectRefusal(() => validate(core), 'BUNDLE_SCHEMA_INVALID');
  });

  it('refuses a contract key nothing released', () => {
    const stray = {
      ...contractByKey(bundle, 'TERMINOLOGY_LEXICON'),
      key: 'SKILL_OUTPUT', identity: null, confluencePageId: '1', owns: [], dependsOn: [],
    } as unknown as ContractSource;
    const core = withContracts(coreOf(bundle), [...bundle.contracts, stray]);
    const error = expectRefusal(() => validate(core), 'BUNDLE_SCHEMA_INVALID');
    expect(error.detail).toEqual({ key: 'SKILL_OUTPUT' });
  });

  it('refuses a contract that occurs twice', () => {
    const core = withContracts(coreOf(bundle), [...bundle.contracts, { ...contractByKey(bundle, 'INTERPRETATION_LENS') }]);
    const error = expectRefusal(() => validate(core), 'BUNDLE_SCHEMA_INVALID');
    expect(error.message).toContain('occurs twice');
  });

  it('refuses a page id that is not a page reference', () => {
    const core = replaceContract(coreOf(bundle), 'ANTI_BOILERPLATE', { confluencePageId: 'page-72056833' });
    const error = expectRefusal(() => validate(core), 'BUNDLE_SCHEMA_INVALID');
    expect(error.message).toContain('not a page reference');
  });

  it('refuses a decision date that is not YYYY-MM-DD, and an empty title', () => {
    const dated = expectRefusal(() => validate(replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { releasedOn: '21.09.2026' })), 'BUNDLE_SCHEMA_INVALID');
    expect(dated.message).toContain('no decision date');
    expectRefusal(() => validate(replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { title: '   ' })), 'BUNDLE_SCHEMA_INVALID');
  });

  it.each(['2026-99-99', '2026-02-30', '2026-13-01', '2026-00-10', '2025-02-29', '2026-04-31'])(
    'refuses a decision date that has the shape but is no calendar date: %s',
    (releasedOn) => {
      const error = expectRefusal(() => validate(replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { releasedOn })), 'BUNDLE_SCHEMA_INVALID');
      expect(error.message).toContain('no decision date');
    },
  );

  it('accepts the leap day that exists (guard self-check)', () => {
    // The released content never carries one; a crafted core proves the check reads the calendar, not just the shape.
    const core = replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { releasedOn: '2024-02-29' });
    expect(() => validate(core)).not.toThrow();
  });

  it('refuses a dependency listed twice', () => {
    const core = replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { dependsOn: ['METHOD_PROFILE', 'LONG_FORM', 'METHOD_PROFILE'] });
    const error = expectRefusal(() => validate(core), 'BUNDLE_SCHEMA_INVALID');
    expect(error.message).toContain('lists a dependency twice');
  });

  it('refuses a domain nothing defines', () => {
    const owns = ['CROSS_READING_INDIVIDUALITY', 'PROSE_STYLE'] as unknown as readonly ContractDomain[];
    const error = expectRefusal(() => validate(replaceContract(coreOf(bundle), 'ANTI_BOILERPLATE', { owns })), 'BUNDLE_SCHEMA_INVALID');
    expect(error.message).toContain('unknown domain');
  });

  it('refuses a contract that depends on itself or on a contract not bound', () => {
    expectRefusal(() => validate(replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { dependsOn: ['INTERPRETATION_LENS'] })), 'BUNDLE_SCHEMA_INVALID');
    const unbound = ['SKILL_OUTPUT'] as unknown as readonly ContractKey[];
    expectRefusal(() => validate(replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { dependsOn: unbound })), 'BUNDLE_SCHEMA_INVALID');
  });

  it('refuses a dependency cycle between contracts', () => {
    const core = replaceContract(coreOf(bundle), 'INTERPRETATION_LENS', { dependsOn: ['METHOD_PROFILE', 'LONG_FORM', 'TERMINOLOGY_LEXICON'] });
    const error = expectRefusal(() => validate(core), 'PRECEDENCE_CONFLICT');
    expect(error.message).toContain('cycle');
  });

  it('refuses an empty precedence tier', () => {
    const core = { ...coreOf(bundle), precedenceTiers: [...bundle.precedenceTiers, []] };
    const error = expectRefusal(() => validate(core), 'PRECEDENCE_CONFLICT');
    expect(error.message).toContain('empty');
  });

  it('refuses a tier that names a contract the bundle does not carry', () => {
    const stray = ['SKILL_OUTPUT'] as unknown as readonly ContractKey[];
    const core = { ...coreOf(bundle), precedenceTiers: [...bundle.precedenceTiers, stray] };
    const error = expectRefusal(() => validate(core), 'PRECEDENCE_CONFLICT');
    expect(error.detail).toEqual({ key: 'SKILL_OUTPUT' });
  });

  it('refuses a core validated against a registry that is not released, before any field comparison', () => {
    const unreleased: MethodRegistry = { ...BAZI_METHOD_REGISTRY_V1, profileVersion: '1.0.1' };
    const error = expectRefusal(() => validateSkillContractBundleCore(coreOf(bundle), unreleased), 'BUNDLE_BINDING_MISMATCH');
    expect(error.message).toContain('not the released one');
    expect(error.detail).toEqual({});
  });

  it('refuses a method reference that is not a string', () => {
    const base = coreOf(bundle);
    const core = {
      ...base,
      semanticEnvelope: {
        ...base.semanticEnvelope,
        nearNeighbourFeatures: [...base.semanticEnvelope.nearNeighbourFeatures, { feature: 'a coerced id', methodRefs: [{ toString: () => 'ten_gods' }] }],
      },
    } as unknown as SkillContractBundleCore;
    const error = expectRefusal(() => validate(core), 'BUNDLE_SCHEMA_INVALID');
    expect(error.message).toContain('not a method id string');
  });

  it('refuses contractByKey for a contract the core does not carry', () => {
    const core = withContracts(coreOf(bundle), bundle.contracts.filter((source) => source.key !== 'INTERPRETATION_LENS'));
    expectRefusal(() => contractByKey(core, 'INTERPRETATION_LENS'), 'REQUIRED_CONTRACT_MISSING');
  });
});

describe('N18: a portable copy edited below the top level, and reference forms', () => {
  it('refuses an extra key inside a vocabulary block, naming the path', () => {
    const copy = portableCopy();
    (copy['semanticEnvelope'] as Record<string, unknown>)['extraGuidance'] = 'be warmer';
    const error = expectRefusal(() => acceptPortableSkillContractBundle(copy), 'CONTRACT_OVERRIDE_REFUSED');
    expect(error.detail).toEqual({ path: 'bundle.semanticEnvelope.extraGuidance' });
    expect(error.message).not.toContain('be warmer');
  });

  it('refuses an extra object inside a vocabulary block', () => {
    const copy = portableCopy();
    (copy['individuality'] as Record<string, unknown>)['pilot'] = { threshold: 'high' };
    const error = expectRefusal(() => acceptPortableSkillContractBundle(copy), 'CONTRACT_OVERRIDE_REFUSED');
    expect(error.detail).toEqual({ path: 'bundle.individuality.pilot' });
  });

  it('refuses a missing key inside a vocabulary block', () => {
    const copy = portableCopy();
    const wording = { ...(copy['wordingBoundaries'] as Record<string, unknown>) };
    delete wording['metaphorConditions'];
    copy['wordingBoundaries'] = wording;
    const error = expectRefusal(() => acceptPortableSkillContractBundle(copy), 'CONTRACT_OVERRIDE_REFUSED');
    expect(error.detail).toEqual({ path: 'bundle.wordingBoundaries.metaphorConditions' });
  });

  it.each(['__proto__', 'constructor', 'prototype'])('refuses the prototype key "%s" wherever it appears', (key) => {
    // Injected as JSON text so that JSON.parse makes it an OWN property, the
    // form in which it reaches a consumer.
    const rendered = renderPortableSkillContractBundle(bundle);
    expect(rendered.split('"individuality":{').length).toBe(2);
    const copy = JSON.parse(rendered.replace('"individuality":{', `"individuality":{"${key}":{"polluted":"yes"},`)) as Record<string, unknown>;
    const error = expectRefusal(() => acceptPortableSkillContractBundle(copy), 'BUNDLE_SCHEMA_INVALID');
    expect(error.detail).toEqual({ path: `bundle.individuality.${key}` });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('refuses a page address for a page that released an identity - the wrong form, not another version', () => {
    expectRefusal(() => resolveContract(bundle, 'confluence:67371029@1'), 'UNKNOWN_CONTRACT_IDENTITY');
    const evidence = evidenceOf(bundle);
    const wrongForm = {
      ...evidence,
      contracts: evidence.contracts.map((binding) =>
        binding.contractRef === 'grounded-reflective-synthesis-lens@1.0.0'
          ? { contractRef: 'confluence:67371029@1', confluencePageId: '67371029', confluencePageVersion: '1' }
          : binding,
      ),
    };
    expectRefusal(() => assertRunEvidenceBound(bundle, wrongForm), 'UNKNOWN_CONTRACT_IDENTITY');
  });

  it('refuses run evidence that binds a contract twice, even identically', () => {
    const evidence = evidenceOf(bundle);
    const lexicon = evidence.contracts.find((binding) => binding.contractRef === 'terminology-wording-lexicon@1.0.0');
    if (lexicon === undefined) throw new Error('fixture: lexicon binding missing');
    const error = expectRefusal(
      () => assertRunEvidenceBound(bundle, { ...evidence, contracts: [...evidence.contracts, { ...lexicon }] }),
      'BUNDLE_SCHEMA_INVALID',
    );
    expect(error.detail).toEqual({ key: 'TERMINOLOGY_LEXICON' });
  });
});
