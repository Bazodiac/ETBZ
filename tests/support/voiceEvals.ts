/**
 * ETBZ-57 — evaluation instruments for the customer-voice revision (handoff
 * 57.4, evals A-G).
 *
 * Instruments, not gates: they measure the committed readings so the Human
 * Editorial Gate sees numbers anyone can re-derive. None of them decides
 * acceptance - the acceptance boundary refuses, the Product Owner judges. The
 * anti-boilerplate contract compares only within one skill version (72056833
 * section 6), so every probe here runs per version and reports both, side by
 * side; nothing compares a 1.0.0 run with a 1.1.0 run as one check.
 */
import { findUncitedSymbols } from '../../src/application/interpretation/chart-symbol-lexicon.js';
import type { ChartFact } from '../../src/application/interpretation/feature-set.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import {
  LIFE_DOMAIN_WORDS,
  META_NARRATION_PHRASES,
  TEMPLATE_HEDGE_PHRASES,
  TENSION_WORDS,
  TENTATIVE_MARKERS,
  countWords,
  findAllPhrases,
} from '../../src/application/skill/index.js';
import type { SkillInputPackage, SkillReadingDraft, VoicePhraseList } from '../../src/application/skill/index.js';
import { KNOWN, UNKNOWN, draftOf } from './claimGraphFixture.js';
import { planClaims } from './metaNarrativePlanFixture.js';

/**
 * What a reading means, without the identities a version change must change
 * (skill, bundle, package, plan hash, contract set): the claim graph it
 * renders, and per chapter the paragraph kinds, postures, fact and claim
 * references, semantic deltas and callbacks; the reflection bindings; the
 * warning codes; the visual specs. Equal projections = the same accepted
 * facts, claims, epistemic classes and plan bindings (ETBZ-57 AC 5).
 */
export function semanticBindingProjection(reading: SkillReadingDraft): unknown {
  return {
    claimGraphStructuralHash: reading.claimGraphStructuralHash,
    chapters: reading.chapters.map((chapter) => ({
      chapterRef: chapter.chapterRef,
      narrativeOperation: chapter.narrativeOperation,
      paragraphs: chapter.paragraphs.map((paragraph) => ({
        kind: paragraph.kind,
        posture: paragraph.posture,
        factRefs: paragraph.factRefs,
        claimRefs: paragraph.claimRefs,
      })),
      semanticDelta: chapter.semanticDelta,
      callbacks: chapter.callbacks,
    })),
    reflectionQuestions: reading.reflectionQuestions.map((question) => question.claimRefs),
    warningCodes: reading.methodNote.warningCodes,
    visualizationSpecs: reading.visualizationSpecs,
  };
}

/** Eval C instrument (not a gate): phrases that soften a grounded tension into "the chart cannot say". */
export const SOFTENING_PHRASES: VoicePhraseList = {
  source: 'ETBZ-57 eval C instrument; grounded-reflective-synthesis-lens@1.1.0 §7.2',
  phrases: [
    'kann das chart nicht sagen', 'sagt das chart nicht', 'entscheidet nicht das chart', 'würde erfinden',
    'welche dieser formen zutrifft', 'welche seite du eher erlebst',
  ],
};

/** Eval A/C instrument (not a gate): an alternative manifestation written without an ALTERNATIVE_READING relation. */
export const ALTERNATIVE_PHRASES: VoicePhraseList = {
  source: 'ETBZ-57 eval instrument; grounded-reflective-synthesis-lens@1.1.0 §7.6',
  phrases: ['andere mögliche ausdrucksform', 'eine mögliche lesart', 'another possible expression'],
};

export interface SurfaceAudit {
  readonly where: string;
  readonly kind: string;
  readonly posture: string;
  readonly words: number;
  readonly meta: readonly string[];
  readonly templateHedges: readonly string[];
  readonly tentativeMarkers: readonly string[];
  readonly tensionWords: readonly string[];
  readonly softeners: readonly string[];
  readonly alternatives: readonly string[];
  readonly lifeDomain: readonly string[];
}

function audit(text: string, where: string, kind: string, posture: string): SurfaceAudit {
  return {
    where,
    kind,
    posture,
    words: countWords(text),
    meta: findAllPhrases(text, META_NARRATION_PHRASES),
    templateHedges: findAllPhrases(text, TEMPLATE_HEDGE_PHRASES),
    tentativeMarkers: findAllPhrases(text, TENTATIVE_MARKERS),
    tensionWords: findAllPhrases(text, TENSION_WORDS),
    softeners: findAllPhrases(text, SOFTENING_PHRASES),
    alternatives: findAllPhrases(text, ALTERNATIVE_PHRASES),
    lifeDomain: findAllPhrases(text, LIFE_DOMAIN_WORDS),
  };
}

const COUNTED = ['meta', 'templateHedges', 'tentativeMarkers', 'tensionWords', 'softeners', 'alternatives', 'lifeDomain'] as const;

/** Per-surface phrase audit of a reading: what the voice gates and the eval lists find, surface by surface. */
export function voiceAudit(reading: SkillReadingDraft): Readonly<{ surfaces: readonly SurfaceAudit[]; totals: Readonly<Record<string, number>> }> {
  const surfaces: SurfaceAudit[] = [audit(reading.title, 'title', 'TITLE', 'NONE')];
  reading.chapters.forEach((chapter, c) => {
    surfaces.push(audit(chapter.title, `chapters[${String(c)}].title`, 'TITLE', 'NONE'));
    chapter.paragraphs.forEach((paragraph, p) => {
      surfaces.push(audit(paragraph.text, `chapters[${String(c)}].paragraphs[${String(p)}]`, paragraph.kind, paragraph.posture));
    });
  });
  reading.reflectionQuestions.forEach((question, q) => surfaces.push(audit(question.text, `reflectionQuestions[${String(q)}]`, 'QUESTION', 'NONE')));
  surfaces.push(audit(reading.methodNote.text, 'methodNote', 'METHOD_NOTE', 'NONE'));
  const totals: Record<string, number> = { words: surfaces.filter((s) => s.kind !== 'METHOD_NOTE').reduce((sum, s) => sum + s.words, 0) };
  for (const key of COUNTED) {
    totals[key] = surfaces.filter((s) => s.kind !== 'METHOD_NOTE').reduce((sum, s) => sum + s[key].length, 0);
    totals[`${key}Surfaces`] = surfaces.filter((s) => s.kind !== 'METHOD_NOTE' && s[key].length > 0).length;
  }
  totals['supportedParagraphsWithTemplateHedge'] = surfaces.filter((s) => s.posture === 'SUPPORTED' && s.templateHedges.length > 0).length;
  totals['supportedParagraphs'] = surfaces.filter((s) => s.posture === 'SUPPORTED').length;
  return { surfaces, totals };
}

export type FactChange =
  | Readonly<{ kind: 'MUTATE'; factId: string; value: string }>
  | Readonly<{ kind: 'REMOVE'; factId: string }>;

/**
 * Prose dependency probe (72056833 sections 6.3 / 6.4 at paragraph level):
 * which paragraphs depend on the changed fact (cite it, or rest on a claim
 * grounded in it), and which paragraphs the change would refuse - a removed
 * fact cited, or a symbol of the old value no longer covered. A sound reading
 * is refused only inside its dependency cone. It changes the package's fact
 * table directly and is labelled as such: it is an instrument over the
 * reading, not a re-derived chart.
 */
export function proseDependencyProbe(reading: SkillReadingDraft, pkg: SkillInputPackage, change: FactChange): Readonly<{ cone: readonly string[]; refused: readonly string[]; refusedOutsideCone: readonly string[] }> {
  const facts = new Map<string, ChartFact>(pkg.facts.map((fact) => [fact.id, fact]));
  if (!facts.has(change.factId)) throw new Error(`probe fact ${change.factId} is not in the package`);
  if (change.kind === 'MUTATE') facts.set(change.factId, { ...(facts.get(change.factId) as ChartFact), value: change.value });
  else facts.delete(change.factId);
  const claimFacts = new Map<string, readonly string[]>(pkg.claimGraph.claims.map((claim) => [claim.claimId, claim.factRefs]));
  const cone: string[] = [];
  const refused: string[] = [];
  reading.chapters.forEach((chapter, c) => {
    chapter.paragraphs.forEach((paragraph, p) => {
      const where = `chapters[${String(c)}].paragraphs[${String(p)}]`;
      const grounding = [...paragraph.factRefs, ...paragraph.claimRefs.flatMap((id) => claimFacts.get(id) ?? [])];
      if (grounding.includes(change.factId)) cone.push(where);
      const removedCited = change.kind === 'REMOVE' && grounding.includes(change.factId);
      const covered = new Set<string>();
      for (const id of grounding) {
        const fact = facts.get(id);
        if (fact === undefined) continue;
        covered.add(fact.value);
        if (fact.sourceLabel !== null) covered.add(fact.sourceLabel);
      }
      if (removedCited || findUncitedSymbols(paragraph.text, covered).length > 0) refused.push(where);
    });
  });
  return { cone, refused, refusedOutsideCone: refused.filter((where) => !cone.includes(where)) };
}

/**
 * Swap re-validation (72056833 section 6.2), graph step, through the ordinary
 * builder: the fixture's claim drafts re-validated against a foil's
 * interpretation context. The foil is the unknown-time variant of the same
 * synthetic chart (Lens section 14: hour-pillar provisionality). A
 * chart-bound claim graph must not validate against it.
 */
export function swapAgainstUnknownTimeFoil(): Readonly<{ validatesAgainstFoil: boolean; refusal: string | null }> {
  if (KNOWN.brief.structuralHash === UNKNOWN.brief.structuralHash) throw new Error('the foil must be another chart than the source');
  try {
    buildInterpretiveClaimGraph(draftOf(planClaims(KNOWN), UNKNOWN), UNKNOWN);
    return { validatesAgainstFoil: true, refusal: null };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return { validatesAgainstFoil: false, refusal: typeof code === 'string' ? code : String(error) };
  }
}
