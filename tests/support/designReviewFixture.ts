/**
 * ETBZ-68 — the synthetic design-review fixture.
 *
 * A 30-page visual acceptance document for the Product Owner, not a customer
 * artifact and not a reading. The chart is the synthetic known-time chart of
 * `tests/support/narrativeFixture.ts` (Musterkundin A), unchanged: every
 * symbolic value on the chart pages comes from that fixture through the real
 * `buildHoroscopeModel`, none is written here. The body text is a small,
 * versioned, neutral German placeholder corpus about paper, type and
 * book-making (`docs/evidence/etbz-68/fixture/placeholder-corpus.v1.json`),
 * composed deterministically into chapters by `composeDesignReviewContent`.
 *
 * The released `buildPresentationProjection` runs unchanged, with every
 * customer-text gate. The page count is whatever the unchanged paginator makes
 * of the composed content; the corpus's composition plan is tuned so that it
 * comes to 30, and the 30 is asserted only by this slice's contract test.
 * Nothing under `src/` reads it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { BASELINE_CP, buildPresentationProjection } from '../../src/application/presentation/index.js';
import type { PresentationProjection } from '../../src/application/presentation/index.js';
import { GEOMETRY_CENTIPOINTS, PAGINATION_RULES } from '../../src/application/visual/index.js';
import { knownTimeChart } from './narrativeFixture.js';

export const DESIGN_REVIEW_CORPUS = 'docs/evidence/etbz-68/fixture/placeholder-corpus.v1.json';
export const DESIGN_REVIEW_CONTENT = 'docs/evidence/etbz-68/fixture/design-review-content.json';
export const DESIGN_REVIEW_PROJECTION_EVIDENCE = 'docs/evidence/etbz-68/presentation-projection.json';
export const DESIGN_REVIEW_BEHAVIOUR_MAP = 'docs/evidence/etbz-68/page-behaviour-map.json';

const corpusSchema = z.strictObject({
  corpusId: z.literal('etbz68-neutral-placeholder-corpus'),
  version: z.literal('1.2.0'),
  language: z.literal('de'),
  purpose: z.string().min(1),
  title: z.string().min(1),
  chapterTitles: z.array(z.string().min(1)).min(1).max(12),
  sentences: z.array(z.string().min(1)).min(1),
  reflectionQuestions: z.array(z.string().min(1)).min(1).max(12),
  methodNote: z.string().min(1),
  composition: z.strictObject({
    rule: z.string().min(1),
    chapters: z
      .array(
        z.strictObject({
          offset: z.number().int().min(0),
          stride: z.number().int().min(1),
          paragraphs: z.array(z.number().int().min(1)).min(1),
        }),
      )
      .min(1),
  }),
});

export type PlaceholderCorpus = z.infer<typeof corpusSchema>;

export interface DesignReviewContent {
  readonly title: string;
  readonly chapters: readonly Readonly<{ title: string; paragraphs: readonly string[] }>[];
  readonly reflectionQuestions: readonly string[];
  readonly methodNote: string;
}

/**
 * A placeholder sentence must stand on its own: the composer reorders the corpus,
 * so a sentence that opens by pointing back ("Danach …", "Deshalb …") would print
 * after a sentence it never follows. Only the sentence-initial word is checked.
 */
const ANAPHORIC_OPENING = /^(?:Danach|Deshalb|Daher|Darum|Dabei|Damit|Dann|Dazu|Dort|Hier|Außerdem|Auch|Ebenso|Trotzdem|Dennoch|Somit|Also|Diese|Dieser|Dieses|Diesen|Diesem)\b/u;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function loadPlaceholderCorpus(): PlaceholderCorpus {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync(resolve(process.cwd(), DESIGN_REVIEW_CORPUS), 'utf8')));
  const n = corpus.sentences.length;
  if (new Set(corpus.sentences).size !== n) throw new Error('the corpus repeats a sentence');
  const dependent = corpus.sentences.find((sentence) => ANAPHORIC_OPENING.test(sentence));
  if (dependent !== undefined) throw new Error(`a sentence starts with an anaphoric connective and cannot stand alone: ${dependent}`);
  if (corpus.composition.chapters.length !== corpus.chapterTitles.length) throw new Error('one composition entry per chapter title');
  const strides = corpus.composition.chapters.map((plan) => plan.stride % n);
  if (new Set(strides).size !== strides.length) throw new Error('two chapters share a stride, so they would share runs of sentences');
  for (const plan of corpus.composition.chapters) {
    if (gcd(plan.stride, n) !== 1) throw new Error('a stride must be coprime with the sentence count, or the chapter cycles through a subset');
    if (plan.paragraphs.reduce((sum, count) => sum + count, 0) > n) throw new Error('a chapter would repeat one of its own sentences');
  }
  return corpus;
}

/**
 * Chapter i takes `sentences[(offset_i + j * stride_i) mod n]` for j = 0, 1, 2, …
 * in order; a paragraph consumes as many consecutive picks as its count says.
 * Pure: the same corpus always yields the same content.
 */
export function composeDesignReviewContent(corpus: PlaceholderCorpus): DesignReviewContent {
  const n = corpus.sentences.length;
  const chapters = corpus.composition.chapters.map((plan, chapterIndex) => {
    let pick = 0;
    const paragraphs = plan.paragraphs.map((count) => {
      const sentences: string[] = [];
      for (let k = 0; k < count; k += 1) {
        const sentence = corpus.sentences[(plan.offset + pick * plan.stride) % n];
        if (sentence === undefined) throw new Error('unreachable: index is reduced modulo the sentence count');
        sentences.push(sentence);
        pick += 1;
      }
      return sentences.join(' ');
    });
    const title = corpus.chapterTitles[chapterIndex];
    if (title === undefined) throw new Error('unreachable: one composition entry per chapter title');
    return { title, paragraphs };
  });
  return { title: corpus.title, chapters, reflectionQuestions: corpus.reflectionQuestions, methodNote: corpus.methodNote };
}

export interface DesignReviewFixture {
  readonly model: HoroscopeModel;
  readonly content: DesignReviewContent;
  readonly projection: PresentationProjection;
}

export function designReviewFixture(): DesignReviewFixture {
  const model = knownTimeChart().model;
  const content = composeDesignReviewContent(loadPlaceholderCorpus());
  return { model, content, projection: buildPresentationProjection({ model, content }) };
}

// --- the page behaviour map ---------------------------------------------------

const CONTENT_TOP_CP = GEOMETRY_CENTIPOINTS.marginTop;
const CONTENT_BOTTOM_CP = CONTENT_TOP_CP + GEOMETRY_CENTIPOINTS.contentH;
const MIN_SPLIT_LINES = Math.max(PAGINATION_RULES.orphanMinLines, PAGINATION_RULES.widowMinLines);
/** A paragraph of at most this many words is "short"; one of at least this many is "long". */
const SHORT_PARAGRAPH_WORDS = 15;
const LONG_PARAGRAPH_WORDS = 90;

interface FragmentView {
  readonly blockId: string;
  readonly kind: string;
  readonly continuedFromPreviousPage: boolean;
  readonly continuesOnNextPage: boolean;
  readonly xCp: number;
  readonly topCp: number;
  readonly heightCp: number;
  readonly lines: readonly Readonly<{ widthCp: number }>[];
}

interface LongFormContentView {
  readonly kind: 'longForm';
  readonly chapterNumber: number;
  readonly chapterPage: number;
  readonly template: 'opener' | 'continuation';
  readonly fragments: readonly FragmentView[];
  readonly sidebar: unknown;
  readonly referencePanel: unknown;
}

export interface PageBehaviour {
  readonly pageNumber: number;
  readonly pageId: string;
  readonly kind: string;
  readonly chapter: number | null;
  readonly chapterPage: number | null;
  readonly behaviours: readonly string[];
  readonly fill: number | null;
}

function isLongForm(content: unknown): content is LongFormContentView {
  return typeof content === 'object' && content !== null && (content as { kind?: unknown }).kind === 'longForm';
}

function wordCount(text: string): number {
  return text.split(/\s+/u).filter((word) => word.length > 0).length;
}

/**
 * The paginator's own test (long-form.ts): a new paragraph in a non-empty column
 * is set one baseline below the previous one, and it is moved whole when at least
 * one line would fit there but fewer than the two-line minimum may be placed. So
 * a fresh paragraph opening the next column was moved whole exactly when the
 * column it left still had room for one line after that spacing.
 */
function hadRoomForALine(lastInColumn: FragmentView): boolean {
  const y0 = lastInColumn.topCp + lastInColumn.heightCp + BASELINE_CP;
  return Math.floor((CONTENT_BOTTOM_CP - y0) / BASELINE_CP) >= 1;
}

/**
 * Which editorial behaviours each page of the projection exercises, read from
 * the projection the renderer draws (never from intent). Long-form behaviours:
 * - `opener` / `continuation`: the page template;
 * - `two-column` / `one-column`: the number of distinct column x positions;
 * - `column-split`: a paragraph continues from the left into the right column;
 * - `continues-across-page` / `continued-from-previous-page`: a paragraph crosses the page edge;
 * - `split-at-2-line-minimum`: a split fragment carries exactly the orphan/widow minimum of lines
 *   (the split landed on the minimum; whether the rule had to act is not claimed);
 * - `paragraph-moved-whole`: a fresh paragraph opens a column (the right opener column or the next
 *   page) although the column it left had room for at least one line - the paginator's condition;
 * - `opener-width-carry-over`: a continuation-page fragment of a paragraph the paginator wrapped
 *   at the narrower opener width. It wraps a paragraph once, when the paragraph comes up
 *   (long-form.ts, ADR 0012 limitation 4), so this holds exactly for a paragraph with a fragment
 *   on chapter page 1, and for the fresh first paragraph of chapter page 2 (it came up on page 1
 *   and moved);
 * - `short-paragraph` / `long-paragraph`: a paragraph on the page has at most 15 / at least 90 words;
 * - `continuation-with-sidebar` / `short-final-with-reference-panel`: the side module the projection
 *   chose; the final page of a chapter gets the panel when its fill is below 0.6.
 * `fill` is the projection's own measure: (lowest fragment bottom - content top) / content height.
 */
export function pageBehaviourMap(projection: PresentationProjection, content: DesignReviewContent): readonly PageBehaviour[] {
  const pages = projection.pages as readonly Readonly<{ pageNumber: number; pageId: string; content: unknown }>[];
  const openerBlocks = new Set<string>();
  for (const page of pages) {
    if (isLongForm(page.content) && page.content.chapterPage === 1) {
      for (const fragment of page.content.fragments) openerBlocks.add(`${String(page.content.chapterNumber)}/${fragment.blockId}`);
    }
  }
  return pages.map((page, index) => {
    const pageContent = page.content;
    if (!isLongForm(pageContent)) {
      const kind = typeof pageContent === 'object' && pageContent !== null ? String((pageContent as { kind?: unknown }).kind) : 'unknown';
      return { pageNumber: page.pageNumber, pageId: page.pageId, kind, chapter: null, chapterPage: null, behaviours: [], fill: null };
    }
    const behaviours = new Set<string>();
    const fragments = pageContent.fragments;
    behaviours.add(pageContent.template);
    const columns = [...new Set(fragments.map((fragment) => fragment.xCp))].sort((left, right) => left - right);
    behaviours.add(columns.length >= 2 ? 'two-column' : 'one-column');
    for (let i = 0; i < fragments.length; i += 1) {
      const fragment = fragments[i];
      if (fragment === undefined) continue;
      const next = fragments[i + 1];
      if (fragment.continuesOnNextPage && next !== undefined && next.blockId === fragment.blockId && next.continuedFromPreviousPage) {
        behaviours.add('column-split');
        if (fragment.lines.length === MIN_SPLIT_LINES || next.lines.length === MIN_SPLIT_LINES) behaviours.add('split-at-2-line-minimum');
      }
      if (fragment.continuesOnNextPage && (next === undefined || next.blockId !== fragment.blockId)) {
        behaviours.add('continues-across-page');
        if (fragment.lines.length === MIN_SPLIT_LINES) behaviours.add('split-at-2-line-minimum');
      }
      if (i === 0 && fragment.continuedFromPreviousPage) {
        behaviours.add('continued-from-previous-page');
        if (fragment.lines.length === MIN_SPLIT_LINES) behaviours.add('split-at-2-line-minimum');
      }
      const wrappedOnOpener =
        openerBlocks.has(`${String(pageContent.chapterNumber)}/${fragment.blockId}`) ||
        (pageContent.chapterPage === 2 && i === 0 && !fragment.continuedFromPreviousPage);
      if (pageContent.template === 'continuation' && wrappedOnOpener) behaviours.add('opener-width-carry-over');
    }
    // Moved whole into the right opener column.
    if (columns.length >= 2) {
      const rightX = columns[columns.length - 1];
      const firstRight = fragments.findIndex((fragment) => fragment.xCp === rightX);
      const lastLeft = fragments[firstRight - 1];
      const right = fragments[firstRight];
      if (right !== undefined && lastLeft !== undefined && !right.continuedFromPreviousPage && hadRoomForALine(lastLeft)) {
        behaviours.add('paragraph-moved-whole');
      }
    }
    // Moved whole onto this page.
    const first = fragments[0];
    const previous = pages[index - 1]?.content;
    if (pageContent.chapterPage > 1 && first !== undefined && !first.continuedFromPreviousPage && isLongForm(previous)) {
      const last = previous.fragments[previous.fragments.length - 1];
      if (last !== undefined && hadRoomForALine(last)) behaviours.add('paragraph-moved-whole');
    }
    const chapter = content.chapters[pageContent.chapterNumber - 1];
    for (const blockId of new Set(fragments.map((fragment) => fragment.blockId))) {
      const paragraph = chapter?.paragraphs[Number(blockId.slice(1)) - 1];
      if (paragraph === undefined) continue;
      const words = wordCount(paragraph);
      if (words <= SHORT_PARAGRAPH_WORDS) behaviours.add('short-paragraph');
      if (words >= LONG_PARAGRAPH_WORDS) behaviours.add('long-paragraph');
    }
    if (pageContent.sidebar !== null && pageContent.sidebar !== undefined) behaviours.add('continuation-with-sidebar');
    if (pageContent.referencePanel !== null && pageContent.referencePanel !== undefined) behaviours.add('short-final-with-reference-panel');
    const usedBottom = Math.max(...fragments.map((fragment) => fragment.topCp + fragment.heightCp));
    const fill = Math.round(((usedBottom - CONTENT_TOP_CP) / GEOMETRY_CENTIPOINTS.contentH) * 1000) / 1000;
    return {
      pageNumber: page.pageNumber,
      pageId: page.pageId,
      kind: 'longForm',
      chapter: pageContent.chapterNumber,
      chapterPage: pageContent.chapterPage,
      behaviours: [...behaviours].sort(),
      fill,
    };
  });
}
