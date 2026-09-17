/**
 * ETBZ-34 — `BazodiacInterpretationInput v1`: the validated hand-off into the
 * Bazodiac Interpretation Skill (Confluence ETBZ 62128133, section 3).
 *
 * It is NOT a raw API dump used as a prompt. It is built from a HoroscopeModel
 * that has already passed the fail-closed consumer validation, restated as
 * addressable facts, and bound to the exact Method Profile that decides what
 * may be interpreted from them.
 *
 * Three things this module refuses to do, by construction:
 *
 *  1. It never invents, repairs or recomputes a symbolic fact. Every check below
 *     is a comparison of values FuFirE already delivered.
 *  2. It never substitutes a time of day. For an unknown birth time ETBZ sends
 *     the date only; the noon normalisation belongs to FuFirE (canonical
 *     contract, Confluence BG 62259202; FUF-163 -> FUF-164 -> FUF-165). Until
 *     that producer contract is delivered and pinned, an unknown-time input is
 *     buildable for synthetic/evidence work but is NOT production-eligible.
 *  3. It never claims a verification it did not perform. What ETBZ cannot yet
 *     check is reported as a named blocker, not as `true`.
 */
import { structuralHash } from '../../domain/structural-hash.js';
import type { HoroscopeModel } from '../horoscope-model.js';
import { WUXING_ELEMENTS } from '../ports/fufire-gateway.js';
import { deriveInterpretationFeatureSet } from './feature-set.js';
import type { ChartFact, InterpretationFeatureSet } from './feature-set.js';
import {
  BAZI_METHOD_REGISTRY_V1,
  METHOD_PROFILE_ID,
  methodRegistryStructuralHash,
  resolveMethodEnablement,
  validateMethodRegistry,
} from './method-registry.js';
import type { MethodEnablement, MethodRegistry } from './method-registry.js';

export const INTERPRETATION_INPUT_SCHEMA_VERSION = 'bazodiac-interpretation-input.v1' as const;
export const REQUIRED_WUXING_BASIS = 'bazi_four_pillars' as const;
/** PD-9. Must equal the value the FuFirE adapter sends. */
export const CANONICAL_DAY_BOUNDARY = 'midnight' as const;

export type InterpretationInputErrorCode =
  | 'INTERPRETATION_INPUT_BASIS_INVALID'
  | 'INTERPRETATION_INPUT_WUXING_KEYSET_INVALID'
  | 'INTERPRETATION_INPUT_DOMINANT_INCONSISTENT'
  | 'INTERPRETATION_INPUT_PRECISION_CONTRADICTION'
  | 'INTERPRETATION_INPUT_NOT_PRODUCTION_ELIGIBLE';

export class InterpretationInputError extends Error {
  readonly code: InterpretationInputErrorCode;
  constructor(code: InterpretationInputErrorCode, message: string) {
    super(message);
    this.name = 'InterpretationInputError';
    this.code = code;
  }
}

/**
 * Why an input may not be used for a paid reading yet. Each code names work
 * that is NOT done — a blocker is a fact about the system, not a warning.
 */
export type ProductionBlocker =
  /** FUF-163/164/165 not delivered: the producer cannot yet prove its unknown-time assumption. */
  | 'UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED'
  /** ETBZ-34 source-pillar guard not yet in the consumer: Wu-Xing same-chart is unproven. */
  | 'WUXING_SOURCE_PILLARS_NOT_VERIFIED';

export interface BazodiacInterpretationInput {
  readonly schemaVersion: typeof INTERPRETATION_INPUT_SCHEMA_VERSION;
  /** PII-minimised: no display name, no coordinates, no place label. */
  readonly input: Readonly<{
    birthDate: string;
    birthTimeKnown: boolean;
    /** Present ONLY when the birth time is known. Never an assumed time. */
    birthTime?: string;
    timezone: string;
  }>;
  /** Consumer-validated producer snapshots (the gateway port retains no raw wire bytes). */
  readonly fufire: Readonly<{
    bazi: Readonly<{
      pillars: HoroscopeModel['pillars'];
      dayMaster: HoroscopeModel['dayMaster'];
      /**
       * `birthLocal` / `birthUtc` are NULL when the birth time is unknown: for such
       * a chart the producer's instant is the assumed time of day, and handing it
       * downstream as "the birth" is exactly the leak CONF-62259202 forbids.
       */
      dates: Readonly<{ birthLocal: string | null; birthUtc: string | null; lichunLocal: string }>;
    }>;
    wuxing: HoroscopeModel['wuxing'];
    natal: HoroscopeModel['natal'];
  }>;
  readonly validatedChart: Readonly<{
    featureSetVersion: InterpretationFeatureSet['featureSetVersion'];
    featureSetStructuralHash: string;
    sourceStructuralHash: string;
    /** The ONLY things a claim may cite. A raw path is not a factRef (AF-1). */
    facts: readonly ChartFact[];
    factIds: readonly string[];
  }>;
  readonly precision: Readonly<{
    birthTimeKnown: boolean;
    provisionalFields: InterpretationFeatureSet['provisionalFields'];
    provisionalPillars: InterpretationFeatureSet['provisionalPillars'];
    dayBoundary: typeof CANONICAL_DAY_BOUNDARY;
    unknownTimeContract: Readonly<{
      canonicalSource: 'confluence:BG/62259202';
      upstream: readonly ['FUF-163', 'FUF-164', 'FUF-165'];
      /** ETBZ sends the date only and never a time of its own. */
      consumerSubstitutedTime: false;
      /**
       * The assumption metadata the canonical contract promises (assumed local
       * time, reason, quality). The pinned producer contract does not carry it,
       * so there is nothing to preserve yet — and nothing is made up.
       */
      producerAssumptionMetadata: 'NOT_DELIVERED_BY_PINNED_CONTRACT';
    }>;
  }>;
  /** FuFirE warning codes, verbatim: source order, duplicates, unknown codes. */
  readonly warnings: readonly string[];
  readonly provisionality: Readonly<{
    provisionalFactIds: readonly string[];
    /** PD-10: present as evidence, excluded from interpretation. */
    excludedFactIds: readonly string[];
    exclusionReason: 'ASSUMED_TIME_DERIVED' | null;
  }>;
  readonly validation: Readonly<{
    /** Enforced inside buildHoroscopeModel: natal pillars/day master == BaZi. */
    sameChartBaziNatal: true;
    /** ETBZ-34 source-pillar guard. Honest until that guard exists. */
    sameChartWuxing: 'NOT_VERIFIED';
    basis: typeof REQUIRED_WUXING_BASIS;
    wuxingKeysetValid: true;
    dominantConsistent: true;
  }>;
  readonly methodProfile: Readonly<{
    ref: string;
    registryStructuralHash: string;
    enablement: readonly MethodEnablement[];
  }>;
  readonly provenance: Readonly<{
    engineVersion: string;
    rulesetId: string;
    ephemerisId: string;
    tzdbVersionId: string;
    runtimeImage: string;
    openapiSha256: string;
    natalRulesetId: string;
    natalRulesetVersion: string;
  }>;
  readonly productionEligibility: Readonly<{ eligible: boolean; blockers: readonly ProductionBlocker[] }>;
  /** Hash of everything above. Volatile producer timestamps are not part of it. */
  readonly structuralHash: string;
}

function assertWuxing(model: HoroscopeModel): void {
  if (model.wuxing.basis !== REQUIRED_WUXING_BASIS) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_BASIS_INVALID',
      `Wu-Xing basis is "${model.wuxing.basis}"; only "${REQUIRED_WUXING_BASIS}" (POST /v1/calculate/bazi/wuxing) may enter a BaZi reading — a planetary vector is a different chart`,
    );
  }
  const expected = [...WUXING_ELEMENTS].sort();
  const actual = Object.keys(model.wuxing.vector).sort();
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_WUXING_KEYSET_INVALID',
      `Wu-Xing vector keys are [${actual.join(', ')}], expected exactly [${expected.join(', ')}]`,
    );
  }
  const values = Object.values(model.wuxing.vector);
  const maximum = Math.max(...values);
  // A tie is valid: ANY maximum may be named dominant. No tie-break is invented.
  if (model.wuxing.vector[model.wuxing.dominant] !== maximum) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_DOMINANT_INCONSISTENT',
      `dominant element "${model.wuxing.dominant}" is not a maximum of the delivered vector`,
    );
  }
}

export interface BuildInterpretationInputOptions {
  readonly registry?: MethodRegistry;
}

/** Pure: same HoroscopeModel and registry in, byte-identical input out. */
export function buildBazodiacInterpretationInput(
  model: HoroscopeModel,
  options: BuildInterpretationInputOptions = {},
): BazodiacInterpretationInput {
  const registry = options.registry ?? BAZI_METHOD_REGISTRY_V1;
  validateMethodRegistry(registry);
  assertWuxing(model);
  if (model.precision.birthTimeKnown !== model.birth.birthTimeKnown || model.natal.precision.birthTimeKnown !== model.birth.birthTimeKnown) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_PRECISION_CONTRADICTION',
      'input, BaZi and Natal disagree about birth_time_known; the answer is not usable',
    );
  }

  const featureSet = deriveInterpretationFeatureSet(model);
  const birthTimeKnown = featureSet.birthTimeKnown;
  const blockers: ProductionBlocker[] = ['WUXING_SOURCE_PILLARS_NOT_VERIFIED'];
  if (!birthTimeKnown) {
    blockers.unshift('UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED');
  }

  const core = {
    schemaVersion: INTERPRETATION_INPUT_SCHEMA_VERSION,
    input: {
      birthDate: model.birth.date,
      birthTimeKnown,
      ...(birthTimeKnown && model.birth.time !== undefined ? { birthTime: model.birth.time } : {}),
      timezone: model.birth.timezone,
    },
    fufire: {
      bazi: {
        pillars: model.pillars,
        dayMaster: model.dayMaster,
        dates: {
          birthLocal: birthTimeKnown ? model.dates.birthLocal : null,
          birthUtc: birthTimeKnown ? model.dates.birthUtc : null,
          lichunLocal: model.dates.lichunLocal,
        },
      },
      wuxing: model.wuxing,
      natal: model.natal,
    },
    validatedChart: {
      featureSetVersion: featureSet.featureSetVersion,
      featureSetStructuralHash: featureSet.structuralHash,
      sourceStructuralHash: featureSet.sourceStructuralHash,
      facts: featureSet.facts,
      factIds: featureSet.factIds,
    },
    precision: {
      birthTimeKnown,
      provisionalFields: featureSet.provisionalFields,
      provisionalPillars: featureSet.provisionalPillars,
      dayBoundary: CANONICAL_DAY_BOUNDARY,
      unknownTimeContract: {
        canonicalSource: 'confluence:BG/62259202' as const,
        upstream: ['FUF-163', 'FUF-164', 'FUF-165'] as const,
        consumerSubstitutedTime: false as const,
        producerAssumptionMetadata: 'NOT_DELIVERED_BY_PINNED_CONTRACT' as const,
      },
    },
    warnings: [...featureSet.sourceWarnings],
    provisionality: {
      provisionalFactIds: featureSet.provisionalFactIds,
      excludedFactIds: featureSet.excludedFactIds,
      exclusionReason: featureSet.excludedFactIds.length > 0 ? ('ASSUMED_TIME_DERIVED' as const) : null,
    },
    validation: {
      sameChartBaziNatal: true as const,
      sameChartWuxing: 'NOT_VERIFIED' as const,
      basis: REQUIRED_WUXING_BASIS,
      wuxingKeysetValid: true as const,
      dominantConsistent: true as const,
    },
    methodProfile: {
      ref: `${METHOD_PROFILE_ID}@${registry.profileVersion}`,
      registryStructuralHash: methodRegistryStructuralHash(registry),
      enablement: resolveMethodEnablement(registry, featureSet),
    },
    provenance: {
      engineVersion: model.provenance.engineVersion,
      rulesetId: model.provenance.rulesetId,
      ephemerisId: model.provenance.ephemerisId,
      tzdbVersionId: model.provenance.tzdbVersionId,
      runtimeImage: model.provenance.runtimeImage,
      openapiSha256: model.provenance.openapiSha256,
      natalRulesetId: model.natal.provenance.rulesetId,
      natalRulesetVersion: model.natal.provenance.rulesetVersion,
    },
    productionEligibility: { eligible: blockers.length === 0, blockers },
  };
  // `fufire.natal.provenance.computedAt` and the BaZi computation timestamp are
  // volatile per call; the hash covers the facts and the contract, not the clock.
  const hashed = {
    ...core,
    fufire: { ...core.fufire, natal: { ...core.fufire.natal, provenance: { ...core.fufire.natal.provenance, computedAt: null } } },
  };
  return { ...core, structuralHash: structuralHash(hashed) };
}

/**
 * The gate a paid run must pass. Fails closed and names every blocker.
 *
 * Today it ALWAYS throws: the Wu-Xing source-pillar guard of ETBZ-34 is not in
 * the consumer yet, and for unknown time the producer contract (FUF-163/164/165)
 * is not delivered. That is the honest state, and a gate that reported anything
 * else would be decoration.
 */
export function assertProductionEligible(input: BazodiacInterpretationInput): void {
  if (!input.productionEligibility.eligible) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_NOT_PRODUCTION_ELIGIBLE',
      `interpretation input is not production-eligible: ${input.productionEligibility.blockers.join(', ')}`,
    );
  }
}
