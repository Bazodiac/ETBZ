/**
 * ETBZ-56 — the refusals of `buildSkillReadingProjection`.
 *
 * Pattern: the accepted ETBZ-57 reading of the synthetic known-time chart, with
 * its 1.1.0 input package, is the green baseline; each test changes as little as
 * its refusal needs. A refusal of the run boundary (`acceptSkillReading`) surfaces
 * unchanged as `SkillRunError`; every other one is a `PresentationError` with its
 * code. Nothing partial is returned.
 */
import { describe, expect, it } from 'vitest';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import {
  PresentationError,
  assertBundleCarriesTemplateWording,
  bindVisualSpecs,
  buildSkillReadingProjection,
} from '../../src/application/presentation/index.js';
import type { PresentationErrorCode } from '../../src/application/presentation/index.js';
import {
  RELEASED_BUNDLE_HASHES,
  SkillRunError,
  acceptSkillReading,
  buildSkillContractBundle,
  buildSkillInputPackage,
} from '../../src/application/skill/index.js';
import type { SkillContractBundle, SkillInputPackage } from '../../src/application/skill/index.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { skillFixtureV1_1 } from '../support/skillFixture.js';
import { skillPresentationFixture } from '../support/skillPresentationFixture.js';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

const fixture = skillPresentationFixture();
const parts = skillFixtureV1_1();

function thrown(action: () => unknown): unknown {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  return caught;
}

function expectRefusal(action: () => unknown, code: PresentationErrorCode): PresentationError {
  const caught = thrown(action);
  expect(caught, 'expected a PresentationError').toBeInstanceOf(PresentationError);
  expect((caught as PresentationError).code).toBe(code);
  return caught as PresentationError;
}

const present = (over: Partial<{ model: HoroscopeModel; reading: unknown; bundle: SkillContractBundle; inputPackage: SkillInputPackage }> = {}) =>
  buildSkillReadingProjection({ model: fixture.model, reading: fixture.reading, bundle: fixture.bundle, inputPackage: fixture.inputPackage, ...over });

function modelWith(edit: (model: Mutable<HoroscopeModel>) => void): HoroscopeModel {
  const copy = structuredClone(fixture.model) as Mutable<HoroscopeModel>;
  edit(copy);
  return copy;
}

function readingWith(edit: (reading: Record<string, unknown>) => void): Record<string, unknown> {
  const copy = structuredClone(fixture.reading);
  edit(copy);
  return copy;
}

describe('S0: the baseline presents the accepted reading under its released identities', () => {
  it('projects 29 pages recorded under bundle, Skill, Lexicon and reading 1.1.0', () => {
    const { projection } = fixture;
    expect(projection.pageCount).toBe(29);
    expect(projection.sources.lexicon).toEqual({ contractRef: 'terminology-wording-lexicon@1.1.0', confluencePageId: '77529091', confluencePageVersion: '4' });
    const skill = projection.sources.skill;
    expect(skill?.skillRef).toBe('bazodiac-interpretation-skill@1.1.0');
    expect(skill?.bundleRef).toBe('bazodiac-skill-contract-bundle@1.1.0');
    expect(skill?.bundleStructuralHash).toBe(RELEASED_BUNDLE_HASHES['1.1.0']);
    expect(skill?.readingStructuralHash).toBe(fixture.reading['structuralHash']);
    expect(skill?.inputPackageStructuralHash).toBe(fixture.inputPackage.structuralHash);
    expect(skill?.contracts.map((binding) => [binding.contractRef, binding.confluencePageVersion])).toEqual(
      expect.arrayContaining([
        ['grounded-reflective-synthesis-lens@1.1.0', '6'],
        ['terminology-wording-lexicon@1.1.0', '4'],
        ['cross-reading-individuality-contract@1.1.0', '3'],
      ]),
    );
  });

  it('prints the reading text and nothing of its identities (AC 5: no internal evidence ids)', () => {
    const { projection } = fixture;
    const customer = projection.customerStrings.join('\n');
    const skill = projection.sources.skill;
    if (skill === undefined) throw new Error('no skill record');
    const identifiers = [
      skill.skillRef, skill.bundleRef, skill.bundleStructuralHash, skill.inputPackageStructuralHash, skill.readingStructuralHash,
      skill.claimGraphStructuralHash, skill.planStructuralHash,
      ...skill.visualBindings.flatMap((binding) => [binding.specId, binding.slotId, ...binding.shownFactRefs, ...binding.notShownFactRefs, ...binding.claimRefs]),
    ];
    for (const identifier of identifiers) expect(customer, identifier).not.toContain(identifier);
    expect(customer).not.toMatch(/sha256:|claim\.sha256|chart\.(pillar|natal|dayMaster|wuxing)|spec\.|chapter\.sha256/u);
    const chapterTitles = (fixture.reading['chapters'] as { title: string }[]).map((chapter) => chapter.title);
    for (const title of chapterTitles) expect(projection.customerStrings).toContain(title);
  });
});

describe('S1: the bundle must be the released identity this projection presents (AC 7)', () => {
  it('refuses the superseded 1.0.0 bundle', () => {
    const error = expectRefusal(() => present({ bundle: buildSkillContractBundle() }), 'PRESENTATION_SKILL_IDENTITY_REFUSED');
    expect(error.detail['bundleVersion']).toBe('1.0.0');
  });

  it('refuses a 1.1.0 bundle that is not its released identity (a placeholder hash, an edited contract)', () => {
    const placeholder = { ...fixture.bundle, structuralHash: `sha256:${'0'.repeat(64)}` };
    expectRefusal(() => present({ bundle: placeholder }), 'PRESENTATION_SKILL_IDENTITY_REFUSED');
    const edited = structuredClone(fixture.bundle) as Mutable<SkillContractBundle>;
    const lexicon = edited.contracts.find((source) => source.key === 'TERMINOLOGY_LEXICON');
    if (lexicon === undefined) throw new Error('no Lexicon');
    lexicon.confluencePageVersion = '3';
    expectRefusal(() => present({ bundle: edited }), 'PRESENTATION_SKILL_IDENTITY_REFUSED');
  });

  it('refuses a bundle whose Ten-God wording or chart terms are not the ones the template prints', () => {
    expect(() => assertBundleCarriesTemplateWording(fixture.bundle)).not.toThrow();
    expect(() => assertBundleCarriesTemplateWording(buildSkillContractBundle())).not.toThrow();
    const wording = structuredClone(fixture.bundle) as Mutable<SkillContractBundle>;
    const first = wording.wordingBoundaries.tenGodRelationWording[0];
    if (first === undefined) throw new Error('no wording');
    first.customerDe = `${first.customerDe} (anders)`;
    expectRefusal(() => assertBundleCarriesTemplateWording(wording), 'PRESENTATION_SKILL_IDENTITY_REFUSED');
    const terms = structuredClone(fixture.bundle) as Mutable<SkillContractBundle>;
    terms.wordingBoundaries.chartTerminology = terms.wordingBoundaries.chartTerminology.filter((entry) => !entry.term.startsWith('Earthly Branches'));
    expectRefusal(() => assertBundleCarriesTemplateWording(terms), 'PRESENTATION_SKILL_IDENTITY_REFUSED');
  });
});

describe('S2: the reading must be accepted again and be the reading it says it is', () => {
  it('refuses a reading that is not an object or carries no structural hash', () => {
    expectRefusal(() => present({ reading: 'reading' }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
    expectRefusal(() => present({ reading: readingWith((reading) => { delete reading['structuralHash']; }) }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
  });

  it('refuses a reading whose content no longer hashes to its recorded hash (output/hash mismatch)', () => {
    const retitled = readingWith((reading) => { reading['title'] = `${String(reading['title'])} heute`; });
    expectRefusal(() => present({ reading: retitled }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
    const rehashed = readingWith((reading) => { reading['structuralHash'] = `sha256:${'1'.repeat(64)}`; });
    expectRefusal(() => present({ reading: rehashed }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
  });

  it('surfaces the run boundary refusal unchanged for an unknown fact or claim reference (AC 2)', () => {
    const unknownFact = readingWith((reading) => {
      const specs = reading['visualizationSpecs'] as { factRefs: string[] }[];
      (specs[0] as { factRefs: string[] }).factRefs = ['chart.pillar.year.invented'];
    });
    const caught = thrown(() => present({ reading: unknownFact }));
    expect(caught).toBeInstanceOf(SkillRunError);
    expect((caught as SkillRunError).code).toBe('READING_VISUAL_REF_INVALID');
    const unknownClaim = readingWith((reading) => {
      const questions = reading['reflectionQuestions'] as { claimRefs: string[] }[];
      (questions[0] as { claimRefs: string[] }).claimRefs = [`claim.sha256:${'2'.repeat(64)}`];
    });
    expect(thrown(() => present({ reading: unknownClaim }))).toBeInstanceOf(SkillRunError);
  });
});

describe('S3: the package and the chart must be the same chart', () => {
  it('refuses a chart whose value differs from a package fact, shown or not', () => {
    expectRefusal(() => present({ model: modelWith((model) => { model.wuxing.vector['Erde'] = 3; }) }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
    expectRefusal(() => present({ model: modelWith((model) => { model.wuxing.dominant = 'Erde'; }) }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
    expectRefusal(() => present({ model: modelWith((model) => { model.pillars.hour.tierDe = 'Schaf'; }) }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
  });

  it("refuses a chart of another subject than the package's", () => {
    expectRefusal(() => present({ model: modelWith((model) => { model.displayName = 'Musterkundin B'; }) }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
  });

  it("refuses a package whose slot vocabulary is not the template's, even with a reading bound to it", () => {
    const allowedSlotIds = listSlotIds().filter((slotId) => slotId !== 'education.anchors');
    const narrowed = buildSkillInputPackage({
      bundle: parts.bundle,
      input: parts.input,
      graph: parts.graph,
      plan: parts.plan,
      subject: parts.inputPackage.subject,
      allowedSlotIds,
    });
    const draft = structuredClone(fixture.reading);
    delete draft['structuralHash'];
    const rebound = acceptSkillReading({ ...draft, inputPackageStructuralHash: narrowed.structuralHash }, { bundle: parts.bundle, inputPackage: narrowed });
    expectRefusal(() => present({ reading: rebound, inputPackage: narrowed }), 'PRESENTATION_SKILL_BINDING_MISMATCH');
  });
});

describe('S4: visualization specs on the pages', () => {
  const specs = (fixture.reading['visualizationSpecs'] as Parameters<typeof bindVisualSpecs>[0]);

  it('records where each slot is drawn, the empty Day-Master reading slot, and the cited facts no slot shows', () => {
    const bindings = fixture.projection.sources.skill?.visualBindings ?? [];
    expect(bindings.map((binding) => binding.specId)).toEqual(specs.map((spec) => spec.specId));
    const byId = new Map(bindings.map((binding) => [binding.specId, binding]));
    expect(byId.get('spec.dayMaster.reading')).toMatchObject({ pageNumbers: [], emptyReason: 'NO_APPROVED_CONTENT', shownFactRefs: [] });
    expect(byId.get('spec.glance.wuXing')?.notShownFactRefs).toEqual(['chart.wuxing.dominant']);
    expect(byId.get('spec.pillars.branch')?.pageNumbers).toEqual([5]);
    for (const binding of bindings) if (binding.emptyReason === null) expect(binding.pageNumbers.length, binding.specId).toBeGreaterThan(0);
  });

  it('refuses a spec over a slot no page draws, a fact the package lacks and a fact kind the vocabulary does not know', () => {
    const first = specs[0];
    if (first === undefined) throw new Error('no spec');
    expectRefusal(() => bindVisualSpecs([{ ...first, slotId: 'nowhere.drawn' }], fixture.inputPackage.facts, fixture.projection), 'PRESENTATION_VISUAL_SPEC_UNBOUND');
    expectRefusal(() => bindVisualSpecs([{ ...first, factRefs: ['chart.missing'] }], fixture.inputPackage.facts, fixture.projection), 'PRESENTATION_VISUAL_SPEC_UNBOUND');
    const cited = first.factRefs[0];
    const facts = fixture.inputPackage.facts.map((fact) => (fact.id === cited ? { ...fact, kind: 'invented_kind' } : fact)) as unknown as SkillInputPackage['facts'];
    expectRefusal(() => bindVisualSpecs([first], facts, fixture.projection), 'PRESENTATION_VISUAL_SPEC_UNBOUND');
  });
});
