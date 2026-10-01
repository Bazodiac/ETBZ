/**
 * ETBZ-57 — the machine-derived evidence of the voice revision, as one
 * function the emitter writes and the contract suite re-derives byte for byte.
 *
 * Inputs are the committed readings: the 1.0.0 fixture reading of ETBZ-52
 * (unchanged) and the 1.1.0 REALISE reading and its EDIT revision. Outputs:
 * the accepted 1.1.0 reading, its customer projection, and `evals.json` with
 * the deterministic parts of evals A-G. The qualitative customer-voice review
 * and the human verdict are not here: they are declared, not derived.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import type { ChartFact } from '../../src/application/interpretation/feature-set.js';
import {
  SkillRunError,
  acceptEditorialRevision,
  acceptSkillReading,
  projectCustomerReading,
} from '../../src/application/skill/index.js';
import type { AcceptedSkillReading, SkillInputPackage, SkillReadingDraft } from '../../src/application/skill/index.js';
import { skillFixture, skillFixtureV1_1 } from './skillFixture.js';
import { proseDependencyProbe, semanticBindingProjection, swapAgainstUnknownTimeFoil, voiceAudit } from './voiceEvals.js';

export const ETBZ57_FIXTURE_DIR = 'docs/evidence/etbz-57/fixture';
export const ETBZ52_FIXTURE_DIR = 'docs/evidence/etbz-52/fixture';

const readJson = (path: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as unknown;

function codeOf(action: () => unknown): string {
  try {
    action();
    return 'ACCEPTED';
  } catch (error) {
    if (error instanceof SkillRunError) return error.code;
    throw error;
  }
}

/** A package with one edit and a recomputed hash, and a reading re-bound to it. */
function rebound(pkg: SkillInputPackage, reading: SkillReadingDraft, edit: (core: Record<string, unknown>) => void): { pkg: SkillInputPackage; reading: SkillReadingDraft } {
  const mutable = structuredClone(pkg) as unknown as Record<string, unknown>;
  delete mutable['structuralHash'];
  edit(mutable);
  const next = { ...mutable, structuralHash: structuralHash(mutable) } as unknown as SkillInputPackage;
  const draft = structuredClone(reading) as SkillReadingDraft & { structuralHash?: string };
  delete draft.structuralHash;
  return { pkg: next, reading: { ...draft, inputPackageStructuralHash: next.structuralHash } };
}

export interface Etbz57Evidence {
  readonly accepted: AcceptedSkillReading;
  readonly customer: unknown;
  readonly evals: unknown;
  readonly manifest: unknown;
}

/**
 * Declared, not measured: who wrote the two readings, with what, when and on
 * which repository head. Nothing in the repository can prove which model
 * wrote a text (as in ETBZ-52's manifest), so this is recorded as a declaration.
 */
export const ETBZ57_GENERATION = {
  declared: true,
  runtime: 'Claude Code CLI - the Delivery Runner (PO decision D2, Jira ETBZ-2 comment 16690; program handoff, comment 16866)',
  model: 'claude-opus-5-5',
  executedAt: '2026-10-01',
  operator: 'Delivery Runner (ETBZ-57 57.4)',
  repositoryHead: 'ffbcd0ab6ba215e3172cd78b32e0c8872c29be8d',
  passes: [
    'REALISE v1 and EDIT v1: superseded after independent editorial review round 1 (not committed)',
    'REALISE v2 and EDIT v2: superseded after review round 2 confirmed 8 of 20 flagged sentences as overreach (not committed)',
    'REALISE v3 and EDIT v3: committed in ffbcd0a, superseded after the delta review (round 3) found unlicensed count statements and 3 overreaching fill sentences',
    'REALISE v4: semantic-reading.json',
    'EDIT v4: skill-reading.json (text-only revision of REALISE v4)',
  ],
} as const;

const sha256Of = (path: string): string => `sha256:${createHash('sha256').update(readFileSync(resolve(process.cwd(), path))).digest('hex')}`;
const sha256OfText = (text: string): string => `sha256:${createHash('sha256').update(text).digest('hex')}`;

export function deriveEtbz57Evidence(): Etbz57Evidence {
  const v10 = skillFixture();
  const v11 = skillFixtureV1_1();
  const context = { bundle: v11.bundle, inputPackage: v11.inputPackage, candidateEvaluation: true } as const;
  const old = acceptSkillReading(readJson(`${ETBZ52_FIXTURE_DIR}/skill-reading.json`), { bundle: v10.bundle, inputPackage: v10.inputPackage });
  const semantic = acceptSkillReading(readJson(`${ETBZ57_FIXTURE_DIR}/semantic-reading.json`), context);
  const accepted = acceptEditorialRevision(semantic, readJson(`${ETBZ57_FIXTURE_DIR}/skill-reading.json`), context);

  // A — same meaning, new voice.
  const oldAudit = voiceAudit(old);
  const newAudit = voiceAudit(accepted);
  const projectionOld = semanticBindingProjection(old);
  const projectionNew = semanticBindingProjection(accepted);

  // B — TENTATIVE stays visible: the Day Master fact made provisional, every paragraph on it written TENTATIVE.
  const provisional = (core: Record<string, unknown>): void => {
    core['facts'] = (core['facts'] as ChartFact[]).map((fact) => (fact.id === 'chart.dayMaster.stem' ? { ...fact, provisional: true } : fact));
    core['provisionalFactIds'] = ['chart.dayMaster.stem'];
  };
  const tentative = rebound(v11.inputPackage, accepted, provisional);
  const onDayMaster = (r: SkillReadingDraft) => r.chapters.flatMap((c) => c.paragraphs.filter((p) => p.factRefs.includes('chart.dayMaster.stem')));
  const silent = structuredClone(tentative.reading);
  for (const p of onDayMaster(silent)) (p as { posture: string }).posture = 'TENTATIVE';
  const marked = structuredClone(silent);
  for (const p of onDayMaster(marked)) (p as { text: string }).text = `Vorläufig, solange die Angabe nicht bestätigt ist: ${p.text}`;
  const tentativeContext = { bundle: v11.bundle, inputPackage: tentative.pkg, candidateEvaluation: true } as const;

  // D — no manufactured tension: tension language added to the paragraph over the one claim in no contrast.
  const manufactured = structuredClone(accepted) as SkillReadingDraft & { structuralHash?: string };
  delete manufactured.structuralHash;
  const c4Paragraph = manufactured.chapters[1]?.paragraphs[2] as { text: string };
  c4Paragraph.text = `${c4Paragraph.text} Darin liegt eine echte Spannung.`;

  // F — fact mutation and removal, per version (72056833 section 6: never across versions).
  const mutation = { kind: 'MUTATE', factId: 'chart.wuxing.dominant', value: 'Holz' } as const;
  const removal = { kind: 'REMOVE', factId: 'chart.natal.pillar.day.hiddenStem.0.tenGod' } as const;

  const contrastClaims = new Set(v11.inputPackage.claimGraph.claims.flatMap((claim) => claim.relations.filter((r) => r.type === 'CONTRASTS_WITH').flatMap((r) => [claim.claimId, r.targetClaimId])));
  const tensionSurfaces = (r: SkillReadingDraft) => r.chapters.flatMap((c, ci) => c.paragraphs
    .map((p, pi) => ({ where: `chapters[${String(ci)}].paragraphs[${String(pi)}]`, p }))
    .filter(({ p }) => p.kind !== 'FACT' && p.claimRefs.filter((id) => contrastClaims.has(id)).length >= 2));

  const evals = {
    evalsVersion: 'etbz57-voice-evals.v1',
    note: 'Deterministic instruments only; they decide nothing. The acceptance boundary refuses, the Product Owner judges (ETBZ-57 57.5).',
    versions: {
      old: { skillRef: old.skillRef, bundleRef: old.bundleRef, bundleStructuralHash: old.bundleStructuralHash, acceptedReadingStructuralHash: old.structuralHash },
      new: { skillRef: accepted.skillRef, bundleRef: accepted.bundleRef, bundleStructuralHash: accepted.bundleStructuralHash, acceptedReadingStructuralHash: accepted.structuralHash, semanticReadingStructuralHash: semantic.structuralHash },
    },
    A_fixtureOldVsNew: {
      semanticBindingsEqual: canonicalJson(projectionOld) === canonicalJson(projectionNew),
      claimGraphStructuralHash: accepted.claimGraphStructuralHash,
      oldTotals: oldAudit.totals,
      newTotals: newAudit.totals,
      oldSurfaces: oldAudit.surfaces,
      newSurfaces: newAudit.surfaces,
    },
    B_tentative: {
      variant: 'chart.dayMaster.stem made provisional in the 1.1.0 package (synthetic); every paragraph citing it set TENTATIVE',
      paragraphsOnFact: onDayMaster(silent).length,
      asCertain: codeOf(() => acceptSkillReading(tentative.reading, tentativeContext)),
      tentativeWithoutMarker: codeOf(() => acceptSkillReading(silent, tentativeContext)),
      tentativeWithMarker: codeOf(() => acceptSkillReading(marked, tentativeContext)),
    },
    C_groundedTension: {
      contrastPairs: v11.inputPackage.plan.tensions.length,
      old: tensionSurfaces(old).map(({ where, p }) => ({ where, tensionWords: oldAudit.surfaces.find((s) => s.where === where)?.tensionWords ?? [], softeners: oldAudit.surfaces.find((s) => s.where === where)?.softeners ?? [], alternatives: oldAudit.surfaces.find((s) => s.where === where)?.alternatives ?? [], claims: p.claimRefs.length })),
      new: tensionSurfaces(accepted).map(({ where, p }) => ({ where, tensionWords: newAudit.surfaces.find((s) => s.where === where)?.tensionWords ?? [], softeners: newAudit.surfaces.find((s) => s.where === where)?.softeners ?? [], alternatives: newAudit.surfaces.find((s) => s.where === where)?.alternatives ?? [], claims: p.claimRefs.length })),
    },
    D_noTension: {
      probe: 'tension sentence added to chapters[1].paragraphs[2], whose only claim is in no CONTRASTS_WITH relation',
      result: codeOf(() => acceptSkillReading(manufactured, context)),
      chapterWithoutContrastTensionWords: newAudit.surfaces.filter((s) => s.where.startsWith('chapters[1]')).flatMap((s) => s.tensionWords),
    },
    E_nearNeighbourSwap: {
      graphIdenticalAcrossVersions: old.claimGraphStructuralHash === accepted.claimGraphStructuralHash,
      swap: swapAgainstUnknownTimeFoil(),
    },
    F_factMutationAndRemoval: {
      mutation,
      removal,
      old: { mutation: proseDependencyProbe(old, v10.inputPackage, mutation), removal: proseDependencyProbe(old, v10.inputPackage, removal) },
      new: { mutation: proseDependencyProbe(accepted, v11.inputPackage, mutation), removal: proseDependencyProbe(accepted, v11.inputPackage, removal) },
    },
    G_antiBoilerplate: {
      graphLevelChecks: 'claim graph and plan content are identical across versions (A, E): the graph-level steps of 72056833 sections 6.1-6.4 and 6.6 have the same outcome under both skill versions by construction',
      proseLevel: '6.5 anchor ablation is read in the qualitative review; 6.7 reuse needs a second reading under the same version and is not run (ETBZ-54 executes the section 8 minimum)',
    },
  };
  const customer = projectCustomerReading(accepted);
  const skillManifest = readJson('skill/bazodiac-interpretation-skill-v1.1/MANIFEST.json') as { packageStructuralHash: string };
  const manifest = {
    manifestVersion: 'bazodiac-skill-fixture-run-manifest.v1',
    runId: 'etbz57-voice-fixture-run-known-time-2026-10-01',
    skillRef: v11.inputPackage.skillRef,
    skillPackageStructuralHash: skillManifest.packageStructuralHash,
    bundleRef: v11.bundle.bundleRef,
    bundleStructuralHash: v11.bundle.structuralHash,
    bundleStatus: 'CANDIDATE',
    contracts: v11.inputPackage.contracts,
    inputPackageStructuralHash: v11.inputPackage.structuralHash,
    interpretationInputStructuralHash: v11.input.structuralHash,
    claimGraphStructuralHash: v11.graph.structuralHash,
    planStructuralHash: v11.plan.structuralHash,
    semanticReadingStructuralHash: semantic.structuralHash,
    acceptedReadingStructuralHash: accepted.structuralHash,
    subject: v11.inputPackage.subject,
    warnings: v11.inputPackage.warnings,
    files: {
      'skill-input.json': sha256Of(`${ETBZ57_FIXTURE_DIR}/skill-input.json`),
      'semantic-reading.json': sha256Of(`${ETBZ57_FIXTURE_DIR}/semantic-reading.json`),
      'skill-reading.json': sha256Of(`${ETBZ57_FIXTURE_DIR}/skill-reading.json`),
      // Written by the same emit run as this manifest: hashed from the rendered bytes, not read back.
      'accepted-reading.json': sha256OfText(renderJson(accepted)),
      'customer-reading.json': sha256OfText(renderJson(customer)),
      '../evals.json': sha256OfText(renderJson(evals)),
    },
    generation: ETBZ57_GENERATION,
  };
  return { accepted, customer, evals, manifest };
}

export function renderJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}
