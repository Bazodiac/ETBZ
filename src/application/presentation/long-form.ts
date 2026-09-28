// =============================================================================
// ETBZ-55 - the deterministic long-form paginator.
//
// A faithful port of the ETBZ-49 canonical paginator
// (tools/visual-proof-harness/build/paginate.py, and `header_height` from
// pages_longform.py). The port is proven against the layout that build
// measured: `tests/unit/etbz55-long-form.test.ts` reproduces every line of
// `assets/visual-system-v1/longform/pagination-report.json` - text, x, baseline
// and width - from the recovered fixture chapter.
//
// Contract (unchanged): integer centipoints only; overflow has exactly one
// resolution, another page - no scale, no clip, no shortening; orphan and widow
// at least two lines; a subhead keeps with the next two lines; pull quote and
// key insight are atomic; the opener page sets two balanced columns, every
// continuation page one 104 mm column beside a 60 mm sidebar.
//
// Differences from the Python original, both fail-closed: a character the
// pinned face does not carry is refused rather than measured as '?', and a
// geometric finding throws `PRESENTATION_LAYOUT_FINDING` instead of being
// written into a report.
// =============================================================================

import { GEOMETRY_CENTIPOINTS, PAGINATION_RULES } from '../visual/index.js';
import { PresentationError } from './errors.js';
import { BASELINE_CP, LINE_TOLERANCE_CP, TEXT_STYLES, ceilToBaseline, firstBaseline, textWidth, wrap } from './text-measure.js';
import type { TextStyleId } from './text-measure.js';

const CONTENT_X = GEOMETRY_CENTIPOINTS.marginSide;
const CONTENT_Y = GEOMETRY_CENTIPOINTS.marginTop;
export const CONTENT_W = GEOMETRY_CENTIPOINTS.contentW;
const CONTENT_H = GEOMETRY_CENTIPOINTS.contentH;
const CONTENT_BOTTOM = CONTENT_Y + CONTENT_H;
const GUTTER = GEOMETRY_CENTIPOINTS.gutter;
/** Running-head band on continuation pages. */
export const RUNNING_HEAD_CP = 4 * BASELINE_CP;
const MIN_BAND_LINES = PAGINATION_RULES.minBandLines;
/** The continuation column: 104 mm, as the canonical build compiles it. */
export const CONTINUATION_COLUMN_CP = Math.round((104 / 25.4) * 72 * 100);

export type LongFormHeaderBlock = Readonly<{ id: string; kind: 'kicker' | 'sectionTitle' | 'standfirst'; text: string }>;

export type LongFormBlock =
  | Readonly<{ id: string; kind: 'paragraph' | 'subhead'; text: string }>
  | Readonly<{ id: string; kind: 'pullQuote'; text: string }>
  | Readonly<{ id: string; kind: 'keyInsight'; title: string; text: string }>;

export interface LayoutLine {
  readonly text: string;
  readonly xCp: number;
  readonly baselineCp: number;
  readonly widthCp: number;
  /** Present on the lines of an atomic module, whose lines mix styles. */
  readonly styleId?: TextStyleId;
}

export interface LayoutFragment {
  readonly blockId: string;
  readonly kind: LongFormBlock['kind'];
  readonly fragmentIndex: number;
  readonly continuedFromPreviousPage: boolean;
  readonly continuesOnNextPage: boolean;
  readonly xCp: number;
  readonly topCp: number;
  readonly widthCp: number;
  readonly heightCp: number;
  readonly styleId: string;
  readonly boxCp?: Readonly<{ xCp: number; yCp: number; widthCp: number; heightCp: number }>;
  readonly meta?: Readonly<Record<string, string | number | boolean>>;
  readonly lines: readonly LayoutLine[];
}

export interface LayoutPage {
  readonly pageNumber: number;
  readonly template: 'opener' | 'continuation';
  readonly sidebar: Readonly<{ xCp: number; yCp: number; widthCp: number }> | null;
  readonly fragments: readonly LayoutFragment[];
  readonly usedBottomCp: number;
}

export interface LongFormLayout {
  readonly pages: readonly LayoutPage[];
  readonly lineCount: number;
  readonly wordCount: number;
  readonly findings: readonly (readonly [string, number, string])[];
  readonly geometry: Readonly<{
    contentXCp: number;
    contentYCp: number;
    contentWidthCp: number;
    contentHeightCp: number;
    baselineCp: number;
    toleranceCp: number;
  }>;
}

// ---------------------------------------------------------------------------
// the opener header
// ---------------------------------------------------------------------------

const HEADER_MEASURE: Readonly<Record<LongFormHeaderBlock['kind'], number>> = {
  kicker: CONTENT_W,
  sectionTitle: Math.trunc(CONTENT_W * 0.72),
  standfirst: Math.trunc(CONTENT_W * 0.78),
};

export interface HeaderLine {
  readonly text: string;
  readonly styleId: LongFormHeaderBlock['kind'];
  readonly xCp: number;
  readonly baselineCp: number;
  readonly widthCp: number;
}

/** Height of the opener header band (pages_longform.py `header_height`). */
export function headerHeight(header: readonly LongFormHeaderBlock[]): number {
  let height = 0;
  for (const block of header) {
    const lines = wrap(block.text, block.kind, HEADER_MEASURE[block.kind]);
    height += ceilToBaseline(lines.length * TEXT_STYLES[block.kind].leadingCp) + (block.kind !== 'standfirst' ? BASELINE_CP : 0);
  }
  return height + 3 * BASELINE_CP;
}

/** The header lines as the opener page sets them, from the content top down. */
export function layoutHeader(header: readonly LongFormHeaderBlock[]): readonly HeaderLine[] {
  const out: HeaderLine[] = [];
  let y = CONTENT_Y;
  for (const block of header) {
    const lines = wrap(block.text, block.kind, HEADER_MEASURE[block.kind]);
    const lead = TEXT_STYLES[block.kind].leadingCp;
    const baseline = firstBaseline(block.kind);
    lines.forEach((text, index) => {
      out.push({ text, styleId: block.kind, xCp: CONTENT_X, baselineCp: y + baseline + index * lead, widthCp: textWidth(text, block.kind) });
    });
    y += ceilToBaseline(lines.length * lead) + (block.kind !== 'standfirst' ? BASELINE_CP : 0);
  }
  return out;
}

// ---------------------------------------------------------------------------
// the flow model
// ---------------------------------------------------------------------------

interface Line {
  readonly block: LongFormBlock;
  readonly index: number;
  readonly count: number;
  readonly text: string;
  readonly style: TextStyleId;
}

class Column {
  y: number;
  items: LayoutFragment[] = [];
  constructor(
    readonly x: number,
    public top: number,
    readonly bottom: number,
    readonly w: number,
  ) {
    this.y = top;
  }
}

class Page {
  fragments: LayoutFragment[] = [];
  cols: Column[] = [];
  sidebar: { xCp: number; yCp: number; widthCp: number } | null = null;
  colmode = 1;
  top = 0;
  constructor(
    readonly number: number,
    readonly template: 'opener' | 'continuation',
  ) {}
  usedBottom(): number {
    let bottom = this.top;
    for (const fragment of this.fragments) bottom = Math.max(bottom, fragment.topCp + fragment.heightCp);
    return bottom;
  }
}

function makePage(number: number, openerHeaderHeight: number): Page {
  const page = new Page(number, number === 1 ? 'opener' : 'continuation');
  if (number === 1) {
    page.top = CONTENT_Y + openerHeaderHeight;
    const columnWidth = Math.floor((CONTENT_W - GUTTER) / 2);
    page.cols = [
      new Column(CONTENT_X, page.top, CONTENT_BOTTOM, columnWidth),
      new Column(CONTENT_X + columnWidth + GUTTER, page.top, CONTENT_BOTTOM, columnWidth),
    ];
    page.colmode = 2;
  } else {
    page.top = CONTENT_Y + RUNNING_HEAD_CP;
    page.cols = [new Column(CONTENT_X, page.top, CONTENT_BOTTOM, CONTINUATION_COLUMN_CP)];
    page.sidebar = {
      xCp: CONTENT_X + CONTINUATION_COLUMN_CP + GUTTER,
      yCp: page.top,
      widthCp: CONTENT_W - CONTINUATION_COLUMN_CP - GUTTER,
    };
    page.colmode = 1;
  }
  return page;
}

function wrapBlock(block: LongFormBlock, measure: number): readonly Line[] {
  if (block.kind !== 'paragraph' && block.kind !== 'subhead') return [];
  const style: TextStyleId = block.kind === 'paragraph' ? 'body' : 'subhead';
  const texts = wrap(block.text, style, measure);
  return texts.map((text, index) => ({ block, index, count: texts.length, text, style }));
}

interface ModuleLayout {
  readonly heightCp: number;
  readonly lines: readonly (readonly [TextStyleId, string, number])[];
  readonly meta: Readonly<Record<string, string | number | boolean>>;
}

function moduleLines(block: LongFormBlock, measure: number): ModuleLayout {
  if (block.kind === 'pullQuote') {
    const inset = 0;
    const texts = wrap(`\u201C${block.text}\u201D`, 'pullQuote', measure - 2 * inset);
    const lead = TEXT_STYLES.pullQuote.leadingCp;
    return {
      heightCp: ceilToBaseline(BASELINE_CP + texts.length * lead + BASELINE_CP),
      lines: texts.map((text, index) => ['pullQuote', text, BASELINE_CP + index * lead] as const),
      meta: { kind: 'pullQuote', rule: true },
    };
  }
  if (block.kind === 'keyInsight') {
    const pad = 1400;
    const texts = wrap(block.text, 'panelBody', measure - 2 * pad);
    const lead = TEXT_STYLES.panelBody.leadingCp;
    const inner = pad + 1200 + 600 + texts.length * lead + pad;
    return {
      heightCp: ceilToBaseline(inner),
      lines: [
        ['panelTitle', block.title, pad] as const,
        ...texts.map((text, index) => ['panelBody', text, pad + 1200 + 600 + index * lead] as const),
      ],
      meta: { kind: 'keyInsight', pad },
    };
  }
  throw new PresentationError('PRESENTATION_INPUT_INVALID', `block ${block.id} of kind ${block.kind} is not an atomic module`, { blockId: block.id });
}

function spaceBefore(kind: LongFormBlock['kind']): number {
  return kind === 'pullQuote' || kind === 'keyInsight' || kind === 'subhead' ? BASELINE_CP : 0;
}

/** The text a block contributes to the every-word check. */
export function blockWords(block: LongFormBlock): string {
  return block.kind === 'keyInsight' ? `${block.title} ${block.text}` : block.text;
}

// ---------------------------------------------------------------------------
// paginate
// ---------------------------------------------------------------------------

/**
 * Flows the body blocks (everything after the opener header). Throws
 * `PRESENTATION_LAYOUT_FINDING` when the result breaks a geometric rule; the
 * returned layout therefore always has an empty `findings` list.
 */
export function paginateLongForm(blocks: readonly LongFormBlock[], headerHeightCp: number): LongFormLayout {
  const pages: Page[] = [makePage(1, ceilToBaseline(headerHeightCp))];
  let page = pages[0] as Page;
  let bandStart = page.top;
  let ci = 0;
  let pendingSpace = 0;
  const blockLineCounts: [string, number][] = [];

  const col = (): Column => {
    const column = page.cols[ci];
    if (column === undefined) throw new PresentationError('PRESENTATION_LAYOUT_FINDING', 'no active column', { ci });
    return column;
  };

  const newPage = (): void => {
    page = makePage(pages.length + 1, 0);
    pages.push(page);
    ci = 0;
    pendingSpace = 0;
    bandStart = page.top;
  };

  const nextColumn = (): void => {
    if (ci + 1 < page.cols.length) {
      ci += 1;
      pendingSpace = 0;
    } else {
      newPage();
    }
  };

  const placeLines = (lines: readonly Line[], start: number, end: number): void => {
    const c = col();
    const y = c.y + (c.y > c.top ? pendingSpace : 0);
    const first = lines[start] as Line;
    const lead = TEXT_STYLES[first.style].leadingCp;
    const baseline = firstBaseline(first.style);
    const fragment: LayoutFragment = {
      blockId: first.block.id,
      kind: first.block.kind,
      fragmentIndex: first.index,
      continuedFromPreviousPage: first.index > 0,
      continuesOnNextPage: end < first.count,
      xCp: c.x,
      topCp: y,
      widthCp: c.w,
      heightCp: (end - start) * lead,
      styleId: first.style,
      lines: lines.slice(start, end).map((line, index) => ({
        text: line.text,
        xCp: c.x,
        baselineCp: y + baseline + index * lead,
        widthCp: textWidth(line.text, first.style),
      })),
    };
    page.fragments.push(fragment);
    c.items.push(fragment);
    c.y = y + (end - start) * lead;
  };

  /** Opener only: rebalance the current two-column band so an atomic module can span below it. */
  const balanceBand = (): void => {
    if (page.colmode !== 2) return;
    const [c1, c2] = page.cols as [Column, Column];
    if (c1.y === c1.top) return;
    const frags = page.fragments.filter((fragment) => fragment.topCp >= bandStart);
    const entries: [string, LongFormBlock['kind'], string, string, number][] = [];
    for (const fragment of frags) {
      fragment.lines.forEach((line, index) => {
        entries.push([fragment.blockId, fragment.kind, fragment.styleId, line.text, fragment.fragmentIndex + index]);
      });
    }
    page.fragments = page.fragments.filter((fragment) => !frags.includes(fragment));
    c1.items = c1.items.filter((fragment) => !frags.includes(fragment));
    c2.items = c2.items.filter((fragment) => !frags.includes(fragment));
    const n = entries.length;
    let k = Math.floor((n + 1) / 2);
    const ok = (candidate: number): boolean => {
      if (candidate <= 0 || candidate >= n) return false;
      const a = entries[candidate - 1] as (typeof entries)[number];
      const b = entries[candidate] as (typeof entries)[number];
      if (a[1] === 'subhead') return false;
      if (a[0] === b[0]) {
        const before = entries.slice(0, candidate).filter((entry) => entry[0] === a[0]).length;
        const after = entries.slice(candidate).filter((entry) => entry[0] === a[0]).length;
        if (before < 2 || after < 2) return false;
      }
      return true;
    };
    const candidates = Array.from({ length: Math.max(0, n - 1) }, (_, index) => index + 1).sort(
      (left, right) => Math.abs(left - k) - Math.abs(right - k) || left - right,
    );
    const chosen = candidates.find(ok);
    if (chosen !== undefined) k = chosen;
    c1.y = bandStart;
    c2.y = bandStart;
    const flush = (current: (typeof entries)[number][]): void => {
      const c = col();
      const [blockId, kind, style] = current[0] as (typeof entries)[number];
      const styleId = style as TextStyleId;
      const lead = TEXT_STYLES[styleId].leadingCp;
      const baseline = firstBaseline(styleId);
      let y = c.y + (c.y > bandStart && kind === 'subhead' ? spaceBefore(kind) : 0);
      if (c.y > bandStart && kind === 'paragraph' && (current[0] as (typeof entries)[number])[4] === 0) y = c.y + BASELINE_CP;
      const count = blockLineCounts.find((entry) => entry[0] === blockId)?.[1] ?? 0;
      const last = current[current.length - 1] as (typeof entries)[number];
      const fragment: LayoutFragment = {
        blockId,
        kind,
        fragmentIndex: (current[0] as (typeof entries)[number])[4],
        continuedFromPreviousPage: (current[0] as (typeof entries)[number])[4] > 0,
        continuesOnNextPage: last[4] + 1 < count,
        xCp: c.x,
        topCp: y,
        widthCp: c.w,
        heightCp: current.length * lead,
        styleId,
        lines: current.map((entry, index) => ({
          text: entry[3],
          xCp: c.x,
          baselineCp: y + baseline + index * lead,
          widthCp: textWidth(entry[3], styleId),
        })),
      };
      page.fragments.push(fragment);
      c.items.push(fragment);
      c.y = y + current.length * lead;
    };
    const emit = (target: number, slice: (typeof entries)[number][]): void => {
      ci = target;
      let current: (typeof entries)[number][] = [];
      for (const entry of slice) {
        const previous = current[current.length - 1];
        if (previous !== undefined && entry[0] !== previous[0]) {
          flush(current);
          current = [];
        }
        current.push(entry);
      }
      if (current.length > 0) flush(current);
    };
    emit(0, entries.slice(0, k));
    emit(1, entries.slice(k));
    ci = 1;
  };

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i] as LongFormBlock;
    const kind = block.kind;
    if (kind === 'paragraph' || kind === 'subhead') {
      const lines = wrapBlock(block, col().w);
      blockLineCounts.push([block.id, lines.length]);
      pendingSpace = col().y > col().top ? spaceBefore(kind) : 0;
      if (kind === 'paragraph' && col().y > col().top) pendingSpace = BASELINE_CP;
      let start = 0;
      while (start < lines.length) {
        const c = col();
        const lead = TEXT_STYLES[(lines[0] as Line).style].leadingCp;
        const y0 = c.y + (c.y > c.top ? pendingSpace : 0);
        const fit = Math.floor((c.bottom - y0) / lead);
        const remaining = lines.length - start;
        if (kind === 'subhead') {
          const bodyLead = TEXT_STYLES.body.leadingCp;
          if (fit < remaining || c.bottom - (y0 + remaining * lead) < 2 * bodyLead) {
            nextColumn();
            continue;
          }
          placeLines(lines, 0, lines.length);
          break;
        }
        if (fit >= remaining) {
          placeLines(lines, start, lines.length);
          break;
        }
        let take = fit;
        if (remaining - take < 2) take = remaining - 2;
        if (take < 2) {
          if (c.y === c.top && start === 0 && fit >= 2) {
            take = Math.max(2, Math.min(fit, remaining - 2));
          } else {
            nextColumn();
            continue;
          }
        }
        placeLines(lines, start, start + take);
        start += take;
        nextColumn();
      }
      i += 1;
      continue;
    }

    // atomic module
    let measure = page.colmode === 2 ? CONTENT_W : col().w;
    let y0: number;
    let x0: number;
    if (page.colmode === 2) {
      balanceBand();
      y0 = Math.max((page.cols[0] as Column).y, (page.cols[1] as Column).y);
      x0 = CONTENT_X;
    } else {
      y0 = col().y;
      x0 = col().x;
    }
    let module = moduleLines(block, measure);
    let sb = y0 > page.top ? spaceBefore(kind) : 0;
    if (y0 + sb + module.heightCp > CONTENT_BOTTOM) {
      newPage();
      y0 = col().y;
      x0 = col().x;
      sb = 0;
      measure = col().w;
      module = moduleLines(block, measure);
    }
    const pad = typeof module.meta['pad'] === 'number' ? module.meta['pad'] : 0;
    const fragment: LayoutFragment = {
      blockId: block.id,
      kind,
      fragmentIndex: 0,
      continuedFromPreviousPage: false,
      continuesOnNextPage: false,
      xCp: x0,
      topCp: y0 + sb,
      widthCp: measure,
      heightCp: module.heightCp,
      styleId: kind,
      boxCp: { xCp: x0, yCp: y0 + sb, widthCp: measure, heightCp: module.heightCp },
      meta: module.meta,
      lines: module.lines.map(([styleId, text, dy]) => ({
        text,
        styleId,
        xCp: x0 + pad,
        baselineCp: y0 + sb + dy + firstBaseline(styleId),
        widthCp: textWidth(text, styleId),
      })),
    };
    page.fragments.push(fragment);
    if (page.colmode === 2) {
      bandStart = y0 + sb + module.heightCp + BASELINE_CP;
      if (CONTENT_BOTTOM - bandStart < MIN_BAND_LINES * BASELINE_CP) {
        newPage();
      } else {
        for (const column of page.cols) {
          column.y = bandStart;
          column.top = bandStart;
        }
        ci = 0;
      }
    } else {
      col().y = y0 + sb + module.heightCp;
      pendingSpace = BASELINE_CP;
    }
    i += 1;
  }

  // ---- validation (walk the result, not the intention) ----
  const findings: [string, number, string][] = [];
  for (const p of pages) {
    const boxes: [number, number, number, number][] = [];
    for (const f of p.fragments) {
      if (f.xCp < CONTENT_X || f.xCp + f.widthCp > CONTENT_X + CONTENT_W + 1) findings.push(['OUTSIDE_X', p.number, f.blockId]);
      if (f.topCp < CONTENT_Y || f.topCp + f.heightCp > CONTENT_BOTTOM) findings.push(['OUTSIDE_Y', p.number, f.blockId]);
      for (const line of f.lines) {
        if (line.widthCp > f.widthCp) findings.push(['LINE_EXCEEDS_MEASURE', p.number, f.blockId]);
        const styleId = (line.styleId ?? f.styleId) as TextStyleId;
        if (TEXT_STYLES[styleId].sizeCp < GEOMETRY_CENTIPOINTS.textFloorCp) findings.push(['BELOW_TEXT_FLOOR', p.number, f.blockId]);
      }
      const box: [number, number, number, number] = [f.xCp, f.topCp, f.xCp + f.widthCp, f.topCp + f.heightCp];
      for (const other of boxes) {
        if (box[0] < other[2] && other[0] < box[2] && box[1] < other[3] && other[1] < box[3]) findings.push(['OVERLAP', p.number, f.blockId]);
      }
      boxes.push(box);
    }
  }
  const sourceWords = blocks.map(blockWords).join(' ').split(/\s+/u).filter((word) => word.length > 0);
  const placedWords = pages
    .flatMap((p) => p.fragments.flatMap((f) => f.lines.map((line) => line.text)))
    .join(' ')
    .replace(/[\u201C\u201D]/gu, '')
    .split(/\s+/u)
    .filter((word) => word.length > 0);
  const same = sourceWords.length === placedWords.length && sourceWords.every((word, index) => word === placedWords[index]);
  if (!same) findings.push(['TEXT_MISMATCH', 0, `${String(sourceWords.length)} vs ${String(placedWords.length)}`]);
  if (findings.length > 0) {
    throw new PresentationError('PRESENTATION_LAYOUT_FINDING', `the long-form layout breaks ${String(findings.length)} rule(s)`, { findings });
  }

  const lineCount = pages.reduce((sum, p) => sum + p.fragments.reduce((inner, f) => inner + f.lines.length, 0), 0);
  return {
    pages: pages.map((p) => ({
      pageNumber: p.number,
      template: p.template,
      sidebar: p.sidebar,
      fragments: p.fragments,
      usedBottomCp: p.usedBottom(),
    })),
    lineCount,
    wordCount: sourceWords.length,
    findings,
    geometry: {
      contentXCp: CONTENT_X,
      contentYCp: CONTENT_Y,
      contentWidthCp: CONTENT_W,
      contentHeightCp: CONTENT_H,
      baselineCp: BASELINE_CP,
      toleranceCp: LINE_TOLERANCE_CP,
    },
  };
}
