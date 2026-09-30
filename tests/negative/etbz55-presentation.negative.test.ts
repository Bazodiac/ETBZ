/**
 * ETBZ-55 — the refusals of the PresentationProjection.
 *
 * Pattern: the valid fixture (D4 chart + ETBZ-52 German payload) is the green
 * baseline; each test changes as little of a deep copy as its refusal needs.
 * A refusal the ETBZ-49 visual contract owns surfaces as `VisualContractError`;
 * every other one is a `PresentationError` with its code. Nothing partial is
 * returned.
 */
import { describe, expect, it } from 'vitest';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import {
  PresentationError,
  assertReleasedTemplate,
  buildPresentationProjection,
  ceilToBaseline,
  paginateLongForm,
  templateBinding,
} from '../../src/application/presentation/index.js';
import type { PresentationErrorCode } from '../../src/application/presentation/index.js';
import { VisualContractError } from '../../src/application/visual/index.js';
import type { VisualContractErrorCode } from '../../src/application/visual/index.js';
import { presentationFixture } from '../support/presentationFixture.js';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
type Content = { title: string; chapters: { title: string; paragraphs: string[] }[]; reflectionQuestions: string[]; methodNote: string };

const fixture = presentationFixture();

function modelWith(edit: (model: Mutable<HoroscopeModel>) => void): HoroscopeModel {
  const copy = structuredClone(fixture.model) as Mutable<HoroscopeModel>;
  edit(copy);
  return copy;
}

function contentWith(edit: (content: Content) => void): unknown {
  const copy = structuredClone(fixture.content) as Content;
  edit(copy);
  return copy;
}

function thrown(action: () => unknown): unknown {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  return caught;
}

function expectPresentationRefusal(action: () => unknown, code: PresentationErrorCode): PresentationError {
  const caught = thrown(action);
  expect(caught, 'expected a PresentationError').toBeInstanceOf(PresentationError);
  expect((caught as PresentationError).code).toBe(code);
  return caught as PresentationError;
}

function expectVisualRefusal(action: () => unknown, code: VisualContractErrorCode): VisualContractError {
  const caught = thrown(action);
  expect(caught, 'expected a VisualContractError').toBeInstanceOf(VisualContractError);
  expect((caught as VisualContractError).code).toBe(code);
  return caught as VisualContractError;
}

const project = (model: HoroscopeModel, content: unknown = fixture.content) => buildPresentationProjection({ model, content });

describe('N0: the baseline is green', () => {
  it('projects the fixture', () => {
    expect(project(fixture.model).pageCount).toBe(29);
  });
});

describe('N1: the content payload', () => {
  it('refuses a missing title, an extra key and an empty chapter list', () => {
    expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { delete (c as Partial<Content>).title; })), 'PRESENTATION_INPUT_INVALID');
    expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { (c as Record<string, unknown>)['layout'] = 'wide'; })), 'PRESENTATION_INPUT_INVALID');
    expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.chapters = []; })), 'PRESENTATION_INPUT_INVALID');
  });

  it('refuses text the layout would have to normalise: a double space, a newline, a leading space', () => {
    const refusal = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.chapters[0]!.paragraphs[0] += '  Ende.'; })), 'PRESENTATION_INPUT_INVALID');
    expect(refusal.detail).toEqual({ path: 'chapters.0.paragraphs.0' });
    expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.reflectionQuestions[0] = 'Eine\nFrage?'; })), 'PRESENTATION_INPUT_INVALID');
    expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.methodNote = ` ${c.methodNote}`; })), 'PRESENTATION_INPUT_INVALID');
  });

  it('refuses a control or format character anywhere in the payload: a bell, a zero-width space, a soft hyphen, a bidi override, a byte-order mark, a lone surrogate, a private-use, unassigned or default-ignorable character', () => {
    // A bell, a zero-width space, a soft hyphen, a bidi override, a byte-order mark, NEL, a line separator,
    // a lone surrogate, a Hangul filler, a variation selector, a private-use character and an unassigned code point.
    const invisible = [0x0007, 0x200b, 0x00ad, 0x202e, 0xfeff, 0x0085, 0x2028, 0xd800, 0x3164, 0xfe0f, 0xe000, 0x0378].map((codepoint) => String.fromCodePoint(codepoint));
    for (const character of invisible) {
      const at = `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
      const title = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.title = `Dein${character}Reading`; })), 'PRESENTATION_INPUT_INVALID');
      expect(title.detail, at).toEqual({ path: 'title' });
      const question = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.reflectionQuestions[0] += character; })), 'PRESENTATION_INPUT_INVALID');
      expect(question.detail, at).toEqual({ path: 'reflectionQuestions.0' });
      const method = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.methodNote = `${character}${c.methodNote}`; })), 'PRESENTATION_INPUT_INVALID');
      expect(method.detail, at).toEqual({ path: 'methodNote' });
      const paragraph = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.chapters[3]!.paragraphs[0] = c.chapters[3]!.paragraphs[0]!.replace(' ', `${character} `); })), 'PRESENTATION_INPUT_INVALID');
      expect(paragraph.detail, at).toEqual({ path: 'chapters.3.paragraphs.0' });
    }
  });

  it('refuses a character outside the pinned Inter advance tables (and not a CJK ideograph) in the texts the long form does not measure: a Braille blank, a decomposed umlaut, an emoji', () => {
    const unmeasurable = [String.fromCodePoint(0x2800), `a${String.fromCodePoint(0x0308)}`, String.fromCodePoint(0x1f469)];
    for (const text of unmeasurable) {
      const title = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.title = `Dein ${text} Reading`; })), 'PRESENTATION_TEXT_UNMEASURABLE');
      expect(title.detail).toMatchObject({ where: 'title' });
      const question = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.reflectionQuestions[1] = `Frage ${text}?`; })), 'PRESENTATION_TEXT_UNMEASURABLE');
      expect(question.detail).toMatchObject({ where: 'reflectionQuestions.1' });
      const method = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.methodNote = `${c.methodNote} ${text}`; })), 'PRESENTATION_TEXT_UNMEASURABLE');
      expect(method.detail).toMatchObject({ where: 'methodNote' });
      const name = expectPresentationRefusal(() => project(modelWith((m) => { m.displayName = `Musterkundin ${text}`; })), 'PRESENTATION_TEXT_UNMEASURABLE');
      expect(name.detail).toMatchObject({ where: 'displayName' });
    }
  });

  it('refuses an animal label the Sizhu table does not give the branch (a hand-built model): another branch\'s animal, an animal of no branch, Cyrillic, an emoji', () => {
    // The day branch is 亥 (Schwein): the rat belongs to 子, the horse to this chart's year and month branch 午.
    for (const text of ['Ratte', 'Pferd', 'Einhorn', String.fromCodePoint(0x0416), String.fromCodePoint(0x1f40e)]) {
      const refusal = expectPresentationRefusal(() => project(modelWith((m) => { m.pillars.day.tierDe = text; })), 'PRESENTATION_FACT_MISMATCH');
      expect(refusal.detail).toMatchObject({ where: 'pillars.day' });
    }
  });

  it('refuses a padded or empty display name', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { m.displayName = ' Musterkundin A'; })), 'PRESENTATION_INPUT_INVALID');
    expectPresentationRefusal(() => project(modelWith((m) => { m.displayName = ''; })), 'PRESENTATION_INPUT_INVALID');
  });

  it('holds the display name - printed on every page - to the payload rule: no forbidden character, no double space', () => {
    for (const codepoint of [0x202e, 0x200b, 0x00ad, 0x00a0, 0xd800]) {
      const name = `Muster${String.fromCodePoint(codepoint)}kundin A`;
      expectPresentationRefusal(() => project(modelWith((m) => { m.displayName = name; })), 'PRESENTATION_INPUT_INVALID');
    }
    expectPresentationRefusal(() => project(modelWith((m) => { m.displayName = 'Musterkundin  A'; })), 'PRESENTATION_INPUT_INVALID');
  });
});

describe('N2: time', () => {
  it('refuses an unknown or provisional birth time rather than rendering a guess', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { m.birth.birthTimeKnown = false; })), 'PRESENTATION_UNKNOWN_TIME_UNSUPPORTED');
    expectPresentationRefusal(() => project(modelWith((m) => { m.precision.provisionalFields = ['hour']; })), 'PRESENTATION_UNKNOWN_TIME_UNSUPPORTED');
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.precision.birthTimeKnown = false; })), 'PRESENTATION_UNKNOWN_TIME_UNSUPPORTED');
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.precision.provisionalFields = ['hour']; })), 'PRESENTATION_UNKNOWN_TIME_UNSUPPORTED');
    expectPresentationRefusal(() => project(modelWith((m) => { m.wuxing.precision.birthTimeKnown = false; })), 'PRESENTATION_UNKNOWN_TIME_UNSUPPORTED');
    const wuxing = expectPresentationRefusal(() => project(modelWith((m) => { m.wuxing.precision.provisionalFields = ['hour']; })), 'PRESENTATION_UNKNOWN_TIME_UNSUPPORTED');
    expect(wuxing.detail).toEqual({ provisionalFields: ['hour'] });
  });
});

describe('N3: chart values that disagree', () => {
  it('refuses a stem phase the glyph contract does not give that character', () => {
    const refusal = expectPresentationRefusal(() => project(modelWith((m) => { m.pillars.year.stemElementDe = 'Holz'; m.natal.pillars.year.stemElement = 'wood'; })), 'PRESENTATION_FACT_MISMATCH');
    expect(refusal.detail).toMatchObject({ where: 'pillars.year.stem', character: '庚', chart: 'wood', glyph: 'metal' });
  });

  it('refuses a stem element that differs between the BaZi and natal answers', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.month.stemElement = 'fire'; })), 'PRESENTATION_FACT_MISMATCH');
  });

  it('refuses a branch phase, a hidden-stem phase, a polarity or a pinyin the glyph contract contradicts', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.day.branchElement = 'fire'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { (m.natal.pillars.hour.hiddenStems[0] as { element: string }).element = 'water'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.year.polarity = 'yin'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { m.pillars.year.stemPinyin = 'geng'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { m.pillars.year.branchPinyin = 'wu'; })), 'PRESENTATION_FACT_MISMATCH');
  });

  it('refuses a pillar whose BaZi and natal characters differ, and a Day Master that is not the day stem', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.hour.branchCn = '申'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.year.stemCn = '辛'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { m.dayMaster.stemHanzi = '庚'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { m.dayMaster.stemPinyin = 'xin'; })), 'PRESENTATION_FACT_MISMATCH');
    expectPresentationRefusal(() => project(modelWith((m) => { m.dayMaster.elementDe = 'Wasser'; })), 'PRESENTATION_FACT_MISMATCH');
  });

  it('refuses a natal Day Master that differs from the day stem in character, element or polarity', () => {
    const character = expectPresentationRefusal(() => project(modelWith((m) => { m.natal.dayMaster.stemCn = '庚'; })), 'PRESENTATION_FACT_MISMATCH');
    expect(character.message).toContain('natal Day Master is not the stem');
    const element = expectPresentationRefusal(() => project(modelWith((m) => { m.natal.dayMaster.element = 'water'; })), 'PRESENTATION_FACT_MISMATCH');
    expect(element.message).toContain('natal Day Master element');
    const polarity = expectPresentationRefusal(() => project(modelWith((m) => { m.natal.dayMaster.polarity = 'yang'; })), 'PRESENTATION_FACT_MISMATCH');
    expect(polarity.message).toContain('natal Day Master polarity');
  });

  it('refuses a hidden stem the Sizhu table spells differently from the glyph contract', () => {
    const refusal = expectPresentationRefusal(() => project(modelWith((m) => { (m.natal.pillars.day.hiddenStems[0] as { stem: string }).stem = 'Jia'; })), 'PRESENTATION_FACT_MISMATCH');
    expect(refusal.detail).toEqual({ where: 'pillars.day.hiddenStems[0]' });
  });

  it('refuses a day pillar that carries a relation to itself', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.day.tenGod = m.natal.pillars.year.tenGod; })), 'PRESENTATION_FACT_MISMATCH');
  });
});

describe('N4: chart values that are missing', () => {
  it('refuses a pillar without hidden stems, a visible stem without its relation, and a branch without its animal', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.month.hiddenStems = []; })), 'PRESENTATION_FACT_MISSING');
    const four = expectPresentationRefusal(
      () => project(modelWith((m) => { m.natal.pillars.hour.hiddenStems = [...m.natal.pillars.hour.hiddenStems, m.natal.pillars.hour.hiddenStems[0]!]; })),
      'PRESENTATION_FACT_MISSING',
    );
    expect(four.message).toContain('at most three exist');
    expectPresentationRefusal(() => project(modelWith((m) => { m.natal.pillars.hour.tenGod = null; })), 'PRESENTATION_FACT_MISSING');
    expectPresentationRefusal(() => project(modelWith((m) => { m.pillars.day.tierDe = ' '; })), 'PRESENTATION_FACT_MISSING');
  });

  it('refuses a Wu Xing distribution of four phases and an element label the vocabulary does not know', () => {
    expectPresentationRefusal(() => project(modelWith((m) => { delete (m.wuxing.vector as Record<string, number>)['Holz']; })), 'PRESENTATION_FACT_MISSING');
    expectPresentationRefusal(() => project(modelWith((m) => { m.pillars.day.stemElementDe = 'Luft'; })), 'PRESENTATION_FACT_MISSING');
  });
});

describe('N5: bindings to the released contracts', () => {
  it('refuses a Ten-God relation the Lexicon does not carry', () => {
    const refusal = expectPresentationRefusal(
      () => project(modelWith((m) => { (m.natal.pillars.year.tenGod as { pinyin: string }).pinyin = 'Xyz Abc'; })),
      'PRESENTATION_TEN_GOD_UNBOUND',
    );
    expect(refusal.detail).toMatchObject({ where: 'pillars.year.tenGod', matches: 0 });
    const hidden = expectPresentationRefusal(
      () => project(modelWith((m) => { (m.natal.pillars.day.hiddenStems[1]!.tenGod as { pinyin: string }).pinyin = 'Xyz Abc'; })),
      'PRESENTATION_TEN_GOD_UNBOUND',
    );
    expect(hidden.detail).toMatchObject({ where: 'pillars.day.hiddenStems[1].tenGod', matches: 0 });
  });

  it('refuses a character outside the 27 display glyphs through the visual contract', () => {
    expectVisualRefusal(() => project(modelWith((m) => { m.pillars.hour.branchHanzi = '天'; m.natal.pillars.hour.branchCn = '天'; })), 'DISPLAY_GLYPH_OUT_OF_CONTRACT');
  });

  it('refuses a negative Wu Xing count through the visual contract', () => {
    expectVisualRefusal(() => project(modelWith((m) => { (m.wuxing.vector as Record<string, number>)['Erde'] = -1; })), 'WU_XING_VECTOR_INVALID');
  });

  it('refuses a template that no longer hashes to its released identity', () => {
    const binding = templateBinding();
    expect(() => assertReleasedTemplate(binding)).not.toThrow();
    expectPresentationRefusal(() => assertReleasedTemplate({ ...binding, structuralHash: `sha256:${'0'.repeat(64)}` }), 'PRESENTATION_INPUT_INVALID');
  });
});

describe('N6: the long form', () => {
  it('refuses a character the pinned face cannot measure', () => {
    const refusal = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.chapters[0]!.paragraphs[0] += ' Pfeil → hier.'; })), 'PRESENTATION_TEXT_UNMEASURABLE');
    expect(refusal.detail).toMatchObject({ codepoint: 'U+2192' });
  });

  it('refuses a word wider than its measure instead of hyphenating or shrinking it', () => {
    expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.chapters[1]!.paragraphs[1] += ` ${'Wort'.repeat(30)}`; })), 'PRESENTATION_WORD_EXCEEDS_MEASURE');
  });

  it('refuses a chapter outside the long-form word budget through the visual contract', () => {
    expectVisualRefusal(() => project(fixture.model, contentWith((c) => { c.chapters[2]!.paragraphs = c.chapters[2]!.paragraphs.slice(0, 1); })), 'LONG_FORM_BUDGET_OUT_OF_CONTRACT');
  });

  it('refuses a layout that breaks its own geometry: an atomic module taller than a page', () => {
    const tall = Array.from({ length: 900 }, (_, index) => `Wort${String(index)}`).join(' ');
    const refusal = expectPresentationRefusal(() => paginateLongForm([{ id: 'k', kind: 'keyInsight', title: 'Titel', text: tall }], 0), 'PRESENTATION_LAYOUT_FINDING');
    expect((refusal.detail['findings'] as readonly unknown[]).length).toBeGreaterThan(0);
  });

  it('refuses a subhead taller than a fresh continuation column instead of adding pages forever', () => {
    const tall = Array.from({ length: 400 }, (_, index) => `Wort${String(index)}`).join(' ');
    const refusal = expectPresentationRefusal(
      () => paginateLongForm([{ id: 's', kind: 'subhead', text: tall }, { id: 'p', kind: 'paragraph', text: 'Ein kurzer Absatz.' }], 0),
      'PRESENTATION_LAYOUT_FINDING',
    );
    expect(refusal.detail).toMatchObject({ blockId: 's' });
  });

  it('refuses a layout that would run past the page backstop', () => {
    const paragraphs = Array.from({ length: 70 }, (_, index) => ({
      id: `p${String(index)}`,
      kind: 'paragraph' as const,
      text: Array.from({ length: 700 }, (_, word) => `Wort${String(word)}`).join(' '),
    }));
    const refusal = expectPresentationRefusal(() => paginateLongForm(paragraphs, 0), 'PRESENTATION_LAYOUT_FINDING');
    expect(refusal.detail).toEqual({ pages: 64 });
  });

  it('refuses a fractional centipoint position rather than rounding it', () => {
    expect(ceilToBaseline(1)).toBeGreaterThan(0);
    expectPresentationRefusal(() => ceilToBaseline(0.5), 'PRESENTATION_LAYOUT_FINDING');
  });
});

describe('N7: customer text', () => {
  it('refuses wording the Lexicon prohibits and a method the profile defers', () => {
    const prohibited = expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.reflectionQuestions[1] = 'Du solltest das ändern.'; })), 'PRESENTATION_CUSTOMER_TEXT_REFUSED');
    expect(prohibited.detail).toMatchObject({ classId: 'ADVICE_PREDICTION' });
    expectPresentationRefusal(() => project(fixture.model, contentWith((c) => { c.methodNote += ' Die Glückssäulen fehlen.'; })), 'PRESENTATION_CUSTOMER_TEXT_REFUSED');
  });

  it('refuses evidence chrome on the customer surface through the visual contract', () => {
    expectVisualRefusal(() => project(fixture.model, contentWith((c) => { c.title = 'Reading sha256:abc'; })), 'EVIDENCE_CHROME_IN_CUSTOMER_SURFACE');
  });
});
