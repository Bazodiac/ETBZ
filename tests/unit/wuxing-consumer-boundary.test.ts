/**
 * ETBZ-34 AC 1–4 — the BaZi Wu-Xing answer at the deterministic
 * producer -> consumer boundary.
 *
 * Two layers, both fail-closed, neither repairing anything:
 *   - the WIRE mapper (`fufireResponseMapper.mapWuxing`) refuses a body that is
 *     not the pinned BaZi Wu-Xing contract;
 *   - `buildHoroscopeModel` refuses a snapshot that is not THIS chart's.
 * A HoroscopeModel therefore cannot exist for any of the defects below.
 */
import { describe, expect, it } from 'vitest';
import { FufireError, fufireResponseMapper } from '../../src/adapters/fufire/http-client.js';
import { HoroscopeError, buildHoroscopeModel } from '../../src/application/horoscope-model.js';
import type { HoroscopeErrorCode } from '../../src/application/horoscope-model.js';
import type { WuxingSnapshot } from '../../src/application/ports/fufire-gateway.js';
import { KNOWN_BIRTH, RUNTIME, UNKNOWN_BIRTH, baziSnapshot } from '../support/narrativeFixture.js';
import { UNKNOWN_TIME_NATAL_OVERRIDES, natalSnapshot } from '../support/natalFixture.js';
import { WUXING_SNAPSHOT, WUXING_UNKNOWN_SNAPSHOT, wuxingWireBody } from '../support/wuxingFixture.js';

const PILLARS = ['year', 'month', 'day', 'hour'] as const;

function model(wuxing: WuxingSnapshot): unknown {
  return buildHoroscopeModel(KNOWN_BIRTH, baziSnapshot(), wuxing, natalSnapshot(), RUNTIME);
}

function expectModelRefusal(code: HoroscopeErrorCode, wuxing: WuxingSnapshot): void {
  try {
    model(wuxing);
  } catch (error) {
    expect(error).toBeInstanceOf(HoroscopeError);
    expect((error as HoroscopeError).code, (error as HoroscopeError).message).toBe(code);
    return;
  }
  expect.unreachable(`expected the model to be refused with ${code}`);
}

function expectWireRefusal(body: Record<string, unknown>, fragment: RegExp): void {
  try {
    fufireResponseMapper.mapWuxing(body);
  } catch (error) {
    expect(error).toBeInstanceOf(FufireError);
    expect((error as FufireError).code).toBe('FUFIRE_CONTRACT_ERROR');
    expect((error as FufireError).message).toMatch(fragment);
    return;
  }
  expect.unreachable('expected the wire body to be refused');
}

describe('ETBZ-34 AC 1: Wu-Xing source pillars must be the BaZi pillars', () => {
  it('keeps the source pillars from the wire response in the snapshot and in the model', () => {
    const snapshot = fufireResponseMapper.mapWuxing(wuxingWireBody());
    expect(snapshot.sourcePillars).toEqual(WUXING_SNAPSHOT.sourcePillars);
    const built = model(WUXING_SNAPSHOT) as { wuxing: { sourcePillars: unknown } };
    expect(built.wuxing.sourcePillars).toEqual(WUXING_SNAPSHOT.sourcePillars);
  });

  it.each(PILLARS.flatMap((pillar) => [[pillar, 'stem'], [pillar, 'branch']] as const))(
    'blocks when exactly the %s %s differs',
    (pillar, part) => {
      const drifted: WuxingSnapshot = {
        ...WUXING_SNAPSHOT,
        sourcePillars: {
          ...WUXING_SNAPSHOT.sourcePillars,
          [pillar]: { ...WUXING_SNAPSHOT.sourcePillars[pillar], [part]: part === 'stem' ? 'Jia' : 'Zi' },
        },
      };
      expectModelRefusal('HOROSCOPE_WUXING_SOURCE_PILLAR_CONTRADICTION', drifted);
    },
  );

  it('blocks a snapshot that carries no source pillars at all', () => {
    const { sourcePillars: _dropped, ...rest } = WUXING_SNAPSHOT;
    void _dropped;
    expectModelRefusal('HOROSCOPE_WUXING_SOURCE_PILLAR_CONTRADICTION', rest as unknown as WuxingSnapshot);
  });

  it('refuses a wire body without pillars, with a fifth pillar, or with a malformed pillar', () => {
    const { pillars: _pillars, ...without } = wuxingWireBody();
    void _pillars;
    expectWireRefusal(without, /pillars/u);
    const body = wuxingWireBody();
    expectWireRefusal({ ...body, pillars: { ...(body['pillars'] as object), luck: { stem: 'Jia', branch: 'Zi' } } }, /pillars has keys/u);
    expectWireRefusal({ ...body, pillars: { ...(body['pillars'] as object), day: { stem: 'Xin' } } }, /pillars\.day/u);
  });

  it('ties the Wu-Xing precision statement to the same question', () => {
    expectModelRefusal('HOROSCOPE_WUXING_PRECISION_CONTRADICTION', WUXING_UNKNOWN_SNAPSHOT);
    expect(() =>
      buildHoroscopeModel(
        UNKNOWN_BIRTH,
        baziSnapshot({ precision: { birthTimeKnown: false, provisionalFields: ['hour'] } }),
        WUXING_SNAPSHOT,
        natalSnapshot(structuredClone(UNKNOWN_TIME_NATAL_OVERRIDES)),
        RUNTIME,
      ),
    ).toThrow(expect.objectContaining({ code: 'HOROSCOPE_WUXING_PRECISION_CONTRADICTION' }) as HoroscopeError);
  });
});

describe('ETBZ-34 AC 2: dominant must be a maximum of the vector', () => {
  it('blocks a valid element that is not a maximum — at the wire and at the model', () => {
    expectWireRefusal({ ...wuxingWireBody(), dominant_element: 'Holz' }, /not a maximum/u);
    expectModelRefusal('HOROSCOPE_WUXING_DOMINANT_INCONSISTENT', { ...WUXING_SNAPSHOT, dominant: 'Holz' });
  });

  it('blocks a dominant outside the vocabulary', () => {
    expectWireRefusal({ ...wuxingWireBody(), dominant_element: 'Aether' }, /not a wu-xing element/u);
    expectModelRefusal('HOROSCOPE_WUXING_ELEMENT_ERROR', { ...WUXING_SNAPSHOT, dominant: 'Aether' });
  });

  it('accepts EVERY tied maximum and invents no tie-break', () => {
    const vector = { Holz: 2, Feuer: 2.5, Erde: 2.5, Metall: 2, Wasser: 2 };
    for (const dominant of ['Feuer', 'Erde']) {
      expect(() => model({ ...WUXING_SNAPSHOT, vector, dominant })).not.toThrow();
      expect(() => fufireResponseMapper.mapWuxing({ ...wuxingWireBody(), wu_xing_vector: vector, dominant_element: dominant })).not.toThrow();
    }
    expectModelRefusal('HOROSCOPE_WUXING_DOMINANT_INCONSISTENT', { ...WUXING_SNAPSHOT, vector, dominant: 'Holz' });
  });
});

describe('ETBZ-34 AC 3: the vector has exactly the five canonical keys', () => {
  const vector = WUXING_SNAPSHOT.vector;

  it('blocks a sixth key instead of dropping it', () => {
    expectWireRefusal({ ...wuxingWireBody(), wu_xing_vector: { ...vector, Aether: 0.4 } }, /expected exactly/u);
    expectModelRefusal('HOROSCOPE_WUXING_KEYSET_ERROR', { ...WUXING_SNAPSHOT, vector: { ...vector, Aether: 0.4 } as WuxingSnapshot['vector'] });
  });

  it('blocks a missing key instead of defaulting it', () => {
    const { Wasser: _water, ...four } = vector;
    void _water;
    expectWireRefusal({ ...wuxingWireBody(), wu_xing_vector: four }, /expected exactly/u);
    expectModelRefusal('HOROSCOPE_WUXING_KEYSET_ERROR', { ...WUXING_SNAPSHOT, vector: four as unknown as WuxingSnapshot['vector'] });
  });

  it('blocks an English-keyed vector: five keys, wrong vocabulary', () => {
    expectWireRefusal({ ...wuxingWireBody(), wu_xing_vector: { wood: 1.8, fire: 2.5, earth: 2, metal: 2, water: 2 } }, /expected exactly/u);
  });
});

describe('ETBZ-34 AC 4: basis is exactly bazi_four_pillars', () => {
  it.each(['western_planetary', 'fusion', 'BAZI_FOUR_PILLARS', ''])('blocks basis "%s"', (basis) => {
    expectWireRefusal({ ...wuxingWireBody(), basis }, /basis|not a non-empty|string/u);
    expectModelRefusal('HOROSCOPE_WUXING_BASIS_ERROR', { ...WUXING_SNAPSHOT, basis });
  });

  it('blocks a planetary payload even when everything else looks like this chart', () => {
    expectModelRefusal('HOROSCOPE_WUXING_BASIS_ERROR', { ...WUXING_SNAPSHOT, basis: 'western_planetary' });
  });
});
