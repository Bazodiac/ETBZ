/**
 * ETBZ-52 — the Skill input package and the accepted fixture reading.
 *
 * The values a Skill run is bound to are stated here in full: the package hash
 * of the known-time fixture, the hash of the accepted reading, the contract set.
 * A change to the fixture chain, the vocabularies or the reading is a new run,
 * never an edit of this one.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import {
  CHAPTER_WORD_BUDGET,
  SKILL_INPUT_PACKAGE_VERSION,
  SKILL_READING_SCHEMA_VERSION,
  SKILL_REF,
  acceptSkillReading,
  countWords,
  findEvidenceChrome,
  findProhibitedWording,
  findUnsupportedMethodTerm,
  projectCustomerReading,
  skillReadingJsonSchema,
} from '../../src/application/skill/index.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { LONG_FORM_WORD_BUDGET } from '../../src/application/visual/pagination.js';
import { skillFixture } from '../support/skillFixture.js';

const FIXTURE_DIR = resolve(process.cwd(), 'docs/evidence/etbz-52/fixture');
const readFixture = (name: string): unknown => JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf8'));

const fixture = skillFixture();
const { bundle, inputPackage } = fixture;

describe('ETBZ-52: the Skill input package of the known-time fixture', () => {
  it('is bazodiac-skill-input.v1 for bazodiac-interpretation-skill@1.0.0 under the released bundle', () => {
    expect(SKILL_REF).toBe('bazodiac-interpretation-skill@1.0.0');
    expect(inputPackage.packageVersion).toBe(SKILL_INPUT_PACKAGE_VERSION);
    expect(inputPackage.skillRef).toBe(SKILL_REF);
    expect(inputPackage.bundleRef).toBe('bazodiac-skill-contract-bundle@1.0.0');
    expect(inputPackage.bundleStructuralHash).toBe(bundle.structuralHash);
    expect(inputPackage.contracts).toEqual([
      { contractRef: 'bazi-method-profile@1.0.0', confluencePageId: '63012866', confluencePageVersion: '5' },
      { contractRef: 'confluence:57802765@2', confluencePageId: '57802765', confluencePageVersion: '2' },
      { contractRef: 'grounded-reflective-synthesis-lens@1.0.0', confluencePageId: '67371029', confluencePageVersion: '1' },
      { contractRef: 'terminology-wording-lexicon@1.0.0', confluencePageId: '67600385', confluencePageVersion: '1' },
      { contractRef: 'cross-reading-individuality-contract@1.0.0', confluencePageId: '72056833', confluencePageVersion: '1' },
    ]);
  });

  it('carries the interpretable facts, the warnings verbatim and the subject of the fixture chart', () => {
    expect(inputPackage.subject).toEqual({ displayName: 'Musterkundin A', birthTimeKnown: true });
    expect(inputPackage.facts).toHaveLength(101);
    expect(inputPackage.facts.every((fact) => fact.interpretable)).toBe(true);
    expect(inputPackage.excludedFactIds).toEqual([]);
    expect(inputPackage.provisionalFactIds).toEqual([]);
    expect(inputPackage.warnings).toEqual(['DAY_ANCHOR_UNVERIFIED']);
    expect(inputPackage.precision.birthTimeKnown).toBe(true);
    expect(inputPackage.interpretationInputStructuralHash).toBe(fixture.input.structuralHash);
  });

  it('binds the accepted claim graph and plan of the fixture and the slots of the visual contract', () => {
    expect(inputPackage.claimGraph).toBe(fixture.graph);
    expect(inputPackage.plan).toBe(fixture.plan);
    expect(inputPackage.plan.claimGraphStructuralHash).toBe(fixture.graph.structuralHash);
    expect(inputPackage.allowedSlotIds).toEqual(listSlotIds());
    expect(inputPackage.claimGraph.claims).toHaveLength(6);
    expect(inputPackage.plan.chapterPlan.map((chapter) => chapter.narrativeOperation)).toEqual([
      'ESTABLISH', 'REINFORCE', 'CONTRAST', 'CONTEXTUALIZE', 'QUALIFY', 'CONTRAST', 'INTEGRATE',
    ]);
  });

  it('is frozen by its content hash, stated in full', () => {
    const { structuralHash: published, ...core } = inputPackage;
    expect(published).toBe(structuralHash(core));
    expect(published).toBe('sha256:ad10c1de5d761d0108be706ab469ca9c48c21ff63edd7e11b18ba7a2189c71fb');
  });

  it('carries no raw producer body and no excluded value', () => {
    const text = canonicalJson(inputPackage);
    expect(text).not.toContain('baziRaw');
    expect(text).not.toContain('wuxingRaw');
    expect(text).not.toContain('natalRaw');
    expect(text).not.toContain('REDACTED_PII');
  });
});

describe('ETBZ-52: the accepted fixture reading', () => {
  const draft = readFixture('skill-reading.json');
  // Accepted lazily: a package mutant that breaks the reading's bindings must fail
  // these tests, not the file's collection - the package tests above still run.
  let accepted!: ReturnType<typeof acceptSkillReading>;
  beforeAll(() => {
    accepted = acceptSkillReading(draft, { bundle, inputPackage });
  });

  it('is accepted, hash-bound, and equals the committed accepted reading', () => {
    expect(accepted.schemaVersion).toBe(SKILL_READING_SCHEMA_VERSION);
    expect(accepted.structuralHash).toBe('sha256:7bab4c731ca0e4416636549c9fe32c1c212df6fbb11feadffa7426dacd21a4ea');
    const { structuralHash: published, ...core } = accepted;
    expect(published).toBe(structuralHash(core));
    expect(accepted).toEqual(readFixture('accepted-reading.json'));
  });

  it('renders the plan: seven chapters in order, every planned claim in its chapter, the thesis, one delta per chapter', () => {
    expect(accepted.chapters.map((chapter) => chapter.chapterRef)).toEqual(inputPackage.plan.chapterPlan.map((chapter) => chapter.chapterId));
    accepted.chapters.forEach((chapter, index) => {
      const planned = inputPackage.plan.chapterPlan[index];
      const rendered = new Set(chapter.paragraphs.flatMap((paragraph) => paragraph.claimRefs));
      expect([...rendered].sort()).toEqual([...(planned?.claimRefs ?? [])].sort());
      expect(chapter.semanticDelta.length).toBeGreaterThan(0);
      const words = chapter.paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph.text), 0);
      expect(words).toBeGreaterThanOrEqual(CHAPTER_WORD_BUDGET.min);
      expect(words).toBeLessThanOrEqual(CHAPTER_WORD_BUDGET.max);
    });
    const renderedAnywhere = new Set(accepted.chapters.flatMap((chapter) => chapter.paragraphs.flatMap((paragraph) => paragraph.claimRefs)));
    for (const claimId of inputPackage.plan.reportThesis.claimRefs) expect(renderedAnywhere.has(claimId)).toBe(true);
  });

  it('separates FACT, FRAME, INTERPRETATION and REFLECTION and carries the source warning verbatim', () => {
    const kinds = new Set(accepted.chapters.flatMap((chapter) => chapter.paragraphs.map((paragraph) => paragraph.kind)));
    expect([...kinds].sort()).toEqual(['FACT', 'FRAME', 'INTERPRETATION', 'REFLECTION']);
    expect(accepted.reflectionQuestions).toHaveLength(3);
    expect(accepted.methodNote.warningCodes).toEqual(['DAY_ANCHOR_UNVERIFIED']);
    expect(accepted.visualizationSpecs.length).toBeGreaterThan(0);
    for (const spec of accepted.visualizationSpecs) expect(inputPackage.allowedSlotIds).toContain(spec.slotId);
  });

  it('projects to a text-only customer reading that equals the committed one and carries no evidence', () => {
    const customer = projectCustomerReading(accepted);
    expect(customer).toEqual(readFixture('customer-reading.json'));
    const text = canonicalJson(customer);
    expect(text).not.toMatch(/sha256|claim\.|chapter\.|chart\.|DAY_ANCHOR|fixture/u);
    expect(customer.chapters).toHaveLength(7);
    expect(customer.reflectionQuestions).toHaveLength(3);
  });
});

describe('ETBZ-52: the wording gates and helpers', () => {
  it.each([
    ['du solltest das ändern', 'ADVICE_PREDICTION'],
    ['this proves your nature', 'DETERMINISM_CAUSALITY'],
    ['ein schwacher Tagesmeister', 'UNSUPPORTED_BALANCE_STRENGTH'],
    ['an old trauma', 'CLINICAL_THERAPEUTIC'],
    ['eine männliche Energie', 'GENDER_IDENTITY'],
    ['deine kosmische Schwingung', 'MYSTIFICATION_PSEUDO_SCIENCE'],
    ['tief in dir weißt du es', 'IDENTITY_VERDICT'],
  ])('finds prohibited wording in "%s"', (text, classId) => {
    expect(findProhibitedWording(text)?.classId).toBe(classId);
  });

  it('finds no prohibited wording in bounded customer language', () => {
    expect(findProhibitedWording('Innerhalb dieses BaZi-Rahmens kann dies als eine mögliche Lesart gelesen werden.')).toBeNull();
    expect(findProhibitedWording('You may recognise one side more than the other.')).toBeNull();
  });

  it.each(['die Jahreszeit', 'the seasonal strength', 'ein Sommer', 'luck pillars', 'Glückssäulen', 'Ge Ju', 'Useful God', 'Nayin', 'Shensha', 'Yongshen', 'Dayun', 'Tonggen', 'Kongwang'])(
    'finds unsupported method language in "%s"',
    (text) => {
      expect(findUnsupportedMethodTerm(text)).not.toBeNull();
    },
  );

  it('does not mistake everyday words for methods', () => {
    expect(findUnsupportedMethodTerm('a strong theme with deep roots in the chart')).toBeNull();
    expect(findUnsupportedMethodTerm('die Jahressäule trägt den Stamm')).toBeNull();
  });

  it.each([
    ['sha256:abc', 'hash'],
    ['see claim.sha256:0123456789abcdef', 'hash'],
    ['claim.0123456789ab', 'artefact id'],
    ['chart.pillar.year.stem', 'fact id'],
    ['DAY_ANCHOR_UNVERIFIED', 'state or code'],
    ['a fixture label', 'fixture'],
  ])('finds evidence chrome in "%s"', (text, label) => {
    expect(findEvidenceChrome(text)).toBe(label);
  });

  it('counts words on whitespace', () => {
    expect(countWords('  vier   Säulen\nund ein Reading ')).toBe(5);
    expect(countWords('')).toBe(0);
  });

  it('binds the chapter word budget to the visual system budget (Confluence 66650114 v2 section 12)', () => {
    expect(CHAPTER_WORD_BUDGET).toEqual(LONG_FORM_WORD_BUDGET);
  });

  it('exports the reading schema as JSON Schema with the closed shape', () => {
    const schema = skillReadingJsonSchema() as { type?: string; required?: string[]; additionalProperties?: boolean };
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(expect.arrayContaining(['chapters', 'methodNote', 'reflectionQuestions', 'visualizationSpecs', 'contracts']));
    expect(schema.additionalProperties).toBe(false);
  });
});
