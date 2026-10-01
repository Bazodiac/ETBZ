// =============================================================================
// ETBZ-56 - an accepted Skill reading on the one projection.
//
// `buildSkillReadingProjection({ model, reading, bundle, inputPackage })` puts
// the customer text of an accepted Skill reading onto the same
// PresentationProjection and template the ETBZ-55 renderer draws - no second
// path, no second template. It adds no meaning: the text is the reading's
// customer projection, every chart value still comes from the validated
// chart, and the reading's identities are recorded in `sources.skill`, never
// printed.
//
// Fail-closed, in this order:
//  - the bundle must be a released bundle this projection presents (1.1.0,
//    the ETBZ-57 release); a candidate, a superseded 1.0.0 or an unknown
//    version is refused, and so is a bundle whose Lexicon values are not the
//    ones the template prints (PRESENTATION_SKILL_IDENTITY_REFUSED);
//  - the reading must pass `acceptSkillReading` again against that bundle and
//    package - the run boundary is composed, never re-implemented - and hash to
//    the structural hash it carries (PRESENTATION_SKILL_BINDING_MISMATCH);
//  - every fact of the input package must equal the chart value at its own
//    path, and the package's subject and slot vocabulary must be the chart's
//    and the template's (PRESENTATION_SKILL_BINDING_MISMATCH), so the PDF can
//    only show the chart the reading was written about;
//  - every visualization spec must name a slot a page draws or the template
//    leaves empty, and every fact it cites must be of a kind the slot-to-fact
//    vocabulary below knows (PRESENTATION_VISUAL_SPEC_UNBOUND).
//
// Does NOT: re-check the reading's wording (the run boundary did, under the
// bundle's own lists), fill an empty content slot from a spec (a spec carries
// references, no text), draw a cited fact the template does not show (it is
// recorded as not shown), or accept a reading with an unknown birth time (the
// projection refuses those, as for any payload).
// =============================================================================

import {
  CHART_TERMINOLOGY,
  TEN_GOD_RELATION_WORDING,
  acceptSkillReading,
  assertReleasedSkillContractBundle,
  contractBindingRef,
  contractByKey,
  projectCustomerReading,
} from '../skill/index.js';
import type { AcceptedSkillReading, ReadingVisualizationSpec, SkillContractBundle, SkillContractBundleCore, SkillInputPackage } from '../skill/index.js';
import { PAGE_FAMILY, listSlotIds } from '../visual/index.js';
import type { HoroscopeModel } from '../horoscope-model.js';
import { structuralHash } from '../../domain/structural-hash.js';
import { PresentationError } from './errors.js';
import type { PresentationErrorCode } from './errors.js';
import { projectPresentation } from './projection.js';
import type { PresentationProjection, SkillPresentationSources, VisualBinding } from './projection.js';

/** The bundle versions whose readings this projection presents: the release of ETBZ-57. 1.0.0 is superseded for new runs. */
export const PRESENTED_SKILL_BUNDLE_VERSIONS = ['1.1.0'] as const;

export interface SkillReadingPresentationInput {
  readonly model: HoroscopeModel;
  /** The accepted reading as it was recorded, its `structuralHash` included. Untrusted until accepted again. */
  readonly reading: unknown;
  readonly bundle: SkillContractBundle;
  readonly inputPackage: SkillInputPackage;
}

/**
 * The slot-to-fact-kind vocabulary (ADR 0011 left it to ETBZ-56): each fact kind of the input package, as the page
 * family names what a slot consumes. `null` marks a kind no page of the template shows (FuFirE's element-relation
 * notes, the Month Command, the dominant phase - ADR 0012 section 4). A kind missing from this table is refused.
 */
export const SKILL_FACT_KIND_TO_PAGE_KIND: Readonly<Record<string, string | null>> = {
  day_master: 'day_master_stem',
  day_master_hanzi: 'day_master_stem',
  day_master_pinyin: 'day_master_stem',
  day_master_element: 'stem_phase',
  day_master_polarity: 'stem_polarity',
  pillar_stem: 'pillar_stem',
  pillar_stem_hanzi: 'pillar_stem',
  pillar_stem_pinyin: 'pillar_stem',
  pillar_stem_element: 'stem_phase',
  pillar_stem_polarity: 'stem_polarity',
  pillar_branch: 'pillar_branch',
  pillar_branch_hanzi: 'pillar_branch',
  pillar_branch_pinyin: 'pillar_branch',
  pillar_branch_tier: 'branch_animal_label',
  hidden_stem: 'hidden_stem',
  hidden_stem_element: 'hidden_stem_phase',
  hidden_stem_qi_role: 'hidden_stem_qi_role',
  hidden_stem_ten_god: 'hidden_stem_ten_god_relation',
  hidden_stem_ten_god_element_relation: null,
  ten_god: 'ten_god_relation',
  ten_god_element_relation: null,
  wu_xing_weight: 'wu_xing_vector',
  wu_xing_dominant: null,
  month_command_branch: null,
  month_command_element: null,
  month_command_principal_qi_stem: null,
};

function refuse(code: PresentationErrorCode, message: string, detail: Readonly<Record<string, unknown>>): never {
  throw new PresentationError(code, message, detail);
}

// ---------------------------------------------------------------------------
// identity
// ---------------------------------------------------------------------------

function assertPresentedBundle(bundle: SkillContractBundle): void {
  if (!(PRESENTED_SKILL_BUNDLE_VERSIONS as readonly string[]).includes(bundle.bundleVersion)) {
    refuse('PRESENTATION_SKILL_IDENTITY_REFUSED', `bundle ${bundle.bundleRef} is not a version this projection presents`, {
      bundleVersion: bundle.bundleVersion,
      presented: PRESENTED_SKILL_BUNDLE_VERSIONS,
    });
  }
  try {
    assertReleasedSkillContractBundle(bundle);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'UNKNOWN';
    refuse('PRESENTATION_SKILL_IDENTITY_REFUSED', `bundle ${bundle.bundleRef} is not its released identity`, { bundleVersion: bundle.bundleVersion, cause: code });
  }
  assertBundleCarriesTemplateWording(bundle);
}

/**
 * The template prints the Ten-God names and chart terms from the module's Lexicon tables; the manifest records the
 * bundle's Lexicon. That is only true if the bundle carries the same values - refused otherwise. Exported so a test
 * can observe it on a bundle that differs (both released bundles carry the same values today).
 */
export function assertBundleCarriesTemplateWording(bundle: SkillContractBundleCore): void {
  if (structuralHash(bundle.wordingBoundaries.tenGodRelationWording) !== structuralHash(TEN_GOD_RELATION_WORDING)) {
    refuse('PRESENTATION_SKILL_IDENTITY_REFUSED', `bundle ${bundle.bundleRef} carries other Ten-God wording than the template prints`, { bundleVersion: bundle.bundleVersion });
  }
  const bundleTerms = new Set(bundle.wordingBoundaries.chartTerminology.map((entry) => entry.term));
  const missingTerm = CHART_TERMINOLOGY.find((entry) => !bundleTerms.has(entry.term));
  if (missingTerm !== undefined) {
    refuse('PRESENTATION_SKILL_IDENTITY_REFUSED', `bundle ${bundle.bundleRef} carries no term "${missingTerm.term}" the template prints`, { bundleVersion: bundle.bundleVersion });
  }
}

// ---------------------------------------------------------------------------
// the reading, the package and the chart
// ---------------------------------------------------------------------------

function acceptAgain(reading: unknown, bundle: SkillContractBundle, inputPackage: SkillInputPackage): AcceptedSkillReading {
  if (typeof reading !== 'object' || reading === null || Array.isArray(reading)) {
    return refuse('PRESENTATION_SKILL_BINDING_MISMATCH', 'the reading is not an object', {});
  }
  const { structuralHash: recorded, ...draft } = reading as Record<string, unknown>;
  if (typeof recorded !== 'string') return refuse('PRESENTATION_SKILL_BINDING_MISMATCH', 'the reading carries no structural hash', {});
  const accepted = acceptSkillReading(draft, { bundle, inputPackage });
  if (accepted.structuralHash !== recorded) {
    refuse('PRESENTATION_SKILL_BINDING_MISMATCH', 'the reading does not hash to the structural hash it carries', { recorded, actual: accepted.structuralHash });
  }
  return accepted;
}

const MISSING = Symbol('missing');

/** The value at a fact path of the chart (`natal.pillars.day.hiddenStems[0].element`), or MISSING. */
function valueAt(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split('.')) {
    const match = /^([^[\]]+)((?:\[\d+\])*)$/u.exec(segment);
    if (match === null) return MISSING;
    const steps: (string | number)[] = [match[1] as string, ...[...(match[2] ?? '').matchAll(/\[(\d+)\]/gu)].map((index) => Number(index[1]))];
    for (const step of steps) {
      if (typeof step === 'number') {
        if (!Array.isArray(current) || step >= current.length) return MISSING;
        current = current[step] as unknown;
      } else {
        if (typeof current !== 'object' || current === null || Array.isArray(current) || !Object.hasOwn(current, step)) return MISSING;
        current = (current as Record<string, unknown>)[step];
      }
    }
  }
  return current;
}

function assertPackageIsTheChart(model: HoroscopeModel, inputPackage: SkillInputPackage): void {
  if (inputPackage.subject.displayName !== model.displayName || inputPackage.subject.birthTimeKnown !== model.birth.birthTimeKnown) {
    refuse('PRESENTATION_SKILL_BINDING_MISMATCH', "the input package's subject is not the chart's", {});
  }
  for (const fact of inputPackage.facts) {
    const value = valueAt(model, fact.path);
    // A fact's value is text: a string verbatim, a number as `JSON.stringify` writes it (feature-set.ts numberText).
    const text = typeof value === 'string' ? value : typeof value === 'number' ? JSON.stringify(value) : null;
    if (text === null || text !== fact.value) {
      refuse('PRESENTATION_SKILL_BINDING_MISMATCH', `fact ${fact.id} does not equal the chart value at ${fact.path}`, { factId: fact.id, path: fact.path });
    }
  }
  const template = [...listSlotIds()].sort();
  const allowed = [...inputPackage.allowedSlotIds].sort();
  if (structuralHash(allowed) !== structuralHash(template)) {
    refuse('PRESENTATION_SKILL_BINDING_MISMATCH', "the input package's slot vocabulary is not the template's", { allowed: allowed.length, template: template.length });
  }
}

// ---------------------------------------------------------------------------
// visualization specs
// ---------------------------------------------------------------------------

function consumedKinds(slotId: string): ReadonlySet<string> {
  const kinds = new Set<string>();
  for (const page of PAGE_FAMILY) {
    for (const binding of page.bindings) {
      if (binding.slotId === slotId) for (const kind of binding.consumedFactKinds) kinds.add(kind);
    }
  }
  // ETBZ-56 AC 8: wherever a branch is shown, its animal label is shown with it.
  if (kinds.has('pillar_branch')) kinds.add('branch_animal_label');
  return kinds;
}

/**
 * Each visualization spec on the pages: where its slot is drawn, or why it stays empty, and which of its cited facts
 * the slot shows. Exported so a test can observe the refusals the released vocabulary and template cannot reach (a
 * slot no page draws, a fact kind the vocabulary does not know).
 */
export function bindVisualSpecs(
  specs: readonly ReadingVisualizationSpec[],
  facts: SkillInputPackage['facts'],
  projection: PresentationProjection,
): VisualBinding[] {
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  return specs.map((spec) => {
    const pageNumbers = projection.pages.filter((page) => page.slots.includes(spec.slotId)).map((page) => page.pageNumber);
    const empty = projection.emptyContentSlots.find((entry) => entry.slotId === spec.slotId);
    if (pageNumbers.length === 0 && empty === undefined) {
      refuse('PRESENTATION_VISUAL_SPEC_UNBOUND', `spec ${spec.specId} binds slot ${spec.slotId}, which no page draws`, { specId: spec.specId, slotId: spec.slotId });
    }
    const consumed = consumedKinds(spec.slotId);
    const shownFactRefs: string[] = [];
    const notShownFactRefs: string[] = [];
    for (const factRef of spec.factRefs) {
      const fact = factsById.get(factRef);
      if (fact === undefined) return refuse('PRESENTATION_VISUAL_SPEC_UNBOUND', `spec ${spec.specId} cites ${factRef}, which the package does not carry`, { specId: spec.specId, factRef });
      if (!Object.hasOwn(SKILL_FACT_KIND_TO_PAGE_KIND, fact.kind)) {
        refuse('PRESENTATION_VISUAL_SPEC_UNBOUND', `spec ${spec.specId} cites a fact of kind ${fact.kind}, which the slot vocabulary does not know`, { specId: spec.specId, kind: fact.kind });
      }
      const pageKind = SKILL_FACT_KIND_TO_PAGE_KIND[fact.kind] ?? null;
      if (pageNumbers.length > 0 && pageKind !== null && consumed.has(pageKind)) shownFactRefs.push(factRef);
      else notShownFactRefs.push(factRef);
    }
    return {
      specId: spec.specId,
      slotId: spec.slotId,
      pageNumbers,
      emptyReason: pageNumbers.length === 0 && empty !== undefined ? empty.reason : null,
      shownFactRefs,
      notShownFactRefs,
      claimRefs: [...spec.claimRefs],
    };
  });
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

export function buildSkillReadingProjection(input: SkillReadingPresentationInput): PresentationProjection {
  const { model, bundle, inputPackage } = input;
  assertPresentedBundle(bundle);
  const reading = acceptAgain(input.reading, bundle, inputPackage);
  assertPackageIsTheChart(model, inputPackage);

  const lexiconSource = contractByKey(bundle, 'TERMINOLOGY_LEXICON');
  const lexicon = {
    contractRef: contractBindingRef(lexiconSource),
    confluencePageId: lexiconSource.confluencePageId,
    confluencePageVersion: lexiconSource.confluencePageVersion,
  };
  const content = projectCustomerReading(reading);
  const identities: Omit<SkillPresentationSources, 'visualBindings'> = {
    skillRef: reading.skillRef,
    bundleRef: bundle.bundleRef,
    bundleStructuralHash: bundle.structuralHash,
    inputPackageStructuralHash: inputPackage.structuralHash,
    claimGraphStructuralHash: reading.claimGraphStructuralHash,
    planStructuralHash: reading.planStructuralHash,
    readingStructuralHash: reading.structuralHash,
    contracts: reading.contracts.map((binding) => ({ ...binding })),
  };
  // The pages do not depend on the record; the first build tells which page draws which slot.
  const pages = projectPresentation(model, content, { lexicon, skill: { ...identities, visualBindings: [] } });
  return projectPresentation(model, content, {
    lexicon,
    skill: { ...identities, visualBindings: bindVisualSpecs(reading.visualizationSpecs, inputPackage.facts, pages) },
  });
}
