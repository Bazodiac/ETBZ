/**
 * ETBZ-55 — the PresentationProjection of the D4 golden input.
 *
 * The chart is the synthetic known-time fixture (Musterkundin A); the content
 * is the versioned German text payload of the ETBZ-52 fixture run. These tests
 * pin what the projection shows and prove every shown chart value against the
 * validated chart and against the fact set the Skill was handed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PRESENTATION_PROJECTION_VERSION,
  RELEASED_TEMPLATE_HASHES,
  TEMPLATE_LABELS,
  TEMPLATE_REF,
  buildPresentationProjection,
  templateBinding,
} from '../../src/application/presentation/index.js';
import type { PageContent, PillarValue, PresentationPage, PresentationProjection } from '../../src/application/presentation/index.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { CHART_TERMINOLOGY, findProhibitedWording, findUnsupportedMethodTerm } from '../../src/application/skill/index.js';
import { DISPLAY_GLYPH_SET, PAGE_FAMILY, findEvidenceChrome } from '../../src/application/visual/index.js';
import { presentationFixture } from '../support/presentationFixture.js';

// Loaded per describe block that needs it: a projection that refuses to build must fail the
// tests about the projection, not the collection of the template tests below.
let model!: HoroscopeModel;
let content!: unknown;
let projection!: PresentationProjection;
const load = (): void => {
  if (projection !== undefined) return;
  ({ model, content, projection } = presentationFixture());
};
const skillInput = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/evidence/etbz-52/fixture/skill-input.json'), 'utf8')) as {
  facts: readonly { id: string; value: string }[];
};
const factValue = (id: string): string | undefined => skillInput.facts.find((fact) => fact.id === id)?.value;
const contentOf = <K extends PageContent['kind']>(kind: K): Extract<PageContent, { kind: K }> => {
  const page = projection.pages.find((candidate) => candidate.content.kind === kind);
  if (page === undefined) throw new Error(`no ${kind} page`);
  return page.content as Extract<PageContent, { kind: K }>;
};

describe('ETBZ-55: the template', () => {
  it('is bazodiac-final-template@1.0.0 over the ETBZ-49 visual system, frozen by its released hash', () => {
    const binding = templateBinding();
    expect(TEMPLATE_REF).toBe('bazodiac-final-template@1.0.0');
    expect(binding.structuralHash).toBe(RELEASED_TEMPLATE_HASHES['1.0.0']);
    expect(binding.decisionSource).toEqual({ system: 'confluence', pageId: '66650114', version: '2' });
    expect(binding.designSystem).toEqual({ name: 'Bazodiac Final', version: '1.0.0', tokenVersion: 1 });
    expect(binding.pageFamily).toHaveLength(PAGE_FAMILY.length);
  });

  it('takes every Lexicon label verbatim from the released Lexicon term it names', () => {
    for (const [id, entry] of Object.entries(TEMPLATE_LABELS)) {
      const lexiconTerm = 'lexiconTerm' in entry ? entry.lexiconTerm : undefined;
      if (entry.source !== 'lexicon') {
        expect(lexiconTerm, id).toBeUndefined();
        continue;
      }
      const term = CHART_TERMINOLOGY.find((candidate) => candidate.term === lexiconTerm);
      expect(term, `${id}: Lexicon term ${String(lexiconTerm)}`).toBeDefined();
      expect(term?.customerDe, id).toContain(entry.text);
    }
  });

  it('carries no label that is prohibited wording, a deferred method or evidence chrome, and leaves none unused', () => {
    load();
    const printed = projection.customerStrings.map((text) => text.toLowerCase());
    for (const [id, entry] of Object.entries(TEMPLATE_LABELS)) {
      expect(findProhibitedWording(entry.text), id).toBeNull();
      expect(findUnsupportedMethodTerm(entry.text), id).toBeNull();
      expect(findEvidenceChrome(entry.text), id).toEqual([]);
      expect(printed.some((text) => text.includes(entry.text.toLowerCase())), `${id} is printed somewhere`).toBe(true);
    }
  });
});

describe('ETBZ-55: the page model', () => {
  beforeAll(load);

  it('binds the released template', () => {
    expect(projection.template).toEqual(templateBinding());
  });

  it('is bazodiac-presentation-projection.v1, German, twenty-nine pages in the template sequence', () => {
    expect(projection.projectionVersion).toBe(PRESENTATION_PROJECTION_VERSION);
    expect(projection.language).toBe('de');
    expect(projection.pageCount).toBe(29);
    expect(projection.pages.map((page) => page.pageNumber)).toEqual(Array.from({ length: 29 }, (_, index) => index + 1));
    const kinds = projection.pages.map((page) => page.content.kind);
    expect(kinds.slice(0, 11)).toEqual(['cover', 'identity', 'contents', 'glance', 'fourPillars', 'foundation', 'dayMaster', 'wuXing', 'fivePhases', 'tenGods', 'hiddenStems']);
    expect(kinds.slice(11, 25).every((kind) => kind === 'longForm')).toBe(true);
    expect(kinds.slice(25)).toEqual(['reflection', 'summary', 'closing', 'methodNote']);
  });

  it('instantiates every fixed page of the page family once and binds only declared slots', () => {
    const fixed = PAGE_FAMILY.filter((page) => page.family !== 'long-form').map((page) => page.id);
    const instantiated = projection.pages.map((page) => page.contractPageId);
    for (const id of fixed) expect(instantiated.filter((candidate) => candidate === id), id).toHaveLength(1);
    for (const page of projection.pages) {
      const contract = PAGE_FAMILY.find((candidate) => candidate.id === page.contractPageId);
      expect(contract, page.pageId).toBeDefined();
      for (const slot of page.slots) expect(contract?.bindings.map((binding) => binding.slotId), page.pageId).toContain(slot);
    }
  });

  it('lays every chapter over two to three pages, opener first, every word of the payload placed in order', () => {
    const chapters = (content as { chapters: { title: string; paragraphs: string[] }[] }).chapters;
    chapters.forEach((chapter, index) => {
      const pages = projection.pages.filter((page) => page.content.kind === 'longForm' && page.content.chapterNumber === index + 1);
      expect(pages.length).toBeGreaterThanOrEqual(2);
      expect(pages.length).toBeLessThanOrEqual(3);
      expect(pages.map((page) => (page.content.kind === 'longForm' ? page.content.template : null))).toEqual(['opener', ...Array<string>(pages.length - 1).fill('continuation')]);
      const placed = pages.flatMap((page) => (page.content.kind === 'longForm' ? page.content.fragments.flatMap((fragment) => fragment.lines.map((line) => line.text)) : []));
      expect(placed.join(' ').split(' ')).toEqual(chapter.paragraphs.join(' ').split(' '));
    });
  });

  it('derives the contents from its own pages and points the data note at the method page', () => {
    const contents = contentOf('contents');
    const entries = contents.sections.flatMap((section) => section.entries);
    expect(entries).toHaveLength(22);
    for (const entry of entries) {
      const page = projection.pages[Number(entry.pageLabel) - 1] as PresentationPage;
      expect(page.pageLabel).toBe(entry.pageLabel);
    }
    const identity = contentOf('identity');
    expect(model.sourceWarnings).toEqual(['DAY_ANCHOR_UNVERIFIED']);
    expect(identity.rows.at(-1)).toEqual({ label: 'Datenhinweis', value: 'Siehe Methodenhinweis, Seite 29' });
    expect(projection.pages[28]?.content.kind).toBe('methodNote');
  });

  it('leaves the two Day-Master content slots empty rather than filling them with stock copy', () => {
    expect(projection.emptyContentSlots).toEqual([
      { slotId: 'dayMaster.reading', reason: 'NO_APPROVED_CONTENT' },
      { slotId: 'dayMaster.pillarReading', reason: 'NO_APPROVED_CONTENT' },
    ]);
    expect(projection.pages.find((page) => page.contractPageId === 'day-master')?.slots).toEqual(['dayMaster.hero']);
  });
});

describe('ETBZ-55 AC2: Four Pillars and Wu Xing equal the chart exactly', () => {
  let pillars: readonly PillarValue[] = [];
  beforeAll(() => {
    load();
    pillars = contentOf('fourPillars').pillars;
  });

  it('shows each pillar as the validated chart and the Skill fact set state it', () => {
    expect(pillars.map((pillar) => pillar.position)).toEqual(['year', 'month', 'day', 'hour']);
    for (const pillar of pillars) {
      const chart = model.pillars[pillar.position];
      const natal = model.natal.pillars[pillar.position];
      expect(pillar.stem.character).toBe(chart.stemHanzi);
      expect(pillar.stem.character).toBe(factValue(`chart.pillar.${pillar.position}.stemHanzi`));
      expect(pillar.stem.pinyin).toBe(chart.stemPinyin);
      expect(pillar.stem.phaseLabel).toBe(chart.stemElementDe);
      expect(pillar.stem.phaseLabel).toBe(factValue(`chart.pillar.${pillar.position}.stemElement`));
      expect(pillar.stem.polarity).toBe(natal.polarity);
      expect(pillar.branch.character).toBe(chart.branchHanzi);
      expect(pillar.branch.character).toBe(factValue(`chart.pillar.${pillar.position}.branchHanzi`));
      expect(pillar.branch.phase).toBe(natal.branchElement);
      expect(pillar.branch.animalLabel).toBe(chart.tierDe);
      expect(pillar.branch.animalLabel).toBe(factValue(`chart.pillar.${pillar.position}.tier`));
      expect(pillar.hidden.map((hidden) => [hidden.character, hidden.phase, hidden.qiRole])).toEqual(
        natal.hiddenStems.map((hidden) => [hidden.stemCn, hidden.element, hidden.qi]),
      );
      expect(pillar.tenGod?.code ?? null).toBe(natal.tenGod?.name ?? null);
      expect(pillar.isDayMaster).toBe(pillar.position === 'day');
    }
  });

  it('colours one region per phase and never a whole pillar', () => {
    for (const pillar of pillars) {
      expect(pillar.paint.container.startsWith('paper-')).toBe(true);
      expect(pillar.paint.regions.map((region) => region.phase)).toEqual([pillar.stem.phase, pillar.branch.phase, ...pillar.hidden.map((hidden) => hidden.phase)]);
    }
  });

  it('prints the Wu Xing values as supplied and derives nothing but the registered ratio', () => {
    const wuXing = contentOf('wuXing').wuXing;
    expect(wuXing.transformId).toBe('pt.linear-max-v1');
    expect(wuXing.phases.map((entry) => [entry.label, entry.valueText])).toEqual([
      ['Holz', '1.8'],
      ['Feuer', '2.5'],
      ['Erde', '2'],
      ['Metall', '2'],
      ['Wasser', '2'],
    ]);
    for (const entry of wuXing.phases) {
      expect(entry.value).toBe(model.wuxing.vector[entry.label]);
      expect(entry.valueText).toBe(factValue(`chart.wuxing.weight.${entry.label}`));
    }
    expect(JSON.stringify(projection)).not.toContain(model.wuxing.dominant === 'Feuer' ? '"dominant"' : '__never__');
  });

  it('names every Ten-God relation with the Lexicon Hanzi, pinyin and German wording', () => {
    const tenGods = contentOf('tenGods');
    expect(tenGods.rows).toHaveLength(10);
    const year = pillars[0]?.tenGod;
    expect(year).toMatchObject({ code: 'RobWealth', hanzi: '劫财', pinyin: 'Jié Cái', familyId: 'PEER' });
    expect(year?.customerLabel).toBe('wettbewerbliche Peer-Dynamik; Spannung um gemeinsamen Raum/Ressourcen');
    const marks = Object.fromEntries(tenGods.rows.map((row) => [row.tenGod.hanzi, row.marks]));
    expect(marks['劫财']).toEqual(['stem', null, null, null]);
    expect(marks['伤官']).toEqual([null, 'stem', 'hidden', null]);
    expect(marks['七杀']).toEqual(['hidden', 'hidden', null, 'hidden']);
  });
});

describe('ETBZ-55: the printable inventory', () => {
  beforeAll(load);

  it('lists the printable strings sorted and unique, clean of evidence chrome, prohibited wording and deferred methods', () => {
    const strings = projection.customerStrings;
    expect([...strings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(strings);
    expect(new Set(strings).size).toBe(strings.length);
    for (const text of strings) {
      expect(findEvidenceChrome(text), text).toEqual([]);
      expect(findProhibitedWording(text), text).toBeNull();
      expect(findUnsupportedMethodTerm(text), text).toBeNull();
    }
    expect(strings).toContain('Musterkundin A');
    expect(strings.some((text) => /DAY_ANCHOR|sha256|claim\.|chart\./u.test(text))).toBe(false);
  });

  it('draws only the 27 display glyphs and sets every other Hanzi in the informational face', () => {
    const contract = new Set(DISPLAY_GLYPH_SET.map((glyph) => glyph.character));
    for (const glyph of projection.displayGlyphs) expect(contract.has(glyph), glyph).toBe(true);
    expect(projection.displayGlyphs).toHaveLength(27);
    for (const hanzi of ['劫', '财', '伤', '官', '四', '柱', '庚', '辛']) expect(projection.cjkText).toContain(hanzi);
  });
});

describe('ETBZ-55 AC6: the same input yields the same projection', () => {
  beforeAll(load);

  it('builds twice to the same structure and hash', () => {
    const again = buildPresentationProjection({ model, content });
    expect(again.structuralHash).toBe(projection.structuralHash);
    expect(again).toEqual(projection);
  });
});
