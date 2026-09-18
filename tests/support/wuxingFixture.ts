/**
 * ETBZ-34 test support — the BaZi Wu-Xing answer for the shared synthetic chart
 * (year Geng/Wu, month Ren/Wu, day Xin/Hai, hour Yi/Wei).
 *
 * `sourcePillars` are the pillars FuFirE summed the vector FROM; for a same-chart
 * answer they equal the BaZi pillars of the fixture chart.
 */
import type { WuxingSnapshot } from '../../src/application/ports/fufire-gateway.js';

export const WUXING_SOURCE_PILLARS: WuxingSnapshot['sourcePillars'] = {
  year: { stem: 'Geng', branch: 'Wu' },
  month: { stem: 'Ren', branch: 'Wu' },
  day: { stem: 'Xin', branch: 'Hai' },
  hour: { stem: 'Yi', branch: 'Wei' },
};

export const WUXING_KNOWN_PRECISION: WuxingSnapshot['precision'] = { birthTimeKnown: true, provisionalFields: [] };
export const WUXING_UNKNOWN_PRECISION: WuxingSnapshot['precision'] = { birthTimeKnown: false, provisionalFields: ['hour'] };

export const WUXING_SNAPSHOT: WuxingSnapshot = {
  vector: { Holz: 1.8, Feuer: 2.5, Erde: 2, Metall: 2, Wasser: 2 },
  dominant: 'Feuer',
  basis: 'bazi_four_pillars',
  sourcePillars: WUXING_SOURCE_PILLARS,
  precision: WUXING_KNOWN_PRECISION,
};

export const WUXING_UNKNOWN_SNAPSHOT: WuxingSnapshot = { ...WUXING_SNAPSHOT, precision: WUXING_UNKNOWN_PRECISION };

/** The wire body of `POST /v1/calculate/bazi/wuxing` for a snapshot (keys of FuFirE c914d567). */
export function wuxingWireBody(snapshot: WuxingSnapshot = WUXING_SNAPSHOT): Record<string, unknown> {
  const known = snapshot.precision.birthTimeKnown;
  return {
    input: {
      date: known ? '1990-06-15T14:30:00' : '1985-11-03',
      tz: 'Europe/Berlin',
      lon: 13.405,
      lat: 52.52,
      birth_time_known: known,
    },
    wu_xing_vector: { ...snapshot.vector },
    dominant_element: snapshot.dominant,
    basis: snapshot.basis,
    pillars: structuredClone(snapshot.sourcePillars),
    contribution_ledger: { bazi: [] },
    quality_flags: { ephemeris_mode: 'swieph' },
    precision: {
      birth_time_known: known,
      provisional_fields: [...snapshot.precision.provisionalFields],
    },
  };
}
