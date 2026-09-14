import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import {
  META_NARRATIVE_PLAN_VERSION,
  PLAN_CLAIM_SCOPE,
  PRIMARY_MOTIF_COUNT,
  TENSION_RELATION_TYPES,
  THREAD_NARRATIVE_ROLES,
  buildMetaNarrativePlan,
  deriveChapterId,
  deriveOpenThreadId,
  derivePrimaryMotifId,
  hashMetaNarrativePlan,
} from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import { NARRATIVE_OPERATORS } from '../../src/application/interpretation/interpretive-claim.js';
import {
  BASELINE_GRAPH,
  CHAPTER_INTEGRATE,
  CLAIM_ELEMENTAL,
  CLAIM_POSITIONAL,
  CLAIM_SEASONAL,
  CLAIM_SELF_ROLE,
  KNOWN_BRIEF,
  KNOWN_MODEL,
  MOTIF_MEASURE,
  MOTIF_ROLE,
  MOTIF_SEASON,
  MOTIF_SPREAD,
  PLAN_THESIS_ALT,
  THREAD_CLOSING,
  THREAD_OPEN,
  buildPlan,
  validPlanDraft,
} from '../support/metaNarrativePlanFixture.js';
import type { MutablePlan } from '../support/metaNarrativePlanFixture.js';

/**
 * ETBZ-30 C3 — the accepted MetaNarrativePlan.
 *
 * The properties that matter here are the ones a test which merely builds a
 * valid plan cannot see. An identity that silently depends on a planner's
 * handle, on input order, or on how often a reference was repeated is
 * indistinguishable from a stable one until something reorders the draft; a
 * hash that is not re-derivable is not evidence. So every claim this commit
 * makes is asserted from the outside:
 *
 *   1. THE PLAN INVENTS NO IMPORTANCE. Anti-drift law 7 refuses numerical
 *      salience, and the strongest form of that is not "no field named score"
 *      but NO NUMBER AT ALL in the published artefact — asserted by walking
 *      every value. Repetition is the other half: repeating a reference is the
 *      cheapest way to make something look weightier, and it must move nothing.
 *
 *   2. ORDER MEANS EXACTLY ONE THING. The chapter sequence is semantic, so
 *      moving a chapter MUST move the hash. Every other list is a set, so
 *      permuting it must NOT. Both directions are measured, because a build
 *      that sorted everything would satisfy half of this file and destroy the
 *      narrative, and one that sorted nothing would satisfy the other half and
 *      let transport shape become meaning.
 *
 *   3. DERIVED MEANS DERIVED. Tensions come from the graph's relations and
 *      coverage from the chapter plan; both are re-derived here independently
 *      of the module, so "the planner cannot author them" is a measurement
 *      rather than a promise.
 */

const BASELINE: MetaNarrativePlan = buildPlan(validPlanDraft());

/** Every number-typed value reachable in a JSON-shaped artefact, with its path. */
function findNumericValues(node: unknown, path: string): string[] {
  const found: string[] = [];
  const visit = (current: unknown, currentPath: string): void => {
    if (typeof current === 'number' || typeof current === 'bigint') {
      found.push(`${currentPath}: ${String(current)}`);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((entry: unknown, index: number) => {
        visit(entry, `${currentPath}[${String(index)}]`);
      });
      return;
    }
    if (typeof current === 'object' && current !== null) {
      for (const [key, value] of Object.entries(current)) {
        visit(value, `${currentPath}.${key}`);
      }
    }
  };
  visit(node, path);
  return found;
}

/**
 * Field-name spellings that invite a ranking reading.
 *
 * Matched against KEYS only, never against the serialized artefact. The
 * coverage sets carry FuFirE's own fact ids, and `chart.wuxing.weight.Feuer` is
 * one of them — a source measurement travelling as evidence, which is exactly
 * the line `narrative-provider-ranking-signal.negative.test.ts` already draws
 * between ETBZ-authored metadata and the chart's own values. A scan over the
 * whole JSON blob would report that id as a ranking signal and force the
 * evidence to be renamed around the guard.
 */
const SIGNAL_WORDS = [
  'salience',
  'confidence',
  'rank',
  'weight',
  'score',
  'centrality',
  'prominence',
  'importance',
] as const;

function findSignalNamedFields(node: unknown, path: string): string[] {
  const found: string[] = [];
  const visit = (current: unknown, currentPath: string): void => {
    if (Array.isArray(current)) {
      current.forEach((entry: unknown, index: number) => {
        visit(entry, `${currentPath}[${String(index)}]`);
      });
      return;
    }
    if (typeof current === 'object' && current !== null) {
      for (const [key, value] of Object.entries(current)) {
        const keyPath = `${currentPath}.${key}`;
        const normalized = key.toLowerCase();
        for (const word of SIGNAL_WORDS) {
          if (normalized.includes(word)) {
            found.push(`${keyPath}: ${word}`);
          }
        }
        visit(value, keyPath);
      }
    }
  };
  visit(node, path);
  return found;
}

describe('ETBZ-30 C3-A: a trusted draft builds an accepted plan', () => {
  it('A: accepts the verified baseline and publishes the contract shape', () => {
    expect(Object.keys(BASELINE).sort()).toEqual([
      'chapterPlan',
      'constraints',
      'coverage',
      'openThreads',
      'planVersion',
      'primaryMotifs',
      'reportThesis',
      'sourceBriefHash',
      'sourceClaimGraphHash',
      'structuralHash',
      'tensions',
    ]);
    expect(BASELINE.planVersion).toBe(META_NARRATIVE_PLAN_VERSION);
    expect(BASELINE.primaryMotifs).toHaveLength(4);
    expect(BASELINE.chapterPlan).toHaveLength(4);
    expect(BASELINE.openThreads).toHaveLength(2);
  });

  it('binds to BOTH the brief and the claim graph it was accepted against', () => {
    expect(BASELINE.sourceBriefHash).toBe(KNOWN_BRIEF.structuralHash);
    expect(BASELINE.sourceClaimGraphHash).toBe(BASELINE_GRAPH.structuralHash);
  });

  it('publishes a motif with no planner field and no number', () => {
    for (const motif of BASELINE.primaryMotifs) {
      expect(Object.keys(motif).sort()).toEqual([
        'anchorClaimRef',
        'claimRefs',
        'motifId',
        'statement',
      ]);
      expect(motif.claimRefs).toContain(motif.anchorClaimRef);
    }
  });

  it('publishes a chapter whose references are all accepted identities', () => {
    const claimIds = new Set(BASELINE_GRAPH.claims.map((claim) => claim.claimId));
    const motifIds = new Set(BASELINE.primaryMotifs.map((motif) => motif.motifId));
    const threadIds = new Set(BASELINE.openThreads.map((thread) => thread.threadId));

    for (const chapter of BASELINE.chapterPlan) {
      expect(Object.keys(chapter).sort()).toEqual([
        'chapterId',
        'claimRefs',
        'closeThreadRefs',
        'motifRefs',
        'motifTransitions',
        'narrativeRole',
        'openThreadRefs',
      ]);
      expect(NARRATIVE_OPERATORS).toContain(chapter.narrativeRole);
      expect(chapter.claimRefs.length).toBeGreaterThan(0);
      for (const claimRef of chapter.claimRefs) expect(claimIds.has(claimRef)).toBe(true);
      for (const motifRef of chapter.motifRefs) expect(motifIds.has(motifRef)).toBe(true);
      for (const threadRef of [...chapter.openThreadRefs, ...chapter.closeThreadRefs]) {
        expect(threadIds.has(threadRef)).toBe(true);
      }
      // No draft handle survives into the accepted plan.
      expect(JSON.stringify(chapter)).not.toContain('chapter-');
      expect(JSON.stringify(chapter)).not.toContain('motif-');
    }
  });

  it('keeps the thread role vocabulary a strict subset of the narrative operators', () => {
    for (const role of THREAD_NARRATIVE_ROLES) {
      expect(NARRATIVE_OPERATORS).toContain(role);
    }
    // ESTABLISH and REINFORCE leave nothing owing and are absent on purpose;
    // an absence nobody measures is indistinguishable from an oversight.
    expect(THREAD_NARRATIVE_ROLES).not.toContain('ESTABLISH');
    expect(THREAD_NARRATIVE_ROLES).not.toContain('REINFORCE');
  });
});

describe('ETBZ-30 C3-B: the plan invents no importance (anti-drift law 7)', () => {
  it('publishes NO number-typed value anywhere in the accepted plan', () => {
    // The strong form. A blocklist of field names is defeated by renaming;
    // there being no number-shaped hole at all is not.
    expect(findNumericValues(BASELINE, 'plan')).toEqual([]);
  });

  it('names no salience, confidence, rank or weight FIELD', () => {
    expect(findSignalNamedFields(BASELINE, 'plan')).toEqual([]);
  });

  it('flags a planted ranking field, so the name scan is not vacuously green', () => {
    const polluted = structuredClone(BASELINE) as unknown as Record<string, unknown>;
    polluted['motifRank'] = 'high';

    // A STRING value, which the numeric scan cannot see — the two scans catch
    // different smuggling routes and neither subsumes the other.
    expect(findSignalNamedFields(polluted, 'plan')).toEqual(['plan.motifRank: rank']);
    expect(findNumericValues(polluted, 'plan')).toEqual([]);
  });

  it('does NOT mistake a FuFirE fact id for a ranking signal', () => {
    // The precision control the blunt version of this test failed: the Wu Xing
    // weight ids really are in the published coverage, and they are the
    // source's measurements rather than an ETBZ-authored importance.
    expect(BASELINE.coverage.factRefs.some((factId) => factId.includes('weight'))).toBe(true);
    expect(findSignalNamedFields(BASELINE.coverage, 'coverage')).toEqual([]);
  });

  it('finds a planted number, so the scan above is not vacuously green', () => {
    const polluted = structuredClone(BASELINE) as unknown as Record<string, unknown>;
    const motifs = polluted['primaryMotifs'];
    if (!Array.isArray(motifs)) throw new Error('fixture defect: primaryMotifs is not an array');
    const first: unknown = motifs[0];
    if (typeof first !== 'object' || first === null) {
      throw new Error('fixture defect: no motif to pollute');
    }
    (first as Record<string, unknown>)['salience'] = 0.9;

    expect(findNumericValues(polluted, 'plan')).toEqual(['plan.primaryMotifs[0].salience: 0.9']);
  });

  it('D: repeating a reference changes neither the plan nor its hash', () => {
    // The cheapest way to fake emphasis: say it twice. It must buy nothing.
    const repeated = validPlanDraft();
    repeated.reportThesis.claimRefs.push(CLAIM_SELF_ROLE);
    const integrate = repeated.chapterPlan[3];
    expect(integrate).toBeDefined();
    if (integrate === undefined) return;
    integrate.claimRefs.push(CLAIM_SELF_ROLE, CLAIM_SELF_ROLE);
    integrate.motifRefs.push(MOTIF_ROLE);

    const plan = buildPlan(repeated);

    expect(canonicalJson(plan)).toBe(canonicalJson(BASELINE));
    expect(plan.structuralHash).toBe(BASELINE.structuralHash);
    // ...and the repetition really was normalized away rather than absent.
    expect(plan.reportThesis.claimRefs).toEqual([...new Set(plan.reportThesis.claimRefs)]);
  });
});

describe('ETBZ-30 C3-C: the plan is a pure function of the planned meaning', () => {
  it('B: produces a byte-identical plan from identical input', () => {
    const again = buildPlan(validPlanDraft());

    expect(canonicalJson(again)).toBe(canonicalJson(BASELINE));
    expect(again.structuralHash).toBe(BASELINE.structuralHash);
  });

  it('C: permuting set-like reference lists changes neither plan nor hash', () => {
    const permuted = validPlanDraft();
    permuted.reportThesis.claimRefs.reverse();
    const qualify = permuted.chapterPlan[1];
    const integrate = permuted.chapterPlan[3];
    expect(qualify).toBeDefined();
    expect(integrate).toBeDefined();
    if (qualify === undefined || integrate === undefined) return;
    qualify.claimRefs.reverse();
    qualify.motifRefs.reverse();
    qualify.motifTransitions.reverse();
    integrate.motifTransitions.reverse();

    const plan = buildPlan(permuted);

    expect(canonicalJson(plan)).toBe(canonicalJson(BASELINE));
    expect(plan.structuralHash).toBe(BASELINE.structuralHash);
  });

  it('C: permuting a chapter’s thread references changes neither plan nor hash', () => {
    // The baseline opens one thread per chapter, so the permutation needs a
    // chapter that opens two — otherwise this assertion would be vacuous.
    const both = (): MutablePlan => {
      const draft = validPlanDraft();
      const establish = draft.chapterPlan[0];
      const qualify = draft.chapterPlan[1];
      if (establish === undefined || qualify === undefined) throw new Error('fixture defect');
      establish.openThreadRefs = [THREAD_CLOSING, THREAD_OPEN];
      qualify.openThreadRefs = [];
      return draft;
    };
    const forward = buildPlan(both());
    const backward = (): MetaNarrativePlan => {
      const draft = both();
      const establish = draft.chapterPlan[0];
      if (establish === undefined) throw new Error('fixture defect');
      establish.openThreadRefs.reverse();
      return buildPlan(draft);
    };

    expect(forward.chapterPlan[0]?.openThreadRefs).toHaveLength(2);
    expect(canonicalJson(backward())).toBe(canonicalJson(forward));
  });

  it('E: permuting the primary motif input order changes neither plan nor hash', () => {
    const permuted = validPlanDraft();
    permuted.primaryMotifs.reverse();

    const plan = buildPlan(permuted);

    expect(canonicalJson(plan)).toBe(canonicalJson(BASELINE));
    expect(plan.primaryMotifs.map((motif) => motif.motifId)).toEqual(
      BASELINE.primaryMotifs.map((motif) => motif.motifId),
    );
  });

  it('E: permuting the open thread input order changes neither plan nor hash', () => {
    const permuted = validPlanDraft();
    permuted.openThreads.reverse();

    expect(canonicalJson(buildPlan(permuted))).toBe(canonicalJson(BASELINE));
  });

  it('F: MOVING A CHAPTER moves the plan hash', () => {
    // The one ordering in this artefact that is meaning. A report told in
    // another order is a different report, and the hash has to say so.
    const reordered = validPlanDraft();
    const qualify = reordered.chapterPlan[1];
    const contrast = reordered.chapterPlan[2];
    expect(qualify).toBeDefined();
    expect(contrast).toBeDefined();
    if (qualify === undefined || contrast === undefined) return;
    reordered.chapterPlan[1] = contrast;
    reordered.chapterPlan[2] = qualify;

    const plan = buildPlan(reordered);

    expect(plan.structuralHash).not.toBe(BASELINE.structuralHash);
    // The chapters themselves are UNCHANGED: only their sequence moved, which
    // is what makes this a statement about order rather than about content.
    expect([...plan.chapterPlan.map((chapter) => chapter.chapterId)].sort()).toEqual(
      [...BASELINE.chapterPlan.map((chapter) => chapter.chapterId)].sort(),
    );
    expect(plan.chapterPlan.map((chapter) => chapter.narrativeRole)).toEqual([
      'ESTABLISH',
      'CONTRAST',
      'QUALIFY',
      'INTEGRATE',
    ]);
  });
});

describe('ETBZ-30 C3-D: identity is the application’s, not the planner’s', () => {
  it('G: renaming every motifRef changes neither the motif ids nor the hash', () => {
    const renamed = validPlanDraft();
    const rename = (ref: string): string => `handle-${String(ref.length)}-${ref}`;
    for (const motif of renamed.primaryMotifs) motif.motifRef = rename(motif.motifRef);
    for (const thread of renamed.openThreads) {
      thread.motifRefs = thread.motifRefs.map(rename);
    }
    for (const chapter of renamed.chapterPlan) {
      chapter.motifRefs = chapter.motifRefs.map(rename);
      for (const transition of chapter.motifTransitions) {
        transition.motifRef = rename(transition.motifRef);
      }
    }

    const plan = buildPlan(renamed);

    expect(canonicalJson(plan)).toBe(canonicalJson(BASELINE));
    expect(JSON.stringify(plan)).not.toContain('handle-');
  });

  it('H: renaming every threadRef changes neither the thread ids nor the hash', () => {
    const renamed = validPlanDraft();
    const rename = (ref: string): string => `obligation-${ref}`;
    for (const thread of renamed.openThreads) thread.threadRef = rename(thread.threadRef);
    for (const chapter of renamed.chapterPlan) {
      chapter.openThreadRefs = chapter.openThreadRefs.map(rename);
      chapter.closeThreadRefs = chapter.closeThreadRefs.map(rename);
    }

    const plan = buildPlan(renamed);

    expect(canonicalJson(plan)).toBe(canonicalJson(BASELINE));
    expect(JSON.stringify(plan)).not.toContain('obligation-');
  });

  it('I: renaming every chapterRef changes neither the chapter ids nor the hash', () => {
    const renamed = validPlanDraft();
    const rename = (ref: string): string => `section-${ref}`;
    for (const chapter of renamed.chapterPlan) chapter.chapterRef = rename(chapter.chapterRef);
    for (const thread of renamed.openThreads) {
      if (thread.resolution.chapterRef !== undefined) {
        thread.resolution.chapterRef = rename(thread.resolution.chapterRef);
      }
    }

    const plan = buildPlan(renamed);

    expect(canonicalJson(plan)).toBe(canonicalJson(BASELINE));
    expect(JSON.stringify(plan)).not.toContain('section-');
  });

  it('derives every accepted id from its semantic content, re-derivably', () => {
    for (const motif of BASELINE.primaryMotifs) {
      expect(motif.motifId).toBe(
        derivePrimaryMotifId({
          statement: motif.statement,
          anchorClaimRef: motif.anchorClaimRef,
          claimRefs: motif.claimRefs,
        }),
      );
      expect(motif.motifId.startsWith('motif.sha256:')).toBe(true);
    }
    for (const thread of BASELINE.openThreads) {
      expect(thread.threadId).toBe(
        deriveOpenThreadId({
          narrativeRole: thread.narrativeRole,
          claimRefs: thread.claimRefs,
          motifRefs: thread.motifRefs,
        }),
      );
    }
    for (const chapter of BASELINE.chapterPlan) {
      expect(chapter.chapterId).toBe(
        deriveChapterId({
          narrativeRole: chapter.narrativeRole,
          claimRefs: chapter.claimRefs,
          motifRefs: chapter.motifRefs,
          motifTransitions: chapter.motifTransitions,
          openThreadRefs: chapter.openThreadRefs,
          closeThreadRefs: chapter.closeThreadRefs,
        }),
      );
    }
  });

  it('keeps a chapter id independent of WHERE the chapter sits', () => {
    // The counterpart of F: the sequence moves the PLAN hash, and moves no
    // chapter's own identity. Both must hold, or "order is semantic" would
    // silently mean "position is part of a chapter".
    const reordered = validPlanDraft();
    const qualify = reordered.chapterPlan[1];
    const contrast = reordered.chapterPlan[2];
    if (qualify === undefined || contrast === undefined) return;
    reordered.chapterPlan[1] = contrast;
    reordered.chapterPlan[2] = qualify;

    const moved = buildPlan(reordered);
    const qualifyBefore = BASELINE.chapterPlan[1]?.chapterId;
    const qualifyAfter = moved.chapterPlan[2]?.chapterId;

    expect(qualifyBefore).toBeDefined();
    expect(qualifyAfter).toBe(qualifyBefore);
  });
});

describe('ETBZ-30 C3-E: the thesis is a synthesis OF accepted claims', () => {
  it('J: publishes only accepted claim ids, normalized', () => {
    const claimIds = new Set(BASELINE_GRAPH.claims.map((claim) => claim.claimId));
    for (const claimRef of BASELINE.reportThesis.claimRefs) {
      expect(claimIds.has(claimRef)).toBe(true);
    }
    expect(BASELINE.reportThesis.claimRefs).toEqual(
      [...BASELINE.reportThesis.claimRefs].sort(),
    );
    expect(BASELINE.reportThesis.claimRefs.length).toBeGreaterThanOrEqual(2);
  });

  it('J: receives no claim id of its own', () => {
    // The thesis is a synthesis, not a new InterpretiveClaim. If it carried an
    // id, something downstream could cite it as independently grounded.
    expect(Object.keys(BASELINE.reportThesis).sort()).toEqual(['claimRefs', 'statement']);
    expect(BASELINE_GRAPH.claims.map((claim) => claim.statement)).not.toContain(
      BASELINE.reportThesis.statement,
    );
  });
});

describe('ETBZ-30 C3-F: tensions and coverage are DERIVED, never supplied', () => {
  it('K: derives tensions exactly from the graph’s own relations', () => {
    const expected = BASELINE_GRAPH.relations
      .filter((relation) => (TENSION_RELATION_TYPES as readonly string[]).includes(relation.type))
      .map((relation) => ({ from: relation.from, type: relation.type, to: relation.to }));

    expect([...BASELINE.tensions]).toEqual(
      [...expected].sort((left, right) => (left.from < right.from ? -1 : left.from > right.from ? 1 : 0)),
    );
    expect(BASELINE.tensions).toHaveLength(2);
  });

  it('K: does NOT reclassify an ordinary relation as a tension', () => {
    // The graph carries CONTEXTUALIZES and SUPPORTS too. A build that swept
    // every relation in would produce four tensions and demand chapters for
    // relations that state no conflict.
    const relationTypes = BASELINE_GRAPH.relations.map((relation) => relation.type);
    expect(relationTypes).toContain('CONTEXTUALIZES');
    expect(relationTypes).toContain('SUPPORTS');
    expect(BASELINE.tensions.map((tension) => tension.type).sort()).toEqual([
      'CONTRASTS_WITH',
      'QUALIFIES',
    ]);
  });

  it('L: represents every accepted graph claim in the chapter coverage', () => {
    const covered = new Set(BASELINE.chapterPlan.flatMap((chapter) => chapter.claimRefs));

    for (const claim of BASELINE_GRAPH.claims) {
      expect(covered.has(claim.claimId), claim.claimId).toBe(true);
    }
    expect(BASELINE.coverage.claimRefs).toEqual(
      [...BASELINE_GRAPH.claims.map((claim) => claim.claimId)].sort(),
    );
  });

  it('M: publishes theme and fact coverage that re-derives independently', () => {
    // Re-derived here from the graph and the brief WITHOUT the module, so this
    // is a measurement of the closure rather than a restatement of it.
    const claimsById = new Map(BASELINE_GRAPH.claims.map((claim) => [claim.claimId, claim]));
    const themes = new Set<string>();
    const facts = new Set<string>();
    for (const claimId of BASELINE.coverage.claimRefs) {
      const claim = claimsById.get(claimId);
      expect(claim).toBeDefined();
      if (claim === undefined) continue;
      for (const factId of claim.factRefs) facts.add(factId);
      for (const themeId of claim.themeRefs) {
        themes.add(themeId);
        const theme = KNOWN_BRIEF.primaryThemes.find((entry) => entry.id === themeId);
        for (const factId of theme?.factIds ?? []) facts.add(factId);
      }
    }

    expect(BASELINE.coverage.themeRefs).toEqual([...themes].sort());
    expect(BASELINE.coverage.factRefs).toEqual([...facts].sort());
    expect(BASELINE.coverage.themeRefs.length).toBeGreaterThan(0);
  });

  it('M: publishes coverage as sets, with no count or percentage', () => {
    expect(Object.keys(BASELINE.coverage).sort()).toEqual([
      'claimRefs',
      'factRefs',
      'themeRefs',
    ]);
    expect(findNumericValues(BASELINE.coverage, 'coverage')).toEqual([]);
  });
});

describe('ETBZ-30 C3-G: integration, lifecycle and open obligations', () => {
  it('N: carries a real INTEGRATE chapter relating two claims and two motifs', () => {
    const integrations = BASELINE.chapterPlan.filter(
      (chapter) => chapter.narrativeRole === 'INTEGRATE',
    );

    expect(integrations.length).toBeGreaterThanOrEqual(1);
    for (const chapter of integrations) {
      expect(chapter.claimRefs.length).toBeGreaterThanOrEqual(2);
      expect(chapter.motifRefs.length).toBeGreaterThanOrEqual(2);
    }
    // ...and the plan is not merely a row of ESTABLISH operations.
    expect(new Set(BASELINE.chapterPlan.map((chapter) => chapter.narrativeRole)).size)
      .toBeGreaterThan(1);
  });

  it('O: accepts a lifecycle that SKIPS forward states', () => {
    // The seasonal motif goes SEEDED -> INTEGRATED, skipping DEVELOPED and
    // COMPLICATED. The contract allows it, so the baseline exercises it rather
    // than leaving the rule proven only by its own refusal.
    const seasonMotif = BASELINE.primaryMotifs.find(
      (motif) => motif.anchorClaimRef === CLAIM_SEASONAL,
    );
    expect(seasonMotif).toBeDefined();
    if (seasonMotif === undefined) return;

    const states = BASELINE.chapterPlan.flatMap((chapter) =>
      chapter.motifTransitions
        .filter((transition) => transition.motifRef === seasonMotif.motifId)
        .map((transition) => transition.targetState),
    );

    expect(states).toEqual(['SEEDED', 'INTEGRATED']);
  });

  it('O: every primary motif is advanced and ends INTEGRATED or CLOSED', () => {
    const finalState = new Map<string, string>();
    for (const chapter of BASELINE.chapterPlan) {
      for (const transition of chapter.motifTransitions) {
        finalState.set(transition.motifRef, transition.targetState);
      }
    }

    for (const motif of BASELINE.primaryMotifs) {
      expect(finalState.get(motif.motifId), motif.motifId).toBeDefined();
      expect(['INTEGRATED', 'CLOSED'], motif.motifId).toContain(finalState.get(motif.motifId));
    }
  });

  it('P: an EXPLICITLY_LEFT_OPEN thread keeps an unfinished motif visible', () => {
    // The measure motif is left at COMPLICATED — genuinely unfinished — and the
    // plan is accepted ONLY because a thread says so out loud.
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    expect(integrate).toBeDefined();
    if (integrate === undefined) return;
    integrate.motifTransitions = integrate.motifTransitions.filter(
      (transition) => transition.motifRef !== MOTIF_MEASURE,
    );

    const plan = buildPlan(draft);
    const measureMotif = plan.primaryMotifs.find(
      (motif) => motif.anchorClaimRef === CLAIM_POSITIONAL,
    );
    expect(measureMotif).toBeDefined();
    if (measureMotif === undefined) return;

    const openThread = plan.openThreads.find(
      (thread) => thread.resolution.mode === 'EXPLICITLY_LEFT_OPEN',
    );
    expect(openThread).toBeDefined();
    // The obligation is still IN the accepted plan and still names the motif:
    // left open is a published state, not a quiet disappearance.
    expect(openThread?.motifRefs).toContain(measureMotif.motifId);
    expect(plan.structuralHash).not.toBe(BASELINE.structuralHash);
  });

  it('P: a closing thread resolves to a real, LATER chapter by its accepted id', () => {
    const closing = BASELINE.openThreads.find(
      (thread) => thread.resolution.mode === 'CLOSE_IN_CHAPTER',
    );
    expect(closing).toBeDefined();
    if (closing === undefined) return;
    const resolution = closing.resolution;
    if (resolution.mode !== 'CLOSE_IN_CHAPTER') {
      expect.unreachable('the baseline carries a closing thread');
      return;
    }
    const closingChapterId = resolution.chapterId;

    const closingIndex = BASELINE.chapterPlan.findIndex(
      (chapter) => chapter.chapterId === closingChapterId,
    );
    const openingIndex = BASELINE.chapterPlan.findIndex((chapter) =>
      chapter.openThreadRefs.includes(closing.threadId),
    );

    expect(openingIndex).toBeGreaterThanOrEqual(0);
    expect(closingIndex).toBeGreaterThan(openingIndex);
    // The resolution names an ACCEPTED chapter id, never the draft handle.
    expect(closingChapterId.startsWith('chapter.sha256:')).toBe(true);
    expect(JSON.stringify(closing)).not.toContain(CHAPTER_INTEGRATE);
  });

  it('states the motif count bounds it enforces', () => {
    expect(PRIMARY_MOTIF_COUNT.minimum).toBe(3);
    expect(PRIMARY_MOTIF_COUNT.maximum).toBe(5);
    expect(BASELINE.primaryMotifs.length).toBeGreaterThanOrEqual(PRIMARY_MOTIF_COUNT.minimum);
    expect(BASELINE.primaryMotifs.length).toBeLessThanOrEqual(PRIMARY_MOTIF_COUNT.maximum);
  });
});

describe('ETBZ-30 C3-H: the published hash is re-derivable and sensitive', () => {
  it('Q: is the plain sha256 of the canonical text of the plan core', () => {
    const core = {
      planVersion: BASELINE.planVersion,
      sourceBriefHash: BASELINE.sourceBriefHash,
      sourceClaimGraphHash: BASELINE.sourceClaimGraphHash,
      reportThesis: BASELINE.reportThesis,
      primaryMotifs: BASELINE.primaryMotifs,
      tensions: BASELINE.tensions,
      openThreads: BASELINE.openThreads,
      coverage: BASELINE.coverage,
      chapterPlan: BASELINE.chapterPlan,
      constraints: BASELINE.constraints,
    };
    const independent = createHash('sha256').update(canonicalJson(core), 'utf8').digest('hex');

    expect(BASELINE.structuralHash).toBe(`sha256:${independent}`);
    expect(hashMetaNarrativePlan(core)).toBe(BASELINE.structuralHash);
  });

  it('Q: carries no provider, model, route or clock inside the hashed core', () => {
    const serialized = JSON.stringify(BASELINE).toLowerCase();
    for (const word of ['provider', 'model', 'route', 'timestamp', 'candidate', 'sha1']) {
      expect(serialized, word).not.toContain(word);
    }
  });

  it('R: a changed THESIS decision moves the plan hash', () => {
    const changed = validPlanDraft();
    changed.reportThesis.statement = PLAN_THESIS_ALT;

    expect(buildPlan(changed).structuralHash).not.toBe(BASELINE.structuralHash);
  });

  it('R: a changed MOTIF decision moves the plan hash and that motif’s id', () => {
    const changed = validPlanDraft();
    const motif = changed.primaryMotifs[0];
    expect(motif).toBeDefined();
    if (motif === undefined) return;
    motif.claimRefs = [CLAIM_SELF_ROLE, CLAIM_ELEMENTAL];

    const plan = buildPlan(changed);

    expect(plan.structuralHash).not.toBe(BASELINE.structuralHash);
    expect(new Set(plan.primaryMotifs.map((entry) => entry.motifId))).not.toEqual(
      new Set(BASELINE.primaryMotifs.map((entry) => entry.motifId)),
    );
  });

  it('R: a changed CHAPTER decision moves the plan hash', () => {
    const changed = validPlanDraft();
    const contrast = changed.chapterPlan[2];
    expect(contrast).toBeDefined();
    if (contrast === undefined) return;
    contrast.motifRefs = [MOTIF_SPREAD, MOTIF_MEASURE, MOTIF_SEASON];

    expect(buildPlan(changed).structuralHash).not.toBe(BASELINE.structuralHash);
  });

  it('R: a changed THREAD disposition moves the plan hash', () => {
    const changed = validPlanDraft();
    const integrate = changed.chapterPlan[3];
    const thread = changed.openThreads[0];
    expect(integrate).toBeDefined();
    expect(thread).toBeDefined();
    if (integrate === undefined || thread === undefined) return;
    thread.resolution = { mode: 'EXPLICITLY_LEFT_OPEN' };
    integrate.closeThreadRefs = [];

    expect(buildPlan(changed).structuralHash).not.toBe(BASELINE.structuralHash);
  });

  it('binds the plan to the graph’s own published anchor', () => {
    // Called through the exported entry point rather than the fixture helper,
    // so the binding is asserted against the real signature a caller uses.
    const plan = buildMetaNarrativePlan({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      claimGraph: BASELINE_GRAPH,
      planDraft: validPlanDraft(),
    });

    expect(plan.sourceClaimGraphHash).toBe(BASELINE_GRAPH.structuralHash);
    expect(plan.sourceBriefHash).toBe(KNOWN_BRIEF.structuralHash);
    // The two anchors are genuinely different values, so binding to "a hash"
    // cannot pass by accident.
    expect(plan.sourceClaimGraphHash).not.toBe(plan.sourceBriefHash);
    expect(plan.structuralHash).toBe(BASELINE.structuralHash);
  });
});

describe('ETBZ-30 C3-I: the plan persists its rendering claim constraint', () => {
  it('publishes exactly the ETBZ-owned claim-scope constraint', () => {
    expect(BASELINE.constraints).toEqual({ claimScope: 'ACCEPTED_GRAPH_CLAIMS_ONLY' });
    expect(Object.keys(BASELINE.constraints)).toEqual(['claimScope']);
    expect(BASELINE.constraints.claimScope).toBe(PLAN_CLAIM_SCOPE);
  });

  it('scopes rendering to the exact claim graph this plan is bound to', () => {
    // The literal alone would not say WHICH claims are admissible. The
    // constraint is only meaningful because the plan also names the graph, so
    // both halves are asserted together.
    expect(BASELINE.sourceClaimGraphHash).toBe(BASELINE_GRAPH.structuralHash);

    const admissible = new Set(BASELINE_GRAPH.claims.map((claim) => claim.claimId));
    for (const claimRef of BASELINE.coverage.claimRefs) {
      expect(admissible.has(claimRef), claimRef).toBe(true);
    }
    expect(admissible.size).toBeGreaterThan(0);
  });

  it('commits the constraint to the plan structural hash', () => {
    // Re-derived WITHOUT the module. Dropping `constraints` from the core must
    // move the digest, or the published anchor would not commit to the scope
    // the plan was accepted under.
    const core = {
      planVersion: BASELINE.planVersion,
      sourceBriefHash: BASELINE.sourceBriefHash,
      sourceClaimGraphHash: BASELINE.sourceClaimGraphHash,
      reportThesis: BASELINE.reportThesis,
      primaryMotifs: BASELINE.primaryMotifs,
      tensions: BASELINE.tensions,
      openThreads: BASELINE.openThreads,
      coverage: BASELINE.coverage,
      chapterPlan: BASELINE.chapterPlan,
      constraints: BASELINE.constraints,
    };
    const withoutConstraints: Record<string, unknown> = { ...core };
    delete withoutConstraints['constraints'];

    const withIt = createHash('sha256').update(canonicalJson(core), 'utf8').digest('hex');
    const withoutIt = createHash('sha256')
      .update(canonicalJson(withoutConstraints), 'utf8')
      .digest('hex');

    expect(BASELINE.structuralHash).toBe(`sha256:${withIt}`);
    expect(withoutIt).not.toBe(withIt);
  });

  it('adds no number and no ranking-shaped field with the constraint', () => {
    // Anti-drift law 7 still holds WITH constraints on the artefact: the new
    // field must not become the number-shaped hole the rest of C3 refuses.
    expect(findNumericValues(BASELINE.constraints, 'constraints')).toEqual([]);
    expect(findSignalNamedFields(BASELINE.constraints, 'constraints')).toEqual([]);
    expect(findNumericValues(BASELINE, 'plan')).toEqual([]);
    expect(findSignalNamedFields(BASELINE, 'plan')).toEqual([]);
  });
});

describe('ETBZ-30 C3-J: accepted chapter identity is unique within one plan', () => {
  it('publishes a distinct chapterId for every accepted chapter', () => {
    const ids = BASELINE.chapterPlan.map((chapter) => chapter.chapterId);

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('control: two chapters may share a narrativeRole when they differ in substance', () => {
    // Uniqueness is about accepted MEANING, not about the operator. A plan that
    // establishes twice over different claims is legal and stays legal.
    const draft = validPlanDraft();
    draft.chapterPlan = [
      ...draft.chapterPlan,
      {
        chapterRef: 'chapter-second-establish',
        narrativeRole: 'ESTABLISH',
        claimRefs: [CLAIM_ELEMENTAL],
        motifRefs: [],
        motifTransitions: [],
        openThreadRefs: [],
        closeThreadRefs: [],
      },
    ];

    const plan = buildPlan(draft);
    const ids = plan.chapterPlan.map((chapter) => chapter.chapterId);

    expect(
      plan.chapterPlan.filter((chapter) => chapter.narrativeRole === 'ESTABLISH'),
    ).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('control: renaming a chapterRef leaves its accepted chapterId unchanged', () => {
    // The handle is the planner's; the identity is the application's. Renaming
    // every handle, and the resolution that points at one, moves nothing.
    const renamed = validPlanDraft();
    for (const chapter of renamed.chapterPlan) {
      chapter.chapterRef = `renamed-${chapter.chapterRef}`;
    }
    for (const thread of renamed.openThreads) {
      if (thread.resolution.chapterRef !== undefined) {
        thread.resolution.chapterRef = `renamed-${thread.resolution.chapterRef}`;
      }
    }

    const plan = buildPlan(renamed);

    expect(plan.chapterPlan.map((chapter) => chapter.chapterId)).toEqual(
      BASELINE.chapterPlan.map((chapter) => chapter.chapterId),
    );
    expect(plan.structuralHash).toBe(BASELINE.structuralHash);
    expect(JSON.stringify(plan)).not.toContain('renamed-');
  });

  it('control: moving a unique chapter moves the plan hash and no chapterId', () => {
    // Both halves at once: position is NOT part of a chapter's identity, and it
    // IS part of the plan's. Uniqueness therefore cannot be an artefact of
    // where a chapter happens to sit.
    const reordered = validPlanDraft();
    const qualify = reordered.chapterPlan[1];
    const contrast = reordered.chapterPlan[2];
    if (qualify === undefined || contrast === undefined) throw new Error('fixture defect');
    reordered.chapterPlan[1] = contrast;
    reordered.chapterPlan[2] = qualify;

    const plan = buildPlan(reordered);
    const ids = plan.chapterPlan.map((chapter) => chapter.chapterId);

    expect(plan.structuralHash).not.toBe(BASELINE.structuralHash);
    expect([...ids].sort()).toEqual(
      [...BASELINE.chapterPlan.map((chapter) => chapter.chapterId)].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
