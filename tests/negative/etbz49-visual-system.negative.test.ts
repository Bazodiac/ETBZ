// =============================================================================
// ETBZ-49 - every refusal the visual contract owes.
//
// The ten negative paths ETBZ-49 requires, each asserted by its CODE rather
// than by "it threw": a guard that fails for the wrong reason is a guard that
// will pass for the wrong reason later.
//
//   missing glyph · malformed/clipped glyph · whole-column phase tint ·
//   Wu Xing recomputation · unsupported Sheng/Ke · unknown visual type ·
//   unknown slot · semantic truncation · uncontrolled shrink-to-fit ·
//   developer chrome in the customer surface
// =============================================================================

import { describe, expect, it } from 'vitest';

import {
  DISPLAY_GLYPH_MANIFEST,
  DISPLAY_GLYPH_SET,
  VISUAL_CONTRACT_ERROR_CODES,
  VisualContractError,
  acceptWuXingVector,
  assertCustomerSurfaceClean,
  assertDisplayGlyphIntegrity,
  assertEveryWordPlaced,
  findEvidenceChrome,
  isVisualContractError,
  presentWuXing,
  resolveDisplayGlyph,
  resolvePhasePaint,
  resolveShengKeRelation,
  resolveSlot,
  resolveVisualComponent,
  validateLongFormPlacement,
} from '../../src/application/visual/index.js';
import type {
  DisplayGlyph,
  LongFormPlacement,
  VisualContractErrorCode,
} from '../../src/application/visual/index.js';

/** Asserts the call fails, and fails under the code the contract names. */
function expectRefusal(code: VisualContractErrorCode, call: () => unknown): VisualContractError {
  let caught: unknown;
  try {
    call();
  } catch (error: unknown) {
    caught = error;
  }
  expect(caught, `expected ${code}, nothing was thrown`).toBeInstanceOf(VisualContractError);
  const error = caught as VisualContractError;
  expect(error.code, `expected ${code}, got ${error.code}: ${error.message}`).toBe(code);
  return error;
}

const firstGlyph = (): DisplayGlyph => {
  const glyph = DISPLAY_GLYPH_SET[0];
  if (glyph === undefined) throw new Error('the glyph set is empty');
  return glyph;
};

// -----------------------------------------------------------------------------

describe('ETBZ-49 N1: a glyph outside the twenty-seven is refused, never substituted', () => {
  it.each([
    ['一', 'a common Hanzi that is not in the set'],
    ['龍', 'a zodiac animal written out'],
    ['U+4E00', 'the same, by codepoint'],
    ['A', 'a Latin letter'],
    ['', 'the empty string'],
    ['甲乙', 'two glyphs at once'],
  ])('refuses %s (%s)', (input) => {
    const error = expectRefusal('DISPLAY_GLYPH_OUT_OF_CONTRACT', () =>
      resolveDisplayGlyph(input),
    );
    expect(error.message).toContain('InformationalCjkText');
  });

  it('refuses rather than falling back to a text face', () => {
    // The failure mode this forbids: a renderer that quietly sets an unknown
    // character in Noto Sans and ships a glyph nobody approved.
    const error = expectRefusal('DISPLAY_GLYPH_OUT_OF_CONTRACT', () =>
      resolveDisplayGlyph('龍'),
    );
    expect(error.detail['requested']).toBe('龍');
  });
});

describe('ETBZ-49 N2: a malformed or clipped glyph is refused', () => {
  it('refuses an empty outline', () => {
    expectRefusal('DISPLAY_GLYPH_MALFORMED', () => {
      assertDisplayGlyphIntegrity({ ...firstGlyph(), path: '   ' });
    });
  });

  it('refuses an outline that is not a path', () => {
    expectRefusal('DISPLAY_GLYPH_MALFORMED', () => {
      assertDisplayGlyphIntegrity({ ...firstGlyph(), path: 'L0 0Z' });
    });
  });

  it('refuses a bounding box that leaves the common box', () => {
    const [vx, vy, vw, vh] = DISPLAY_GLYPH_MANIFEST.viewBox;
    const error = expectRefusal('DISPLAY_GLYPH_CLIPPED', () => {
      assertDisplayGlyphIntegrity({
        ...firstGlyph(),
        bbox: [vx - 1, vy + 10, vx + vw - 10, vy + vh - 10],
      });
    });
    expect(error.detail['viewBox']).toEqual(DISPLAY_GLYPH_MANIFEST.viewBox);
  });

  it('refuses a glyph whose STROKE crosses the edge although its outline does not', () => {
    // The ink pass paints half the stroke width outside the outline. A bare-bbox
    // check calls this glyph safe; the printed asset is already cut.
    const [vx, vy, vw, vh] = DISPLAY_GLYPH_MANIFEST.viewBox;
    const margin = DISPLAY_GLYPH_MANIFEST.inkPass.strokeUnits / 2;
    const justInside: DisplayGlyph = {
      ...firstGlyph(),
      bbox: [vx + 1, vy + 1, vx + vw - 1, vy + vh - 1],
    };

    expect(justInside.bbox[0]).toBeGreaterThan(vx);
    expect(justInside.bbox[0] - margin).toBeLessThan(vx);
    expectRefusal('DISPLAY_GLYPH_CLIPPED', () => {
      assertDisplayGlyphIntegrity(justInside);
    });
  });

  it('refuses a degenerate box', () => {
    expectRefusal('DISPLAY_GLYPH_CLIPPED', () => {
      assertDisplayGlyphIntegrity({ ...firstGlyph(), bbox: [0, 0, 0, 0] });
    });
  });
});

describe('ETBZ-49 N3: a phase colour may not tint a whole column', () => {
  it.each([
    ['pillar', 'the exclusion names this one directly'],
    ['column', 'the same thing by another name'],
    ['page', 'the largest version of it'],
    ['card', 'an invented container'],
    ['', 'no scope at all'],
  ])('refuses scope "%s" (%s)', (scope) => {
    const error = expectRefusal('PHASE_SCOPE_OUT_OF_CONTRACT', () =>
      resolvePhasePaint(scope, 'wood'),
    );
    expect(error.detail['allowed']).toEqual(['stem', 'branch', 'hiddenStem']);
  });

  it('refuses a phase that is not one of the five', () => {
    expectRefusal('UNKNOWN_VISUAL_TYPE', () =>
      resolvePhasePaint('stem', 'aether' as unknown as 'wood'),
    );
  });
});

describe('ETBZ-49 N4: the design side never recomputes a Wu Xing distribution', () => {
  const VALID = { wood: 2, fire: 3, earth: 1, metal: 2, water: 0 };

  it.each([
    'dominant',
    'dominance',
    'strength',
    'balance',
    'deficiency',
    'excess',
    'weighted',
    'normalized',
    'normalised',
    'score',
    'percentage',
    'usefulGod',
    'shengKe',
  ])('refuses a vector carrying a derived "%s"', (key) => {
    const error = expectRefusal('WU_XING_RECOMPUTATION_REFUSED', () =>
      acceptWuXingVector({ ...VALID, [key]: 'wood' }),
    );
    expect(error.detail['derivedKeys']).toEqual([key]);
  });

  it('refuses the same through the presentation entry point', () => {
    expectRefusal('WU_XING_RECOMPUTATION_REFUSED', () =>
      presentWuXing({ ...VALID, dominant: 'fire' }),
    );
  });

  it.each([
    [{ wood: 1, fire: 1, earth: 1, metal: 1 }, 'a missing phase'],
    [{ ...VALID, aether: 1 }, 'a sixth phase'],
    [{ ...VALID, water: -1 }, 'a negative count'],
    [{ ...VALID, water: 1.5 }, 'a fractional count'],
    [{ ...VALID, water: Number.NaN }, 'a NaN count'],
    [{ ...VALID, water: '0' }, 'a count as a string'],
  ])('refuses %j (%s)', (vector, description) => {
    const error = expectRefusal('WU_XING_VECTOR_INVALID', () => acceptWuXingVector(vector));
    expect(error.message, description).toContain('five phases');
  });

  it.each([
    [null, 'null'],
    ['wood:2', 'a string'],
    [[2, 3, 1, 2, 0], 'an array of counts'],
    [42, 'a number'],
  ])('refuses %j (%s) as a distribution', (input, description) => {
    const error = expectRefusal('WU_XING_VECTOR_INVALID', () => acceptWuXingVector(input));
    expect(error.detail['received'], description).toBeDefined();
  });
});

describe('ETBZ-49 N5: Sheng/Ke has no customer graphic in the MVP', () => {
  it('refuses every relation, in both directions', () => {
    const error = expectRefusal('SHENG_KE_NOT_SUPPORTED', () =>
      resolveShengKeRelation('wood', 'fire'),
    );
    expect(error.detail).toEqual({ from: 'wood', to: 'fire' });
    expectRefusal('SHENG_KE_NOT_SUPPORTED', () => resolveShengKeRelation('metal', 'wood'));
  });
});

describe('ETBZ-49 N6: an unknown visual type is refused', () => {
  it.each([
    ['LuckPillarsTimeline', 'an excluded MVP feature'],
    ['ShengKeStar', 'the relation graphic by name'],
    ['WesternZodiacWheel', 'an out-of-scope tradition'],
    ['wordmark', 'the right component, wrong case'],
    ['toString', 'a prototype property that is not a component'],
    ['constructor', 'the same trap, one level deeper'],
  ])('refuses %s (%s)', (id) => {
    expectRefusal('UNKNOWN_VISUAL_TYPE', () => resolveVisualComponent(id));
  });
});

describe('ETBZ-49 N7: an unknown slot is refused', () => {
  it.each([
    ['luckPillars.timeline', 'an excluded page'],
    ['dayMaster.personality', 'stock personality copy'],
    ['pillars.stem', 'the array slot without its index marker'],
    ['', 'no slot at all'],
  ])('refuses %s (%s)', (slotId) => {
    expectRefusal('UNKNOWN_SLOT', () => resolveSlot(slotId));
  });
});

describe('ETBZ-49 N8: content is never shortened to fit', () => {
  const base: LongFormPlacement = {
    fixtureId: 'negative/base',
    wordCount: 749,
    pages: [
      { pageNumber: 1, template: 'opener', lines: Array.from({ length: 48 }, () => 'line') },
      {
        pageNumber: 2,
        template: 'continuation',
        lines: Array.from({ length: 41 }, () => 'line'),
      },
    ],
  };

  it('refuses a dropped word', () => {
    expectRefusal('SEMANTIC_TRUNCATION_REFUSED', () => {
      validateLongFormPlacement({ ...base, droppedWords: ['tradition'] });
    });
  });

  it('refuses a layout that placed fewer words than the source carries', () => {
    expectRefusal('SEMANTIC_TRUNCATION_REFUSED', () => {
      assertEveryWordPlaced('one two three four', {
        ...base,
        pages: [{ pageNumber: 1, template: 'opener', lines: ['one two three'] }],
      });
    });
  });

  it('refuses a layout that placed the words in a different order', () => {
    const error = expectRefusal('SEMANTIC_TRUNCATION_REFUSED', () => {
      assertEveryWordPlaced('one two three', {
        ...base,
        pages: [{ pageNumber: 1, template: 'opener', lines: ['one three two'] }],
      });
    });
    expect(error.detail['expected']).toBe('two');
    expect(error.detail['actual']).toBe('three');
  });

  it('refuses a layout that quietly ADDED a word', () => {
    expectRefusal('SEMANTIC_TRUNCATION_REFUSED', () => {
      assertEveryWordPlaced('one two', {
        ...base,
        pages: [{ pageNumber: 1, template: 'opener', lines: ['one two three'] }],
      });
    });
  });
});

describe('ETBZ-49 N9: layout never shrinks, clips or overlaps', () => {
  const base: LongFormPlacement = {
    fixtureId: 'negative/layout',
    wordCount: 749,
    pages: [
      { pageNumber: 1, template: 'opener', lines: Array.from({ length: 48 }, () => 'line') },
      {
        pageNumber: 2,
        template: 'continuation',
        lines: Array.from({ length: 41 }, () => 'line'),
      },
    ],
  };

  it('refuses shrink-to-fit', () => {
    expectRefusal('SHRINK_TO_FIT_REFUSED', () => {
      validateLongFormPlacement({ ...base, shrinkToFitApplied: true });
    });
  });

  it('refuses clipping', () => {
    expectRefusal('CLIPPING_REFUSED', () => {
      validateLongFormPlacement({ ...base, clippedRegions: ['ch.p7'] });
    });
  });

  it('refuses overlap', () => {
    expectRefusal('OVERLAP_REFUSED', () => {
      validateLongFormPlacement({ ...base, overlappingRegions: ['ch.pullQuote / ch.p4'] });
    });
  });

  it.each([
    [599, 'one word under the budget'],
    [901, 'one word over it'],
    [0, 'an empty chapter'],
  ])('refuses a chapter of %d words (%s)', (wordCount) => {
    expectRefusal('LONG_FORM_BUDGET_OUT_OF_CONTRACT', () => {
      validateLongFormPlacement({ ...base, wordCount });
    });
  });

  it.each([
    [1, 'a single page'],
    [4, 'four pages'],
  ])('refuses a chapter laid out across %d page(s) (%s)', (pageCount) => {
    expectRefusal('LONG_FORM_BUDGET_OUT_OF_CONTRACT', () => {
      validateLongFormPlacement({
        ...base,
        pages: Array.from({ length: pageCount }, (_unused, index) => ({
          pageNumber: index + 1,
          template: 'continuation',
          lines: Array.from({ length: 20 }, () => 'line'),
        })),
      });
    });
  });

  it('refuses a widow page carrying a single line', () => {
    expectRefusal('LONG_FORM_BUDGET_OUT_OF_CONTRACT', () => {
      validateLongFormPlacement({
        ...base,
        pages: [
          ...base.pages,
          { pageNumber: 3, template: 'continuation', lines: ['one orphaned line'] },
        ],
      });
    });
  });
});

describe('ETBZ-49 N10: evidence chrome never reaches the customer surface', () => {
  it.each([
    ['sha256:54f0ed0d5d3eebf6', 'a hash prefix'],
    ['54f0ed0d5d3eebf65817c13cb54ea814049c2e79c05d9d040889c69bd08005d9', 'a bare digest'],
    ['METHOD_SCOPE_BLOCKED', 'an internal blocked state'],
    ['Transform pt.linear-max-v1 applied', 'a rule id'],
    ['fixture v4-mixed-v1', 'a fixture label'],
    ['INTERPRETIVE SLOT · MAX 900 CHARS', 'slot chrome'],
    ['SAMPLE · NOT CUSTOMER DATA', 'sample chrome'],
    ['SAMPLE DATA', 'the shorter sample tag'],
  ])('refuses %s (%s)', (text) => {
    const error = expectRefusal('EVIDENCE_CHROME_IN_CUSTOMER_SURFACE', () => {
      assertCustomerSurfaceClean(text);
    });
    expect((error.detail['findings'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('catches an unknown rule id it was never told about (shape, not blocklist)', () => {
    // The point of matching a shape: a rule id nobody has written yet is caught.
    const findings = findEvidenceChrome('Transform pt.some-future-thing-v9 applied');
    expect(findings.map((finding) => finding.label)).toContain('rule id');
  });

  it('does not fire on ordinary customer prose', () => {
    expect(
      findEvidenceChrome(
        'Your Day Master is Xin, Yin Metal. The chart shows two Wood, three Fire and no Water.',
      ),
    ).toEqual([]);
  });
});

describe('ETBZ-49 N11: the refusal vocabulary itself is closed', () => {
  it('exposes every documented code and nothing else', () => {
    expect([...VISUAL_CONTRACT_ERROR_CODES].sort()).toEqual(
      [
        'CLIPPING_REFUSED',
        'DISPLAY_GLYPH_CLIPPED',
        'DISPLAY_GLYPH_MALFORMED',
        'DISPLAY_GLYPH_OUT_OF_CONTRACT',
        'EVIDENCE_CHROME_IN_CUSTOMER_SURFACE',
        'LONG_FORM_BUDGET_OUT_OF_CONTRACT',
        'OVERLAP_REFUSED',
        'PHASE_SCOPE_OUT_OF_CONTRACT',
        'SEMANTIC_TRUNCATION_REFUSED',
        'SHENG_KE_NOT_SUPPORTED',
        'SHRINK_TO_FIT_REFUSED',
        'UNKNOWN_SLOT',
        'UNKNOWN_VISUAL_TYPE',
        'WU_XING_RECOMPUTATION_REFUSED',
        'WU_XING_VECTOR_INVALID',
      ].sort(),
    );
  });

  it('narrows correctly: isVisualContractError distinguishes codes', () => {
    let caught: unknown;
    try {
      resolveDisplayGlyph('一');
    } catch (error: unknown) {
      caught = error;
    }
    expect(isVisualContractError(caught, 'DISPLAY_GLYPH_OUT_OF_CONTRACT')).toBe(true);
    expect(isVisualContractError(caught, 'UNKNOWN_SLOT')).toBe(false);
    expect(isVisualContractError(new Error('plain'))).toBe(false);
  });
});
