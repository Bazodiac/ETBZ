/**
 * ETBZ-54 — the Golden E2E run of GOLDEN-KT-01 (Jira ETBZ-54; Product Owner authorization D-54-1, comment 17073;
 * Rebaseline 62128133 v21): the frozen case through the canonical chain, with the section-8 minimum of
 * `cross-reading-individuality-contract@1.1.0` (Confluence 77266967 v3).
 *
 * Privacy architecture (D-53-1..3, D-53-6, 17073). Everything that carries the case - the drafts, the variants N and
 * S⁻, the Skill input packages, the readings, the judge packets, the projection, the PDF and its renders - lives in the
 * private archive below `<archive>/etbz54/` (directories 700, files 600), outside every repository. This module is
 * generic: it holds no value of the case and derives everything from the archive at run time. The repository
 * receives the run record (`etbz54Record.ts`): identities, gate outcomes, reason codes and digests keyed with the
 * archive's HMAC key.
 *
 * The chain reuses the ETBZ-58/59/60 tooling unchanged (D-53-7): the live stage and replay, the builders, the
 * withdrawal function (D-59-1), the deterministic checks and the judge-packet sheets. What is new here is only what
 * the Golden case needs: reading the frozen case from the archive, the neighbouring-hour variant of the frozen input
 * (D-53-6), and the drafts as data (D-53-4: the Delivery Runner drafts from the frozen chart facts; an independent
 * instance reviews them) instead of code, because a draft of the Golden chart states its values.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { fufireResponseMapper } from '../../src/adapters/fufire/http-client.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { deriveInterpretationFeatureSet, withdrawFactsForEvaluation } from '../../src/application/interpretation/feature-set.js';
import { buildBazodiacInterpretationInput } from '../../src/application/interpretation/interpretation-input.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { CLAIM_RELATION_TYPES } from '../../src/application/interpretation/interpretive-claim.js';
import type { InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { PLAN_CONTRACT_BINDINGS_V1_1, buildMetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlanContext, MetaNarrativePlanDraft } from '../../src/application/interpretation/meta-narrative-plan.js';
import {
  RELEASED_BUNDLE_HASHES,
  SKILL_CONTRACT_BUNDLE_VERSION_V1_1,
  buildSkillContractBundle,
  buildSkillInputPackage,
} from '../../src/application/skill/index.js';
import type { SkillContractBundle } from '../../src/application/skill/index.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { contextFor, draftOf } from './claimGraphFixture.js';
import { assertGoldenInput, caseValues, loadArchivedRun, parseQuietly } from './etbz53GoldenFreeze.js';
import { EXCHANGE_LABELS, renderJson, replayInterpretationInput } from './etbz58Rehearsal.js';
import type { ExchangeLabel, RuntimeReadback } from './etbz58Rehearsal.js';
import type { CaseLabel, CaseRun } from './etbz59Cases.js';
import { sourceChart } from './etbz59Variants.js';
import type { ReplayedChart } from './etbz59Variants.js';

export const ETBZ54_DIR = 'docs/evidence/etbz-54';
export const ETBZ54_RECORD = `${ETBZ54_DIR}/golden-run-record.json`;
/** The run's working folder below the archive directory. */
export const ETBZ54_WORK = 'etbz54';
export const GOLDEN_LABELS = ['source', 'near', 'removal'] as const satisfies readonly CaseLabel[];

/** The only bundle a Golden run may bind (D-54-1: explicit 1.1.0, never the 1.0.0 default). */
export const GOLDEN_BUNDLE_REF = 'bazodiac-skill-contract-bundle@1.1.0';
export const GOLDEN_SKILL_REF = 'bazodiac-interpretation-skill@1.1.0';

export type GoldenErrorCode =
  | 'GOLDEN_NOT_PRIVATE'
  | 'GOLDEN_ARCHIVE_DRIFT'
  | 'GOLDEN_NEAR_SHIFT_UNAVAILABLE'
  | 'GOLDEN_NEAR_DIFFERENCE_NOT_HOUR'
  | 'GOLDEN_DRAFTS_INVALID'
  | 'GOLDEN_DRAFT_HANDLE_UNKNOWN'
  | 'GOLDEN_DRAFT_FACTS_DRIFTED'
  | 'GOLDEN_BUNDLE_IDENTITY'
  | 'GOLDEN_RECORD_LEAKS_CASE_DATA';

export class GoldenRunError extends Error {
  readonly code: GoldenErrorCode;
  constructor(code: GoldenErrorCode, message: string) {
    super(message);
    this.name = 'GoldenRunError';
    this.code = code;
  }
}

export interface GoldenConfig {
  /** The Product Owner's input file (read, never written, never printed). */
  readonly inputPath: string;
  /** The ETBZ-53 archive of the case; this run works below `<archiveDir>/etbz54/`. */
  readonly archiveDir: string;
}

export const workPath = (config: GoldenConfig, ...parts: string[]): string => join(config.archiveDir, ETBZ54_WORK, ...parts);

// ---------------------------------------------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------------------------------------------

/** Writes a file readable by its owner only, creating private parent folders. */
export function writePrivateFile(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, data, { mode: 0o600 });
  chmodSync(path, 0o600);
}

/** Refuses a tree in which group or other may access any folder or file (the archive rule: 700 and 600). */
export function assertTreePrivate(dir: string): void {
  const loose: string[] = [];
  const walk = (path: string): void => {
    const stat = statSync(path);
    if ((stat.mode & 0o077) !== 0) loose.push(path);
    if (stat.isDirectory()) for (const name of readdirSync(path)) walk(join(path, name));
  };
  walk(dir);
  if (loose.length > 0) throw new GoldenRunError('GOLDEN_NOT_PRIVATE', `group or other may access ${String(loose.length)} path(s) below the archive (names not shown)`);
}

/** A message is shown only when it carries no value of the input file; otherwise it is withheld. */
export function safeMessage(message: string, raw: unknown): string {
  return caseValues(raw).some(({ value }) => message.includes(value)) ? '(message withheld: it quotes the case input)' : message;
}

// ---------------------------------------------------------------------------------------------------------------
// The near neighbour N (D-53-6): the frozen input with the birth time in the neighbouring two-hour block
// ---------------------------------------------------------------------------------------------------------------

export const NEAR_DISPLAY_NAME = 'Variante N (synthetisch)';
export type ShiftDirection = 'LATER' | 'EARLIER';

const minutesOf = (time: string): number => {
  const match = /^(\d{2}):(\d{2})$/u.exec(time);
  if (match === null) throw new GoldenRunError('GOLDEN_NEAR_SHIFT_UNAVAILABLE', 'the birth time is not HH:MM');
  return Number(match[1]) * 60 + Number(match[2]);
};
const timeOf = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * The same civil time two hours later, or else two hours earlier: the neighbouring two-hour block (the hour branches
 * are two-hour blocks of civil time; FuFirE reads civil time). A candidate must stay on the same date and outside
 * 23:00-23:59, where schools differ on the day pillar, so that the named difference is the hour pillar alone.
 */
export function nearBirthTime(birthTime: string): { birthTime: string; direction: ShiftDirection } {
  const source = minutesOf(birthTime);
  const allowed = (minutes: number): boolean => minutes >= 0 && minutes < 23 * 60;
  if (allowed(source + 120)) return { birthTime: timeOf(source + 120), direction: 'LATER' };
  if (allowed(source - 120)) return { birthTime: timeOf(source - 120), direction: 'EARLIER' };
  throw new GoldenRunError('GOLDEN_NEAR_SHIFT_UNAVAILABLE', 'no neighbouring block on the same date outside 23:00-23:59');
}

/** N's BirthInput: the frozen input with exactly the birth time moved and the display name marking the variant. */
export function nearBirthInput(raw: unknown): { birthInput: Record<string, unknown>; direction: ShiftDirection } {
  assertGoldenInput(raw);
  const source = raw as Record<string, unknown>;
  const { birthTime, direction } = nearBirthTime(String(source['birthTime']));
  return { birthInput: { ...source, birthTime, displayName: NEAR_DISPLAY_NAME }, direction };
}

const PILLAR_FACT = /^chart\.(?:natal\.)?pillar\.(year|month|day|hour)\./u;

/**
 * The named difference Δ of S and N must be the hour pillar: at least one hour-pillar fact, and no fact of another
 * pillar, of the day master or of the month command (a facts tally such as the Wu Xing weights may follow the hour).
 */
export function assertHourDifference(delta: readonly string[]): void {
  const hour = delta.some((id) => PILLAR_FACT.exec(id)?.[1] === 'hour');
  const foreign = delta.filter((id) => {
    const pillar = PILLAR_FACT.exec(id)?.[1];
    return (pillar !== undefined && pillar !== 'hour') || id.startsWith('chart.dayMaster.') || id.startsWith('chart.natal.monthCommand.');
  });
  if (!hour || foreign.length > 0) {
    throw new GoldenRunError('GOLDEN_NEAR_DIFFERENCE_NOT_HOUR', `the near neighbour differs ${hour ? '' : 'nowhere in the hour pillar'}${!hour && foreign.length > 0 ? ' and ' : ''}${foreign.length > 0 ? `in ${String(foreign.length)} fact(s) outside it` : ''}`);
  }
}

export const nearRunDir = (config: GoldenConfig): string => workPath(config, 'variants', 'near');
export const nearReadbackFile = (config: GoldenConfig): string => join(nearRunDir(config), 'runtime-readback.json');
export const nearResponseFile = (config: GoldenConfig, exchange: ExchangeLabel): string => join(nearRunDir(config), `${exchange}.response.json`);

// ---------------------------------------------------------------------------------------------------------------
// The charts
// ---------------------------------------------------------------------------------------------------------------

export const readInput = (config: GoldenConfig): unknown => {
  const raw = parseQuietly(readFileSync(config.inputPath, 'utf8'), 'the input file');
  assertGoldenInput(raw);
  return raw;
};

/** S: the frozen case, replayed from the ETBZ-53 archive; the archived InterpretationInput must be the re-derived one. */
export async function goldenChart(config: GoldenConfig, raw: unknown = readInput(config)): Promise<ReplayedChart> {
  const { readback, responses } = loadArchivedRun(config.archiveDir);
  const chart = await replayInterpretationInput(readback, responses, raw);
  if (readFileSync(join(config.archiveDir, 'interpretation-input.json'), 'utf8') !== renderJson(chart.input)) {
    throw new GoldenRunError('GOLDEN_ARCHIVE_DRIFT', 'the archived InterpretationInput is not the one the archived responses re-derive');
  }
  return chart;
}

export function loadNearRun(config: GoldenConfig): { readback: RuntimeReadback; responses: Record<ExchangeLabel, Uint8Array> } {
  const readback = parseQuietly(readFileSync(nearReadbackFile(config), 'utf8'), 'the near readback') as RuntimeReadback;
  const responses = Object.fromEntries(EXCHANGE_LABELS.map((exchange) => [exchange, new Uint8Array(readFileSync(nearResponseFile(config, exchange)))])) as Record<ExchangeLabel, Uint8Array>;
  return { readback, responses };
}

/** N: replayed offline from its archived live record, with the shifted input re-derived from the frozen one. */
export async function nearChart(config: GoldenConfig, raw: unknown = readInput(config)): Promise<ReplayedChart> {
  const { readback, responses } = loadNearRun(config);
  return replayInterpretationInput(readback, responses, nearBirthInput(raw).birthInput);
}

/** D: Musterkundin A, replayed from the ETBZ-58 live record in the repository (D-53-6). Chart only. */
export const distantChart = (root: string = process.cwd()): Promise<ReplayedChart> => sourceChart(root);

export const REMOVAL_REFERENCE = 'Jira ETBZ-54 comment 17073 (D-54-1) under D-53-6 and D-59-1 (Anti-Boilerplate 77266967 v3, section 6.4)';

/** S⁻: S with the drafted removal set withdrawn for evaluation (D-59-1). */
export function removalChart(source: ReplayedChart, factIds: readonly string[], config: GoldenConfig): ReplayedChart {
  const model = withdrawFactsForEvaluation(source.model, factIds, REMOVAL_REFERENCE);
  const { readback } = loadArchivedRun(config.archiveDir);
  const input = buildBazodiacInterpretationInput(model, source.source, { mapper: fufireResponseMapper, attestation: readback.attestation });
  return { model, input, source: source.source };
}

// ---------------------------------------------------------------------------------------------------------------
// The drafts (D-53-4, D-59-2, D-60-1), as data in the archive
// ---------------------------------------------------------------------------------------------------------------

export const DRAFTS_FILE = 'drafts.json';

const claimSchema = z.object({
  claimId: z.string().min(1),
  statement: z.string().min(1),
  factRefs: z.array(z.string()),
  themeRefs: z.array(z.string()),
  methodRefs: z.array(z.string()),
  epistemicClass: z.enum(['SUPPORTED_INTERPRETATION', 'TENTATIVE_INTERPRETATION']),
  provisionalFactRefs: z.array(z.string()),
  relations: z.array(z.object({ type: z.enum(CLAIM_RELATION_TYPES), targetClaimId: z.string() }).strict()),
}).strict();

/** A plan draft whose claim references are the drafts' claim handles; the run binds them to the accepted ids. */
const planSchema = z.object({
  reportThesis: z.object({ claimRefs: z.array(z.string()) }).strict(),
  primaryMotifs: z.array(z.object({ motifId: z.string(), coreClaimRefs: z.array(z.string()) }).strict()),
  tensions: z.array(z.object({ claimRefs: z.array(z.string()) }).strict()),
  openThreads: z.array(z.object({ threadId: z.string(), claimRefs: z.array(z.string()), resolution: z.string() }).strict()),
  chapterPlan: z.array(z.object({
    narrativeOperation: z.string(),
    claimRefs: z.array(z.string()),
    motifTransitions: z.array(z.object({ motifRef: z.string(), toState: z.string() }).strict()),
    opensThreadRefs: z.array(z.string()),
    closesThreadRefs: z.array(z.string()),
  }).strict()),
}).strict();

const caseDraftSchema = z.object({
  claims: z.array(claimSchema).min(1),
  plan: planSchema,
  /** The value of every cited fact as the independent review saw it (canonical JSON). */
  pins: z.record(z.string(), z.string()),
}).strict();

export const goldenDraftsSchema = z.object({
  draftVersion: z.literal('etbz54-golden-drafts.v1'),
  cases: z.object({ source: caseDraftSchema, near: caseDraftSchema, removal: caseDraftSchema }).strict(),
  /** S⁻ (D-59-1): the facts withdrawn from S. */
  removal: z.object({ factIds: z.array(z.string()).min(1) }).strict(),
  /** Terms that locate model-memory-rescue candidates in R(S⁻) (6.4), pre-registered with the cones; they decide nothing. */
  rescueTerms: z.object({ subjectTerms: z.array(z.string()).min(1), positionTerms: z.array(z.string()).min(1), why: z.string().min(1) }).strict(),
}).strict();

export type GoldenDrafts = z.infer<typeof goldenDraftsSchema>;
export type CaseDraft = GoldenDrafts['cases']['source'];

export function parseGoldenDrafts(value: unknown): GoldenDrafts {
  const result = goldenDraftsSchema.safeParse(value);
  // Paths and codes only: a zod message may quote a value of the drafts.
  if (!result.success) throw new GoldenRunError('GOLDEN_DRAFTS_INVALID', `the drafts file does not match its schema at ${result.error.issues.map((issue) => `${issue.path.join('.')} (${issue.code})`).join('; ')}`);
  return result.data;
}

export const loadGoldenDrafts = (config: GoldenConfig): GoldenDrafts =>
  parseGoldenDrafts(parseQuietly(readFileSync(workPath(config, DRAFTS_FILE), 'utf8'), 'the drafts file'));

/** The value of every fact the claims cite, read from the chart (canonical JSON, as the pins state them). */
export function citedValues(model: HoroscopeModel, claims: readonly InterpretiveClaim[]): Map<string, string> {
  const values = new Map(deriveInterpretationFeatureSet(model).facts.map((fact) => [fact.id, canonicalJson(fact.value)]));
  const ids = [...new Set(claims.flatMap((claim) => claim.factRefs))].sort();
  return new Map(ids.map((id) => [id, values.get(id) ?? 'MISSING']));
}

/** Refuses a chart on which a cited fact has another value than the one the review saw, or a pin no claim cites. */
export function assertPinsHold(label: CaseLabel, model: HoroscopeModel, draft: CaseDraft): void {
  const live = citedValues(model, draft.claims);
  const keys = [...new Set([...live.keys(), ...Object.keys(draft.pins)])].sort();
  const drifted = keys.filter((id) => live.get(id) !== draft.pins[id]);
  // Ids only: the values are the chart's.
  if (drifted.length > 0) throw new GoldenRunError('GOLDEN_DRAFT_FACTS_DRIFTED', `the ${label} drafts cite facts the chart answers differently, or pin facts they do not cite: ${drifted.join(', ')}`);
}

/**
 * Binds the plan's claim handles to the accepted claim ids: a handle names a draft claim, whose statement names
 * exactly one accepted claim (the graph replaces handles by content ids).
 */
export function bindPlanDraft(plan: CaseDraft['plan'], claims: readonly InterpretiveClaim[], context: MetaNarrativePlanContext): MetaNarrativePlanDraft {
  const idOfHandle = (handle: string): string => {
    const draft = claims.find((claim) => claim.claimId === handle);
    const accepted = draft === undefined ? [] : context.graph.claims.filter((claim) => claim.statement === draft.statement);
    const [only] = accepted;
    if (only === undefined || accepted.length !== 1) throw new GoldenRunError('GOLDEN_DRAFT_HANDLE_UNKNOWN', `the plan names "${handle}", which is not exactly one accepted claim`);
    return only.claimId;
  };
  const bind = (refs: readonly string[]): string[] => refs.map(idOfHandle);
  return {
    sourceBriefStructuralHash: context.brief.structuralHash,
    claimGraphStructuralHash: context.graph.structuralHash,
    reportThesis: { claimRefs: bind(plan.reportThesis.claimRefs) },
    primaryMotifs: plan.primaryMotifs.map((motif) => ({ motifId: motif.motifId, coreClaimRefs: bind(motif.coreClaimRefs) })),
    tensions: plan.tensions.map((tension) => ({ claimRefs: bind(tension.claimRefs) })),
    openThreads: plan.openThreads.map((thread) => ({ ...thread, claimRefs: bind(thread.claimRefs) })),
    chapterPlan: plan.chapterPlan.map((chapter) => ({ ...chapter, claimRefs: bind(chapter.claimRefs) })),
  } as MetaNarrativePlanDraft;
}

/** The bundle a Golden run binds: 1.1.0, passed explicitly, at its released content hash. */
export function goldenBundle(): SkillContractBundle {
  const bundle = buildSkillContractBundle(undefined, SKILL_CONTRACT_BUNDLE_VERSION_V1_1);
  if (bundle.bundleRef !== GOLDEN_BUNDLE_REF || bundle.structuralHash !== RELEASED_BUNDLE_HASHES['1.1.0']) {
    throw new GoldenRunError('GOLDEN_BUNDLE_IDENTITY', `the run binds ${GOLDEN_BUNDLE_REF} at its released hash; got ${bundle.bundleRef} ${bundle.structuralHash}`);
  }
  return bundle;
}

export interface GoldenCharts {
  readonly source: ReplayedChart;
  readonly near: ReplayedChart;
  readonly removal: ReplayedChart;
}

export async function goldenCharts(config: GoldenConfig, drafts: GoldenDrafts = loadGoldenDrafts(config)): Promise<GoldenCharts> {
  const raw = readInput(config);
  const source = await goldenChart(config, raw);
  return { source, near: await nearChart(config, raw), removal: removalChart(source, drafts.removal.factIds, config) };
}

/** Offline and deterministic: a case's chart, claim graph, plan, the 1.1.0 bundle and the Skill input package. */
export function deriveGoldenCase(label: CaseLabel, charts: GoldenCharts, drafts: GoldenDrafts): CaseRun {
  const { model, input } = charts[label];
  const draft = drafts.cases[label];
  assertPinsHold(label, model, draft);
  const claims = draft.claims as readonly InterpretiveClaim[];
  const context = contextFor(model);
  const graph: InterpretiveClaimGraph = buildInterpretiveClaimGraph(draftOf(claims, context), context);
  const planContext: MetaNarrativePlanContext = { ...context, graph, contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 };
  const plan = buildMetaNarrativePlan(bindPlanDraft(draft.plan, claims, planContext), planContext);
  const bundle = goldenBundle();
  const inputPackage = buildSkillInputPackage({ bundle, input, graph, plan, subject: { displayName: model.displayName, birthTimeKnown: model.precision.birthTimeKnown }, allowedSlotIds: listSlotIds() });
  return { label, model, input, graph, plan, bundle, inputPackage };
}

export async function deriveGoldenCases(config: GoldenConfig): Promise<Record<CaseLabel, CaseRun>> {
  const drafts = loadGoldenDrafts(config);
  const charts = await goldenCharts(config, drafts);
  return Object.fromEntries(GOLDEN_LABELS.map((label) => [label, deriveGoldenCase(label, charts, drafts)])) as Record<CaseLabel, CaseRun>;
}

export type ReadingFile = 'skill-input' | 'semantic-reading' | 'skill-reading' | 'accepted-reading';
export const caseFile = (config: GoldenConfig, label: CaseLabel, file: ReadingFile): string => workPath(config, 'cases', label, `${file}.json`);
export const caseDir = (config: GoldenConfig, label: CaseLabel): string => workPath(config, 'cases', label);
export const CONES_FILE = 'pre-run-cones.json';

export const readPrivateJson = (path: string): unknown => parseQuietly(readFileSync(path, 'utf8'), 'an archive file');
export const archiveHas = (path: string): boolean => existsSync(path);
