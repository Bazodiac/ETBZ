/**
 * ETBZ-56 — Earthly-Branch animal labels (AC 8, AC 9) and the every-word check over quotation marks.
 *
 * The label table is a released, versioned identity; every page of both
 * projections (the ETBZ-55 fixture payload and the accepted Skill reading) that
 * shows an Earthly Branch shows its animal from that table, and a branch or a
 * language without a label is refused. The every-word check compares the text a
 * block places with the placed lines character for character, so German
 * quotation marks („…“) and pull quotes pass and a dropped mark does not.
 */
import { describe, expect, it } from 'vitest';
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

const BRANCHES = new Set(DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'earthly_branch').map((glyph) => glyph.character));

describe('ETBZ-56: the branch animal table is a released identity', () => {
  it('hashes to its released identity and equals the Sizhu table, branch for branch', () => {
    expect(structuralHash(BRANCH_ANIMAL_LABELS)).toBe(RELEASED_BRANCH_ANIMAL_LABELS_HASHES[BRANCH_ANIMAL_LABELS_REF]);
    expect(() => assertReleasedBranchAnimalLabels()).not.toThrow();
    expect(BRANCH_ANIMAL_LABELS.locales.de.map((entry) => [entry.branch, entry.label])).toEqual(TWELVE_BRANCHES.map((entry) => [entry.hanzi, entry.tierDe]));
    expect([...BRANCHES].sort()).toEqual(BRANCH_ANIMAL_LABELS.locales.de.map((entry) => entry.branch).sort());
  });

  it('refuses a changed label, a reordered table and a label the Sizhu table does not carry', () => {
    const relabelled: BranchAnimalLabels = { ...BRANCH_ANIMAL_LABELS, locales: { de: BRANCH_ANIMAL_LABELS.locales.de.map((entry) => (entry.branch === '丑' ? { ...entry, label: 'Ochse' } : entry)) } };
    expect(refusal(() => assertReleasedBranchAnimalLabels(relabelled)).code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
    const reordered: BranchAnimalLabels = { ...BRANCH_ANIMAL_LABELS, locales: { de: [...BRANCH_ANIMAL_LABELS.locales.de].reverse() } };
    expect(refusal(() => assertReleasedBranchAnimalLabels(reordered)).message).toMatch(/released identity/u);
  });

  it('answers each of the twelve branches in German and refuses anything else, without a fallback', () => {
    expect(branchAnimalLabel('午', 'de')).toBe('Pferd');
    expect(branchAnimalLabel('丑', 'de')).toBe('Büffel');
    for (const branch of TWELVE_BRANCHES) expect(branchAnimalLabel(branch.hanzi, 'de')).toBe(branch.tierDe);
    expect(refusal(() => branchAnimalLabel('午', 'en')).code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
    expect(refusal(() => branchAnimalLabel('甲', 'de')).code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
    expect(refusal(() => branchAnimalLabel('Wu', 'de')).code).toBe('PRESENTATION_BRANCH_ANIMAL_UNMAPPED');
  });
});

/**
 * Fields that carry the reading's own text. A branch character quoted inside the prose is the Skill's text and stays
 * as written - the projection never edits a reading - so AC 8 is measured on what the template displays.
 */
const PAYLOAD_KEYS = new Set(['fragments', 'headerLines', 'questions', 'paragraphs', 'title']);

/** Every Earthly Branch the template displays on a page: as a glyph (a `character`) or inside a chart-value string. */
function branchesShown(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    for (const character of value) if (BRANCHES.has(character)) out.add(character);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) branchesShown(entry, out);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) if (!PAYLOAD_KEYS.has(key)) branchesShown(child, out);
  }
}

/** Every glyph object that draws a branch, with the object it sits in. */
function branchGlyphs(value: unknown, parent: Record<string, unknown> | null, out: { glyph: Record<string, unknown>; parent: Record<string, unknown> | null }[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) branchGlyphs(entry, parent, out);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record['character'] === 'string' && BRANCHES.has(record['character'])) out.push({ glyph: record, parent });
    for (const child of Object.values(record)) branchGlyphs(child, record, out);
  }
}

const projections: readonly (readonly [string, () => PresentationProjection])[] = [
  ['the fixture payload (ETBZ-55 path)', () => presentationFixture().projection],
  ['the accepted Skill reading (ETBZ-56 path)', () => skillPresentationFixture().projection],
];

describe.each(projections)('ETBZ-56 AC 8: every displayed Earthly Branch carries its animal - %s', (_name, build) => {
  const projection = build();

  it('prints the animal of every branch a page shows, on that page', () => {
    let pagesWithBranches = 0;
    for (const page of projection.pages) {
      const shown = new Set<string>();
      branchesShown(page.content, shown);
      if (shown.size > 0) pagesWithBranches += 1;
      for (const branch of shown) expect(page.strings, `page ${String(page.pageNumber)} ${page.pageId}: ${branch}`).toContain(branchAnimalLabel(branch, 'de'));
    }
    // glance, four pillars, foundation, day master, five phases, hidden stems, reflection, summary
    expect(pagesWithBranches).toBe(8);
  });

  it('binds each drawn branch glyph to its own animal, never to a stem, and keeps the two values apart', () => {
    const found: { glyph: Record<string, unknown>; parent: Record<string, unknown> | null }[] = [];
    branchGlyphs(projection.pages.map((page) => page.content), null, found);
    expect(found.length).toBeGreaterThan(0);
    for (const { glyph, parent } of found) {
      const character = glyph['character'] as string;
      // The foundation page lists a branch as a glyph with its animal as the entry's detail.
      const label = 'animalLabel' in glyph ? glyph['animalLabel'] : parent?.['detail'];
      expect(label, character).toBe(branchAnimalLabel(character, 'de'));
      expect(String(label)).not.toContain(character);
    }
    const stems = DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'heavenly_stem').map((glyph) => glyph.character);
    const stemObjects: Record<string, unknown>[] = [];
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        if (typeof record['character'] === 'string' && stems.includes(record['character'])) stemObjects.push(record);
        Object.values(record).forEach(collect);
      }
    };
    collect(projection.pages.map((page) => page.content));
    expect(stemObjects.length).toBeGreaterThan(0);
    expect(stemObjects.filter((stem) => 'animalLabel' in stem)).toEqual([]);
  });

  it('refuses a chart whose animal label differs from the released table', () => {
    const { model, content } = presentationFixture();
    const changed = structuredClone(model) as { pillars: { hour: { tierDe: string } } };
    changed.pillars.hour.tierDe = 'Schaf';
    expect(refusal(() => buildPresentationProjection({ model: changed as unknown as typeof model, content })).code).toBe('PRESENTATION_FACT_MISMATCH');
  });

  it('records the label table it used', () => {
    expect(projection.sources.branchAnimals).toEqual({ ref: BRANCH_ANIMAL_LABELS_REF, locale: 'de', structuralHash: RELEASED_BRANCH_ANIMAL_LABELS_HASHES[BRANCH_ANIMAL_LABELS_REF] });
  });
});

describe('ETBZ-56: the every-word check compares the placed text exactly (ADR 0012 limitation 12)', () => {
  const blocks: LongFormBlock[] = [
    { id: 'p1', kind: 'paragraph', text: 'BaZi heißt wörtlich \u201Eacht Zeichen\u201C und nennt die vier Säulen beim Namen.' },
    { id: 'q1', kind: 'pullQuote', text: 'Ein Satz, der als Zitat hervorgehoben steht.' },
    { id: 'p2', kind: 'paragraph', text: 'Ein Absatz danach, mit \u201Cenglischen\u201D Zeichen im Text.' },
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
    const placement = placementOf(layout);
    expect(placedBlockText(blocks[1] as LongFormBlock)).toBe('\u201CEin Satz, der als Zitat hervorgehoben steht.\u201D');
    expect(() => assertEveryWordPlaced(blocks.map(placedBlockText).join(' '), placement)).not.toThrow();
  });

  it('refuses a placement that drops a quotation mark', () => {
    const placement = placementOf(paginateLongForm(blocks, header));
    const dropped = {
      ...placement,
      pages: placement.pages.map((page) => ({ ...page, lines: page.lines.map((line) => line.replace('Zeichen\u201C', 'Zeichen')) })),
    };
    expect(dropped.pages.flatMap((page) => page.lines).join(' ')).not.toContain('Zeichen\u201C');
    expect(() => assertEveryWordPlaced(blocks.map(placedBlockText).join(' '), dropped)).toThrow(VisualContractError);
  });
});
