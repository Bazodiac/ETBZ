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
import { FONT_METRICS } from '../../src/application/presentation/font-metrics.js';
import { CONTINUATION_COLUMN_CP, RUNNING_HEAD_CP } from '../../src/application/presentation/long-form.js';
import { CJK_IDEOGRAPH_ADVANCE_EM, LINE_TOLERANCE_CP, TEXT_STYLES } from '../../src/application/presentation/text-measure.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import { NATAL_QI_ROLES } from '../../src/application/ports/fufire-gateway.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { CHART_TERMINOLOGY, findProhibitedWording, findUnsupportedMethodTerm } from '../../src/application/skill/index.js';
import { DISPLAY_GLYPH_SET, GEOMETRY_CENTIPOINTS, PAGE_FAMILY, findEvidenceChrome } from '../../src/application/visual/index.js';
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

  it('binds the long-form typography that decides every line break', () => {
    expect(templateBinding().typography).toEqual({
      textStyles: TEXT_STYLES,
      lineToleranceCp: LINE_TOLERANCE_CP,
      runningHeadCp: RUNNING_HEAD_CP,
      continuationColumnCp: CONTINUATION_COLUMN_CP,
      cjkIdeographAdvanceEm: CJK_IDEOGRAPH_ADVANCE_EM,
      fontMetricsStructuralHash: structuralHash(FONT_METRICS),
    });
  });

  it('classifies every label: Lexicon labels verbatim from their term, terminology labels by the FuFirE value they name', () => {
    const sources = new Set<string>();
    for (const [id, entry] of Object.entries(TEMPLATE_LABELS)) {
      sources.add(entry.source);
      const lexiconTerm = 'lexiconTerm' in entry ? entry.lexiconTerm : undefined;
      const fufireValue = 'fufireValue' in entry ? entry.fufireValue : undefined;
      if (entry.source === 'template') {
        expect(lexiconTerm, id).toBeUndefined();
        expect(fufireValue, id).toBeUndefined();
        continue;
      }
      if (entry.source === 'terminology') {
        expect(lexiconTerm, id).toBeUndefined();
        // The HoroscopeModel field the label names, and one value of FuFirE's Qi-role enum.
        const match = /^natal\.pillars\[\]\.hiddenStems\[\]\.qi = (.+)$/u.exec(fufireValue ?? '');
        expect(match, id).not.toBeNull();
        expect(NATAL_QI_ROLES as readonly string[], id).toContain(match?.[1]);
        continue;
      }
      expect(fufireValue, id).toBeUndefined();
      const term = CHART_TERMINOLOGY.find((candidate) => candidate.term === lexiconTerm);
      expect(term, `${id}: Lexicon term ${String(lexiconTerm)}`).toBeDefined();
      expect(term?.customerDe, id).toContain(entry.text);
    }
    expect([...sources].sort()).toEqual(['lexicon', 'template', 'terminology']);
    const terminology = Object.entries(TEMPLATE_LABELS).filter(([, entry]) => entry.source === 'terminology').map(([id]) => id);
    expect(terminology).toEqual(['qiPrincipal', 'qiCentral', 'qiResidual']);
    const named = terminology.map((id) => (TEMPLATE_LABELS[id as keyof typeof TEMPLATE_LABELS] as { fufireValue?: string }).fufireValue?.split(' = ')[1]);
    expect(named).toEqual([...NATAL_QI_ROLES]);
  });

  it('carries no label that is prohibited wording, a deferred method or evidence chrome', () => {
    for (const [id, entry] of Object.entries(TEMPLATE_LABELS)) {
      expect(findProhibitedWording(entry.text), id).toBeNull();
      expect(findUnsupportedMethodTerm(entry.text), id).toBeNull();
      expect(findEvidenceChrome(entry.text), id).toEqual([]);
    }
  });

  it('prints every label as a string of its own, except the three composed forms and the one conditional caption', () => {
    load();
    const composed: Readonly<Record<string, readonly string[]>> = {
      chapter: ['KAPITEL 01', 'KAPITEL 07'],
      continued: ['KAPITEL 01 · FORTSETZUNG'],
      dataNoteSeeMethod: ['Siehe Methodenhinweis, Seite 29'],
    };
    const conditional = new Set(['wuXingZeroIsZero']);
    for (const [id, entry] of Object.entries(TEMPLATE_LABELS)) {
      const forms = composed[id];
      if (forms !== undefined) {
        for (const form of forms) expect(projection.customerStrings, `${id} as "${form}"`).toContain(form);
        expect(projection.customerStrings, `${id} is never printed bare`).not.toContain(entry.text);
        continue;
      }
      if (conditional.has(id)) {
        expect(projection.customerStrings, `${id} is printed only when a phase is 0`).not.toContain(entry.text);
        continue;
      }
      expect(projection.customerStrings, `${id} is printed as "${entry.text}"`).toContain(entry.text);
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

  it('prints no identifier or classification value: relation codes, Lexicon families, phases, roles, kinds', () => {
    // An independent list of the fields that identify, classify, position or colour - never printed.
    const identifying = new Set(['kind', 'phase', 'polarity', 'position', 'code', 'familyId', 'qiRole', 'template', 'mark', 'marks', 'transformId', 'zeroPhases', 'blockId', 'styleId', 'tagKind']);
    const values = new Set<string>();
    const walk = (value: unknown, key: string | null): void => {
      if (typeof value === 'string') {
        if (key !== null && identifying.has(key) && value !== '') values.add(value);
        return;
      }
      if (Array.isArray(value)) {
        for (const entry of value) walk(entry, key);
        return;
      }
      if (typeof value === 'object' && value !== null) for (const [child, entry] of Object.entries(value)) walk(entry, child);
    };
    walk(projection.pages, null);
    for (const expected of ['RobWealth', 'PEER', 'metal', 'principal', 'tenGods', 'opener']) expect(values, expected).toContain(expected);
    for (const page of projection.pages) {
      const printed = page.strings.filter((text) => values.has(text));
      expect(printed, page.pageId).toEqual([]);
    }
  });

  it('places the reference panel on a short final chapter page only, below its text and instead of the sidebar', () => {
    let panels = 0;
    const chapters = new Set(projection.pages.flatMap((page) => (page.content.kind === 'longForm' ? [page.content.chapterNumber] : [])));
    for (const chapterNumber of chapters) {
      const pages = projection.pages.flatMap((page) => (page.content.kind === 'longForm' && page.content.chapterNumber === chapterNumber ? [page.content] : []));
      pages.forEach((page, index) => {
        const bottom = Math.max(...page.fragments.map((fragment) => fragment.topCp + fragment.heightCp));
        const fill = (bottom - GEOMETRY_CENTIPOINTS.marginTop) / GEOMETRY_CENTIPOINTS.contentH;
        const shortFinal = index === pages.length - 1 && fill < 0.6;
        expect(page.referencePanel !== null, `chapter ${String(chapterNumber)} page ${String(page.chapterPage)} fill ${fill.toFixed(3)}`).toBe(shortFinal);
        if (page.referencePanel !== null) {
          panels += 1;
          expect(page.sidebar).toBeNull();
          expect(page.referencePanel.yCp).toBeGreaterThan(bottom);
        }
      });
    }
    expect(panels).toBeGreaterThan(0);
  });

  it('derives the contents from its own pages and points the data note at the method page, which carries it', () => {
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
    expect(contentOf('methodNote').dataNote).toEqual({ label: 'Datenhinweis', text: 'Zu diesem Chart liegt ein Datenhinweis der Chart-Berechnung vor.' });
  });

  it('carries no data note when the chart has no source warning', () => {
    const quiet = buildPresentationProjection({ model: { ...model, sourceWarnings: [] }, content });
    const method = quiet.pages.find((page) => page.content.kind === 'methodNote')?.content;
    expect(method?.kind === 'methodNote' ? method.dataNote : 'missing').toBeNull();
    const identity = quiet.pages.find((page) => page.content.kind === 'identity')?.content;
    expect(identity?.kind === 'identity' ? identity.rows.map((row) => row.label) : []).not.toContain('Datenhinweis');
    expect(quiet.customerStrings).not.toContain('Datenhinweis');
  });

  it('prints the zero caption only when a phase is 0', () => {
    expect(contentOf('wuXing').captions).toEqual([TEMPLATE_LABELS.wuXingValuesAsSupplied.text]);
    const zero = buildPresentationProjection({ model: { ...model, wuxing: { ...model.wuxing, vector: { ...model.wuxing.vector, Holz: 0 } } }, content });
    const wuXing = zero.pages.find((page) => page.content.kind === 'wuXing')?.content;
    expect(wuXing?.kind === 'wuXing' ? wuXing.captions : []).toEqual([TEMPLATE_LABELS.wuXingValuesAsSupplied.text, TEMPLATE_LABELS.wuXingZeroIsZero.text]);
    expect(zero.customerStrings).toContain(TEMPLATE_LABELS.wuXingZeroIsZero.text);
  });

  it('gives every page exactly the strings it prints, and the inventory is their union', () => {
    const internal = new Set(projection.pages.flatMap((page) => [page.pageId, page.contractPageId, page.family, ...page.slots]));
    for (const page of projection.pages) {
      expect([...page.strings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), page.pageId).toEqual(page.strings);
      expect(new Set(page.strings).size, page.pageId).toBe(page.strings.length);
      for (const text of page.strings) expect(internal.has(text), `${page.pageId}: "${text}" is an identifier`).toBe(false);
      for (const mark of ['stem', 'hidden', 'both']) expect(page.strings, page.pageId).not.toContain(mark);
      if (page.chrome === null) {
        // Cover and closing carry no running chrome; only the closing page prints its number.
        if (page.content.kind === 'closing') expect(page.strings, page.pageId).toContain(page.pageLabel);
        else expect(page.strings, page.pageId).not.toContain(page.pageLabel);
      } else {
        expect(page.strings, page.pageId).toContain(page.pageLabel);
        expect(page.strings, page.pageId).toContain(page.chrome.footer[0]);
        expect(page.strings, page.pageId).toContain(page.chrome.displayName);
      }
    }
    const closing = contentOf('closing');
    expect(closing.pageNumberLabel).toBe('28');
    const union = [...new Set(projection.pages.flatMap((page) => page.strings))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(projection.customerStrings).toEqual(union);
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
      expect(pillar.hidden.map((hidden) => [hidden.character, hidden.phase])).toEqual(natal.hiddenStems.map((hidden) => [hidden.stemCn, hidden.element]));
      expect(pillar.tenGod?.code ?? null).toBe(natal.tenGod?.name ?? null);
      expect(pillar.tenGod?.code ?? null).toBe(factValue(`chart.natal.pillar.${pillar.position}.tenGod`) ?? null);
      expect(pillar.isDayMaster).toBe(pillar.position === 'day');
    }
  });

  it('shows every hidden stem, its Qi role and its Ten-God relation as the natal chart and the Skill fact set state them', () => {
    const rows = contentOf('hiddenStems').rows;
    expect(rows).toHaveLength(4);
    let compared = 0;
    rows.forEach((row, index) => {
      const position = (['year', 'month', 'day', 'hour'] as const)[index] as 'year' | 'month' | 'day' | 'hour';
      const natal = model.natal.pillars[position];
      expect(row.hidden).toHaveLength(natal.hiddenStems.length);
      row.hidden.forEach((hidden, at) => {
        const fact = natal.hiddenStems[at];
        const prefix = `chart.natal.pillar.${position}.hiddenStem.${String(at)}`;
        expect(hidden.character).toBe(fact?.stemCn);
        expect(hidden.phase).toBe(fact?.element);
        expect(hidden.phase).toBe(factValue(`${prefix}.element`));
        expect(hidden.qiRole).toBe(fact?.qi);
        expect(hidden.qiRole).toBe(factValue(`${prefix}.qi`));
        expect(hidden.tenGod.code).toBe(fact?.tenGod.name);
        expect(hidden.tenGod.code).toBe(factValue(`${prefix}.tenGod`));
        compared += 1;
      });
    });
    expect(compared).toBe(9);
  });

  it('checks the Day Master against the natal answer, not against a copy of itself', () => {
    const dm = contentOf('dayMaster').dayMaster;
    expect(dm.character).toBe(model.natal.dayMaster.stemCn);
    expect(dm.phase).toBe(model.natal.dayMaster.element);
    expect(dm.polarity).toBe(model.natal.dayMaster.polarity);
    expect(dm.character).toBe(factValue('chart.dayMaster.stemHanzi'));
    expect(dm.pinyin).toBe(factValue('chart.dayMaster.stemPinyin'));
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
    expect(JSON.stringify(projection.pages)).not.toMatch(/"dominan/iu);
    for (const text of projection.customerStrings) expect(text, text).not.toMatch(/dominan/iu);
  });

  it('names every Ten-God relation with the Lexicon Hanzi, pinyin and German wording, and marks all four presence states', () => {
    const tenGods = contentOf('tenGods');
    expect(tenGods.rows).toHaveLength(10);
    expect(pillars[0]?.tenGod).toEqual({ code: 'RobWealth', hanzi: '劫财', pinyin: 'Jié Cái' });
    const rob = tenGods.rows.find((row) => row.tenGod.hanzi === '劫财')?.tenGod;
    expect(rob).toMatchObject({ familyId: 'PEER', customerLabel: 'wettbewerbliche Peer-Dynamik; Spannung um gemeinsamen Raum/Ressourcen' });
    const marks = Object.fromEntries(tenGods.rows.map((row) => [row.tenGod.hanzi, row.marks]));
    expect(marks['劫财']).toEqual(['stem', null, null, null]);
    expect(marks['伤官']).toEqual([null, 'stem', 'hidden', null]);
    expect(marks['七杀']).toEqual(['hidden', 'hidden', null, 'hidden']);
    expect(marks['偏财']).toEqual([null, null, null, 'both']);
    expect(marks['偏印']).toEqual(['hidden', 'hidden', null, 'hidden']);
    expect(marks['正财']).toEqual([null, null, 'hidden', null]);
    expect(tenGods.legend.map((entry) => entry.mark)).toEqual(['stem', 'hidden', 'both', null]);
    expect(tenGods.legend.find((entry) => entry.mark === 'both')?.label).toBe('Sichtbar und verborgen');
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
