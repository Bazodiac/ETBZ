/**
 * ETBZ-55 — the TypeScript paginator is the canonical ETBZ-49 paginator.
 *
 * `assets/visual-system-v1/longform/pagination-report.json` records the layout
 * the canonical (Python) build measured for its two long-form fixtures: every
 * page, fragment and line with its text, x, baseline and width. The port must
 * reproduce both, line for line, from the recovered fixtures and the committed
 * Inter binaries - otherwise "the same content yields the same page-break
 * structure" would be a claim about a different algorithm.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CJK_IDEOGRAPH_ADVANCE_EM,
  FONT_METRICS,
  LINE_TOLERANCE_CP,
  headerHeight,
  paginateLongForm,
  roundHalfEven,
  textWidth,
  wrap,
} from '../../src/application/presentation/index.js';
import type { LongFormBlock, LongFormHeaderBlock } from '../../src/application/presentation/index.js';

const LONGFORM = resolve(process.cwd(), 'assets/visual-system-v1/longform');
const read = (name: string): unknown => JSON.parse(readFileSync(resolve(LONGFORM, name), 'utf8')) as unknown;

interface Fixture {
  readonly fixtureId: string;
  readonly header: readonly LongFormHeaderBlock[];
  readonly blocks: readonly LongFormBlock[];
}
interface ReportFixture {
  readonly fixtureId: string;
  readonly wordCount: number;
  readonly pages: number;
  readonly lines: number;
  readonly layout: Record<string, unknown>;
}

const report = read('pagination-report.json') as { fixtures: readonly ReportFixture[] };

describe('ETBZ-55: the port reproduces the canonical pagination', () => {
  it.each([
    ['fixture-customer-chapter.json', 'bazodiac-final/fixture/long-form/general-education-chapter-v1'],
    ['fixture-v6-677.json', 'etbz43/fixture/long-form/pagination-stress-v1'],
  ])('lays out %s exactly as the canonical build measured it', (file, fixtureId) => {
    const fixture = read(file) as Fixture;
    const expected = report.fixtures.find((entry) => entry.fixtureId === fixtureId);
    expect(expected, `the report carries ${fixtureId}`).toBeDefined();
    // A defect that makes the paginator throw must fail an assertion here, not crash the test.
    let layout = undefined as unknown as ReturnType<typeof paginateLongForm>;
    expect(() => {
      layout = paginateLongForm(fixture.blocks, headerHeight(fixture.header));
    }).not.toThrow();
    const { structuralSha256: _hash, ...expectedLayout } = (expected as ReportFixture).layout;
    expect(JSON.parse(JSON.stringify(layout))).toEqual(expectedLayout);
    expect(layout.pages).toHaveLength((expected as ReportFixture).pages);
    expect(layout.lineCount).toBe((expected as ReportFixture).lines);
    expect(layout.wordCount).toBe((expected as ReportFixture).wordCount);
    expect(_hash).toMatch(/^sha256:/u);
  });

  it('pins the canonical per-page line counts of the customer fixture (48, 38, 3)', () => {
    const fixture = read('fixture-customer-chapter.json') as Fixture;
    const layout = paginateLongForm(fixture.blocks, headerHeight(fixture.header));
    expect(layout.pages.map((page) => page.fragments.reduce((sum, fragment) => sum + fragment.lines.length, 0))).toEqual([48, 38, 3]);
    expect(layout.pages.map((page) => page.template)).toEqual(['opener', 'continuation', 'continuation']);
  });
});

interface OracleChapter {
  readonly id: string;
  readonly header: readonly LongFormHeaderBlock[];
  readonly blocks: readonly LongFormBlock[];
  readonly headerHeightCp: number;
  readonly layout: Record<string, unknown>;
}

const oracle = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/support/etbz55-paginator-oracle.json'), 'utf8')) as {
  source: string;
  provenance: Readonly<Record<string, string>>;
  chapters: readonly OracleChapter[];
};

describe('ETBZ-55: the port against the canonical paginator on the branches the fixtures never reach', () => {
  it('carries forty-seven chapters laid out by the canonical ETBZ-49 paginator', () => {
    expect(oracle.source).toContain('tools/visual-proof-harness/build/paginate.py');
    expect(oracle.chapters.map((chapter) => chapter.id.split('-')[0])).toEqual([
      ...Array<string>(9).fill('widow'),
      ...Array<string>(16).fill('subhead'),
      ...Array<string>(6).fill('module'),
      ...Array<string>(12).fill('band'),
      ...Array<string>(4).fill('lead'),
    ]);
  });

  it('was produced from the committed canonical paginator, tokens and Inter faces (their digests re-derived here)', () => {
    expect(Object.keys(oracle.provenance).sort()).toEqual([
      'assets/visual-system-v1/fonts/Inter-Medium.ttf',
      'assets/visual-system-v1/fonts/Inter-Regular.ttf',
      'assets/visual-system-v1/fonts/InterDisplay-Light.ttf',
      'assets/visual-system-v1/fonts/InterDisplay-Regular.ttf',
      'assets/visual-system-v1/tokens.json',
      'tools/visual-proof-harness/build/paginate.py',
    ]);
    for (const [path, digest] of Object.entries(oracle.provenance)) {
      expect(`sha256:${createHash('sha256').update(readFileSync(resolve(process.cwd(), path))).digest('hex')}`, path).toBe(digest);
    }
  });

  it.each(oracle.chapters.map((chapter) => [chapter.id, chapter] as const))('reproduces the canonical layout of %s', (_id, chapter) => {
    expect(headerHeight(chapter.header)).toBe(chapter.headerHeightCp);
    let layout = undefined as unknown as ReturnType<typeof paginateLongForm>;
    expect(() => {
      layout = paginateLongForm(chapter.blocks, chapter.headerHeightCp);
    }).not.toThrow();
    expect(JSON.parse(JSON.stringify(layout))).toEqual(chapter.layout);
  });
});

describe('ETBZ-55: measuring a line', () => {
  it('rounds like Python: nearest, ties to even', () => {
    expect([0.5, 1.5, 2.5, 2.4999, 2.5001, -1.5, -2.5].map(roundHalfEven)).toEqual([0, 2, 2, 2, 3, -2, -2]);
  });

  it('measures with the pinned advances, kerning off, tracking after every character', () => {
    const regular = FONT_METRICS.regular;
    const advanceOf = (character: string): number => {
      const codepoint = character.codePointAt(0) ?? 0;
      for (const [first, advances] of regular.advanceRuns) {
        const advance = advances[codepoint - first];
        if (codepoint >= first && advance !== undefined) return advance;
      }
      throw new Error(`no advance for ${character}`);
    };
    const units = [...'Xin'].reduce((sum, character) => sum + advanceOf(character), 0);
    expect(textWidth('Xin', 'body')).toBe(roundHalfEven((units * 1050) / regular.unitsPerEm));
    expect(textWidth('AB', 'kicker')).toBeGreaterThan(textWidth('AB', 'panelTitle') - 1);
  });

  it('sets a CJK ideograph in running text one em wide', () => {
    expect(CJK_IDEOGRAPH_ADVANCE_EM).toBe(1);
    expect(textWidth('辛', 'body')).toBe(1050);
    expect(textWidth('辛亥', 'body')).toBe(2100);
  });

  it('breaks greedily on single spaces and keeps the tolerance free', () => {
    const measure = 20000;
    const lines = wrap('Dein Chart besteht aus vier Säulen und jede Säule aus einem Stamm und einem Zweig.', 'body', measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(textWidth(line, 'body')).toBeLessThanOrEqual(measure - LINE_TOLERANCE_CP);
    expect(lines.join(' ')).toBe('Dein Chart besteht aus vier Säulen und jede Säule aus einem Stamm und einem Zweig.');
  });

  it('projects exactly the faces the long form sets, from the committed binaries', () => {
    expect(Object.keys(FONT_METRICS).sort()).toEqual(['displayLight', 'medium', 'regular']);
    expect(FONT_METRICS.regular.file).toBe('fonts/Inter-Regular.ttf');
    for (const face of Object.values(FONT_METRICS)) expect(face.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });
});
