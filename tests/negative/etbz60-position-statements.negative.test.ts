/**
 * ETBZ-60 — `READING_POSITION_UNGROUNDED` (PO decisions D-59-5, D-59-6; Jira ETBZ-60): a sentence that states
 * something of the chart's positions as a whole needs a cited fact of every pillar (SKILL.md 1.1.0 law 3 and step 2,
 * now machine-checked; the Skill package and the bundle are unchanged).
 *
 * The positive controls are the real defect: the ETBZ-59 readings as accepted at e5ccc94c, whose position statements
 * raised the BLOCKING STOCK_PARAGRAPH_REUSE. The negative controls are the framework sentences committed readings
 * carry, among them the defining clause of the ETBZ-57 reading the Product Owner accepted at the Editorial Gate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SkillRunError, acceptSkillReading, findPositionStatement } from '../../src/application/skill/index.js';
import { caseFile, deriveCase } from '../support/etbz59Cases.js';
import type { CaseLabel } from '../support/etbz59Cases.js';
import { skillFixtureV1_1 } from '../support/skillFixture.js';
import { casePlanDraft } from '../support/etbz59Cases.js';
import { deriveRound2Case, placeSurfaceClaim } from '../support/etbz60Cases.js';
import { caseFile as roundCaseFile } from '../support/etbz60Rereading.js';
import { planContextFor } from '../support/metaNarrativePlanFixture.js';
import { contextFor } from '../support/claimGraphFixture.js';
import { PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';

// Each acceptance runs a 4,000-word reading through every gate; a default 5 s timeout would read as a gate failure.
vi.setConfig({ testTimeout: 60_000 });

type Paragraph = { kind: string; text: string; factRefs: string[]; claimRefs: string[] };
type Reading = { chapters: { paragraphs: Paragraph[] }[] };

const readJson = (path: string): Reading => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as Reading;
const refusalOf = (action: () => unknown): SkillRunError => {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected a SkillRunError').toBeInstanceOf(SkillRunError);
  return caught as SkillRunError;
};
const placesOf = (error: SkillRunError): string[] => error.diagnostics.map((entry) => `${entry.code}@${String(entry.detail['where'])}`);

/** The ETBZ-59 EDIT texts (the accepted customer text) refused by this boundary, path by path - measured, not guessed. */
const ETBZ59_POSITION_STATEMENTS: Readonly<Record<CaseLabel, readonly string[]>> = {
  source: ['chapters[2].paragraphs[2]', 'chapters[5].paragraphs[1]', 'chapters[5].paragraphs[2]'],
  near: ['chapters[2].paragraphs[1]', 'chapters[2].paragraphs[4]', 'chapters[3].paragraphs[2]'],
  removal: ['chapters[2].paragraphs[1]', 'chapters[3].paragraphs[0]'],
};

describe('ETBZ-60: the ETBZ-59 readings, accepted at e5ccc94c, are refused at their position statements', () => {
  it.each(['source', 'near', 'removal'] as const)('%s: every refusal is READING_POSITION_UNGROUNDED, at exactly the measured paragraphs', async (label) => {
    const run = await deriveCase(label);
    const error = refusalOf(() => acceptSkillReading(readJson(caseFile(label, 'skill-reading')), { bundle: run.bundle, inputPackage: run.inputPackage }));
    expect(placesOf(error)).toEqual(ETBZ59_POSITION_STATEMENTS[label].map((where) => `READING_POSITION_UNGROUNDED@${where}`));
  });

  it('names the phrase and the pillars no cited fact covers (R(N) [2.4], the passage judge B ruled BLOCKING)', async () => {
    const run = await deriveCase('near');
    const error = refusalOf(() => acceptSkillReading(readJson(caseFile('near', 'skill-reading')), { bundle: run.bundle, inputPackage: run.inputPackage }));
    const entry = error.diagnostics.find((candidate) => candidate.detail['where'] === 'chapters[2].paragraphs[4]');
    expect(entry?.detail).toEqual({ where: 'chapters[2].paragraphs[4]', phrase: 'nicht an der Oberfläche einer Säule', missingPillars: ['hour'] });
  });

  it('accepts R(S) again once its position statements name only the positions its facts cover: the new check is the only change', async () => {
    const run = await deriveCase('source');
    const reading = readJson(caseFile('source', 'skill-reading'));
    const swap = (c: number, p: number, from: string, to: string): void => {
      const target = reading.chapters[c]?.paragraphs[p];
      expect(target?.text, `${String(c)}.${String(p)}`).toContain(from);
      if (target !== undefined) target.text = target.text.replace(from, to);
    };
    swap(2, 2, 'Sie steht nicht offen oben auf einer Säule, sondern liegt im Inneren der Zweige.', 'Sie liegt im Inneren dieser Zweige.');
    swap(5, 1, 'sie steht auf keiner Säule oben, sondern gehört zur inneren Ebene der Zweige.', 'sie gehört zur inneren Ebene dieser Zweige.');
    swap(5, 1, ', ohne an die Oberfläche zu treten.', '.');
    swap(5, 2, 'die das Innere des Charts durchzieht, ohne an die Oberfläche zu treten.', 'die das Innere dieser Zweige durchzieht.');
    expect(() => acceptSkillReading(reading, { bundle: run.bundle, inputPackage: run.inputPackage })).not.toThrow();
  });
});

describe('ETBZ-60: what a position statement is', () => {
  it('finds each form in the sentence the ETBZ-59 readings wrote', () => {
    expect(findPositionStatement('Sie steht nicht offen oben auf einer Säule, sondern liegt im Inneren der Zweige.')).toBe('nicht offen oben auf einer Säule');
    expect(findPositionStatement('Die Stimme bleibt dabei verborgen; sie steht auf keiner Säule oben, sondern gehört zur inneren Ebene der Zweige.')).toBe('keiner Säule');
    expect(findPositionStatement('Zusammengenommen zeigt sich daran eine Stimme, die das Innere des Charts durchzieht, ohne an die Oberfläche zu treten.')).toBe('ohne an die Oberfläche');
    expect(findPositionStatement('Auch diese Bezeichnung steht nicht offen in einem Himmelsstamm, sondern in der verborgenen Ebene der Erdzweige von Jahr und Monat.')).toBe('nicht offen in einem Himmelsstamm');
    expect(findPositionStatement('Diese Stimme liegt nur im Monatszweig.')).toBe('nur im Monatszweig');
  });

  it('sets aside only the defining clause, not its sentence, and reads decomposed Unicode (PR #25 review, MINOR-6)', () => {
    expect(findPositionStatement('Die Stämme, die nicht sichtbar sind, liegen in den Zweigen, und die fordernde Stimme steht auf keiner Säule oben.')).toBe('keiner Säule');
    expect(findPositionStatement('Sie steht auf keiner Säule oben.'.normalize('NFD'))).toBe('keiner Säule');
    expect(findPositionStatement('Die Anforderung tritt nicht an der Oberfläche einer Säule auf.'.normalize('NFD'))).toBe('nicht an der Oberfläche einer Säule');
  });

  it('exempts a defining clause only where it opens its sentence, not after a determiner (PR #25 review, MINOR-11)', () => {
    expect(findPositionStatement('Die fordernden Stämme, die nicht offen auf einer Säule stehen, wirken von innen.')).toBe('nicht offen auf einer Säule');
    expect(findPositionStatement('In deinem Chart sind es die kontrollierenden Stämme, die nicht an der Oberfläche einer Säule erscheinen.')).toBe('nicht an der Oberfläche einer Säule');
    expect(findPositionStatement('Jeder Erdzweig trägt verborgene Stämme in sich: Himmelsstämme, die nicht auf der Oberfläche einer Säule stehen, sondern im Zweig enthalten sind.')).toBeNull();
  });

  it('leaves framework sentences alone: a defining clause about stems, "every pillar has", and "not only in"', () => {
    // The ETBZ-57 reading the Product Owner accepted at the Editorial Gate, chapters[2].paragraphs[3].
    expect(findPositionStatement('Himmelsstämme, die nicht auf der Oberfläche einer Säule stehen, sondern im Zweig enthalten sind.')).toBeNull();
    expect(findPositionStatement('Jede Säule hat oben einen Himmelsstamm und darunter einen Erdzweig.')).toBeNull();
    expect(findPositionStatement('Dieselbe Rolle liegt also nicht nur im Inneren der Monatssäule, sondern auch im Inneren der Stundensäule.')).toBeNull();
    expect(findPositionStatement('Sie liegt nicht nur im Monatszweig, sondern auch im Stundenzweig.')).toBeNull();
    expect(findPositionStatement('Das Thema hängt nicht nur an einer Position.')).toBeNull();
    expect(findPositionStatement('Eine Erwartung, die nirgends formuliert ist und trotzdem den Rahmen setzt.')).toBeNull();
    expect(findPositionStatement('Ein Anspruch, der überall dieselbe Sprache spricht.')).toBeNull();
  });
});

describe('ETBZ-60: a statement of every position is grounded by a fact of every pillar', () => {
  const { bundle, inputPackage } = skillFixtureV1_1();
  const baseline = readJson('docs/evidence/etbz-57/fixture/skill-reading.json');
  const pillarsOf = (paragraph: Paragraph): Set<string> =>
    new Set(paragraph.factRefs.map((id) => inputPackage.facts.find((fact) => fact.id === id)?.pillar).filter((pillar): pillar is NonNullable<typeof pillar> => pillar !== null && pillar !== undefined));

  it('accepts it in a paragraph that cites a fact of all four pillars, and refuses it in one that does not', () => {
    const everyPillar = baseline.chapters[0]?.paragraphs[0];
    expect(everyPillar === undefined ? [] : [...pillarsOf(everyPillar)].sort()).toEqual(['day', 'hour', 'month', 'year']);
    const sentence = ' Keine Säule steht dabei ohne Bezug zum Tagesmeister.';
    const grounded = structuredClone(baseline);
    if (grounded.chapters[0]?.paragraphs[0] !== undefined) grounded.chapters[0].paragraphs[0].text += sentence;
    expect(() => acceptSkillReading(grounded, { bundle, inputPackage })).not.toThrow();

    const ungrounded = structuredClone(baseline);
    const target = ungrounded.chapters[2]?.paragraphs[2];
    expect(target === undefined ? 4 : pillarsOf(target).size).toBeLessThan(4);
    if (target !== undefined) target.text += sentence;
    expect(refusalOf(() => acceptSkillReading(ungrounded, { bundle, inputPackage })).code).toBe('READING_POSITION_UNGROUNDED');
  });

  it('accepts the Editorial-Gate reading of ETBZ-57 unchanged', () => {
    expect(() => acceptSkillReading(baseline, { bundle, inputPackage })).not.toThrow();
  });
});

describe('ETBZ-60: grounding through claims, and the round-2 placement rule', () => {
  it('accepts a statement of every position grounded through its claims alone (round-2 R(S) [2.5] with its own facts removed)', async () => {
    const run = await deriveRound2Case('source');
    const reading = readJson(roundCaseFile('round-2', 'source', 'skill-reading'));
    const target = reading.chapters[2]?.paragraphs[5];
    expect(findPositionStatement(target?.text ?? '')).not.toBeNull();
    if (target !== undefined) target.factRefs = [];
    expect(() => acceptSkillReading(reading, { bundle: run.bundle, inputPackage: run.inputPackage })).not.toThrow();
  });

  it('refuses a plan without a CONTRAST chapter over the thesis or without an INTEGRATE chapter (REHEARSAL_DRAFT_PLAN_SHAPE)', async () => {
    const run = await deriveRound2Case('source');
    const context = contextFor(run.model);
    const base = casePlanDraft('source', { ...planContextFor(context, run.graph), contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 });
    const withoutIntegrate = { ...base, chapterPlan: base.chapterPlan.filter((chapter) => chapter.narrativeOperation !== 'INTEGRATE') };
    expect(() => placeSurfaceClaim(withoutIntegrate, 'draft.surface', 'source')).toThrow(/REHEARSAL_DRAFT_PLAN_SHAPE|no CONTRAST chapter over the thesis or no INTEGRATE chapter/u);
    expect(placeSurfaceClaim(base, 'draft.surface', 'source').chapterPlan.filter((chapter) => chapter.claimRefs.includes('draft.surface')).map((chapter) => chapter.narrativeOperation)).toEqual(['CONTRAST', 'INTEGRATE']);
  });
});
