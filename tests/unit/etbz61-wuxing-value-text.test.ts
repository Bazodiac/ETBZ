/**
 * ETBZ-61 — a Wu Xing weight is printed without binary floating-point noise, and never rounded beyond it (PO decision
 * D-54-2, Jira ETBZ-54 comment 17123).
 *
 * The defect is the producer's: a weight that is a floating-point sum arrives with its representation noise (a sum
 * such as 0.1 + 0.2 arrives as 0.30000000000000004), and the projection printed it with `String(value)` - seventeen
 * significant digits that overflow the distribution page (renderer PAGE_QA: OUTSIDE_SHEET, CLIPPED_BY_ANCESTOR). The
 * values below are synthetic sums; the template, its label "Werte wie geliefert", `value` and `ratio` are unchanged.
 */
import { describe, expect, it } from 'vitest';
import {
  PresentationError,
  TEMPLATE_LABELS,
  WUXING_VALUE_NOISE,
  assertWuXingValueText,
  buildPresentationProjection,
  wuXingValueText,
} from '../../src/application/presentation/index.js';
import { presentationContent } from '../support/presentationFixture.js';
import { knownTimeChart } from '../support/narrativeFixture.js';

const codeOf = (action: () => unknown): string => {
  try {
    action();
    return 'ACCEPTED';
  } catch (error) {
    if (error instanceof PresentationError) return error.code;
    throw error;
  }
};

/** The printed text, or the refusal code: a refusal must fail the assertion, not error the test. */
const textOf = (value: number): string => {
  let text = '';
  const code = codeOf(() => { text = wuXingValueText(value, 'test'); });
  return code === 'ACCEPTED' ? text : code;
};

/** Every `valueText` a page prints, with the phase it names. */
function printedValues(content: unknown): { phase: string; valueText: string }[] {
  const out: { phase: string; valueText: string }[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) for (const child of node) walk(child);
    else if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if (typeof record['valueText'] === 'string' && typeof record['phase'] === 'string') out.push({ phase: record['phase'], valueText: record['valueText'] });
      for (const child of Object.values(record)) walk(child);
    }
  };
  walk(content);
  return out;
}

describe('ETBZ-61: the printed text of a Wu Xing weight', () => {
  it('drops the representation noise of a floating-point sum', () => {
    const sums: [number, string][] = [
      [0.1 + 0.2, '0.3'],
      [0.1 * 12, '1.2'],
      [0.1 + 0.7, '0.8'],
      [1.1 * 3, '3.3'],
      [0.7 + 0.6 + 0.4, '1.7'],
    ];
    for (const [value, expected] of sums) {
      expect(String(value), 'the input carries noise').not.toBe(expected);
      expect(textOf(value), String(value)).toBe(expected);
    }
  });

  it('prints a weight without noise exactly as String(value), real decimals included', () => {
    for (const value of [1.8, 2.5, 2, 0, 4.5, 0.125, 1.005, 2.675, 12.345, 0.0625]) {
      expect(textOf(value), String(value)).toBe(String(value));
    }
  });

  it('keeps every real digit near the bound, small values and fourteen-digit decimals included', () => {
    for (const value of [1.0000001, 0.123456789012, 9.00000000001, 3.7e-13, 1.2345678901234, 0.000012345678901234, 98765.432109876]) {
      expect(textOf(value), String(value)).toBe(String(value));
    }
  });

  it('prints every sum of short decimals as its exact decimal (deterministic sweep)', () => {
    const units = [1, 2, 3, 5, 7, 10, 15, 25, 30, 50];
    let seed = 2026;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let noisy = 0;
    for (let i = 0; i < 20000; i += 1) {
      let sum = 0;
      let hundredths = 0;
      const terms = 2 + Math.floor(next() * 14);
      for (let j = 0; j < terms; j += 1) {
        const unit = units[Math.floor(next() * units.length)] ?? 1;
        const tenths = next() < 0.5;
        sum += unit / (tenths ? 10 : 100);
        hundredths += tenths ? unit * 10 : unit;
      }
      const exact = String(hundredths / 100);
      if (String(sum) !== exact) noisy += 1;
      expect(textOf(sum), String(sum)).toBe(exact);
    }
    expect(noisy, 'the sweep must contain noisy sums').toBeGreaterThan(1000);
  });

  it('refuses a printed text further from the delivered value than representation noise', () => {
    expect(codeOf(() => { assertWuXingValueText(2.25, '2.3', 'test'); })).toBe('PRESENTATION_FACT_MISMATCH');
    expect(codeOf(() => { assertWuXingValueText(1.005, '1', 'test'); })).toBe('PRESENTATION_FACT_MISMATCH');
    expect(codeOf(() => { assertWuXingValueText(2, 'zwei', 'test'); })).toBe('PRESENTATION_FACT_MISMATCH');
    expect(codeOf(() => { assertWuXingValueText(0.1 + 0.2, '0.3', 'test'); })).toBe('ACCEPTED');
    expect(codeOf(() => { assertWuXingValueText(3.7e-13, '4e-13', 'test'); })).toBe('PRESENTATION_FACT_MISMATCH');
    expect(codeOf(() => { assertWuXingValueText(2.5, '2.5', 'test'); })).toBe('ACCEPTED');
  });

  it('refuses a text that is not the canonical text of its number', () => {
    for (const [value, text] of [[0, ''], [2, ' 2 '], [2, '0x2'], [2, '2e0'], [2, '2.0'], [0.5, '.5']] as const) {
      expect(codeOf(() => { assertWuXingValueText(value, text, 'test'); }), JSON.stringify(text)).toBe('PRESENTATION_FACT_MISMATCH');
    }
  });

  it('bounds the noise relative to the value, at sixteen units in the last place', () => {
    expect(WUXING_VALUE_NOISE).toBe(2 ** -48);
    expect(Math.abs(0.1 + 0.2 - 0.3)).toBeLessThan(WUXING_VALUE_NOISE * 0.3);
  });
});

describe('ETBZ-61: the projection prints the weights without noise and changes nothing else', () => {
  const model = knownTimeChart().model;
  const content = presentationContent();
  const noisy: Readonly<Record<string, number>> = { ...model.wuxing.vector, Holz: 0.1 * 12, Wasser: 0.1 + 0.2 };
  const projection = buildPresentationProjection({ model: { ...model, wuxing: { ...model.wuxing, vector: noisy } }, content });

  it('prints the noise-free text on every page that shows a weight', () => {
    const pages = projection.pages.filter((page) => ['glance', 'wuXing', 'summary'].includes(page.content.kind));
    expect(pages.map((page) => page.content.kind).sort()).toEqual(['glance', 'summary', 'wuXing']);
    for (const page of pages) {
      const printed = printedValues(page.content);
      expect(printed.length, page.pageId).toBe(5);
      expect(printed.find((entry) => entry.phase === 'wood')?.valueText, page.pageId).toBe('1.2');
      expect(printed.find((entry) => entry.phase === 'water')?.valueText, page.pageId).toBe('0.3');
    }
    for (const text of projection.customerStrings) expect(text, text).not.toMatch(/\d\.\d{6,}/u);
  });

  it('keeps the delivered value, the ratio and the caption', () => {
    const wuXing = projection.pages.find((page) => page.content.kind === 'wuXing')?.content;
    if (wuXing?.kind !== 'wuXing') throw new Error('no Wu Xing page');
    const max = Math.max(...Object.values(noisy));
    for (const entry of wuXing.wuXing.phases) {
      expect(entry.value).toBe(noisy[entry.label]);
      expect(entry.ratio).toBe(entry.value / max);
    }
    expect(wuXing.captions).toEqual([TEMPLATE_LABELS.wuXingValuesAsSupplied.text]);
  });
});
