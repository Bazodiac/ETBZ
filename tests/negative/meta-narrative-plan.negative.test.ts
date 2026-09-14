import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_BRIEF,
  UNKNOWN_MODEL,
} from '../support/interpretiveClaimFixture.js';
import {
  BASELINE_GRAPH,
  CHAPTER_CONTRAST,
  CHAPTER_ESTABLISH,
  CLAIM_ELEMENTAL,
  CLAIM_POSITIONAL,
  CLAIM_SEASONAL,
  CLAIM_SELF_ROLE,
  KNOWN_MODEL,
  MOTIF_MEASURE,
  MOTIF_ROLE,
  MOTIF_SEASON,
  MOTIF_SPREAD,
  MOTIF_STATEMENT_ROLE,
  MOTIF_STATEMENT_SPARE,
  THREAD_CLOSING,
  THREAD_OPEN,
  baselineSynthesisJson,
  buildPlan,
  expectPlanRefusal,
  graphFrom,
  validPlanDraft,
} from '../support/metaNarrativePlanFixture.js';
import type { MutablePlan } from '../support/metaNarrativePlanFixture.js';

/**
 * ETBZ-30 C3 — what a MetaNarrativePlan draft may NOT do.
 *
 * Every case starts from the SAME verified baseline and changes exactly one
 * thing, so each assertion isolates a single guard. Each group carries a
 * positive control — the unmutated plan, or the legal neighbour of the mutation
 * — because a validator that refused everything would satisfy every refusal
 * below while proving nothing.
 *
 * Nothing here needs a credential or a network: the "planner" is a plain object
 * literal, which is the point. The validation does not care where the draft
 * came from, and no planner implementation exists in this commit.
 */

describe('ETBZ-30 C3-N0: the unmutated draft really does produce a plan', () => {
  it('accepts the baseline (the guards below are not simply always red)', () => {
    const plan = buildPlan(validPlanDraft());

    expect(plan.primaryMotifs).toHaveLength(4);
    expect(plan.chapterPlan).toHaveLength(4);
    expect(plan.openThreads).toHaveLength(2);
  });
});

describe('ETBZ-30 C3-N1: a structurally malformed draft is refused', () => {
  it.each([
    ['not an object', 'a plan'],
    ['null', null],
    ['an empty object', {}],
    ['missing chapterPlan', { ...validPlanDraft(), chapterPlan: undefined }],
    ['chapterPlan of the wrong type', { ...validPlanDraft(), chapterPlan: 'nope' }],
    ['an unknown top-level key', { ...validPlanDraft(), planVersion: 'etbz-30.v1' }],
    ['a planner-supplied structuralHash', { ...validPlanDraft(), structuralHash: 'sha256:0' }],
    ['a planner-supplied coverage', { ...validPlanDraft(), coverage: { claimRefs: [] } }],
    ['planner-authored tensions', { ...validPlanDraft(), tensions: [] }],
    // The rendering claim scope is ETBZ's. A planner that could SUPPLY it could
    // widen it, so both spellings are refused as an unrecognized key rather
    // than validated away — including the one that states the correct value.
    [
      'planner-supplied rendering constraints',
      { ...validPlanDraft(), constraints: { claimScope: 'ACCEPTED_GRAPH_CLAIMS_ONLY' } },
    ],
    [
      'planner-WIDENED rendering constraints',
      { ...validPlanDraft(), constraints: { claimScope: 'ANY_CLAIM' } },
    ],
    ['a provider stamp', { ...validPlanDraft(), providerId: 'etbz-30.test.planner' }],
  ])('1: refuses a draft that is %s', (_label, planDraft) => {
    expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', planDraft);
  });

  it('1: refuses a planner-assigned accepted identity, on every structure', () => {
    // The identities are ETBZ's bookkeeping. A draft that supplied one would be
    // choosing the value the application derives, so the key is refused rather
    // than ignored.
    const withMotifId = validPlanDraft() as unknown as Record<string, unknown>;
    const motifs = withMotifId['primaryMotifs'];
    if (!Array.isArray(motifs)) throw new Error('fixture defect');
    const firstMotif: unknown = motifs[0];
    if (typeof firstMotif !== 'object' || firstMotif === null) throw new Error('fixture defect');
    (firstMotif as Record<string, unknown>)['motifId'] = 'motif.sha256:0';
    expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', withMotifId);

    const withChapterId = validPlanDraft() as unknown as Record<string, unknown>;
    const chapters = withChapterId['chapterPlan'];
    if (!Array.isArray(chapters)) throw new Error('fixture defect');
    const firstChapter: unknown = chapters[0];
    if (typeof firstChapter !== 'object' || firstChapter === null) throw new Error('fixture defect');
    (firstChapter as Record<string, unknown>)['chapterId'] = 'chapter.sha256:0';
    expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', withChapterId);

    const withThreadId = validPlanDraft() as unknown as Record<string, unknown>;
    const threads = withThreadId['openThreads'];
    if (!Array.isArray(threads)) throw new Error('fixture defect');
    const firstThread: unknown = threads[0];
    if (typeof firstThread !== 'object' || firstThread === null) throw new Error('fixture defect');
    (firstThread as Record<string, unknown>)['threadId'] = 'thread.sha256:0';
    expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', withThreadId);
  });

  it('1: refuses a salience field wherever a planner might attach one', () => {
    // There is no number-shaped hole in this contract, and this is where that
    // becomes structural rather than a matter of the planner's restraint.
    for (const field of ['salience', 'confidence', 'rank', 'weight']) {
      const draft = validPlanDraft() as unknown as Record<string, unknown>;
      const motifs = draft['primaryMotifs'];
      if (!Array.isArray(motifs)) throw new Error('fixture defect');
      const motif: unknown = motifs[0];
      if (typeof motif !== 'object' || motif === null) throw new Error('fixture defect');
      (motif as Record<string, unknown>)[field] = 0.9;

      expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', draft);
    }
  });

  it('1: refuses an operator, lifecycle state or thread role nobody approved', () => {
    const badOperator = validPlanDraft();
    const chapter = badOperator.chapterPlan[0];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.narrativeRole = 'SUMMARIZE';
    expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', badOperator);

    const badState = validPlanDraft();
    const stateChapter = badState.chapterPlan[0];
    if (stateChapter === undefined) throw new Error('fixture defect');
    const transition = stateChapter.motifTransitions[0];
    if (transition === undefined) throw new Error('fixture defect');
    transition.targetState = 'RESOLVED';
    expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', badState);

    // ESTABLISH is a legal narrative operator and NOT a legal thread role: a
    // thread declares an obligation, and establishing leaves nothing owing.
    const badRole = validPlanDraft();
    const thread = badRole.openThreads[0];
    if (thread === undefined) throw new Error('fixture defect');
    thread.narrativeRole = 'ESTABLISH';
    expectPlanRefusal('PLAN_DRAFT_SCHEMA_INVALID', badRole);
  });

  it('reports the schema failure without echoing the received value', () => {
    // This repository's secret gate scans tests too, and a refusal that echoes
    // untrusted bulk is how raw planner output reaches a log.
    const marker = 'MARKER-VALUE-THAT-MUST-NOT-BE-ECHOED';
    try {
      buildPlan({ ...validPlanDraft(), unexpectedKey: marker });
      expect.unreachable('an invented key must be refused');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(marker);
      expect((error as Error).message).toContain('unrecognized_keys');
    }
  });
});

describe('ETBZ-30 C3-N2: the plan must belong to this chart, brief and graph', () => {
  it('2: refuses a brief that is not the one this HoroscopeModel produces', () => {
    // A DIFFERENT chart's brief handed alongside THIS chart's model. The chain
    // is re-derived from the model, so the supplied brief is only ever compared
    // against it and never believed.
    expectPlanRefusal(
      'PLAN_BRIEF_NOT_DERIVED_FROM_MODEL',
      validPlanDraft(),
      BASELINE_GRAPH,
      KNOWN_MODEL,
      UNKNOWN_BRIEF,
    );
  });

  it('3: refuses a claim graph bound to another brief', () => {
    // Here the model and the brief agree with each other, so the gate above
    // passes and this one is what fires: the graph being orchestrated was
    // accepted against a different chain entirely. The two cases are therefore
    // distinguishable rather than two spellings of one failure.
    expectPlanRefusal(
      'PLAN_GRAPH_BRIEF_MISMATCH',
      validPlanDraft(),
      BASELINE_GRAPH,
      UNKNOWN_MODEL,
      UNKNOWN_BRIEF,
    );
  });

  it('4: refuses a graph whose published hash is not the hash of its content', () => {
    const tampered = {
      ...BASELINE_GRAPH,
      structuralHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    };

    expectPlanRefusal('PLAN_GRAPH_HASH_INVALID', validPlanDraft(tampered), tampered);
  });

  it('4: refuses a graph whose CLAIMS were changed after it was hashed', () => {
    // The mutation the recomputation exists for: the content moved and the
    // anchor did not.
    const tampered = {
      ...BASELINE_GRAPH,
      claims: BASELINE_GRAPH.claims.slice(0, 3),
    };

    expectPlanRefusal('PLAN_GRAPH_HASH_INVALID', validPlanDraft(tampered), tampered);
  });

  it('5: refuses a draft naming a different brief', () => {
    const draft = validPlanDraft();
    draft.sourceBriefHash = UNKNOWN_BRIEF.structuralHash;

    expectPlanRefusal('PLAN_BRIEF_HASH_MISMATCH', draft);
  });

  it('6: refuses a STALE draft naming a different claim graph', () => {
    const draft = validPlanDraft();
    draft.sourceClaimGraphHash =
      'sha256:1111111111111111111111111111111111111111111111111111111111111111';

    expectPlanRefusal('PLAN_GRAPH_HASH_MISMATCH', draft);
  });
});

describe('ETBZ-30 C3-N3: the report thesis is a grounded synthesis', () => {
  it('7: refuses a thesis resting on fewer than two distinct claims', () => {
    const draft = validPlanDraft();
    draft.reportThesis.claimRefs = [CLAIM_SELF_ROLE];

    expectPlanRefusal('PLAN_THESIS_UNGROUNDED', draft);
  });

  it('7: refuses one claim written twice as if it were two', () => {
    // De-duplication happens BEFORE the floor is applied, so repetition cannot
    // buy a second claim.
    const draft = validPlanDraft();
    draft.reportThesis.claimRefs = [CLAIM_SELF_ROLE, CLAIM_SELF_ROLE];

    expectPlanRefusal('PLAN_THESIS_UNGROUNDED', draft);
  });

  it('7: refuses a whitespace-only thesis statement', () => {
    const draft = validPlanDraft();
    draft.reportThesis.statement = '   \n\t  ';

    expectPlanRefusal('PLAN_THESIS_UNGROUNDED', draft);
  });

  it('8: refuses a thesis naming a claim the graph does not contain', () => {
    const draft = validPlanDraft();
    draft.reportThesis.claimRefs = [CLAIM_SELF_ROLE, 'claim.sha256:nowhere'];

    expectPlanRefusal('PLAN_UNKNOWN_CLAIM_REF', draft);
  });

  it('9: refuses a thesis naming an unsupported chart symbol', () => {
    // "Geng" is a real stem of this chart and is NOT inside the grounding of
    // the two claims the thesis rests on.
    const draft = validPlanDraft();
    draft.reportThesis.statement = `${draft.reportThesis.statement} Auch Geng zeigt sich darin.`;

    expectPlanRefusal('PLAN_THESIS_UNCITED_SYMBOL', draft);
  });

  it('10: refuses a thesis stating an unsupported numeral', () => {
    const draft = validPlanDraft();
    draft.reportThesis.statement = `${draft.reportThesis.statement} Es sind 7 Bezuege.`;

    expectPlanRefusal('PLAN_THESIS_UNCITED_NUMBER', draft);
  });

  it('11: refuses a thesis invoking a method this slice does not evaluate', () => {
    for (const sentence of [
      'Das Yong Shen dieser Karte ist eindeutig.',
      'Die Wang Shuai Bewertung faellt klar aus.',
      'Die naechste Da Yun Periode bringt eine Wende.',
    ]) {
      const draft = validPlanDraft();
      draft.reportThesis.statement = `${draft.reportThesis.statement} ${sentence}`;

      expectPlanRefusal('PLAN_THESIS_OUT_OF_METHOD_SCOPE', draft);
    }
  });

  it('control: a symbol the thesis grounding DOES cover is accepted', () => {
    // "Xin" is the day master, inside the self-role theme the thesis rests on.
    // The guard distinguishes covered from uncovered rather than refusing every
    // sentence containing a chart word.
    const draft = validPlanDraft();
    draft.reportThesis.statement = `${draft.reportThesis.statement} Der Tagesstamm Xin traegt das.`;

    expect(buildPlan(draft).reportThesis.statement).toContain('Xin');
  });
});

describe('ETBZ-30 C3-N4: primary motifs are grounded, distinct and anchored', () => {
  const motifsOf = (draft: MutablePlan): MutablePlan['primaryMotifs'] => draft.primaryMotifs;

  it('12: refuses fewer than three primary motifs', () => {
    const draft = validPlanDraft();
    draft.primaryMotifs = motifsOf(draft).slice(0, 2);
    // The chapters still reference the removed motifs, but the count gate runs
    // first: the plan is blocked rather than padded to reach the floor.
    expectPlanRefusal('PLAN_MOTIF_COUNT_INVALID', draft);
  });

  it('13: refuses more than five primary motifs', () => {
    const draft = validPlanDraft();
    const extra = motifsOf(draft)[0];
    if (extra === undefined) throw new Error('fixture defect');
    draft.primaryMotifs = [
      ...motifsOf(draft),
      { ...extra, motifRef: 'motif-five' },
      { ...extra, motifRef: 'motif-six' },
    ];

    expectPlanRefusal('PLAN_MOTIF_COUNT_INVALID', draft);
  });

  it('14: refuses a motif naming a claim the graph does not contain', () => {
    const draft = validPlanDraft();
    const motif = motifsOf(draft)[0];
    if (motif === undefined) throw new Error('fixture defect');
    motif.claimRefs = [CLAIM_SELF_ROLE, 'claim.sha256:nowhere'];

    expectPlanRefusal('PLAN_UNKNOWN_CLAIM_REF', draft);
  });

  it('15: refuses a motif whose anchor is absent from its own claimRefs', () => {
    const draft = validPlanDraft();
    const motif = motifsOf(draft)[0];
    if (motif === undefined) throw new Error('fixture defect');
    motif.claimRefs = [CLAIM_SEASONAL];
    motif.anchorClaimRef = CLAIM_SELF_ROLE;

    expectPlanRefusal('PLAN_MOTIF_ANCHOR_INVALID', draft);
  });

  it('16: refuses two motifs anchored in the same accepted claim', () => {
    const draft = validPlanDraft();
    const second = motifsOf(draft)[1];
    if (second === undefined) throw new Error('fixture defect');
    // A genuinely DIFFERENT motif — different statement and claims — that
    // merely claims an anchor another motif already owns.
    second.anchorClaimRef = CLAIM_SELF_ROLE;
    second.claimRefs = [CLAIM_SELF_ROLE, CLAIM_SEASONAL];

    expectPlanRefusal('PLAN_MOTIF_ANCHOR_INVALID', draft);
  });

  it('17: refuses two motifRefs carrying the same accepted meaning', () => {
    // Duplicate CONTENT is checked before duplicate ANCHOR precisely so this
    // case reports what it is. Two identical motifs necessarily share an
    // anchor, so an anchor-first order would leave this guard unreachable.
    const draft = validPlanDraft();
    const first = motifsOf(draft)[0];
    const second = motifsOf(draft)[1];
    if (first === undefined || second === undefined) throw new Error('fixture defect');
    second.statement = first.statement;
    second.anchorClaimRef = first.anchorClaimRef;
    second.claimRefs = [...first.claimRefs];

    expectPlanRefusal('PLAN_DUPLICATE_MOTIF', draft);
  });

  it('17: refuses two motifs sharing one local handle', () => {
    const draft = validPlanDraft();
    const second = motifsOf(draft)[1];
    if (second === undefined) throw new Error('fixture defect');
    second.motifRef = MOTIF_ROLE;

    expectPlanRefusal('PLAN_DUPLICATE_MOTIF', draft);
  });

  it('18: refuses a motif statement that outruns its grounding', () => {
    const symbol = validPlanDraft();
    const symbolMotif = motifsOf(symbol)[0];
    if (symbolMotif === undefined) throw new Error('fixture defect');
    symbolMotif.statement = `${MOTIF_STATEMENT_ROLE} Auch Geng zeigt sich darin.`;
    expectPlanRefusal('PLAN_MOTIF_UNCITED_SYMBOL', symbol);

    const numeral = validPlanDraft();
    const numeralMotif = motifsOf(numeral)[0];
    if (numeralMotif === undefined) throw new Error('fixture defect');
    numeralMotif.statement = `${MOTIF_STATEMENT_ROLE} Es sind 7 Bezuege.`;
    expectPlanRefusal('PLAN_MOTIF_UNCITED_NUMBER', numeral);

    const method = validPlanDraft();
    const methodMotif = motifsOf(method)[0];
    if (methodMotif === undefined) throw new Error('fixture defect');
    methodMotif.statement = `${MOTIF_STATEMENT_ROLE} Das Yong Shen ist eindeutig.`;
    expectPlanRefusal('PLAN_MOTIF_OUT_OF_METHOD_SCOPE', method);
  });

  it('18: refuses a motif with no meaning at all', () => {
    const draft = validPlanDraft();
    const motif = motifsOf(draft)[0];
    if (motif === undefined) throw new Error('fixture defect');
    motif.statement = '   \n  ';

    expectPlanRefusal('PLAN_MOTIF_UNGROUNDED', draft);
  });

  it('control: exactly three motifs, each on its own anchor, is accepted', () => {
    // The floor is reachable, so the count gate is a bound and not a wall. The
    // fourth motif's obligations are removed with it rather than left dangling.
    const draft = validPlanDraft();
    draft.primaryMotifs = motifsOf(draft).slice(0, 3);
    draft.openThreads = draft.openThreads.filter((thread) => thread.threadRef === THREAD_CLOSING);
    for (const chapter of draft.chapterPlan) {
      chapter.motifRefs = chapter.motifRefs.filter((ref) => ref !== MOTIF_MEASURE);
      chapter.motifTransitions = chapter.motifTransitions.filter(
        (transition) => transition.motifRef !== MOTIF_MEASURE,
      );
      chapter.openThreadRefs = chapter.openThreadRefs.filter((ref) => ref !== THREAD_OPEN);
    }
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    integrate.motifRefs = [MOTIF_ROLE, MOTIF_SEASON, MOTIF_SPREAD];

    expect(buildPlan(draft).primaryMotifs).toHaveLength(3);
  });
});

describe('ETBZ-30 C3-N5: chapters reference only accepted structures', () => {
  it('19: refuses a chapter naming a claim the graph does not contain', () => {
    const draft = validPlanDraft();
    const chapter = draft.chapterPlan[0];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.claimRefs = [CLAIM_SELF_ROLE, 'claim.sha256:nowhere'];

    expectPlanRefusal('PLAN_UNKNOWN_CLAIM_REF', draft);
  });

  it('20: refuses a chapter naming a motif the plan does not declare', () => {
    const draft = validPlanDraft();
    const chapter = draft.chapterPlan[0];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.motifRefs = ['motif-nowhere'];

    expectPlanRefusal('PLAN_UNKNOWN_MOTIF_REF', draft);
  });

  it('20: refuses a TRANSITION naming a motif the plan does not declare', () => {
    const draft = validPlanDraft();
    const chapter = draft.chapterPlan[0];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.motifTransitions = [{ motifRef: 'motif-nowhere', targetState: 'SEEDED' }];

    expectPlanRefusal('PLAN_UNKNOWN_MOTIF_REF', draft);
  });

  it('21: refuses a chapter naming a thread the plan does not declare', () => {
    const opening = validPlanDraft();
    const openingChapter = opening.chapterPlan[0];
    if (openingChapter === undefined) throw new Error('fixture defect');
    openingChapter.openThreadRefs = ['thread-nowhere'];
    expectPlanRefusal('PLAN_UNKNOWN_THREAD_REF', opening);

    const closing = validPlanDraft();
    const closingChapter = closing.chapterPlan[3];
    if (closingChapter === undefined) throw new Error('fixture defect');
    closingChapter.closeThreadRefs = ['thread-nowhere'];
    expectPlanRefusal('PLAN_UNKNOWN_THREAD_REF', closing);
  });

  it('22: refuses a chapter that references no accepted claim', () => {
    const draft = validPlanDraft();
    const chapter = draft.chapterPlan[0];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.claimRefs = [];

    expectPlanRefusal('PLAN_CHAPTER_UNGROUNDED', draft);
  });

  it('refuses two chapters sharing one local handle', () => {
    const draft = validPlanDraft();
    const chapter = draft.chapterPlan[1];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.chapterRef = CHAPTER_ESTABLISH;

    expectPlanRefusal('PLAN_DUPLICATE_CHAPTER_REF', draft);
  });

  it('refuses two DISTINCT handles that normalize to one accepted chapterId', () => {
    // Different chapterRef values, identical accepted meaning: same
    // narrativeRole, same accepted claimRefs, same accepted motifRefs, same
    // motifTransitions, same openThreadRefs, same closeThreadRefs.
    //
    // Every reference list is written in a DIFFERENT order than the original,
    // so the collision is proven to be on the NORMALIZED identity rather than
    // on literal draft text.
    //
    // It also proves the guard's ORDERING. This echo repeats the CONTRAST
    // chapter's motif transitions, which the later lifecycle walk would report
    // as standing still on a state those motifs already hold. The duplicate
    // identity has to be refused first, or the defect would be filed as
    // something it is not — and the ambiguous CLOSE_IN_CHAPTER target, which is
    // the actual product failure, would never be named.
    const draft = validPlanDraft();
    const contrast = draft.chapterPlan[2];
    if (contrast === undefined) throw new Error('fixture defect');
    draft.chapterPlan = [
      ...draft.chapterPlan,
      {
        chapterRef: 'chapter-contrast-echo',
        narrativeRole: contrast.narrativeRole,
        claimRefs: [...contrast.claimRefs].reverse(),
        motifRefs: [...contrast.motifRefs].reverse(),
        motifTransitions: [...contrast.motifTransitions]
          .reverse()
          .map((transition) => ({ ...transition })),
        openThreadRefs: [...contrast.openThreadRefs],
        closeThreadRefs: [...contrast.closeThreadRefs],
      },
    ];

    expectPlanRefusal('PLAN_DUPLICATE_CHAPTER_CONTENT', draft);
  });

  it('control: an echo differing in its accepted content is accepted', () => {
    // The pair that makes the refusal above about IDENTITY rather than about
    // "a plan may not carry two chapters that look alike".
    const draft = validPlanDraft();
    const contrast = draft.chapterPlan[2];
    if (contrast === undefined) throw new Error('fixture defect');
    draft.chapterPlan = [
      ...draft.chapterPlan,
      {
        chapterRef: 'chapter-contrast-echo',
        narrativeRole: contrast.narrativeRole,
        // One claim instead of two, and no motif or thread work: a genuinely
        // different chapter wearing the same operator.
        claimRefs: [CLAIM_ELEMENTAL],
        motifRefs: [],
        motifTransitions: [],
        openThreadRefs: [],
        closeThreadRefs: [],
      },
    ];

    const plan = buildPlan(draft);
    const ids = plan.chapterPlan.map((chapter) => chapter.chapterId);

    expect(plan.chapterPlan).toHaveLength(5);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ETBZ-30 C3-N6: accepted meaning is not silently discarded', () => {
  it('23: refuses a plan omitting an accepted graph claim from every chapter', () => {
    const draft = validPlanDraft();
    for (const chapter of draft.chapterPlan) {
      chapter.claimRefs = chapter.claimRefs.filter((ref) => ref !== CLAIM_POSITIONAL);
    }
    // The CONTRAST chapter keeps a claim, so this is a coverage failure rather
    // than an ungrounded-chapter one.
    const contrast = draft.chapterPlan[2];
    if (contrast === undefined) throw new Error('fixture defect');
    expect(contrast.claimRefs.length).toBeGreaterThan(0);

    expectPlanRefusal('PLAN_CLAIM_COVERAGE_INCOMPLETE', draft);
  });

  it('control: covering that claim in ANY chapter is accepted again', () => {
    const draft = validPlanDraft();
    const contrast = draft.chapterPlan[2];
    if (contrast === undefined) throw new Error('fixture defect');
    contrast.claimRefs = [CLAIM_ELEMENTAL, CLAIM_POSITIONAL];

    expect(buildPlan(draft).coverage.claimRefs).toContain(CLAIM_POSITIONAL);
  });
});

describe('ETBZ-30 C3-N7: a plan must actually integrate', () => {
  it('24: refuses a plan with no INTEGRATE chapter', () => {
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    integrate.narrativeRole = 'REINFORCE';

    expectPlanRefusal('PLAN_NO_INTEGRATION', draft);
  });

  it('24: refuses a plan consisting only of ESTABLISH operations', () => {
    const draft = validPlanDraft();
    for (const chapter of draft.chapterPlan) chapter.narrativeRole = 'ESTABLISH';

    expectPlanRefusal('PLAN_NO_INTEGRATION', draft);
  });

  it('25: refuses a FAKE integration that relates only one motif', () => {
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    integrate.motifRefs = [MOTIF_ROLE];

    expectPlanRefusal('PLAN_NO_INTEGRATION', draft);
  });

  it('25: refuses a FAKE integration that relates only one claim', () => {
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    const contrast = draft.chapterPlan[2];
    if (integrate === undefined || contrast === undefined) throw new Error('fixture defect');
    // Coverage is preserved elsewhere so this is an integration failure, not a
    // coverage one.
    contrast.claimRefs = [CLAIM_ELEMENTAL, CLAIM_POSITIONAL, CLAIM_SEASONAL];
    integrate.claimRefs = [CLAIM_SELF_ROLE];

    expectPlanRefusal('PLAN_NO_INTEGRATION', draft);
  });
});

describe('ETBZ-30 C3-N8: a tension the graph states must be faced', () => {
  it('26: refuses a CONTRASTS_WITH that no CONTRAST chapter relates', () => {
    const draft = validPlanDraft();
    const contrast = draft.chapterPlan[2];
    if (contrast === undefined) throw new Error('fixture defect');
    contrast.narrativeRole = 'REINFORCE';

    expectPlanRefusal('PLAN_TENSION_UNADDRESSED', draft);
  });

  it('26: refuses a CONTRAST chapter that relates only one of the two claims', () => {
    const draft = validPlanDraft();
    const contrast = draft.chapterPlan[2];
    const integrate = draft.chapterPlan[3];
    if (contrast === undefined || integrate === undefined) throw new Error('fixture defect');
    contrast.claimRefs = [CLAIM_ELEMENTAL];
    integrate.claimRefs = [CLAIM_SELF_ROLE, CLAIM_SEASONAL, CLAIM_ELEMENTAL, CLAIM_POSITIONAL];

    expectPlanRefusal('PLAN_TENSION_UNADDRESSED', draft);
  });

  it('27: refuses a QUALIFIES that no QUALIFY chapter relates', () => {
    const draft = validPlanDraft();
    const qualify = draft.chapterPlan[1];
    if (qualify === undefined) throw new Error('fixture defect');
    qualify.narrativeRole = 'REINFORCE';

    expectPlanRefusal('PLAN_TENSION_UNADDRESSED', draft);
  });

  it('28: refuses an ALTERNATIVE_READING that no CONTRAST chapter relates', () => {
    const synthesis = baselineSynthesisJson();
    synthesis.relations = [
      { from: 'claim-seasonal', type: 'QUALIFIES', to: 'claim-self-role' },
      { from: 'claim-elemental', type: 'ALTERNATIVE_READING', to: 'claim-positional' },
    ];
    const graph = graphFrom(synthesis);

    const draft = validPlanDraft(graph);
    const contrast = draft.chapterPlan[2];
    if (contrast === undefined) throw new Error('fixture defect');
    contrast.narrativeRole = 'REINFORCE';

    expectPlanRefusal('PLAN_TENSION_UNADDRESSED', draft, graph);
  });

  it('control: the same ALTERNATIVE_READING faced by a CONTRAST chapter is accepted', () => {
    const synthesis = baselineSynthesisJson();
    synthesis.relations = [
      { from: 'claim-seasonal', type: 'QUALIFIES', to: 'claim-self-role' },
      { from: 'claim-elemental', type: 'ALTERNATIVE_READING', to: 'claim-positional' },
    ];
    const graph = graphFrom(synthesis);

    const plan = buildPlan(validPlanDraft(graph), graph);

    expect(plan.tensions.map((tension) => tension.type).sort()).toEqual([
      'ALTERNATIVE_READING',
      'QUALIFIES',
    ]);
  });

  it('control: a graph with no tension relation demands no tension chapter', () => {
    // The rule does not manufacture a tension to satisfy a template.
    const synthesis = baselineSynthesisJson();
    synthesis.relations = [
      { from: 'claim-elemental', type: 'CONTEXTUALIZES', to: 'claim-self-role' },
    ];
    const graph = graphFrom(synthesis);

    const draft = validPlanDraft(graph);
    const qualify = draft.chapterPlan[1];
    const contrast = draft.chapterPlan[2];
    if (qualify === undefined || contrast === undefined) throw new Error('fixture defect');
    qualify.narrativeRole = 'REINFORCE';
    contrast.narrativeRole = 'REINFORCE';

    expect(buildPlan(draft, graph).tensions).toEqual([]);
  });
});

describe('ETBZ-30 C3-N9: the planned motif lifecycle runs forward', () => {
  it('29: refuses a transition to UNSEEN', () => {
    const draft = validPlanDraft();
    const chapter = draft.chapterPlan[0];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.motifTransitions = [{ motifRef: MOTIF_ROLE, targetState: 'UNSEEN' }];

    expectPlanRefusal('PLAN_MOTIF_TRANSITION_INVALID', draft);
  });

  it('30: refuses a regression through the approved lifecycle', () => {
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    // The role motif stands at DEVELOPED after the QUALIFY chapter.
    integrate.motifTransitions = integrate.motifTransitions.map((transition) =>
      transition.motifRef === MOTIF_ROLE
        ? { motifRef: MOTIF_ROLE, targetState: 'SEEDED' }
        : transition,
    );

    expectPlanRefusal('PLAN_MOTIF_TRANSITION_INVALID', draft);
  });

  it('30: refuses standing still on the state a motif already holds', () => {
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    integrate.motifTransitions = integrate.motifTransitions.map((transition) =>
      transition.motifRef === MOTIF_ROLE
        ? { motifRef: MOTIF_ROLE, targetState: 'DEVELOPED' }
        : transition,
    );

    expectPlanRefusal('PLAN_MOTIF_TRANSITION_INVALID', draft);
  });

  it('30: refuses one chapter moving a motif to two different states', () => {
    const draft = validPlanDraft();
    const chapter = draft.chapterPlan[0];
    if (chapter === undefined) throw new Error('fixture defect');
    chapter.motifTransitions = [
      { motifRef: MOTIF_ROLE, targetState: 'SEEDED' },
      { motifRef: MOTIF_ROLE, targetState: 'COMPLICATED' },
    ];

    expectPlanRefusal('PLAN_MOTIF_TRANSITION_INVALID', draft);
  });

  it('31: refuses a motif that is declared and never advanced', () => {
    const draft = validPlanDraft();
    for (const chapter of draft.chapterPlan) {
      chapter.motifTransitions = chapter.motifTransitions.filter(
        (transition) => transition.motifRef !== MOTIF_MEASURE,
      );
    }
    // The thread that would have made it explicit is removed with it, so the
    // motif really does disappear rather than being declared open.
    draft.openThreads = draft.openThreads.filter((thread) => thread.threadRef === THREAD_CLOSING);
    for (const chapter of draft.chapterPlan) {
      chapter.openThreadRefs = chapter.openThreadRefs.filter((ref) => ref !== THREAD_OPEN);
    }

    expectPlanRefusal('PLAN_MOTIF_SILENTLY_DROPPED', draft);
  });

  it('31: refuses a motif left unfinished with no thread declaring it open', () => {
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    integrate.motifTransitions = integrate.motifTransitions.filter(
      (transition) => transition.motifRef !== MOTIF_MEASURE,
    );
    // The motif now ends at COMPLICATED. Its left-open thread no longer names
    // it, so nothing in the accepted plan would say it is unfinished.
    const thread = draft.openThreads.find((entry) => entry.threadRef === THREAD_OPEN);
    if (thread === undefined) throw new Error('fixture defect');
    thread.motifRefs = [];

    expectPlanRefusal('PLAN_MOTIF_SILENTLY_DROPPED', draft);
  });

  it('control: the SAME unfinished motif WITH an explicit open thread is accepted', () => {
    // The pair that makes the refusal above about visibility rather than about
    // the motif's final state.
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    integrate.motifTransitions = integrate.motifTransitions.filter(
      (transition) => transition.motifRef !== MOTIF_MEASURE,
    );

    const plan = buildPlan(draft);

    expect(
      plan.openThreads.some((thread) => thread.resolution.mode === 'EXPLICITLY_LEFT_OPEN'),
    ).toBe(true);
  });
});

describe('ETBZ-30 C3-N10: an obligation resolves, or is stated as open', () => {
  it('32: refuses a resolution naming a chapter the plan does not contain', () => {
    const draft = validPlanDraft();
    const thread = draft.openThreads[0];
    if (thread === undefined) throw new Error('fixture defect');
    thread.resolution = { mode: 'CLOSE_IN_CHAPTER', chapterRef: 'chapter-nowhere' };

    expectPlanRefusal('PLAN_THREAD_RESOLUTION_INVALID', draft);
  });

  it('32: refuses a resolution closing in a chapter that is not LATER', () => {
    const draft = validPlanDraft();
    const thread = draft.openThreads[0];
    const establish = draft.chapterPlan[0];
    const integrate = draft.chapterPlan[3];
    if (thread === undefined || establish === undefined || integrate === undefined) {
      throw new Error('fixture defect');
    }
    // The thread is opened in the very chapter it claims to close in.
    thread.resolution = { mode: 'CLOSE_IN_CHAPTER', chapterRef: CHAPTER_ESTABLISH };
    establish.closeThreadRefs = [THREAD_CLOSING];
    integrate.closeThreadRefs = [];

    expectPlanRefusal('PLAN_THREAD_RESOLUTION_INVALID', draft);
  });

  it('32: refuses a resolution whose chapter does not itself close the thread', () => {
    const draft = validPlanDraft();
    const thread = draft.openThreads[0];
    if (thread === undefined) throw new Error('fixture defect');
    thread.resolution = { mode: 'CLOSE_IN_CHAPTER', chapterRef: CHAPTER_CONTRAST };

    expectPlanRefusal('PLAN_THREAD_RESOLUTION_INVALID', draft);
  });

  it('32: refuses a thread no chapter ever opens', () => {
    const draft = validPlanDraft();
    for (const chapter of draft.chapterPlan) {
      chapter.openThreadRefs = chapter.openThreadRefs.filter((ref) => ref !== THREAD_CLOSING);
    }

    expectPlanRefusal('PLAN_THREAD_RESOLUTION_INVALID', draft);
  });

  it('32: refuses an EXPLICITLY_LEFT_OPEN thread that a chapter quietly closes', () => {
    // The disappearance this rule exists for: the plan says the obligation
    // stays open while the chapter plan closes it.
    const draft = validPlanDraft();
    const integrate = draft.chapterPlan[3];
    if (integrate === undefined) throw new Error('fixture defect');
    integrate.closeThreadRefs = [THREAD_CLOSING, THREAD_OPEN];

    expectPlanRefusal('PLAN_THREAD_RESOLUTION_INVALID', draft);
  });

  it('33: refuses two threadRefs carrying the same accepted meaning', () => {
    const draft = validPlanDraft();
    const first = draft.openThreads[0];
    const second = draft.openThreads[1];
    if (first === undefined || second === undefined) throw new Error('fixture defect');
    second.narrativeRole = first.narrativeRole;
    second.claimRefs = [...first.claimRefs];
    second.motifRefs = [...first.motifRefs];

    expectPlanRefusal('PLAN_DUPLICATE_THREAD', draft);
  });

  it('33: refuses two threads sharing one local handle', () => {
    const draft = validPlanDraft();
    const second = draft.openThreads[1];
    if (second === undefined) throw new Error('fixture defect');
    second.threadRef = THREAD_CLOSING;

    expectPlanRefusal('PLAN_DUPLICATE_THREAD', draft);
  });

  it('refuses a thread that is about neither a claim nor a motif', () => {
    const draft = validPlanDraft();
    const thread = draft.openThreads[1];
    if (thread === undefined) throw new Error('fixture defect');
    thread.claimRefs = [];
    thread.motifRefs = [];

    expectPlanRefusal('PLAN_THREAD_UNGROUNDED', draft);
  });

  it('refuses a thread naming a motif the plan does not declare', () => {
    const draft = validPlanDraft();
    const thread = draft.openThreads[1];
    if (thread === undefined) throw new Error('fixture defect');
    thread.motifRefs = ['motif-nowhere'];

    expectPlanRefusal('PLAN_UNKNOWN_MOTIF_REF', draft);
  });

  it('control: a thread carrying only a motif, with no claim, is accepted', () => {
    // "at least one claimRef OR motifRef" is a disjunction, and the control
    // proves the guard reads it as one.
    const draft = validPlanDraft();
    const thread = draft.openThreads[1];
    if (thread === undefined) throw new Error('fixture defect');
    thread.claimRefs = [];
    thread.motifRefs = [MOTIF_MEASURE];

    expect(buildPlan(draft).openThreads).toHaveLength(2);
  });

  it('control: a second, genuinely different thread is accepted', () => {
    const draft = validPlanDraft();
    const extra = {
      threadRef: 'thread-extra',
      narrativeRole: 'INTEGRATE',
      claimRefs: [CLAIM_ELEMENTAL],
      motifRefs: [MOTIF_SPREAD],
      resolution: { mode: 'EXPLICITLY_LEFT_OPEN' },
    };
    draft.openThreads = [...draft.openThreads, extra];
    const contrast = draft.chapterPlan[2];
    if (contrast === undefined) throw new Error('fixture defect');
    contrast.openThreadRefs = ['thread-extra'];

    expect(buildPlan(draft).openThreads).toHaveLength(3);
  });

  it('control: the spare motif statement is legal prose, so the cases above isolate their cause', () => {
    // Every refusal in this file relies on the baseline's prose being legal.
    // This is the statement the fixture keeps in reserve, measured here rather
    // than assumed.
    const draft = validPlanDraft();
    const motif = draft.primaryMotifs[0];
    if (motif === undefined) throw new Error('fixture defect');
    motif.statement = MOTIF_STATEMENT_SPARE;

    expect(buildPlan(draft).primaryMotifs).toHaveLength(4);
  });
});
