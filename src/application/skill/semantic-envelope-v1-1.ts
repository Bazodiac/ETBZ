// =============================================================================
// ETBZ-57 - the Interpretation Lens voice revision as values.
//
// `ETBZ — Grounded Reflective Synthesis Interpretation Lens v1.1`
// (`grounded-reflective-synthesis-lens@1.1.0`, Confluence 77561858) changes how
// accepted meaning is voiced, never what may be meant (Rebaseline 62128133
// section 17: "Safety below the surface, clarity on the surface"). Every
// block the revision leaves alone is taken from the 1.0.0 envelope unchanged;
// the blocks below replace or add exactly what the revised page changes, and
// name its section. Sections are addressed by contract key, so an unchanged
// block cites the revised page at the same section number.
// =============================================================================

import { SEMANTIC_ENVELOPE } from './semantic-envelope.js';
import type { LensSection } from './semantic-envelope.js';

const lens = (section: string): LensSection => ({ contract: 'INTERPRETATION_LENS', section });

/** Section 1.1: the five invariants, quoted from Rebaseline section 17. */
export const VOICE_INVARIANTS = [
  { invariant: 'GROUNDING_INVARIANT', text: 'linguistic sharpness may never create more meaning than accepted Facts + ClaimGraph + Method Profile permit.' },
  { invariant: 'DIRECTNESS_INVARIANT', text: 'supported interpretations may be stated clearly; tentative interpretations retain visible uncertainty and uncertainty never decreases downstream.' },
  { invariant: 'CONCRETENESS_INVARIANT', text: 'central interpretations become understandable and experience-near without inventing biography, persons, places, situations or life domains as facts.' },
  { invariant: 'CUSTOMER_SURFACE_INVARIANT', text: 'narrative customer text discusses the interpreted pattern and possible lived recognition, not hashes, evidence plumbing, API/source mechanics or validation self-commentary. Required method/data disclosure remains in a clearly separated Method/Data Note.' },
  { invariant: 'INTERPRETIVE_EDGE_INVARIANT', text: 'grounded tensions, contrasts or uncomfortable implications may not be softened into emptiness; where no grounded tension exists, the Skill must not manufacture provocation.' },
] as const;
export const VOICE_INVARIANTS_SOURCE = lens('1.1');

/** Section 1.1: how DIRECTNESS reads against Method Profile section 8. */
export const UNCERTAINTY_CARRIED_NOT_ADDED =
  'uncertainty is carried, not added: it increases only through structure (a TENTATIVE claim, a provisional fact, a QUALIFIES or ALTERNATIVE_READING relation, an unknown birth time), never as a habitual hedge over a SUPPORTED claim';

/** Section 2: the posture column follows the claim's epistemic class. */
export const EPISTEMIC_LEVELS_V1_1 = [
  { level: 'E0', name: 'FACT', contains: 'validated FuFirE/ETBZ chart fact', posture: 'direct factual statement about the chart ("Your chart shows …"), never about the source' },
  { level: 'E1', name: 'AUTHORIZED_SYMBOLIC_RELATION', contains: 'meaning/operation explicitly permitted by bazi-method-profile@1.0.0', posture: 'the framework is named once where it is first needed (method note or first framing); relations are then written in the BaZi register itself, without "within this BaZi framework …" per sentence' },
  { level: 'E2', name: 'LOCAL_INTERPRETATION', contains: 'one bounded interpretation from accepted facts + methods + allowed semantic atoms', posture: 'posture follows the claim: SUPPORTED is stated directly as the reading of the chart; TENTATIVE is visibly tentative ("one possible reading is …")' },
  { level: 'E3', name: 'COMPOSITE_INTERPRETIVE_HYPOTHESIS', contains: 'synthesis of multiple accepted claims/relations into a tension, motif or pattern', posture: '"taken together, …" stated directly; tentative only where a TENTATIVE claim or a graph-carried alternative is part of the composite' },
  { level: 'E4', name: 'NARRATIVE_METAPHOR', contains: 'explanatory/editorial image for an already accepted interpretation', posture: 'metaphor is presentation, never evidence' },
  { level: 'E5', name: 'REFLECTION', contains: 'non-directive invitation to compare the symbolic reading with lived experience', posture: 'a direct, non-directive question the reader can check against concrete memories ("which side feels more familiar?")' },
] as const;

/** Section 2: the hard law read operationally. */
export const EPISTEMIC_HARD_LAW_READING =
  'an interpretation is never presented as a calculated chart fact, an empirical or psychological fact, or an identity verdict; directness about the symbolic reading does not breach the hard law; posture follows the claim\'s epistemic class, never the composition level';

/** Section 7.6: when an alternative manifestation may be written. */
export const ALTERNATIVE_BINDING =
  'an alternative manifestation is written only where the claim graph carries an ALTERNATIVE_READING relation or the claim itself is TENTATIVE; it is never a default closing line for a SUPPORTED claim';

/** Section 7.2: a grounded tension is stated; an ungrounded one is not written. */
export const TENSION_RULE =
  'where both claims are SUPPORTED the tension is stated, not softened; where the claim graph carries no CONTRASTS_WITH relation, no tension, conflict or contradiction is written';

/** Section 9 and 9.2: realisation tasks and language posture. */
export const LANGUAGE_POSTURE_V1_1 = {
  tasks: [
    'choose a coherent explanatory order',
    'connect accepted claims without changing them',
    'articulate tensions and integrations, and state a grounded tension plainly',
    'use restrained metaphors to make abstract relations understandable',
    'make accepted meaning concrete through experience-near situations the reader can recognise, without presenting a biography, a person, a place or a life domain as fact; an illustration is introduced as a situation in which the pattern can show up, never stated as the reader\'s behaviour, feeling, ability, habit or frequency, or as how other people see the reader',
    'explain a BaZi term in plain words at its first meaningful use and keep the term itself visible',
    'produce varied, natural prose across customers',
    'maintain conceptual continuity over long-form chapters',
    'carry each claim\'s epistemic class unchanged - SUPPORTED stated directly, TENTATIVE visibly tentative - and keep the tensions and alternatives the graph carries, adding none',
  ],
  prefer: [
    'a direct statement of a SUPPORTED interpretation about the chart',
    '"Taken together, …" to connect accepted claims',
    'a visible tentative marker only for TENTATIVE claims and graph-carried alternatives',
    'a direct recognition question',
  ],
  avoid: [
    '"You are…" as a total identity verdict',
    '"This explains why you…" as causal certainty',
    '"deep down you know…"',
    '"the chart proves…"',
    '"you need…"',
    '"you should…"',
    '"always / never / destined / guaranteed"',
    'narrating the source, the validation, the calculation, the pipeline, the plan, the chapters or the reading itself',
    'reciting in the narrative what the reading does not claim or which methods it does not use',
    'a hedge formula repeated as a template over SUPPORTED claims',
    'resolving a grounded tension into harmony, cooperation or a cause between its poles that the claim graph does not carry',
    'claiming that the chart or the reader is unique, or that one motif is the chart\'s core, centre or most important part',
    'reading the Wu-Xing distribution as the reader\'s surroundings or mood; it describes the chart\'s composition',
  ],
  source: lens('9.2'),
} as const;

/** Section 10: reflection jobs; alternative manifestation only where the graph carries it. */
export const REFLECTION_JOBS_V1_1 = {
  allowed: ['recognition', 'contextual comparison', 'alternative manifestation, where the graph carries it', 'pattern naming'],
  forbidden: SEMANTIC_ENVELOPE.reflectionJobs.forbidden,
  questionRule: 'a reflection question is understandable without BaZi knowledge, rests on accepted claims and points to situations the reader can remember; it never prescribes',
  source: lens('10'),
} as const;

/** Section 12.4: voice dimensions beside section 12.1, never folded into it. */
export const VOICE_EVALUATION_DIMENSIONS = ['DIRECTNESS', 'CUSTOMER_SURFACE', 'INTERPRETIVE_EDGE'] as const;
export const VOICE_REVIEW_LABELS = [
  'CLEAR_AND_CONCRETE', 'TOO_ABSTRACT', 'GENERIC', 'AI_REGISTER', 'OVER_HEDGED', 'META_NARRATION', 'UNLICENSED_OVERREACH',
] as const;
export const VOICE_EVALUATION_SOURCE = lens('12.4');

/** The 1.1.0 envelope: the 1.0.0 envelope with the revised blocks replaced and the new blocks added. */
export const SEMANTIC_ENVELOPE_V1_1 = {
  ...SEMANTIC_ENVELOPE,
  voiceInvariants: VOICE_INVARIANTS,
  voiceInvariantsSource: VOICE_INVARIANTS_SOURCE,
  uncertaintyCarriedNotAdded: UNCERTAINTY_CARRIED_NOT_ADDED,
  epistemicLevels: EPISTEMIC_LEVELS_V1_1,
  epistemicHardLawReading: EPISTEMIC_HARD_LAW_READING,
  alternativeBinding: ALTERNATIVE_BINDING,
  tensionRule: TENSION_RULE,
  languagePosture: LANGUAGE_POSTURE_V1_1,
  reflectionJobs: REFLECTION_JOBS_V1_1,
  voiceEvaluationDimensions: VOICE_EVALUATION_DIMENSIONS,
  voiceReviewLabels: VOICE_REVIEW_LABELS,
  voiceEvaluationSource: VOICE_EVALUATION_SOURCE,
} as const;
export type SemanticEnvelopeV1_1 = typeof SEMANTIC_ENVELOPE_V1_1;
