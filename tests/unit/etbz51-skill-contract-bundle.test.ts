/**
 * ETBZ-51 — the Skill Contract Bundle as the repository releases it.
 *
 * Every value a Skill run will be held to is stated here in full rather than
 * derived from the module under test: the five page bindings, the repository
 * markers, the released hash. A bundle that drifts from any of them is a new
 * bundle, not an edit of this one.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import { FEATURE_SET_VERSION } from '../../src/application/interpretation/feature-set.js';
import { INTERPRETATION_INPUT_SCHEMA_VERSION } from '../../src/application/interpretation/interpretation-input.js';
import { INTERPRETIVE_CLAIM_GRAPH_VERSION } from '../../src/application/interpretation/interpretive-claim-graph.js';
import {
  INTERPRETATION_LENS_BINDING,
  META_NARRATIVE_PLAN_VERSION,
  TERMINOLOGY_LEXICON_BINDING,
} from '../../src/application/interpretation/meta-narrative-plan.js';
import {
  BAZI_METHOD_REGISTRY_V1,
  METHOD_PROFILE_REF,
  RELEASED_REGISTRY_HASHES,
  isApprovedStatus,
} from '../../src/application/interpretation/method-registry.js';
import {
  CONTRACT_DOMAINS,
  CONTRACT_KEYS,
  RELEASED_BUNDLE_HASHES,
  SKILL_CONTRACT_BUNDLE_REF,
  acceptPortableSkillContractBundle,
  assertReleasedSkillContractBundle,
  assertRunEvidenceBound,
  buildSkillContractBundle,
  contractBindingRef,
  contractByKey,
  renderPortableSkillContractBundle,
  resolveContract,
} from '../../src/application/skill/index.js';
import type { ContractKey, SkillContractBundle } from '../../src/application/skill/index.js';

const bundle: SkillContractBundle = buildSkillContractBundle();

function walk(value: unknown, visit: (path: string, key: string | null, entry: unknown) => void, path = 'bundle'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      visit(`${path}[${index}]`, null, entry);
      walk(entry, visit, `${path}[${index}]`);
    });
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      visit(`${path}.${key}`, key, entry);
      walk(entry, visit, `${path}.${key}`);
    }
  }
}

function methodRefsOf(value: unknown): string[] {
  const found: string[] = [];
  walk(value, (_path, key, entry) => {
    if (key === 'methodRefs' && Array.isArray(entry)) found.push(...entry.map(String));
  });
  return found;
}

describe('ETBZ-51: the released bundle', () => {
  it('is bazodiac-skill-contract-bundle@1.0.0, frozen by the hash the release table carries', () => {
    expect(bundle.bundleRef).toBe('bazodiac-skill-contract-bundle@1.0.0');
    expect(bundle.bundleRef).toBe(SKILL_CONTRACT_BUNDLE_REF);
    const { structuralHash: published, ...core } = bundle;
    expect(published).toBe(structuralHash(core));
    expect(RELEASED_BUNDLE_HASHES['1.0.0']).toBe(published);
    expect(() => assertReleasedSkillContractBundle(bundle)).not.toThrow();
  });

  it('binds exactly the five released contract sources by page id and released page version', () => {
    const table = bundle.contracts.map((source) => [
      source.key, source.identity, source.confluencePageId, source.confluencePageVersion, source.status,
    ]);
    // Each value read back from Confluence on 2026-09-28; none is derived here.
    expect(table).toEqual([
      ['METHOD_PROFILE', 'bazi-method-profile@1.0.0', '63012866', '5', 'CURRENT'],
      ['LONG_FORM', null, '57802765', '2', 'CURRENT'],
      ['INTERPRETATION_LENS', 'grounded-reflective-synthesis-lens@1.0.0', '67371029', '1', 'CURRENT'],
      ['TERMINOLOGY_LEXICON', 'terminology-wording-lexicon@1.0.0', '67600385', '1', 'CURRENT'],
      ['ANTI_BOILERPLATE', 'cross-reading-individuality-contract@1.0.0', '72056833', '1', 'CURRENT'],
    ]);
    expect(bundle.contracts.map((source) => source.key)).toEqual([...CONTRACT_KEYS]);
    expect(bundle.parentDecision).toEqual({
      title: 'Bazodiac Interpretation Model & Skill-driven Concierge MVP Rebaseline v1',
      confluencePageId: '62128133',
      section: '4',
    });
  });

  it('addresses the Long-Form contract, which released no identity, by page and version only', () => {
    const longForm = contractByKey(bundle, 'LONG_FORM');
    expect(longForm.identity).toBeNull();
    expect(contractBindingRef(longForm)).toBe('confluence:57802765@2');
    expect(resolveContract(bundle, 'confluence:57802765@2')).toBe(longForm);
  });

  it('agrees with the bindings the plan and the registry already carry', () => {
    const lexicon = contractByKey(bundle, 'TERMINOLOGY_LEXICON');
    const lens = contractByKey(bundle, 'INTERPRETATION_LENS');
    expect({ contractRef: lexicon.identity, confluencePageId: lexicon.confluencePageId, confluencePageVersion: lexicon.confluencePageVersion })
      .toEqual(TERMINOLOGY_LEXICON_BINDING);
    expect({ contractRef: lens.identity, confluencePageId: lens.confluencePageId, confluencePageVersion: lens.confluencePageVersion })
      .toEqual(INTERPRETATION_LENS_BINDING);
    expect(contractByKey(bundle, 'METHOD_PROFILE').identity).toBe(METHOD_PROFILE_REF);
    expect(bundle.repository).toEqual({
      methodProfileRef: 'bazi-method-profile@1.0.0',
      methodRegistryStructuralHash: 'sha256:77545607f6e547f67df14ec9936ff66a9f90d643b51302e614c7bc0922085224',
      interpretationInputSchemaVersion: 'bazodiac-interpretation-input.v1',
      featureSetVersion: 'etbz-34.feature-set.v3',
      interpretiveClaimGraphVersion: 'etbz-30.interpretive-claim-graph.v1',
      metaNarrativePlanVersion: 'etbz-30.meta-narrative-plan.v1',
    });
    expect(bundle.repository.methodRegistryStructuralHash).toBe(RELEASED_REGISTRY_HASHES['1.0.0']);
    expect(bundle.repository.interpretationInputSchemaVersion).toBe(INTERPRETATION_INPUT_SCHEMA_VERSION);
    expect(bundle.repository.featureSetVersion).toBe(FEATURE_SET_VERSION);
    expect(bundle.repository.interpretiveClaimGraphVersion).toBe(INTERPRETIVE_CLAIM_GRAPH_VERSION);
    expect(bundle.repository.metaNarrativePlanVersion).toBe(META_NARRATIVE_PLAN_VERSION);
  });

  it('resolves every released contract by its binding reference', () => {
    for (const source of bundle.contracts) {
      expect(resolveContract(bundle, contractBindingRef(source))).toBe(source);
      expect(contractByKey(bundle, source.key)).toBe(source);
    }
  });

  it('accepts run evidence that binds every contract at its released identity, page and version', () => {
    const evidence = {
      bundleRef: bundle.bundleRef,
      contracts: bundle.contracts.map((source) => ({
        contractRef: contractBindingRef(source),
        confluencePageId: source.confluencePageId,
        confluencePageVersion: source.confluencePageVersion,
      })),
    };
    expect(() => assertRunEvidenceBound(bundle, evidence)).not.toThrow();
  });

  it('gives every contract one precedence tier and every domain exactly one owner', () => {
    expect(bundle.precedenceTiers).toEqual([
      ['METHOD_PROFILE'],
      ['LONG_FORM'],
      ['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON', 'ANTI_BOILERPLATE'],
    ]);
    const tiers = new Map<ContractKey, number>();
    bundle.precedenceTiers.forEach((tier, index) => tier.forEach((key) => tiers.set(key, index)));
    expect([...tiers.keys()].sort()).toEqual([...CONTRACT_KEYS].sort());
    const owners = new Map<string, ContractKey[]>();
    for (const source of bundle.contracts) {
      for (const domain of source.owns) owners.set(domain, [...(owners.get(domain) ?? []), source.key]);
    }
    expect([...owners.keys()].sort()).toEqual([...CONTRACT_DOMAINS].sort());
    for (const [domain, keys] of owners) expect(keys, domain).toHaveLength(1);
    expect(bundle.domains).toEqual([...CONTRACT_DOMAINS]);
  });

  it('names only approved methods of the released registry, and names the whole sellable core', () => {
    const approved = new Set(
      BAZI_METHOD_REGISTRY_V1.methods.filter((method) => isApprovedStatus(method.status)).map((method) => method.methodId),
    );
    const named = new Set(methodRefsOf(bundle));
    expect(named.size).toBeGreaterThan(0);
    for (const methodId of named) expect(approved.has(methodId), methodId).toBe(true);
    for (const core of BAZI_METHOD_REGISTRY_V1.enabledSets.minimumSellableCore) {
      expect(named.has(core), `the sellable core method ${core} is named by no contract`).toBe(true);
    }
  });

  it('publishes no number and carries no prose field', () => {
    const numbers: string[] = [];
    const proseKeys: string[] = [];
    walk(bundle, (path, key, entry) => {
      if (typeof entry === 'number') numbers.push(path);
      if (key !== null && /^(prompt|prose|statement|paragraph|sentence)$/u.test(key)) proseKeys.push(path);
    });
    expect(numbers).toEqual([]);
    expect(proseKeys).toEqual([]);
  });

  it('round-trips through its portable form byte for byte and comes back as the repository bundle', () => {
    const rendered = renderPortableSkillContractBundle(bundle);
    expect(rendered).toBe(canonicalJson(bundle));
    const accepted = acceptPortableSkillContractBundle(JSON.parse(rendered));
    expect(accepted).toEqual(bundle);
    expect(renderPortableSkillContractBundle(accepted)).toBe(rendered);
  });
});

describe('ETBZ-51: the Interpretation Lens as values (67371029 v1)', () => {
  const envelope = bundle.semanticEnvelope;

  it('carries the six epistemic levels and the hard law', () => {
    expect(envelope.epistemicLevels.map((level) => level.level)).toEqual(['E0', 'E1', 'E2', 'E3', 'E4', 'E5']);
    expect(envelope.epistemicLevels.map((level) => level.name)).toEqual([
      'FACT', 'AUTHORIZED_SYMBOLIC_RELATION', 'LOCAL_INTERPRETATION',
      'COMPOSITE_INTERPRETIVE_HYPOTHESIS', 'NARRATIVE_METAPHOR', 'REFLECTION',
    ]);
    expect(envelope.epistemicLevelsSource).toEqual({ contract: 'INTERPRETATION_LENS', section: '2' });
    expect(envelope.epistemicHardLaw).toContain('E2–E5');
  });

  it('carries five Ten-God families with ten variants, each bound to the ten_gods method', () => {
    expect(envelope.tenGodFamilies.map((family) => family.hanzi)).toEqual(['比劫', '食傷', '財', '官殺', '印']);
    expect(envelope.tenGodVariants).toHaveLength(10);
    const familyIds = new Set(envelope.tenGodFamilies.map((family) => family.familyId));
    for (const variant of envelope.tenGodVariants) expect(familyIds.has(variant.familyId), variant.hanzi).toBe(true);
    for (const family of envelope.tenGodFamilies) {
      expect(family.mustNotBecome.length).toBeGreaterThan(0);
      expect(family.methodRefs).toEqual(['ten_gods']);
      expect(family.source.section).toMatch(/^5\.\d$/u);
    }
    expect(envelope.variantHardRule).toContain('no universal');
  });

  it('carries the depth operators, claim types, dimensions, Barnum patterns and near-neighbour features', () => {
    expect(envelope.depthOperators.map((operator) => operator.operatorId)).toEqual([
      'REINFORCEMENT', 'GROUNDED_TENSION', 'SURFACE_INTERIOR_CONTRAST', 'RECURRENCE_WITHOUT_DOMINANCE',
      'POSITIONAL_CONTEXTUALISATION', 'ALTERNATIVE_MANIFESTATION', 'INTEGRATION',
    ]);
    expect(envelope.depthOperators.filter((operator) => operator.claimRelation !== null).map((operator) => operator.claimRelation))
      .toEqual(['CONTRASTS_WITH', 'ALTERNATIVE_READING']);
    expect(envelope.claimTypes).toEqual(['local', 'contrast', 'reinforcement', 'contextualized', 'alternative', 'integration']);
    expect(envelope.evaluationDimensions).toEqual(['GROUNDING', 'SPECIFICITY', 'RESONANCE', 'NARRATIVE_QUALITY', 'OVERREACH']);
    expect(envelope.barnumRiskPatterns).toHaveLength(7);
    expect(envelope.nearNeighbourFeatures).toHaveLength(8);
    expect(envelope.reflectionJobs.allowed).toHaveLength(4);
    expect(envelope.reflectionJobs.forbidden).toHaveLength(8);
    expect(envelope.llmJudgeNeverSoleOracleFor).toContain('sellability');
  });
});

describe('ETBZ-51: the Terminology & Wording Lexicon as values (67600385 v1)', () => {
  const wording = bundle.wordingBoundaries;

  it('carries the ten global rules and the terminology matrix', () => {
    expect(wording.globalLanguageRules.map((rule) => rule.ruleId)).toEqual([
      'L3.1', 'L3.2', 'L3.3', 'L3.4', 'L3.5', 'L3.6', 'L3.7', 'L3.8', 'L3.9', 'L3.10',
    ]);
    expect(wording.chartTerminology).toHaveLength(14);
    for (const term of wording.chartTerminology) {
      expect(term.customerEn.length).toBeGreaterThan(0);
      expect(term.customerDe.length).toBeGreaterThan(0);
      expect(term.sourceTreatment.length).toBeGreaterThan(0);
    }
    expect(wording.chartTerminology.find((term) => term.term.startsWith('Day Master'))?.methodRefs).toEqual(['day_master']);
  });

  it('carries the Ten-God wording for five families and ten relations, in both languages', () => {
    expect(wording.tenGodFamilyWording.map((family) => family.familyId)).toEqual(['PEER', 'OUTPUT', 'WEALTH', 'AUTHORITY', 'RESOURCE']);
    expect(wording.tenGodRelationWording).toHaveLength(10);
    const familyIds = new Set(wording.tenGodFamilyWording.map((family) => family.familyId));
    for (const relation of wording.tenGodRelationWording) {
      expect(familyIds.has(relation.familyId), relation.hanzi).toBe(true);
      expect(relation.prohibited.length).toBeGreaterThan(0);
      expect(relation.aliases.length).toBeGreaterThan(0);
    }
    expect(wording.tenGodsHardRule).toContain('never reconstructed');
  });

  it('carries uncertainty language, unknown-time patterns, warnings, metaphor conditions and the prohibited classes', () => {
    expect(wording.uncertaintyLanguage.map((entry) => entry.state)).toEqual([
      'validated fact', 'supported interpretation', 'composite hypothesis',
      'tentative interpretation', 'alternative manifestation', 'reflection',
    ]);
    expect(wording.unknownTimeRules).toHaveLength(5);
    expect(wording.unknownTimePatterns.methodRefs).toEqual(['provisionality_unknown_time']);
    expect(wording.sourceWarningWording.methodRefs).toEqual(['source_warnings']);
    expect(wording.metaphorConditions).toHaveLength(4);
    expect(wording.prohibitedWordingClasses.map((entry) => entry.classId)).toEqual([
      'DETERMINISM_CAUSALITY', 'UNSUPPORTED_BALANCE_STRENGTH', 'CLINICAL_THERAPEUTIC',
      'GENDER_IDENTITY', 'MYSTIFICATION_PSEUDO_SCIENCE', 'ADVICE_PREDICTION',
    ]);
    expect(wording.antiPhraseBankRule.mayNot).toHaveLength(4);
  });
});

describe('ETBZ-51: the Cross-Reading Individuality contract as values (72056833 v1)', () => {
  const individuality = bundle.individuality;

  it('carries the eight rules, four dimensions and seven checks', () => {
    expect(individuality.rules.map((rule) => rule.ruleId)).toEqual(['IND-1', 'IND-2', 'IND-3', 'IND-4', 'IND-5', 'IND-6', 'IND-7', 'IND-8']);
    expect(individuality.dimensions).toEqual(['GROUNDING', 'SPECIFICITY', 'INTERPRETIVE_DEPTH', 'NARRATIVE_QUALITY']);
    expect(individuality.checks.map((check) => check.checkId)).toEqual(['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7']);
  });

  it('carries the fifteen reason codes with their class, each raised by a defined check', () => {
    expect(individuality.reasonCodes).toHaveLength(15);
    const byClass = { BLOCKING: 0, ADVISORY: 0, INFORMATIONAL: 0 };
    const checkIds = new Set(individuality.checks.map((check) => check.checkId));
    for (const code of individuality.reasonCodes) {
      byClass[code.class] += 1;
      expect(code.checks.length).toBeGreaterThan(0);
      for (const checkId of code.checks) expect(checkIds.has(checkId), `${code.code} -> ${checkId}`).toBe(true);
    }
    expect(byClass).toEqual({ BLOCKING: 8, ADVISORY: 6, INFORMATIONAL: 1 });
    expect(new Set(individuality.reasonCodes.map((code) => code.code)).size).toBe(15);
  });

  it('carries the six-item Golden-Run minimum over the checks it names', () => {
    expect(individuality.goldenRunMinimum.map((item) => item.itemId)).toEqual(['8.1', '8.2', '8.3', '8.4', '8.5', '8.6']);
    const covered = new Set(individuality.goldenRunMinimum.flatMap((item) => item.checkIds));
    expect([...covered].sort()).toEqual(['6.1', '6.2', '6.3', '6.4', '6.5', '6.7']);
    expect(individuality.stopConditions).toHaveLength(5);
  });
});
