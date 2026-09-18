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
import { REQUIRED_WUXING_BASIS, WUXING_ELEMENTS } from '../ports/fufire-gateway.js';
import { evaluateRuntimeAttestation } from '../attestation/runtime-attestation.js';
import type { AttestationVerdict } from '../attestation/runtime-attestation.js';
import type {
  FufireBaziSnapshot,
  FufireNatalSnapshot,
  ProducerJson,
  ProducerRawResponse,
  ProducerResponseMapper,
  WuxingSnapshot,
} from '../ports/fufire-gateway.js';
import { deriveInterpretationFeatureSet } from './feature-set.js';
import type { ChartFact, InterpretationFeatureSet } from './feature-set.js';
import {
  BAZI_METHOD_REGISTRY_V1,
  METHOD_PROFILE_ID,
  methodRegistryStructuralHash,
  assertReleasedRegistry,
  resolveMethodEnablement,
} from './method-registry.js';
import type { MethodEnablement, MethodRegistry } from './method-registry.js';

export const INTERPRETATION_INPUT_SCHEMA_VERSION = 'bazodiac-interpretation-input.v1' as const;
export { REQUIRED_WUXING_BASIS };
/** PD-9. Must equal the value the FuFirE adapter sends. */
export const CANONICAL_DAY_BOUNDARY = 'midnight' as const;

export type InterpretationInputErrorCode =
  | 'INTERPRETATION_INPUT_BASIS_INVALID'
  | 'INTERPRETATION_INPUT_WUXING_KEYSET_INVALID'
  | 'INTERPRETATION_INPUT_DOMINANT_INCONSISTENT'
  | 'INTERPRETATION_INPUT_PRECISION_CONTRADICTION'
  | 'INTERPRETATION_INPUT_RAW_EVIDENCE_MISSING'
  | 'INTERPRETATION_INPUT_EVIDENCE_NOT_SAME_CHART'
  | 'INTERPRETATION_INPUT_RAW_EVIDENCE_MISMATCH'
  | 'INTERPRETATION_INPUT_ATTESTATION_FOREIGN'
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
  /**
   * ETBZ-34 AC 5–7: no PASS verdict of the runtime attestation (OpenAPI bytes +
   * immutable source revision) was supplied for this chart's runtime.
   */
  | 'RUNTIME_ATTESTATION_NOT_PASSED';

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
  /** SHA-256 of the canonical JSON of the ORIGINAL, unredacted producer body. */
  readonly originalPayloadSha256: string;
  /** SHA-256 of the canonical JSON of `payload` as stored here, after redaction. */
  readonly storedPayloadSha256: string;
  /**
   * The redaction manifest: every path replaced by `REDACTED_PII`. Closed list —
   * the producer's ECHO of ETBZ's own request coordinates. Nothing FuFirE
   * calculated is ever redacted. Empty means `payload` is the original body.
   */
  readonly redactions: readonly string[];
  /** The stored evidence body. NOT byte-verbatim when `redactions` is non-empty. */
  readonly payload: ProducerJson;
}

export const RAW_EVIDENCE_REDACTED = 'REDACTED_PII' as const;

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
   * The complete relevant FuFirE responses (section 3 of CONF-62128133:
   * `bazi_raw`, `wuxing_raw`, `natal_raw`), each proven to map — through the
   * adapter's own response mapper — to exactly the snapshot this chart accepted.
   * Stored with echoed request coordinates redacted (see `redactions`).
   * Evidence, never a claim source.
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
    /** Enforced inside buildHoroscopeModel (ETBZ-34 AC 1): Wu-Xing source pillars == BaZi pillars. */
    sameChartWuxing: true;
    basis: typeof REQUIRED_WUXING_BASIS;
    wuxingKeysetValid: true;
    dominantConsistent: true;
    /**
     * PROVEN, not declared: every raw body was re-mapped by the producer response
     * mapper and equals its snapshot, and those snapshots are the ones this model
     * was built from. RAW -> mapper -> snapshot -> HoroscopeModel.
     */
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
  /** ETBZ-34 AC 5–7 as seen by this input: PASS with its expectation, or not passed. */
  readonly runtimeAttestation:
    | Readonly<{ status: 'PASS'; expectation: AttestationVerdict['expectation'] }>
    | Readonly<{ status: 'NOT_PASSED'; observedStatus: AttestationVerdict['status'] | null }>;
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

/**
 * Redacts the producer's ECHO of ETBZ's own request coordinates — and nothing
 * else. A value is redacted only if BOTH hold:
 *   - its key is a coordinate key (`lat`, `lon`, `latitude`, `longitude`, with
 *     an optional `_deg`), anywhere in the body (FuFirE echoes the request under
 *     `input` and, in traces, under keys such as `longitude_deg`);
 *   - its value IS this chart's own request latitude or longitude.
 * A symbolic response fact (`solar_longitude_deg`, a vector weight that happens
 * to equal a coordinate) matches neither the key rule nor survives both.
 */
const COORDINATE_KEY = /^(?:lat|lon|latitude|longitude)(?:_deg)?$/u;

function redactEcho(
  payload: ProducerJson,
  location: Readonly<{ lat: number; lon: number }>,
): Readonly<{ payload: ProducerJson; redactions: readonly string[] }> {
  const redactions: string[] = [];
  const walk = (value: ProducerJson, path: string): ProducerJson => {
    if (Array.isArray(value)) {
      return (value as readonly ProducerJson[]).map((entry, index) => walk(entry, `${path}[${String(index)}]`));
    }
    if (value === null || typeof value !== 'object') {
      return value;
    }
    const out: Record<string, ProducerJson> = {};
    for (const [key, entry] of Object.entries(value as { readonly [key: string]: ProducerJson })) {
      const here = path === '' ? key : `${path}.${key}`;
      if (COORDINATE_KEY.test(key) && typeof entry === 'number' && (entry === location.lat || entry === location.lon)) {
        out[key] = RAW_EVIDENCE_REDACTED;
        redactions.push(here);
      } else {
        out[key] = walk(entry, here);
      }
    }
    return out;
  };
  const cleaned = walk(payload, '');
  return { payload: redactions.length === 0 ? payload : cleaned, redactions: redactions.sort() };
}

function withoutRaw<T extends { readonly raw?: ProducerRawResponse }>(snapshot: T): Omit<T, 'raw'> {
  const { raw: _raw, ...rest } = snapshot;
  void _raw;
  return rest;
}

/**
 * RAW PRODUCER PAYLOAD -> producer mapper/validator -> snapshot, and that
 * snapshot must EQUAL the accepted one. A body that no longer maps, or maps to
 * different facts, is not this chart's evidence — whatever it is attached to.
 *
 * The mapper is the adapter's own (`ProducerResponseMapper`); nothing symbolic
 * is recomputed here. An additive field the pinned contract tolerates leaves
 * the mapped snapshot unchanged and is accepted; one the contract forbids
 * (the Natal response is `additionalProperties: false`) makes the mapper throw.
 */
function rawEvidenceOf<T extends { readonly raw?: ProducerRawResponse }>(
  what: string,
  snapshot: T,
  map: (payload: unknown) => T,
  location: Readonly<{ lat: number; lon: number }>,
): RawProducerEvidence {
  const raw = snapshot.raw;
  if (raw === undefined || raw.payload === null || typeof raw.payload !== 'object' || Array.isArray(raw.payload)) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_RAW_EVIDENCE_MISSING',
      `the ${what} snapshot carries no raw producer response; an interpretation input without its producer evidence is not reproducible and is refused`,
    );
  }
  let remapped: T;
  try {
    remapped = map(structuredClone(raw.payload));
  } catch (error) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_RAW_EVIDENCE_MISMATCH',
      `the ${what} raw evidence does not pass the producer contract it claims to come from: ${error instanceof Error ? error.message : 'mapping failed'}`,
    );
  }
  if (structuralHash(withoutRaw(remapped)) !== structuralHash(withoutRaw(snapshot))) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_RAW_EVIDENCE_MISMATCH',
      `the ${what} raw evidence maps to different facts than the accepted ${what} snapshot; it is not the body this chart was validated from`,
    );
  }
  const { payload, redactions } = redactEcho(raw.payload, location);
  return {
    endpoint: raw.endpoint,
    claimBearing: false,
    originalPayloadSha256: structuralHash(raw.payload),
    storedPayloadSha256: structuralHash(payload),
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
    wuxing: {
      vector: source.wuxing.vector,
      dominant: source.wuxing.dominant,
      basis: source.wuxing.basis,
      sourcePillars: source.wuxing.sourcePillars,
      precision: source.wuxing.precision,
    },
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
  /** The adapter's response mappers — what proves raw evidence against its snapshot. Required. */
  readonly mapper: ProducerResponseMapper;
  readonly registry?: MethodRegistry;
  /**
   * ETBZ-34 AC 5–7. Only a PASS verdict whose observed OpenAPI SHA-256 is the one
   * this chart's runtime is pinned to lifts `RUNTIME_ATTESTATION_NOT_PASSED`.
   */
  readonly attestation?: AttestationVerdict;
}

/** Pure: same HoroscopeModel and registry in, byte-identical input out. */
export function buildBazodiacInterpretationInput(
  model: HoroscopeModel,
  source: ProducerSnapshots,
  options: BuildInterpretationInputOptions,
): BazodiacInterpretationInput {
  const registry = options.registry ?? BAZI_METHOD_REGISTRY_V1;
  // Only a RELEASED profile may authorise a hand-off (registry <-> Confluence anti-drift).
  assertReleasedRegistry(registry);
  assertWuxing(model);
  assertSnapshotsBuiltThisModel(model, source);
  const baziRaw = rawEvidenceOf('BaZi', source.bazi, (payload) => options.mapper.mapBazi(payload), model.birth.location);
  const wuxingRaw = rawEvidenceOf('BaZi/WuXing', source.wuxing, (payload) => options.mapper.mapWuxing(payload), model.birth.location);
  const natalRaw = rawEvidenceOf('Natal', source.natal, (payload) => options.mapper.mapNatal(payload), model.birth.location);
  if (model.precision.birthTimeKnown !== model.birth.birthTimeKnown || model.natal.precision.birthTimeKnown !== model.birth.birthTimeKnown) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_PRECISION_CONTRADICTION',
      'input, BaZi and Natal disagree about birth_time_known; the answer is not usable',
    );
  }

  const featureSet = deriveInterpretationFeatureSet(model);
  const birthTimeKnown = featureSet.birthTimeKnown;
  const blockers: ProductionBlocker[] = [];
  if (!birthTimeKnown) {
    blockers.push('UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED');
  }
  const attestation = options.attestation;
  // The verdict is RE-DERIVED from its own expectation and observation: a
  // `status: 'PASS'` somebody typed is not an attestation.
  const attestationPassed =
    attestation !== undefined &&
    attestation.status === 'PASS' &&
    evaluateRuntimeAttestation(
      { openapiSha256: attestation.expectation.openapiSha256 ?? undefined, sourceRevision: attestation.expectation.sourceRevision ?? undefined },
      attestation.observation,
    ).status === 'PASS';
  if (attestation !== undefined && attestation.status === 'PASS' && !attestationPassed) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_ATTESTATION_FOREIGN',
      'the supplied attestation claims PASS but its own expectation and observation do not evaluate to PASS',
    );
  }
  if (attestation !== undefined && attestationPassed) {
    // A PASS for some OTHER runtime proves nothing about this chart's producer.
    const observed = attestation.observation.openapi.status === 'OBSERVED' ? attestation.observation.openapi.sha256 : null;
    if (observed === null || observed !== model.provenance.openapiSha256) {
      throw new InterpretationInputError(
        'INTERPRETATION_INPUT_ATTESTATION_FOREIGN',
        'the supplied attestation PASS was observed for a different OpenAPI document than the one this chart is pinned to',
      );
    }
  } else {
    blockers.push('RUNTIME_ATTESTATION_NOT_PASSED');
  }

  const attested =
    attestation !== undefined && attestation.status === 'PASS'
      ? { status: 'PASS' as const, expectation: attestation.expectation }
      : { status: 'NOT_PASSED' as const, observedStatus: attestation?.status ?? null };
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
      sameChartWuxing: true as const,
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
    runtimeAttestation: attested,
    productionEligibility: { eligible: blockers.length === 0, blockers },
  };
  // `fufire.natal.provenance.computedAt` and the BaZi computation timestamp are
  // volatile per call; the hash covers the facts and the contract, not the clock.
  // The raw bodies carry those same clocks, so the package hash covers their
  // endpoint and redaction list but not their bytes; each body has its own
  // `originalPayloadSha256` / `storedPayloadSha256` for byte-level reproducibility.
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
 * It opens only when the runtime attestation PASSED for this chart's runtime
 * and — for an unknown birth time — never, until the producer contract
 * (FUF-163/164/165) is delivered and this code is taught to validate it.
 */
export function assertProductionEligible(input: BazodiacInterpretationInput): void {
  if (!input.productionEligibility.eligible) {
    throw new InterpretationInputError(
      'INTERPRETATION_INPUT_NOT_PRODUCTION_ELIGIBLE',
      `interpretation input is not production-eligible: ${input.productionEligibility.blockers.join(', ')}`,
    );
  }
}
