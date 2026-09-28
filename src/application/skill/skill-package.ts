// =============================================================================
// ETBZ-52 - the Skill identity and the input package a Skill run is handed.
//
// The package is the ONLY thing a Skill runtime reads. It carries the
// validated, interpretable chart facts, the accepted claim graph, the accepted
// plan, the source warnings verbatim and the released contract set - never a
// raw producer body, never a display of assumed-time facts, never a method the
// registry does not enable. It is hash-bound so that the reading a runtime
// returns can name exactly what it was produced from.
//
// Building the package re-proves that its parts describe one chart under one
// contract set; it repairs nothing and adds nothing.
// =============================================================================

import { structuralHash } from '../../domain/structural-hash.js';
import type { ChartFact } from '../interpretation/feature-set.js';
import type { BazodiacInterpretationInput } from '../interpretation/interpretation-input.js';
import type { InterpretiveClaimGraph } from '../interpretation/interpretive-claim-graph.js';
import type { MetaNarrativePlan, ReleasedContractBinding } from '../interpretation/meta-narrative-plan.js';
import { contractBindingRef } from './contract-sources.js';
import { assertReleasedSkillContractBundle, contractByKey } from './skill-contract-bundle.js';
import type { SkillContractBundle } from './skill-contract-bundle.js';
import { SkillRunError } from './skill-run-errors.js';

export const SKILL_ID = 'bazodiac-interpretation-skill' as const;
export const SKILL_VERSION = '1.0.0' as const;
/** The identity a reading and a run's evidence record. */
export const SKILL_REF = `${SKILL_ID}@${SKILL_VERSION}` as const;

export const SKILL_INPUT_PACKAGE_VERSION = 'bazodiac-skill-input.v1' as const;

export interface SkillInputPackage {
  readonly packageVersion: typeof SKILL_INPUT_PACKAGE_VERSION;
  readonly skillRef: typeof SKILL_REF;
  readonly bundleRef: string;
  readonly bundleStructuralHash: string;
  /** The released contract set, as a run's evidence must record it. */
  readonly contracts: readonly ReleasedContractBinding[];
  readonly subject: Readonly<{ displayName: string; birthTimeKnown: boolean }>;
  /** Hash of the exact `BazodiacInterpretationInput v1` the facts come from. */
  readonly interpretationInputStructuralHash: string;
  /** Interpretable facts only. An excluded fact is listed by id, never by value. */
  readonly facts: readonly ChartFact[];
  readonly excludedFactIds: readonly string[];
  readonly provisionalFactIds: readonly string[];
  /** FuFirE warning codes, verbatim: source order, duplicates, unknown codes. */
  readonly warnings: readonly string[];
  readonly precision: BazodiacInterpretationInput['precision'];
  readonly claimGraph: InterpretiveClaimGraph;
  readonly plan: MetaNarrativePlan;
  /** The presentation slots a visualization spec may bind to. Supplied by the caller that owns the visual contract. */
  readonly allowedSlotIds: readonly string[];
  readonly structuralHash: string;
}

export interface SkillInputPackageParts {
  readonly bundle: SkillContractBundle;
  readonly input: BazodiacInterpretationInput;
  readonly graph: InterpretiveClaimGraph;
  readonly plan: MetaNarrativePlan;
  readonly subject: Readonly<{ displayName: string; birthTimeKnown: boolean }>;
  readonly allowedSlotIds: readonly string[];
}

/** A slot id as the visual contract spells it (e.g. `pillars.stem[*]`): one non-empty token without whitespace. */
const ID_PATTERN = /^[a-z][^\s]*$/u;

/**
 * Assembles the package and proves its parts belong together. Throws on the
 * first mismatch; no partial package exists.
 */
export function buildSkillInputPackage(parts: SkillInputPackageParts): SkillInputPackage {
  const { bundle, input, graph, plan, subject, allowedSlotIds } = parts;
  assertReleasedSkillContractBundle(bundle);

  if (graph.methodProfileRef !== bundle.repository.methodProfileRef || graph.methodRegistryStructuralHash !== bundle.repository.methodRegistryStructuralHash) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the claim graph was accepted under another Method Profile than the bundle binds');
  }
  if (graph.graphVersion !== bundle.repository.interpretiveClaimGraphVersion || plan.planVersion !== bundle.repository.metaNarrativePlanVersion) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the claim graph or plan version is not the one the bundle binds');
  }
  if (plan.claimGraphStructuralHash !== graph.structuralHash || plan.sourceBriefStructuralHash !== graph.sourceBriefStructuralHash) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the plan was accepted against another claim graph');
  }
  if (input.schemaVersion !== bundle.repository.interpretationInputSchemaVersion || input.validatedChart.featureSetVersion !== bundle.repository.featureSetVersion) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the interpretation input is not the schema version the bundle binds');
  }
  if (input.validatedChart.featureSetStructuralHash !== graph.featureSetStructuralHash) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the claim graph cites facts of another feature set than the interpretation input carries');
  }
  if (input.methodProfile.ref !== bundle.repository.methodProfileRef || input.methodProfile.registryStructuralHash !== bundle.repository.methodRegistryStructuralHash) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the interpretation input was built under another Method Profile than the bundle binds');
  }
  const lexicon = contractByKey(bundle, 'TERMINOLOGY_LEXICON');
  const lens = contractByKey(bundle, 'INTERPRETATION_LENS');
  if (
    plan.terminologyLexicon.contractRef !== lexicon.identity ||
    plan.terminologyLexicon.confluencePageId !== lexicon.confluencePageId ||
    plan.terminologyLexicon.confluencePageVersion !== lexicon.confluencePageVersion ||
    plan.interpretationLens.contractRef !== lens.identity ||
    plan.interpretationLens.confluencePageId !== lens.confluencePageId ||
    plan.interpretationLens.confluencePageVersion !== lens.confluencePageVersion
  ) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the plan binds another Lexicon or Lens release than the bundle');
  }
  if (input.input.birthTimeKnown !== subject.birthTimeKnown || input.precision.birthTimeKnown !== subject.birthTimeKnown) {
    throw new SkillRunError('PACKAGE_SCHEMA_INVALID', 'subject.birthTimeKnown differs from the interpretation input');
  }
  if (subject.displayName.trim() === '') {
    throw new SkillRunError('PACKAGE_SCHEMA_INVALID', 'subject.displayName is empty');
  }
  const seenSlots = new Set<string>();
  for (const slotId of allowedSlotIds) {
    if (!ID_PATTERN.test(slotId) || seenSlots.has(slotId)) {
      throw new SkillRunError('PACKAGE_SCHEMA_INVALID', 'allowedSlotIds must be unique slot identifiers', { slotId });
    }
    seenSlots.add(slotId);
  }

  const facts = input.validatedChart.facts.filter((fact) => fact.interpretable);
  const excludedFactIds = input.validatedChart.facts.filter((fact) => !fact.interpretable).map((fact) => fact.id);
  const excluded = new Set(input.provisionality.excludedFactIds);
  if (excludedFactIds.length !== excluded.size || excludedFactIds.some((id) => !excluded.has(id))) {
    throw new SkillRunError('PACKAGE_BINDING_MISMATCH', 'the excluded facts of the input do not equal its non-interpretable facts');
  }

  const core = {
    packageVersion: SKILL_INPUT_PACKAGE_VERSION,
    skillRef: SKILL_REF,
    bundleRef: bundle.bundleRef,
    bundleStructuralHash: bundle.structuralHash,
    contracts: bundle.contracts.map((source) => ({
      contractRef: contractBindingRef(source),
      confluencePageId: source.confluencePageId,
      confluencePageVersion: source.confluencePageVersion,
    })),
    subject: { displayName: subject.displayName, birthTimeKnown: subject.birthTimeKnown },
    interpretationInputStructuralHash: input.structuralHash,
    facts,
    excludedFactIds,
    provisionalFactIds: input.provisionality.provisionalFactIds,
    warnings: input.warnings,
    precision: input.precision,
    claimGraph: graph,
    plan,
    allowedSlotIds,
  } satisfies Omit<SkillInputPackage, 'structuralHash'>;
  return { ...core, structuralHash: structuralHash(core) };
}
