/**
 * ETBZ-55 — shared fixture for the presentation suites.
 *
 * The chart is the D4 golden input (PO decision, Jira ETBZ-2 comment 16690): the
 * synthetic known-time chart of `tests/support/narrativeFixture.ts`
 * (Musterkundin A, 1990-06-15 14:30 Europe/Berlin), as a validated
 * `HoroscopeModel`. The content is the versioned text payload of the ETBZ-52
 * controlled fixture run (`docs/evidence/etbz-52/fixture/customer-reading.json`)
 * — a presentation-ready German reading, used here as data. Mapping an accepted
 * Skill reading onto the projection is ETBZ-56's work, not this fixture's.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { buildPresentationProjection } from '../../src/application/presentation/index.js';
import type { PresentationProjection } from '../../src/application/presentation/index.js';
import { knownTimeChart } from './narrativeFixture.js';

export const PRESENTATION_CONTENT_FIXTURE = 'docs/evidence/etbz-52/fixture/customer-reading.json';
export const PRESENTATION_PROJECTION_EVIDENCE = 'docs/evidence/etbz-55/presentation-projection.json';

export interface PresentationFixture {
  readonly model: HoroscopeModel;
  readonly content: unknown;
  readonly projection: PresentationProjection;
}

export function presentationContent(): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), PRESENTATION_CONTENT_FIXTURE), 'utf8')) as unknown;
}

export function presentationFixture(): PresentationFixture {
  const model = knownTimeChart().model;
  const content = presentationContent();
  return { model, content, projection: buildPresentationProjection({ model, content }) };
}
