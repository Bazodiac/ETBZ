/**
 * ETBZ-58 — the Pre-Golden rehearsal: one non-Golden known-time case from a fresh live FuFirE call to the
 * PresentationProjection the renderer draws (Rebaseline 62128133 section 18).
 *
 * The case is Musterkundin A through the canonical fixture input `KNOWN_BIRTH` only (Product Owner, Jira
 * ETBZ-58 comment 16976). The claim graph and the plan are accepted from the reviewed drafts of that chart
 * (`graphFor`, `validPlanDraft`; PO decision D-58-1, comment 17021): the builders accept them against the
 * LIVE chart and refuse when its facts differ. Three stages, each a function here:
 *
 * - `runLiveStage` (network; only the operator command `run-etbz58-live.ts` calls it): the runtime readback
 *   (attestation, health, readiness, a call without credentials) and the authorised known-time calls through
 *   the real FuFirE client and use case, over a transport that records each response body as the client read it
 *   (after HTTP content decoding - the wire encoding is not recorded).
 * - `deriveRehearsalInput` (offline, deterministic): replays the recorded bytes through the same client and
 *   use case - a response whose digest or a request whose body differs from the record is refused - and
 *   builds the InterpretationInput with the recorded attestation, the claim graph, the plan, the 1.1.0 bundle
 *   and the Skill input package. The contract suite re-runs it.
 * - `assembleRehearsal` (offline): accepts the runtime's REALISE reading and its EDIT revision against that
 *   package and builds the PresentationProjection through `buildSkillReadingProjection`.
 *
 * Not here: the generation (a Claude runtime instance; declared in the run record, not measured), the
 * renderer (tools/pdf-renderer, run on the emitted projection) and any judgement of the reading's content.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fufireResponseMapper, createFufireClient, FUFIRE_BAZI_PATH, FUFIRE_NATAL_PATH, FUFIRE_WUXING_PATH } from '../../src/adapters/fufire/http-client.js';
import type { AttestationVerdict } from '../../src/application/attestation/runtime-attestation.js';
import { createCalculateHoroscopeUseCase } from '../../src/application/horoscope-use-case.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { buildBazodiacInterpretationInput } from '../../src/application/interpretation/interpretation-input.js';
import type { BazodiacInterpretationInput, ProducerSnapshots } from '../../src/application/interpretation/interpretation-input.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { PLAN_CONTRACT_BINDINGS_V1_1, buildMetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import { buildSkillReadingProjection } from '../../src/application/presentation/index.js';
import type { PresentationProjection } from '../../src/application/presentation/index.js';
import {
  SKILL_CONTRACT_BUNDLE_VERSION_V1_1,
  acceptEditorialRevision,
  acceptSkillReading,
  buildSkillContractBundle,
  buildSkillInputPackage,
} from '../../src/application/skill/index.js';
import type { AcceptedSkillReading, SkillContractBundle, SkillInputPackage } from '../../src/application/skill/index.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { runFufireAttestation } from '../../src/attest-fufire.js';
import { contextFor } from './claimGraphFixture.js';
import { graphFor, planClaims, planContextFor, validPlanDraft } from './metaNarrativePlanFixture.js';
import { KNOWN_BIRTH, knownTimeChart } from './narrativeFixture.js';

export const ETBZ58_DIR = 'docs/evidence/etbz-58';
export const ETBZ58_RUN_DIR = `${ETBZ58_DIR}/run`;
export const ETBZ58_READBACK = `${ETBZ58_RUN_DIR}/runtime-readback.json`;
export const ETBZ58_SKILL_INPUT = `${ETBZ58_RUN_DIR}/skill-input.json`;
export const ETBZ58_SEMANTIC_READING = `${ETBZ58_RUN_DIR}/semantic-reading.json`;
export const ETBZ58_SKILL_READING = `${ETBZ58_RUN_DIR}/skill-reading.json`;
export const ETBZ58_ACCEPTED_READING = `${ETBZ58_RUN_DIR}/accepted-reading.json`;
export const ETBZ58_PROJECTION = `${ETBZ58_DIR}/presentation-projection.json`;
export const ETBZ58_RECORD = `${ETBZ58_DIR}/rehearsal-record.json`;
export const ETBZ58_REFUSED_REALISE = `${ETBZ58_RUN_DIR}/realise-attempt-1.refused.json`;
export const ETBZ58_ARTIFACT_MANIFEST = `${ETBZ58_DIR}/artifact-manifest.json`;
export const ETBZ58_PDF = `${ETBZ58_DIR}/bazodiac-reading.pdf`;
export const ETBZ58_VISUAL_VERDICT = `${ETBZ58_DIR}/visual-verdict.json`;

/** The ETBZ-57 reading the Human Editorial Gate accepted for the fixture package: not this run's reading. */
export const ETBZ57_ACCEPTED_READING_HASH = 'sha256:a0911b08bcf66bc9175946161b3a77d28245137e6b062cf8bf2575e3d397d8d7';

/**
 * Declared, not measured: who wrote the readings, with what, when, on which head, and the operator's handling.
 * Nothing in the repository can prove which model wrote a text (as in ETBZ-52 and ETBZ-57).
 */
export const ETBZ58_GENERATION = {
  declared: true,
  runtime: 'a fresh Claude Code subagent instance, dispatched by the Delivery Runner under skill/bazodiac-interpretation-skill-v1.1/wrappers/claude.md (PO decision D2, Jira ETBZ-2 comment 16690)',
  model: 'claude-opus-5-5 (as the runtime reported it)',
  executedAt: '2026-10-01/2026-10-02',
  operator: 'Delivery Runner (ETBZ-58)',
  repositoryHead: 'c0d21665617b777091ec0184fe5672cd45bf58a1',
  inputBoundary: 'the instance read only wrappers/claude.md, SKILL.md, contract-bundle.json, reading-schema.json, MANIFEST.json and run/skill-input.json, and used only Read and Write (its own report; not measured)',
  passes: [
    'REALISE attempt 1: realise-attempt-1.refused.json - refused READING_UNSUPPORTED_METHOD_LANGUAGE at chapters[2].paragraphs[3], term "ehe" (the German conjunction, "noch ehe ein Ergebnis vorliegt"); a false positive of the marriage word list',
    'REALISE repair (wrapper step 5, once): semantic-reading.json - exactly one leaf differs from attempt 1 ("ehe" -> "bevor"); accepted',
    'EDIT (wrapper step 5a): skill-reading.json - 36 customer-text leaves revised, nothing else; accepted at the first attempt',
  ],
  noHumanEdit: 'no person edited the reading between the stages',
} as const;

/** The canonical case input, referenced, not copied (Jira ETBZ-58 comment 16976). */
export const ETBZ58_BIRTH_INPUT_REF = 'tests/support/narrativeFixture.ts#KNOWN_BIRTH';

export const EXCHANGE_LABELS = ['bazi', 'wuxing', 'natal'] as const;
export type ExchangeLabel = (typeof EXCHANGE_LABELS)[number];
const EXCHANGE_PATHS: Readonly<Record<ExchangeLabel, string>> = { bazi: FUFIRE_BAZI_PATH, wuxing: FUFIRE_WUXING_PATH, natal: FUFIRE_NATAL_PATH };
export const responseFileOf = (label: ExchangeLabel): string => `${ETBZ58_RUN_DIR}/fufire/${label}.response.json`;

export const HEALTH_PATH = '/v1/health';
export const READY_PATH = '/v1/ready';

export type RehearsalErrorCode =
  | 'REHEARSAL_RUNTIME_NOT_ATTESTED'
  | 'REHEARSAL_RUNTIME_NOT_READY'
  | 'REHEARSAL_RUNTIME_AUTH_NOT_ENFORCED'
  | 'REHEARSAL_PRODUCER_FAILED'
  | 'REHEARSAL_REPLAY_UNKNOWN_CALL'
  | 'REHEARSAL_REPLAY_REQUEST_MISMATCH'
  | 'REHEARSAL_REPLAY_CALL_COUNT'
  | 'REHEARSAL_EVIDENCE_TAMPERED'
  | 'REHEARSAL_NOT_PRODUCTION_ELIGIBLE'
  | 'REHEARSAL_DRAFT_FACTS_DRIFTED';

export class RehearsalError extends Error {
  readonly code: RehearsalErrorCode;
  constructor(code: RehearsalErrorCode, message: string) {
    super(message);
    this.name = 'RehearsalError';
    this.code = code;
  }
}

export const sha256Of = (bytes: Uint8Array | string): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export interface Exchange {
  readonly label: ExchangeLabel;
  readonly method: 'POST';
  readonly path: string;
  readonly requestSha256: string;
  readonly status: number;
  readonly responseFile: string;
  readonly responseSha256: string;
  readonly byteLength: number;
}

export interface Probe {
  readonly path: string;
  readonly status: number;
  readonly bodySha256: string;
}

export interface RuntimeReadback {
  readonly readbackVersion: 'etbz58-runtime-readback.v1';
  readonly executedAt: string;
  readonly repositoryHead: string;
  /** The runtime the chart is pinned to: what the use case records into the model's provenance. */
  readonly runtime: Readonly<{ baseUrlHost: string; runtimeImage: string; openapiSha256: string }>;
  readonly attestation: AttestationVerdict;
  readonly probes: Readonly<{
    health: Probe;
    ready: Probe;
    /** The BaZi call with the recorded request body and no credential: the runtime must refuse it (401/403). */
    unauthorised: Probe & { readonly refused: boolean };
  }>;
  readonly birthInput: Readonly<{ ref: string; canonicalSha256: string }>;
  readonly exchanges: readonly Exchange[];
}

export interface LiveStageConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly expectedOpenapiSha256: string;
  readonly expectedSourceRevision: string;
  readonly executedAt: string;
  readonly repositoryHead: string;
  readonly timeoutMs?: number;
  /**
   * The case: the raw BirthInput candidate and the reference recorded for it. Defaults to the rehearsal case
   * (`KNOWN_BIRTH`). ETBZ-53 passes the Golden case, whose input and readback stay outside the repository.
   */
  readonly case?: Readonly<{ birthInput: unknown; ref: string }>;
}

export interface LiveStageResult {
  readonly readback: RuntimeReadback;
  readonly responses: Readonly<Record<ExchangeLabel, Uint8Array>>;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const labelOfPath = (path: string): ExchangeLabel | undefined => EXCHANGE_LABELS.find((label) => EXCHANGE_PATHS[label] === path);

async function probe(fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs: number): Promise<Probe> {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = new Uint8Array(await response.arrayBuffer());
  return { path: new URL(url).pathname, status: response.status, bodySha256: sha256Of(body) };
}

/**
 * The live stage. Attestation first and fail-closed: no calculation is sent to a runtime that is not the
 * accepted build. Then health and readiness, then the three authorised calls through the real client and use
 * case, then the BaZi call again without credentials, which must be refused.
 */
export async function runLiveStage(config: LiveStageConfig, fetchImpl: FetchLike = (url, init) => fetch(url, init)): Promise<LiveStageResult> {
  const baseUrl = config.baseUrl.trim().replace(/\/+$/u, '');
  const timeoutMs = config.timeoutMs ?? 30_000;
  const attested = await runFufireAttestation(
    {
      ETBZ_FUFIRE_BASE_URL: baseUrl,
      ETBZ_FUFIRE_API_KEY: config.apiKey,
      ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256: config.expectedOpenapiSha256,
      ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION: config.expectedSourceRevision,
      ETBZ_FUFIRE_ATTEST_IDENTITY_FIELDS: 'source_revision',
    },
    { fetch: fetchImpl },
  );
  const verdict = attested.verdict;
  if (verdict?.status !== 'PASS' || verdict.observation.openapi.status !== 'OBSERVED') {
    throw new RehearsalError('REHEARSAL_RUNTIME_NOT_ATTESTED', `runtime attestation is ${verdict?.status ?? String(attested.error)}; no calculation is sent`);
  }
  const openapiSha256 = verdict.observation.openapi.sha256;
  const runtimeImage = `fufire-api-lunar@${config.expectedSourceRevision}`;

  const health = await probe(fetchImpl, `${baseUrl}${HEALTH_PATH}`, { method: 'GET' }, timeoutMs);
  const ready = await probe(fetchImpl, `${baseUrl}${READY_PATH}`, { method: 'GET' }, timeoutMs);
  if (health.status !== 200 || ready.status !== 200) {
    throw new RehearsalError('REHEARSAL_RUNTIME_NOT_READY', `health ${String(health.status)}, ready ${String(ready.status)}`);
  }

  const exchanges: Exchange[] = [];
  const responses: Partial<Record<ExchangeLabel, Uint8Array>> = {};
  const requests: Partial<Record<ExchangeLabel, string>> = {};
  const recording: FetchLike = async (url, init) => {
    const response = await fetchImpl(url, init);
    const path = new URL(url).pathname;
    const label = labelOfPath(path);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (label !== undefined) {
      const body = typeof init.body === 'string' ? init.body : '';
      requests[label] = body;
      responses[label] = bytes;
      exchanges.push({ label, method: 'POST', path, requestSha256: sha256Of(body), status: response.status, responseFile: responseFileOf(label), responseSha256: sha256Of(bytes), byteLength: bytes.byteLength });
    }
    return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
  const gateway = createFufireClient({ config: { baseUrl, apiKey: config.apiKey, timeoutMs, runtimeImage, openapiSha256 }, transport: { fetch: recording } });
  const birthInput = config.case?.birthInput ?? KNOWN_BIRTH;
  const result = await createCalculateHoroscopeUseCase({ gateway, runtime: { runtimeImage, openapiSha256 } }).execute(birthInput);
  if (!result.ok) {
    // Codes and paths only: an issue or a producer message must not carry the case's values out of the run.
    const detail = 'message' in result.error ? result.error.errorCode : JSON.stringify(result.error.issues.map((issue) => (issue as { code?: unknown }).code));
    throw new RehearsalError('REHEARSAL_PRODUCER_FAILED', `${result.error.code}: ${detail}`);
  }

  const unauthorisedProbe = await probe(fetchImpl, `${baseUrl}${FUFIRE_BAZI_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requests.bazi ?? '',
  }, timeoutMs);
  const refused = unauthorisedProbe.status === 401 || unauthorisedProbe.status === 403;
  if (!refused) {
    throw new RehearsalError('REHEARSAL_RUNTIME_AUTH_NOT_ENFORCED', `a call without credentials returned HTTP ${String(unauthorisedProbe.status)}`);
  }

  const complete = EXCHANGE_LABELS.every((label) => responses[label] !== undefined);
  if (!complete || exchanges.length !== EXCHANGE_LABELS.length) {
    throw new RehearsalError('REHEARSAL_PRODUCER_FAILED', `expected one call per operation, recorded ${String(exchanges.length)}`);
  }
  const readback: RuntimeReadback = {
    readbackVersion: 'etbz58-runtime-readback.v1',
    executedAt: config.executedAt,
    repositoryHead: config.repositoryHead,
    runtime: { baseUrlHost: new URL(baseUrl).host, runtimeImage, openapiSha256 },
    attestation: verdict,
    probes: { health, ready, unauthorised: { ...unauthorisedProbe, refused } },
    birthInput: { ref: config.case?.ref ?? ETBZ58_BIRTH_INPUT_REF, canonicalSha256: sha256Of(canonicalJson(birthInput)) },
    exchanges,
  };
  return { readback, responses: responses as Record<ExchangeLabel, Uint8Array> };
}

/**
 * A transport that answers only the recorded calls, with the recorded bytes, for the recorded request bodies. A
 * refusal is also pushed to `violations`: the FuFirE client wraps any transport failure as a network error, and
 * the caller re-raises the rehearsal's own code from there.
 */
export function replayTransport(
  readback: RuntimeReadback,
  responses: Readonly<Record<ExchangeLabel, Uint8Array>>,
  violations: RehearsalError[] = [],
  used: Map<string, number> = new Map<string, number>(),
): { fetch: FetchLike } {
  const refuse = (code: RehearsalErrorCode, message: string): Promise<Response> => {
    const error = new RehearsalError(code, message);
    violations.push(error);
    return Promise.reject(error);
  };
  return {
    fetch: (url, init) => {
      const path = new URL(url).pathname;
      const exchange = readback.exchanges.find((candidate) => candidate.path === path);
      if (exchange === undefined) return refuse('REHEARSAL_REPLAY_UNKNOWN_CALL', `no recorded exchange for ${path}`);
      const body = typeof init.body === 'string' ? init.body : '';
      if (sha256Of(body) !== exchange.requestSha256) return refuse('REHEARSAL_REPLAY_REQUEST_MISMATCH', `the request for ${path} is not the recorded one`);
      const bytes = responses[exchange.label];
      if (sha256Of(bytes) !== exchange.responseSha256 || bytes.byteLength !== exchange.byteLength) {
        return refuse('REHEARSAL_EVIDENCE_TAMPERED', `the response bytes for ${path} are not the recorded ones`);
      }
      const index = String(readback.exchanges.indexOf(exchange));
      used.set(index, (used.get(index) ?? 0) + 1);
      return Promise.resolve(new Response(bytes, { status: exchange.status, headers: { 'Content-Type': 'application/json' } }));
    },
  };
}

/**
 * The facts the reviewed drafts cite, with the value each was reviewed against: the chart the drafts were written
 * for (the fixture chart of Musterkundin A, ETBZ-30A/30B). PO decision D-58-1 uses the drafts on the live chart
 * only where these values hold; a claim's statement is prose the builders cannot compare with a value.
 */
export function draftFactPins(): ReadonlyMap<string, string> {
  const reviewed = knownTimeChart().model;
  const values = new Map(deriveInterpretationFeatureSet(reviewed).facts.map((fact) => [fact.id, canonicalJson(fact.value)]));
  const ids = [...new Set(planClaims(contextFor(reviewed)).flatMap((claim) => claim.factRefs))].sort();
  return new Map(ids.map((id) => [id, values.get(id) ?? 'MISSING']));
}

/** Refuses a live chart on which a cited fact of the reviewed drafts has another value (or none). */
export function assertDraftFactsHold(model: HoroscopeModel): void {
  const live = new Map(deriveInterpretationFeatureSet(model).facts.map((fact) => [fact.id, canonicalJson(fact.value)]));
  const drifted = [...draftFactPins()].filter(([id, value]) => live.get(id) !== value).map(([id, value]) => `${id}: reviewed ${value}, live ${live.get(id) ?? 'absent'}`);
  if (drifted.length > 0) {
    throw new RehearsalError('REHEARSAL_DRAFT_FACTS_DRIFTED', `the reviewed drafts cite facts the live chart answers differently: ${drifted.join('; ')}`);
  }
}

export interface RehearsalInput {
  readonly model: HoroscopeModel;
  readonly input: BazodiacInterpretationInput;
  readonly graph: InterpretiveClaimGraph;
  readonly plan: MetaNarrativePlan;
  readonly bundle: SkillContractBundle;
  readonly inputPackage: SkillInputPackage;
}

/**
 * Offline: the recorded calls through the same client and use case, then the product chain up to the Skill
 * input package. The InterpretationInput must be production-eligible - the recorded attestation re-derives to
 * PASS for the OpenAPI document this chart is pinned to, and the birth time is known.
 */
export async function deriveRehearsalInput(readback: RuntimeReadback, responses: Readonly<Record<ExchangeLabel, Uint8Array>>): Promise<RehearsalInput> {
  const { model, input } = await replayInterpretationInput(readback, responses);
  // PO decision D-58-1: the reviewed drafts of this chart, on the live model only where their cited facts hold.
  assertDraftFactsHold(model);
  const context = contextFor(model);
  const graph = graphFor(context);
  const planContext = { ...planContextFor(context, graph), contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 };
  const plan = buildMetaNarrativePlan(validPlanDraft(planContext), planContext);
  const bundle = buildSkillContractBundle(undefined, SKILL_CONTRACT_BUNDLE_VERSION_V1_1);
  const inputPackage = buildSkillInputPackage({
    bundle,
    input,
    graph,
    plan,
    subject: { displayName: model.displayName, birthTimeKnown: model.precision.birthTimeKnown },
    allowedSlotIds: listSlotIds(),
  });
  return { model, input, graph, plan, bundle, inputPackage };
}

/**
 * Offline: the recorded calls through the same client and use case, up to a production-eligible
 * InterpretationInput. The case input is the rehearsal's unless given (ETBZ-53 passes the Golden case).
 */
export async function replayInterpretationInput(
  readback: RuntimeReadback,
  responses: Readonly<Record<ExchangeLabel, Uint8Array>>,
  birthInput: unknown = KNOWN_BIRTH,
): Promise<{ model: HoroscopeModel; input: BazodiacInterpretationInput; source: ProducerSnapshots }> {
  const { runtimeImage, openapiSha256 } = readback.runtime;
  const violations: RehearsalError[] = [];
  const used = new Map<string, number>();
  const gateway = createFufireClient({
    config: { baseUrl: 'https://replay.invalid', apiKey: 'replay-no-network', timeoutMs: 30_000, runtimeImage, openapiSha256 },
    transport: replayTransport(readback, responses, violations, used),
  });
  const result = await createCalculateHoroscopeUseCase({ gateway, runtime: { runtimeImage, openapiSha256 } }).execute(birthInput);
  const [violation] = violations;
  if (violation !== undefined) throw violation;
  // The replay is the recorded run: every recorded call answered exactly once, no more, no fewer.
  const counts = readback.exchanges.map((_, index) => used.get(String(index)) ?? 0);
  if (result.ok && counts.some((count) => count !== 1)) {
    throw new RehearsalError('REHEARSAL_REPLAY_CALL_COUNT', `each recorded call must be answered exactly once; answered ${JSON.stringify(counts)}`);
  }
  if (!result.ok) {
    const detail = 'message' in result.error ? result.error.errorCode : JSON.stringify(result.error.issues.map((issue) => (issue as { code?: unknown }).code));
    throw new RehearsalError('REHEARSAL_PRODUCER_FAILED', `replay: ${result.error.code}: ${detail}`);
  }
  const { model, source } = result;
  const input = buildBazodiacInterpretationInput(model, source, { mapper: fufireResponseMapper, attestation: readback.attestation });
  if (!input.productionEligibility.eligible) {
    throw new RehearsalError('REHEARSAL_NOT_PRODUCTION_ELIGIBLE', `interpretation input blockers: ${input.productionEligibility.blockers.join(', ')}`);
  }
  return { model, input, source };
}

export interface RehearsalAssembly {
  readonly semantic: AcceptedSkillReading;
  readonly accepted: AcceptedSkillReading;
  readonly projection: PresentationProjection;
}

/** Offline: the runtime's two readings through the acceptance boundary, then the one presentation path. */
export function assembleRehearsal(rehearsal: RehearsalInput, realise: unknown, edit: unknown): RehearsalAssembly {
  const context = { bundle: rehearsal.bundle, inputPackage: rehearsal.inputPackage };
  const semantic = acceptSkillReading(realise, context);
  const accepted = acceptEditorialRevision(semantic, edit, context);
  const projection = buildSkillReadingProjection({ model: rehearsal.model, reading: accepted, bundle: rehearsal.bundle, inputPackage: rehearsal.inputPackage });
  return { semantic, accepted, projection };
}

/** The committed live stage: the readback and the three response bodies as recorded. */
export function loadRecordedRun(root: string = process.cwd()): { readback: RuntimeReadback; responses: Record<ExchangeLabel, Uint8Array> } {
  const readback = JSON.parse(readFileSync(resolve(root, ETBZ58_READBACK), 'utf8')) as RuntimeReadback;
  const responses = Object.fromEntries(EXCHANGE_LABELS.map((label) => [label, new Uint8Array(readFileSync(resolve(root, responseFileOf(label))))])) as Record<ExchangeLabel, Uint8Array>;
  return { readback, responses };
}

export const readJsonFile = (path: string, root: string = process.cwd()): unknown => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as unknown;

const fileSha = (path: string, root: string): string => sha256Of(readFileSync(resolve(root, path)));

/**
 * The run record: every identity of the run, from the case input to the ArtifactManifest, each either a digest of
 * a committed file or a hash the chain re-derives. Written last (`npm run etbz58:assemble -- seal`), after the
 * renderer and the visual verdict; the contract suite re-derives it byte for byte.
 */
export async function deriveRehearsalRecord(root: string = process.cwd()): Promise<Record<string, unknown>> {
  const { readback, responses } = loadRecordedRun(root);
  const rehearsal = await deriveRehearsalInput(readback, responses);
  const { semantic, accepted, projection } = assembleRehearsal(rehearsal, readJsonFile(ETBZ58_SEMANTIC_READING, root), readJsonFile(ETBZ58_SKILL_READING, root));
  const manifest = readJsonFile(ETBZ58_ARTIFACT_MANIFEST, root) as {
    artifactId: string; state: string; sha256: string; pageCount: number;
    template: Record<string, unknown>; renderer: Record<string, unknown>; qa: { status: string; state: string };
  };
  const verdict = readJsonFile(ETBZ58_VISUAL_VERDICT, root) as { verdict: string; defects: readonly unknown[] };
  const skillManifest = readJsonFile('skill/bazodiac-interpretation-skill-v1.1/MANIFEST.json', root) as { packageStructuralHash: string };
  return {
    recordVersion: 'etbz58-rehearsal-record.v1',
    runId: 'etbz58-pre-golden-rehearsal-known-time-2026-10-01',
    case: {
      displayName: rehearsal.model.displayName,
      birthInput: readback.birthInput,
      golden: false,
      decision: 'Jira ETBZ-58 comment 16976 (synthetic non-Golden known-time case; GOLDEN-KT-01 stays reserved for ETBZ-53)',
    },
    runtime: {
      readbackFileSha256: fileSha(ETBZ58_READBACK, root),
      executedAt: readback.executedAt,
      repositoryHead: readback.repositoryHead,
      baseUrlHost: readback.runtime.baseUrlHost,
      runtimeImage: readback.runtime.runtimeImage,
      attestation: { status: readback.attestation.status, expectation: readback.attestation.expectation },
      probes: readback.probes,
      exchanges: readback.exchanges.map(({ label, status, responseSha256, byteLength }) => ({ label, status, responseSha256, byteLength })),
    },
    interpretationInput: { structuralHash: rehearsal.input.structuralHash, productionEligible: rehearsal.input.productionEligibility.eligible },
    drafting: {
      decision: 'PO decision D-58-1, Jira ETBZ-58 comment 17021: the reviewed ETBZ-30A/30B drafts, accepted against the live chart',
      pinnedFacts: Object.fromEntries(draftFactPins()),
      claimGraphStructuralHash: rehearsal.graph.structuralHash,
      planStructuralHash: rehearsal.plan.structuralHash,
    },
    skill: {
      skillRef: rehearsal.inputPackage.skillRef,
      skillPackageStructuralHash: skillManifest.packageStructuralHash,
      bundleRef: rehearsal.bundle.bundleRef,
      bundleStructuralHash: rehearsal.bundle.structuralHash,
      contracts: rehearsal.inputPackage.contracts,
      inputPackageStructuralHash: rehearsal.inputPackage.structuralHash,
      inputPackageFileSha256: fileSha(ETBZ58_SKILL_INPUT, root),
    },
    readings: {
      refusedRealiseFileSha256: fileSha(ETBZ58_REFUSED_REALISE, root),
      semanticFileSha256: fileSha(ETBZ58_SEMANTIC_READING, root),
      semanticStructuralHash: semantic.structuralHash,
      editFileSha256: fileSha(ETBZ58_SKILL_READING, root),
      acceptedStructuralHash: accepted.structuralHash,
      acceptedFileSha256: fileSha(ETBZ58_ACCEPTED_READING, root),
      notTheEtbz57Reading: accepted.structuralHash !== ETBZ57_ACCEPTED_READING_HASH,
    },
    presentation: { structuralHash: projection.structuralHash, fileSha256: fileSha(ETBZ58_PROJECTION, root), pageCount: projection.pageCount },
    artifact: {
      manifestFileSha256: fileSha(ETBZ58_ARTIFACT_MANIFEST, root),
      artifactId: manifest.artifactId,
      state: manifest.state,
      qa: manifest.qa.state,
      pdfSha256: manifest.sha256,
      pageCount: manifest.pageCount,
      template: manifest.template,
      renderer: manifest.renderer,
    },
    visualVerdict: { verdict: verdict.verdict, defects: verdict.defects.length, fileSha256: fileSha(ETBZ58_VISUAL_VERDICT, root) },
    generation: ETBZ58_GENERATION,
  };
}

export function renderJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}
