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
import type {
  FufireBaziSnapshot,
  FufireNatalSnapshot,
  ProducerJson,
  ProducerRawResponse,
  WuxingSnapshot,
} from '../ports/fufire-gateway.js';
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
  | 'INTERPRETATION_INPUT_RAW_EVIDENCE_MISSING'
  | 'INTERPRETATION_INPUT_EVIDENCE_NOT_SAME_CHART'
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

/**
 * The three producer snapshots the HoroscopeModel was built from, each still
 * carrying the wire body it was mapped from (`raw`).
 */
export interface ProducerSnapshots {
  readonly bazi: FufireBaziSnapshot;
  readonly wuxing: WuxingSnapshot;
  readonly natal: FufireNatalSnapshot;
}

/**
 * One raw producer response inside the hand-off.
 *
 * EVIDENCE / REPRODUCIBILITY ONLY. `claimBearing` is the literal `false`: no
 * theme, claim or section may cite this block, and no path into `payload` is a
 * `factRef`. The only semantic source is `validatedChart.facts`.
 */
export interface RawProducerEvidence {
  readonly endpoint: string;
  readonly claimBearing: false;
  /** SHA-256 of the canonical JSON of the payload AS RECEIVED, before redaction. */
  readonly payloadStructuralHash: string;
  /**
   * Paths replaced by `REDACTED_PII`. Closed list: the producer's ECHO of ETBZ's
   * own request coordinates. Nothing FuFirE calculated is ever redacted.
   */
  readonly redactions: readonly string[];
  readonly payload: ProducerJson;
}

export const RAW_EVIDENCE_REDACTED = 'REDACTED_PII' as const;
/** Request-echo keys that are customer PII, not producer facts. */
const ECHO_PII_KEYS: readonly string[] = ['lat', 'lon', 'latitude', 'longitude'];

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
  /**
   * The complete relevant FuFirE responses, verbatim (section 3 of CONF-62128133:
   * `bazi_raw`, `wuxing_raw`, `natal_raw`). Evidence, never a claim source.
   * Under an unknown birth time these bodies contain the producer's ASSUMED
   * instant; `containsAssumedTime` says so, and it is not the customer's birth.
   */
  readonly fufire: Readonly<{
    claimBearing: false;
    containsAssumedTime: boolean;
    baziRaw: RawProducerEvidence;
    wuxingRaw: RawProducerEvidence;
    natalRaw: RawProducerEvidence;
  }>;
  /** Consumer-validated producer snapshots — what the raw bodies were accepted AS. */
  readonly validatedSnapshots: Readonly<{
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
    /** The snapshots carrying the raw evidence are the ones this model was built from. */
    rawEvidenceSameChart: true;
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

function redactEcho(payload: ProducerJson): Readonly<{ payload: ProducerJson; redactions: readonly string[] }> {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { payload, redactions: [] };
  }
  const body = payload as { readonly [key: string]: ProducerJson };
  const echo = body['input'];
  if (echo === undefined || echo === null || typeof echo !== 'object' || Array.isArray(echo)) {
    return { payload, redactions: [] };
  }
  const redactions: string[] = [];
  const cleaned: Record<string, ProducerJson> = {};
  for (const [key, value] of Object.entries(echo as { readonly [key: string]: ProducerJson })) {
    if (ECHO_PII_KEYS.includes(key)) {
      cleaned[key] = RAW_EVIDENCE_REDACTED;
      redactions.push(`input.${key}`);
    } else {
      cleaned[key] = value;
    }
  }
  return { payload: { ...body, input: cleaned }, redactions: redactions.sort() };
}

function rawEvidenceOf(what: string, raw: ProducerRawResponse | undefined): RawProducerEvidence {
  if (raw === undefined || raw.payload === null || typeof raw.payload !== 'object' || Array.isArray(raw.payload)) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_RAW_EVIDENCE_MISSING',
      `the ${what} snapshot carries no raw producer response; an interpretation input without its producer evidence is not reproducible and is refused`,
    );
  }
  const { payload, redactions } = redactEcho(raw.payload);
  return {
    endpoint: raw.endpoint,
    claimBearing: false,
    payloadStructuralHash: structuralHash(raw.payload),
    redactions,
    payload,
  };
}

/**
 * The raw evidence must belong to THIS chart. The model keeps every snapshot
 * value it accepted, so the check is a comparison of accepted values — no raw
 * path is read and nothing is recomputed.
 */
function assertSnapshotsBuiltThisModel(model: HoroscopeModel, source: ProducerSnapshots): void {
  const pillarsOf = (name: 'year' | 'month' | 'day' | 'hour'): unknown => ({
    stem: model.pillars[name].stem,
    branch: model.pillars[name].branch,
    tierDe: model.pillars[name].tierDe,
    elementDe: model.pillars[name].stemElementDe,
  });
  const fromModel = structuralHash({
    bazi: {
      pillars: { year: pillarsOf('year'), month: pillarsOf('month'), day: pillarsOf('day'), hour: pillarsOf('hour') },
      dayMaster: model.dayMaster.stem,
      dates: model.dates,
      precision: model.precision,
      computationTimestamp: model.provenance.computationTimestamp,
    },
    wuxing: model.wuxing,
    natal: {
      pillars: model.natal.pillars,
      dayMaster: model.natal.dayMaster,
      monthCommand: model.natal.monthCommand,
      precision: model.natal.precision,
      provenance: model.natal.provenance,
      warnings: model.sourceWarnings,
    },
  });
  const fromSource = structuralHash({
    bazi: {
      pillars: source.bazi.pillars,
      dayMaster: source.bazi.dayMaster,
      dates: source.bazi.dates,
      precision: source.bazi.precision,
      computationTimestamp: source.bazi.provenance.computationTimestamp,
    },
    wuxing: { vector: source.wuxing.vector, dominant: source.wuxing.dominant, basis: source.wuxing.basis },
    natal: {
      pillars: source.natal.pillars,
      dayMaster: source.natal.dayMaster,
      monthCommand: source.natal.monthCommand,
      precision: source.natal.precision,
      provenance: source.natal.provenance,
      warnings: source.natal.warnings,
    },
  });
  if (fromModel !== fromSource) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_EVIDENCE_NOT_SAME_CHART',
      'the producer snapshots carrying the raw evidence are not the ones this HoroscopeModel was built from; evidence of another chart is refused',
    );
  }
}

export interface BuildInterpretationInputOptions {
  readonly registry?: MethodRegistry;
}

/** Pure: same HoroscopeModel and registry in, byte-identical input out. */
export function buildBazodiacInterpretationInput(
  model: HoroscopeModel,
  source: ProducerSnapshots,
  options: BuildInterpretationInputOptions = {},
): BazodiacInterpretationInput {
  const registry = options.registry ?? BAZI_METHOD_REGISTRY_V1;
  validateMethodRegistry(registry);
  assertWuxing(model);
  assertSnapshotsBuiltThisModel(model, source);
  const baziRaw = rawEvidenceOf('BaZi', source.bazi.raw);
  const wuxingRaw = rawEvidenceOf('BaZi/WuXing', source.wuxing.raw);
  const natalRaw = rawEvidenceOf('Natal', source.natal.raw);
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
      claimBearing: false as const,
      containsAssumedTime: !birthTimeKnown,
      baziRaw,
      wuxingRaw,
      natalRaw,
    },
    validatedSnapshots: {
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
      rawEvidenceSameChart: true as const,
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
  // The raw bodies carry those same clocks, so the package hash covers their
  // endpoint and redaction list but not their bytes; each body has its own
  // `payloadStructuralHash` for byte-level reproducibility.
  const withoutBytes = (evidence: RawProducerEvidence): unknown => ({
    endpoint: evidence.endpoint,
    claimBearing: evidence.claimBearing,
    redactions: evidence.redactions,
  });
  const hashed = {
    ...core,
    fufire: {
      ...core.fufire,
      baziRaw: withoutBytes(baziRaw),
      wuxingRaw: withoutBytes(wuxingRaw),
      natalRaw: withoutBytes(natalRaw),
    },
    validatedSnapshots: {
      ...core.validatedSnapshots,
      natal: {
        ...core.validatedSnapshots.natal,
        provenance: { ...core.validatedSnapshots.natal.provenance, computedAt: null },
      },
    },
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
