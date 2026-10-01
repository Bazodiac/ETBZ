/**
 * ETBZ-56 — shared fixture for the Skill-reading presentation suites.
 *
 * The real accepted Skill output: the ETBZ-57 reading of the synthetic known-time
 * chart (Musterkundin A), accepted at the Human Editorial Gate (Jira ETBZ-57
 * comment 16969) and released under bundle and Skill 1.1.0 - the EDIT v7 reading
 * in `docs/evidence/etbz-57/fixture/accepted-reading.json`, with the input
 * package it was accepted against (`skillFixtureV1_1`). The chart is the one the
 * package was built from. This is not the Golden case: Musterkundin A is a
 * development fixture (Rebaseline 62128133 section 18).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { buildSkillReadingProjection } from '../../src/application/presentation/index.js';
import type { PresentationProjection } from '../../src/application/presentation/index.js';
import type { SkillContractBundle, SkillInputPackage } from '../../src/application/skill/index.js';
import { knownTimeChart } from './narrativeFixture.js';
import { skillFixtureV1_1 } from './skillFixture.js';

export const ACCEPTED_SKILL_READING = 'docs/evidence/etbz-57/fixture/accepted-reading.json';
export const SKILL_PROJECTION_EVIDENCE = 'docs/evidence/etbz-56/presentation-projection.json';

export interface SkillPresentationFixture {
  readonly model: HoroscopeModel;
  readonly reading: Record<string, unknown>;
  readonly bundle: SkillContractBundle;
  readonly inputPackage: SkillInputPackage;
  readonly projection: PresentationProjection;
}

export function acceptedSkillReading(): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(process.cwd(), ACCEPTED_SKILL_READING), 'utf8')) as Record<string, unknown>;
}

export function skillPresentationFixture(): SkillPresentationFixture {
  const { bundle, inputPackage } = skillFixtureV1_1();
  const model = knownTimeChart().model;
  const reading = acceptedSkillReading();
  return { model, reading, bundle, inputPackage, projection: buildSkillReadingProjection({ model, reading, bundle, inputPackage }) };
}
