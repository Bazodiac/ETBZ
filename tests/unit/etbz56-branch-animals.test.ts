/**
 * ETBZ-56 — Earthly-Branch animal labels (AC 8, AC 9) and the every-word check over quotation marks.
 *
 * The label table is a released, versioned identity; every display of an Earthly
 * Branch the template makes, on both projections (the ETBZ-55 fixture payload and
 * the accepted Skill reading), carries that branch's own animal from the table,
 * and a branch or a language without a label is refused. The every-word check
 * compares the text a block places with the placed lines character for character,
 * so German quotation marks and pull quotes pass and a dropped mark does not.
 *
 * The projections are built inside the tests, never while the file is collected:
 * a refusal must surface as a failed assertion of the test that names it.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BRANCH_ANIMAL_LABELS,
  BRANCH_ANIMAL_LABELS_REF,
  PresentationError,
  RELEASED_BRANCH_ANIMAL_LABELS_HASHES,
  assertReleasedBranchAnimalLabels,
  blockWords,
  branchAnimalLabel,
  buildPresentationProjection,
  headerHeight,
  paginateLongForm,
  placedBlockText,
} from '../../src/application/presentation/index.js';
import type { BranchAnimalLabels, LongFormBlock, PresentationProjection } from '../../src/application/presentation/index.js';
import { DISPLAY_GLYPH_SET, VisualContractError, assertEveryWordPlaced } from '../../src/application/visual/index.js';
import { TWELVE_BRANCHES } from '../../src/domain/sizhu.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import { presentationFixture } from '../support/presentationFixture.js';
import { skillPresentationFixture } from '../support/skillPresentationFixture.js';

function refusal(action: () => unknown): PresentationError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected a PresentationError').toBeInstanceOf(PresentationError);
  return caught as PresentationError;
}


// Each Skill-path build accepts the reading again and projects twice; under a full-suite load that exceeds the
// default 5 s. A timed-out test would still log, with stale numbers - pin the budget per file.
vi.setConfig({ testTimeout: 60_000 });
const BRANCHES = new Set(DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'earthly_branch').map((glyph) => glyph.character));
const withDe = (entries: BranchAnimalLabels['locales']['de']): BranchAnimalLabels => ({ ...BRANCH_ANIMAL_LABELS, locales: { de: entries } });
const OPEN_DE = String.fromCodePoint(0x201e);
const OPEN_EN = String.fromCodePoint(0x201c);
const CLOSE_EN = String.fromCodePoint(0x201d);

describe('ETBZ-56: the branch animal table is a released identity', () => {
  it('hashes to its released identity and equals the Sizhu table, branch for branch', () => {
    expect(structuralHash(BRANCH_ANIMAL_LABELS)).toBe(RELEASED_BRANCH_ANIMAL_LABELS_HASHES[BRANCH_ANIMAL_LABELS_REF]);
    expect(() => assertReleasedBranchAnimalLabels()).not.toThrow();
    expect(BRANCH_ANIMAL_LABELS.locales.de.map((entry) => [entry.branch, entry.label])).toEqual(TWELVE_BRANCHES.map((entry) => [entry.hanzi, entry.tierDe]));
    expect([...BRANCHES].sort()).toEqual(BRANCH_ANIMAL_LABELS.locales.de.map((entry) => entry.branch).sort());
  });

  it('refuses a reordered table, a padded label and a label the Sizhu table does not carry, each by its own check', () => {
    expect(refusal(() => assertReleasedBranchAnimalLabels(withDe([...BRANCH_ANIMAL_LABELS.locales.de].reverse()))).message).toMatch(/twelve branches in order/u);
    const padded = withDe(BRANCH_ANIMAL_LABELS.locales.de.map((entry) => (entry.branch === '子' ? { ...entry, label: ' Ratte' } : entry)));
    expect(refusal(() => assertReleasedBranchAnimalLabels(padded)).message).toMatch(/empty or padded/u);
    const relabelled = withDe(BRANCH_ANIMAL_LABELS.locales.de.map((entry) => (entry.branch === '丑' ? { ...entry, label: 'Ochse' } : entry)));
    const error = refusal(() => assertReleasedBranchAnimalLabels(relabelled));
    expect(error.code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
    expect(error.message).toMatch(/Sizhu table/u);
  });

  it('refuses a structurally valid table that is not the released identity', () => {
    const other = { ...BRANCH_ANIMAL_LABELS, ref: 'bazodiac-branch-animal-labels@1.0.1' } as unknown as BranchAnimalLabels;
    expect(refusal(() => assertReleasedBranchAnimalLabels(other)).message).toMatch(/released identity/u);
  });

  it('answers each of the twelve branches in German and refuses anything else, without a fallback', () => {
    expect(branchAnimalLabel('午', 'de')).toBe('Pferd');
    expect(branchAnimalLabel('丑', 'de')).toBe('Büffel');
    for (const branch of TWELVE_BRANCHES) expect(branchAnimalLabel(branch.hanzi, 'de')).toBe(branch.tierDe);
    expect(refusal(() => branchAnimalLabel('午', 'en')).code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
    expect(refusal(() => branchAnimalLabel('甲', 'de')).code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
    expect(refusal(() => branchAnimalLabel('Wu', 'de')).code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
  });

  it('refuses a chart whose animal label differs from the released table (fixture path)', () => {
    const { model, content } = presentationFixture();
    const changed = structuredClone(model) as { pillars: { hour: { tierDe: string } } };
    changed.pillars.hour.tierDe = 'Schaf';
    expect(refusal(() => buildPresentationProjection({ model: changed as unknown as typeof model, content })).code).toBe('PRESENTATION_FACT_MISMATCH');
  });
});

/**
 * Where the reading's own text sits on a page. A branch character quoted inside the reading's prose stays as the
 * Skill wrote it - the projection never edits a reading - so AC 8 is measured on what the template displays.
 */
function readingText(page: PresentationProjection['pages'][number], key: string): boolean {
  const kind = page.content.kind;
  if (kind === 'reflection' && key === 'questions') return true;
  if (kind === 'methodNote' && key === 'paragraphs') return true;
  if (kind === 'cover' && key === 'title') return true;
  return false;
}

interface Display {
  readonly path: string;
  readonly branch: string;
  readonly label: unknown;
}

/**
 * Every display of an Earthly Branch the template makes, with the label that display carries: a glyph object
 * (`character`) carries its own `animalLabel`, or - on the foundation page - its entry's `detail`; a fact row whose
 * value or CJK text names a branch carries the row's `detail`. One entry per display, so a label on one row cannot
 * stand in for a missing or wrong label on another. Long-form pages are the reading's text throughout.
 */
function branchDisplays(page: PresentationProjection['pages'][number]): Display[] {
  const found: Display[] = [];
  const walk = (value: unknown, path: string, parent: Record<string, unknown> | null): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}.${String(index)}`, parent));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    const character = record['character'];
    if (typeof character === 'string' && BRANCHES.has(character)) {
      found.push({ path, branch: character, label: 'animalLabel' in record ? record['animalLabel'] : parent?.['detail'] });
    }
    for (const field of ['value', 'cjk']) {
      const text = record[field];
      if (typeof text !== 'string') continue;
      for (const symbol of text) if (BRANCHES.has(symbol)) found.push({ path: `${path}.${field}`, branch: symbol, label: record['detail'] });
    }
    for (const [key, child] of Object.entries(record)) {
      if (path === 'content' && readingText(page, key)) continue;
      if (key === 'character' || key === 'animalLabel' || key === 'detail') continue;
      walk(child, `${path}.${key}`, record);
    }
  };
  if (page.content.kind !== 'longForm') walk(page.content, 'content', null);
  return found;
}

const projections: readonly (readonly [string, () => PresentationProjection])[] = [
  ['the fixture payload (ETBZ-55 path)', () => presentationFixture().projection],
  ['the accepted Skill reading (ETBZ-56 path)', () => skillPresentationFixture().projection],
];

describe.each(projections)('ETBZ-56 AC 8: every displayed Earthly Branch carries its animal - %s', (_name, build) => {
  it("gives every branch display its own branch's animal, on the pages that show branches", () => {
    const projection = build();
    const pagesWithBranches: string[] = [];
    for (const page of projection.pages) {
      const displays = branchDisplays(page);
      if (displays.length > 0) pagesWithBranches.push(page.pageId);
      for (const display of displays) {
        expect(display.label, `${page.pageId} ${display.path} ${display.branch}`).toBe(branchAnimalLabel(display.branch, 'de'));
        expect(page.strings, `${page.pageId} ${display.path}`).toContain(branchAnimalLabel(display.branch, 'de'));
      }
    }
    expect(pagesWithBranches).toEqual(['glance', 'four-pillars', 'foundation', 'day-master', 'five-phases', 'hidden-stems', 'reflection', 'summary']);
  });

  it('labels branches only - never a stem - and keeps the glyph and the word apart', () => {
    const projection = build();
    const stems = new Set(DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'heavenly_stem').map((glyph) => glyph.character));
    const offenders: string[] = [];
    let stemCount = 0;
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        if (typeof record['character'] === 'string' && stems.has(record['character'])) stemCount += 1;
        if (typeof record['character'] === 'string' && stems.has(record['character']) && 'animalLabel' in record) offenders.push(record['character']);
        Object.values(record).forEach(walk);
      }
    };
    walk(projection.pages.map((page) => page.content));
    expect(stemCount, 'the walk found no stem at all').toBeGreaterThan(0);
    expect(offenders).toEqual([]);
    for (const page of projection.pages) for (const display of branchDisplays(page)) expect(String(display.label)).not.toContain(display.branch);
  });

  it('records the label table it used', () => {
    const projection = build();
    expect(projection.sources.branchAnimals).toEqual({ ref: BRANCH_ANIMAL_LABELS_REF, locale: 'de', structuralHash: RELEASED_BRANCH_ANIMAL_LABELS_HASHES[BRANCH_ANIMAL_LABELS_REF] });
  });
});

describe('ETBZ-56: the every-word check compares the placed text exactly (ADR 0012 limitation 12)', () => {
  const blocks: LongFormBlock[] = [
    { id: 'p1', kind: 'paragraph', text: `BaZi heißt wörtlich ${OPEN_DE}acht Zeichen${OPEN_EN} und nennt die vier Säulen beim Namen.` },
    { id: 'q1', kind: 'pullQuote', text: 'Ein Satz, der als Zitat hervorgehoben steht.' },
    { id: 'p2', kind: 'paragraph', text: `Ein Absatz danach, mit ${OPEN_EN}englischen${CLOSE_EN} Zeichen im Text.` },
  ];
  const header = headerHeight([{ id: 'title', kind: 'sectionTitle', text: 'Probe' }]);
  const placementOf = (layout: ReturnType<typeof paginateLongForm>) => ({
    fixtureId: 'quotes',
    wordCount: blocks.map(blockWords).join(' ').split(/\s+/u).length,
    pages: layout.pages.map((page) => ({ pageNumber: page.pageNumber, template: page.template, lines: page.fragments.flatMap((fragment) => fragment.lines.map((line) => line.text)) })),
  });

  it('places a pull quote and German quotation marks and passes the check', () => {
    // The paginator's own every-word check runs inside paginateLongForm; it must not refuse its own placement.
    let layout: ReturnType<typeof paginateLongForm> | undefined;
    expect(() => {
      layout = paginateLongForm(blocks, header);
    }).not.toThrow();
    if (layout === undefined) return;
    expect(placedBlockText(blocks[1] as LongFormBlock)).toBe(`${OPEN_EN}Ein Satz, der als Zitat hervorgehoben steht.${CLOSE_EN}`);
    expect(() => assertEveryWordPlaced(blocks.map(placedBlockText).join(' '), placementOf(layout as ReturnType<typeof paginateLongForm>))).not.toThrow();
  });

  it("refuses, in the projection's every-word call, a placement that drops a quotation mark", () => {
    const placement = placementOf(paginateLongForm(blocks, header));
    const dropped = {
      ...placement,
      pages: placement.pages.map((page) => ({ ...page, lines: page.lines.map((line) => line.replace(`Zeichen${OPEN_EN}`, 'Zeichen')) })),
    };
    expect(dropped.pages.flatMap((page) => page.lines).join(' ')).not.toContain(`Zeichen${OPEN_EN}`);
    expect(() => assertEveryWordPlaced(blocks.map(placedBlockText).join(' '), dropped)).toThrow(VisualContractError);
  });
});
