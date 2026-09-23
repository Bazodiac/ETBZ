// =============================================================================
// ETBZ-49 positive behaviour of the canonical visual system.
//
// Driven by the recovered chart fixture rather than invented input, because the
// fixture is deliberately MIXED: the year pillar carries a Metal stem over a
// Fire branch over Fire and Earth hidden stems. A whole-column tint would look
// plausible on a uniform chart and is obviously wrong on this one, so the
// fixture is what makes the region-scoping assertion mean something.
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ATMOSPHERIC_COLOR_TOKENS,
  CANONICAL_COLOR_TOKENS,
  CONVERGENCE_SHARES,
  CANONICAL_DECISION_SOURCE,
  DISPLAY_GLYPH_SET,
  HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED,
  LONG_FORM_PAGE_BUDGET,
  LONG_FORM_WORD_BUDGET,
  PAGE_FAMILY,
  PHASES,
  acceptWuXingVector,
  assertCustomerSurfaceClean,
  assertDisplayGlyphIntegrity,
  assertEveryWordPlaced,
  atmosphericColor,
  canonicalColor,
  countWords,
  hasDisplayGlyph,
  listSlotIds,
  presentWuXing,
  resolveDisplayGlyph,
  resolvePhasePaint,
  resolvePillarPaint,
  resolvePillarSelectionPaint,
  resolveSlot,
  resolveVisualComponent,
  validateLongFormPlacement,
} from '../../src/application/visual/index.js';
import type { Phase, PillarFacts } from '../../src/application/visual/index.js';

interface ChartFixture {
  readonly pillars: readonly {
    readonly position: 'year' | 'month' | 'day' | 'hour';
    readonly stem: { readonly ch: string; readonly phase: Phase };
    readonly branch: { readonly ch: string; readonly phase: Phase; readonly animal: string };
    readonly hidden: readonly { readonly ch: string; readonly phase: Phase }[];
  }[];
  readonly wuXing?: Readonly<Record<string, number>>;
}

const CHART: ChartFixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'assets/visual-system-v1/fixtures/chart-fixture.json'),
    'utf8',
  ),
) as ChartFixture;

const CHAPTER: { readonly blocks: readonly { readonly text?: string }[] } = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'assets/visual-system-v1/longform/fixture-customer-chapter.json'),
    'utf8',
  ),
) as { blocks: { text?: string }[] };

// -----------------------------------------------------------------------------

describe('ETBZ-49 P1: the canonical palette resolves', () => {
  it('returns the Confluence hex for every canonical token', () => {
    expect(canonicalColor('paper-000')).toBe('#FBF9F4');
    expect(canonicalColor('ink-900')).toBe('#16181A');
    expect(canonicalColor('gold-500')).toBe('#B2913F');
    expect(canonicalColor('gold-700')).toBe('#7D6425');
  });

  it('resolves both themes for all nineteen', () => {
    for (const token of CANONICAL_COLOR_TOKENS) {
      expect(canonicalColor(token.name, 'light')).toBe(token.value.light);
      expect(canonicalColor(token.name, 'dark')).toBe(token.value.dark);
    }
  });

  it('keeps Metal grey and never gold — the one palette trap of the donor set', () => {
    expect(canonicalColor('phase-metal-mark')).toBe('#6B7376');
    expect(canonicalColor('phase-metal-field')).toBe('#EDEDEC');
    expect(canonicalColor('phase-metal-mark')).not.toBe(canonicalColor('gold-500'));
    expect(canonicalColor('phase-metal-mark')).not.toBe(canonicalColor('gold-700'));
  });

  it('resolves the five decorative tokens through their own accessor', () => {
    for (const token of ATMOSPHERIC_COLOR_TOKENS) {
      expect(atmosphericColor(token.name)).toBe(token.value.light);
    }
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 P2: the twenty-seven display glyphs resolve and stay inside the box', () => {
  it('resolves every glyph by character and by codepoint alike', () => {
    for (const glyph of DISPLAY_GLYPH_SET) {
      expect(resolveDisplayGlyph(glyph.character)).toBe(glyph);
      expect(resolveDisplayGlyph(glyph.codepoint)).toBe(glyph);
      expect(hasDisplayGlyph(glyph.character)).toBe(true);
    }
  });

  it('resolves every stem, branch and Wu Xing character the fixture chart uses', () => {
    for (const pillar of CHART.pillars) {
      expect(resolveDisplayGlyph(pillar.stem.ch).role).toBe('heavenly_stem');
      expect(resolveDisplayGlyph(pillar.branch.ch).role).toBe('earthly_branch');
      for (const hidden of pillar.hidden) {
        expect(resolveDisplayGlyph(hidden.ch).role).toBe('heavenly_stem');
      }
    }
    for (const character of ['木', '火', '土', '金', '水']) {
      expect(resolveDisplayGlyph(character).role).toBe('wu_xing');
    }
  });

  it('passes the clipping check for all twenty-seven, ink margin included', () => {
    for (const glyph of DISPLAY_GLYPH_SET) {
      expect(() => {
        assertDisplayGlyphIntegrity(glyph);
      }).not.toThrow();
    }
  });

  it('separates the branch character from its animal label on every branch', () => {
    const branches = DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'earthly_branch');
    expect(branches).toHaveLength(12);
    for (const branch of branches) {
      expect(branch.animalLabel).not.toBeNull();
      expect(branch.character).not.toBe(branch.animalLabel);
    }
    for (const stem of DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'heavenly_stem')) {
      expect(stem.animalLabel).toBeNull();
      expect(stem.polarity === 'yang' || stem.polarity === 'yin').toBe(true);
    }
  });

  it('tone-marks every pinyin label', () => {
    const untoned = DISPLAY_GLYPH_SET.filter(
      (glyph) => !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(glyph.pinyin),
    );
    expect(untoned.map((glyph) => `${glyph.character} ${glyph.pinyin}`)).toEqual([]);
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 P3: Four Pillars colour is bound to the region, never the column', () => {
  const pillarFacts = (index: number): PillarFacts => {
    const pillar = CHART.pillars[index];
    if (pillar === undefined) throw new Error(`fixture has no pillar ${index}`);
    return {
      position: pillar.position,
      stemPhase: pillar.stem.phase,
      branchPhase: pillar.branch.phase,
      hiddenStemPhases: pillar.hidden.map((hidden) => hidden.phase),
      isDayMaster: pillar.position === 'day',
    };
  };

  it('gives each region of the mixed year pillar its own phase', () => {
    const facts = pillarFacts(0);
    // The fixture's year pillar: Metal stem, Fire branch, Fire + Earth hidden.
    expect(facts.stemPhase).toBe('metal');
    expect(facts.branchPhase).toBe('fire');
    expect(facts.hiddenStemPhases).toEqual(['fire', 'earth']);

    const paint = resolvePillarPaint(facts);
    expect(paint.regions.map((region) => `${region.scope}:${region.field}`)).toEqual([
      'stem:phase-metal-field',
      'branch:phase-fire-field',
      'hiddenStem:phase-fire-field',
      'hiddenStem:phase-earth-field',
    ]);
  });

  it('keeps the pillar container neutral, so no phase spans a column', () => {
    for (let index = 0; index < CHART.pillars.length; index += 1) {
      const paint = resolvePillarPaint(pillarFacts(index));
      expect(['paper-100', 'paper-200']).toContain(paint.container);
      expect(paint.container.startsWith('phase-')).toBe(false);
    }
  });

  it('marks the Day pillar by neutral ground and a gold edge, not by a sixth phase', () => {
    const day = CHART.pillars.findIndex((pillar) => pillar.position === 'day');
    expect(day).toBeGreaterThanOrEqual(0);

    const paint = resolvePillarPaint(pillarFacts(day));
    expect(paint.container).toBe('paper-200');
    expect(paint.selection).toEqual({
      container: 'paper-200',
      edge: 'gold-500',
      edgeWidthMm: 0.35,
      isPhase: false,
    });
    expect(resolvePillarSelectionPaint().isPhase).toBe(false);
  });

  it('leaves every other pillar unselected', () => {
    const selected = CHART.pillars
      .map((_pillar, index) => resolvePillarPaint(pillarFacts(index)))
      .filter((paint) => paint.selection !== null);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.position).toBe('day');
  });

  it('pairs field and mark for every phase and scope', () => {
    for (const scope of ['stem', 'branch', 'hiddenStem'] as const) {
      for (const phase of PHASES) {
        const paint = resolvePhasePaint(scope, phase);
        expect(paint).toEqual({
          scope,
          phase,
          field: `phase-${phase}-field`,
          mark: `phase-${phase}-mark`,
        });
        expect(canonicalColor(paint.field)).toMatch(/^#[0-9A-F]{6}$/);
        expect(canonicalColor(paint.mark)).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 P4: the Wu Xing vector passes through untouched', () => {
  const VECTOR = { wood: 2, fire: 3, earth: 1, metal: 2, water: 0 } as const;

  it('accepts five supplied counts and returns exactly them', () => {
    expect(acceptWuXingVector({ ...VECTOR })).toEqual(VECTOR);
  });

  it('carries the untouched vector alongside the presentation ratios', () => {
    const presentation = presentWuXing({ ...VECTOR });
    expect(presentation.vector).toEqual(VECTOR);
    expect(presentation.transformId).toBe('pt.linear-max-v1');
    expect(presentation.max).toBe(3);
    expect(presentation.ratio).toEqual({
      wood: 2 / 3,
      fire: 1,
      earth: 1 / 3,
      metal: 2 / 3,
      water: 0,
    });
  });

  it('is monotonic: a larger count never gets a shorter bar', () => {
    const presentation = presentWuXing({ ...VECTOR });
    const pairs = PHASES.map((phase) => [VECTOR[phase], presentation.ratio[phase]] as const);
    for (const [countA, ratioA] of pairs) {
      for (const [countB, ratioB] of pairs) {
        if (countA < countB) expect(ratioA).toBeLessThan(ratioB);
        if (countA === countB) expect(ratioA).toBe(ratioB);
      }
    }
  });

  it('reports zero as zero in this distribution, not as a deficiency', () => {
    const presentation = presentWuXing({ ...VECTOR });
    expect(presentation.zeroPhases).toEqual(['water']);
    expect(presentation.ratio.water).toBe(0);
    // All five phases remain present in the output; none is dropped.
    expect(Object.keys(presentation.ratio).sort()).toEqual([...PHASES].sort());
  });

  it('keeps all five visible even when every count is zero', () => {
    const presentation = presentWuXing({ wood: 0, fire: 0, earth: 0, metal: 0, water: 0 });
    expect(presentation.max).toBe(0);
    expect(presentation.zeroPhases).toEqual([...PHASES]);
    expect(Object.values(presentation.ratio)).toEqual([0, 0, 0, 0, 0]);
  });

  it('handles a tie without inventing a winner', () => {
    const presentation = presentWuXing({ wood: 3, fire: 3, earth: 1, metal: 0, water: 1 });
    expect(presentation.ratio.wood).toBe(1);
    expect(presentation.ratio.fire).toBe(1);
    expect(presentation).not.toHaveProperty('dominant');
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 P5: known structures and slots resolve', () => {
  it('resolves every declared component', () => {
    for (const id of [
      'Wordmark',
      'BazodiacDisplayGlyphSet',
      'InformationalCjkText',
      'PhaseField',
      'Pillar',
      'WuXingRing',
      'FivePhaseAnchors',
      'TenGodsMatrix',
      'HiddenStemRows',
      'LongForm',
      'Contents',
      'ChartAtAGlance',
      'Closing',
      'DeveloperProof',
    ]) {
      expect(resolveVisualComponent(id)).toBeDefined();
    }
  });

  it('resolves every slot the page family declares, back to its page', () => {
    for (const page of PAGE_FAMILY) {
      for (const binding of page.bindings) {
        const resolved = resolveSlot(binding.slotId);
        expect(resolved.binding.slotId).toBe(binding.slotId);
      }
    }
    // The three long-form pages share one slot id, so the index is smaller than
    // the binding count. Stating both numbers keeps that intentional, not lost.
    const bindingCount = PAGE_FAMILY.reduce((total, page) => total + page.bindings.length, 0);
    expect(bindingCount).toBe(25);
    expect(listSlotIds()).toHaveLength(23);
  });

  it('exposes the Wu Xing slot as the only one carrying a transform', () => {
    const wuXing = resolveSlot('wuXing.vector');
    expect(wuXing.pageId).toBe('wu-xing-distribution');
    expect(wuXing.binding.presentationTransform).toBe('pt.linear-max-v1');
    expect(wuXing.binding.derives).toEqual([]);
  });

  it('exposes the education page as deriving nothing and personalising nothing', () => {
    const anchors = resolveSlot('education.anchors');
    expect(anchors.binding.consumedFactKinds).toEqual([]);
    expect(anchors.binding.derivedNothing).toBe(true);
    expect(anchors.binding.personalised).toBe(false);
    expect(anchors.binding.relationEdges).toBe('structurally impossible');
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 P6: the long-form contract accepts a real chapter', () => {
  const sourceText = CHAPTER.blocks
    .map((block) => block.text ?? '')
    .filter((text) => text !== '')
    .join(' ');

  it('measures the recovered chapter inside the 600-900 word budget', () => {
    const words = countWords(sourceText);
    expect(words).toBeGreaterThanOrEqual(LONG_FORM_WORD_BUDGET.min);
    expect(words).toBeLessThanOrEqual(LONG_FORM_WORD_BUDGET.max);
  });

  it('accepts a 2-3 page placement with no clipping, overlap or shrink', () => {
    const placement = {
      fixtureId: 'bazodiac-final/fixture/long-form/general-education-chapter-v1',
      wordCount: 749,
      pages: [
        { pageNumber: 1, template: 'opener', lines: Array.from({ length: 48 }, () => 'line') },
        {
          pageNumber: 2,
          template: 'continuation',
          lines: Array.from({ length: 38 }, () => 'line'),
        },
        {
          pageNumber: 3,
          template: 'continuation',
          lines: Array.from({ length: 3 }, () => 'line'),
        },
      ],
    };

    expect(() => {
      validateLongFormPlacement(placement);
    }).not.toThrow();
    expect(placement.pages).toHaveLength(LONG_FORM_PAGE_BUDGET.max);
  });

  it('accepts a placement that carries every word of the source in order', () => {
    const words = sourceText.split(/\s+/).filter((word) => word !== '');
    const half = Math.ceil(words.length / 2);
    const placement = {
      fixtureId: 'unit/every-word',
      wordCount: words.length,
      pages: [
        { pageNumber: 1, template: 'opener', lines: [words.slice(0, half).join(' ')] },
        { pageNumber: 2, template: 'continuation', lines: [words.slice(half).join(' ')] },
      ],
    };

    expect(() => {
      assertEveryWordPlaced(sourceText, placement);
    }).not.toThrow();
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 P7: the customer surface stays free of engineering chrome', () => {
  it('accepts the recovered customer chapter text', () => {
    for (const block of CHAPTER.blocks) {
      if (block.text === undefined) continue;
      expect(() => {
        assertCustomerSurfaceClean(block.text ?? '');
      }).not.toThrow();
    }
  });

  it('accepts ordinary reading prose', () => {
    expect(() => {
      assertCustomerSurfaceClean(
        'The Day Master is the Heavenly Stem of the day pillar. Everything else in the chart is read in relation to it.',
      );
    }).not.toThrow();
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 P8: the canonical decision is recorded, the human gate stays open', () => {
  it('names Confluence 66650114 version 2 as the decision source', () => {
    expect(CANONICAL_DECISION_SOURCE).toEqual({
      system: 'confluence',
      pageId: '66650114',
      version: '2',
      title: 'ETBZ-43 — Bazodiac PDF Visual System Final Convergence v1',
    });
  });

  it('carries the PO convergence shares verbatim', () => {
    expect(CONVERGENCE_SHARES).toEqual({
      V4: 0.35,
      V6: 0.25,
      V3: 0.2,
      V2: 0.12,
      V5: 0.06,
      V1: 0.02,
    });
    const total = Object.values(CONVERGENCE_SHARES).reduce((sum, share) => sum + share, 0);
    expect(Math.round(total * 100)).toBe(100);
  });

  it('leaves the glyph-style approval OPEN — nothing in this repository closes it', () => {
    expect(HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED).toBe('OPEN');
  });
});
