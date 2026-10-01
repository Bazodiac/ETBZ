// =============================================================================
// ETBZ-51 - the Skill Contract Bundle: one versioned, hash-frozen set of the
// contracts a Bazodiac Interpretation Skill run is held to.
//
// A Skill may not interpret from model memory or from a stale copy of a page.
// The bundle therefore binds, in one place: the five released contract sources
// by page id and released page version; the executable representation of the
// Lens, the Lexicon and the Anti-Boilerplate contract as closed vocabularies;
// the repository's own version markers (registry hash, interpretation input,
// feature set, claim graph, plan); and the domain-scoped precedence between
// contracts. The whole thing is frozen by content hash per released bundle
// version, exactly like the Method Registry.
//
// What the bundle does NOT do:
//  - it defines no method, fact kind, operation or mapping - every `methodRefs`
//    entry must be an approved method of the released registry, and a bundle
//    that carries `methods`, `facts` or a mapping is refused outright;
//  - it holds no prompt and no customer prose beyond the Lexicon's own
//    "preferred pattern" entries - it is what a prompt is bound to;
//  - it is never read from disk - a portable copy is a carrier that must equal
//    the repository's bundle in canonical content, or it is refused.
//
// Every refusal is a `SkillContractError` with a named code (see errors.ts);
// the first violation throws and no partial bundle exists.
// =============================================================================

import { z } from 'zod';
import { canonicalJson } from '../../domain/canonical-json.js';
import { structuralHash } from '../../domain/structural-hash.js';
import { FEATURE_SET_VERSION } from '../interpretation/feature-set.js';
import { INTERPRETATION_INPUT_SCHEMA_VERSION } from '../interpretation/interpretation-input.js';
import { INTERPRETIVE_CLAIM_GRAPH_VERSION } from '../interpretation/interpretive-claim-graph.js';
import {
  META_NARRATIVE_PLAN_VERSION,
  PLAN_CONTRACT_BINDINGS_V1_0,
  PLAN_CONTRACT_BINDINGS_V1_1,
} from '../interpretation/meta-narrative-plan.js';
import type { PlanContractBindings, ReleasedContractBinding } from '../interpretation/meta-narrative-plan.js';
import {
  BAZI_METHOD_REGISTRY_V1,
  METHOD_PROFILE_REF,
  RELEASED_REGISTRY_HASHES,
  assertReleasedRegistry,
  isApprovedStatus,
  methodRegistryStructuralHash,
} from '../interpretation/method-registry.js';
import type { MethodRegistry } from '../interpretation/method-registry.js';
import {
  CONTRACT_DOMAINS,
  CONTRACT_KEYS,
  CONTRACT_SOURCES_V1_1,
  CONTRACT_STATUSES,
  PARENT_DECISION,
  PRECEDENCE_TIERS,
  RELEASED_CONTRACT_SOURCES,
  contractBindingRef,
} from './contract-sources.js';
import type { ContractDomain, ContractKey, ContractSource } from './contract-sources.js';
import { SkillContractError } from './errors.js';
import { INDIVIDUALITY_CONTRACT } from './individuality-contract.js';
import type { IndividualityContract } from './individuality-contract.js';
import { SEMANTIC_ENVELOPE } from './semantic-envelope.js';
import type { SemanticEnvelope } from './semantic-envelope.js';
import { SEMANTIC_ENVELOPE_V1_1 } from './semantic-envelope-v1-1.js';
import type { SemanticEnvelopeV1_1 } from './semantic-envelope-v1-1.js';
import { WORDING_BOUNDARIES } from './wording-boundaries.js';
import type { WordingBoundaries } from './wording-boundaries.js';
import { WORDING_BOUNDARIES_V1_1 } from './wording-boundaries-v1-1.js';
import type { WordingBoundariesV1_1 } from './wording-boundaries-v1-1.js';

export const SKILL_CONTRACT_BUNDLE_ID = 'bazodiac-skill-contract-bundle' as const;
export const SKILL_CONTRACT_BUNDLE_VERSION = '1.0.0' as const;
/** The identity a Skill run's evidence records. */
export const SKILL_CONTRACT_BUNDLE_REF =
  `${SKILL_CONTRACT_BUNDLE_ID}@${SKILL_CONTRACT_BUNDLE_VERSION}` as const;
/** ETBZ-57: the bundle of the voice revision (Lens, Lexicon and Anti-Boilerplate at 1.1.0). */
export const SKILL_CONTRACT_BUNDLE_VERSION_V1_1 = '1.1.0' as const;
export const SKILL_CONTRACT_BUNDLE_REF_V1_1 =
  `${SKILL_CONTRACT_BUNDLE_ID}@${SKILL_CONTRACT_BUNDLE_VERSION_V1_1}` as const;

/** The repository's own version markers the bundle pins beside the pages. */
export interface RepositoryBindings {
  readonly methodProfileRef: string;
  readonly methodRegistryStructuralHash: string;
  readonly interpretationInputSchemaVersion: string;
  readonly featureSetVersion: string;
  readonly interpretiveClaimGraphVersion: string;
  readonly metaNarrativePlanVersion: string;
}

export interface SkillContractBundleCore {
  readonly bundleId: typeof SKILL_CONTRACT_BUNDLE_ID;
  readonly bundleVersion: string;
  readonly bundleRef: string;
  readonly parentDecision: typeof PARENT_DECISION;
  readonly contracts: readonly ContractSource[];
  readonly precedenceTiers: readonly (readonly ContractKey[])[];
  readonly domains: readonly ContractDomain[];
  readonly repository: RepositoryBindings;
  readonly semanticEnvelope: SemanticEnvelope | SemanticEnvelopeV1_1;
  readonly wordingBoundaries: WordingBoundaries | WordingBoundariesV1_1;
  readonly individuality: IndividualityContract;
}

export interface SkillContractBundle extends SkillContractBundleCore {
  /** `sha256:` + SHA-256 of the canonical JSON of everything above. */
  readonly structuralHash: string;
}

/** What a consuming run records; checked against the bundle by `assertRunEvidenceBound`. */
export interface SkillRunContractEvidence {
  readonly bundleRef: string;
  readonly contracts: readonly ReleasedContractBinding[];
}

/**
 * The content hash each RELEASED bundle version is frozen to. A bundle whose
 * content is not the released one authorises no run: a changed page version,
 * a widened envelope or an edited wording table is a new bundle version with
 * a new hash and a Confluence re-binding - never an in-place edit.
 */
export const RELEASED_BUNDLE_HASHES: Readonly<Record<string, string>> = {
  '1.0.0': 'sha256:1c8f80c38b57748e65035a6bd2d671604fb19574cdf3355326352fbe0e19564e',
};

/**
 * ETBZ-57: bundle versions whose contract set is still a CANDIDATE, frozen to
 * their content hash exactly like a released version. A candidate authorises
 * an evaluation run and nothing else - it is never a released version, and a
 * release moves it from this table to RELEASED_BUNDLE_HASHES with a new hash.
 */
export const CANDIDATE_BUNDLE_HASHES: Readonly<Record<string, string>> = {
  '1.1.0': 'sha256:c584aa05ef0adc71a457ab7ded0543c27863d122427febef9416c0418b4298e1',
};

/**
 * ETBZ-57: the explicit opt-in every boundary asks for before it lets a
 * CANDIDATE bundle through. Absent, the bundle must be released.
 */
export interface CandidateEvaluation {
  readonly candidateEvaluation?: true;
}

export function isCandidateVersion(bundleVersion: string): boolean {
  return Object.hasOwn(CANDIDATE_BUNDLE_HASHES, bundleVersion);
}

/** What distinguishes one bundle version from another: its contract set and the contract values it carries. */
interface BundleVersionSpec {
  readonly contracts: readonly ContractSource[];
  readonly planBindings: PlanContractBindings;
  readonly semanticEnvelope: SemanticEnvelope | SemanticEnvelopeV1_1;
  readonly wordingBoundaries: WordingBoundaries | WordingBoundariesV1_1;
}

/**
 * Every bundle version this repository builds. 1.0.0 stays buildable so that
 * evidence generated under it (ETBZ-52) is re-derived, never re-bound.
 */
const BUNDLE_VERSION_SPECS: Readonly<Record<string, BundleVersionSpec>> = {
  '1.0.0': { contracts: RELEASED_CONTRACT_SOURCES, planBindings: PLAN_CONTRACT_BINDINGS_V1_0, semanticEnvelope: SEMANTIC_ENVELOPE, wordingBoundaries: WORDING_BOUNDARIES },
  '1.1.0': { contracts: CONTRACT_SOURCES_V1_1, planBindings: PLAN_CONTRACT_BINDINGS_V1_1, semanticEnvelope: SEMANTIC_ENVELOPE_V1_1, wordingBoundaries: WORDING_BOUNDARIES_V1_1 },
};
export const SKILL_CONTRACT_BUNDLE_VERSIONS = ['1.0.0', '1.1.0'] as const;

function specFor(bundleVersion: string): BundleVersionSpec {
  const spec = Object.hasOwn(BUNDLE_VERSION_SPECS, bundleVersion) ? BUNDLE_VERSION_SPECS[bundleVersion] : undefined;
  if (spec === undefined) {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `bundle version ${bundleVersion} is not a version this repository builds`, { bundleVersion });
  }
  return spec;
}

/** The Lexicon and Lens pair a plan must bind to run under this bundle version. */
export function planContractBindingsFor(bundleVersion: string): PlanContractBindings {
  return specFor(bundleVersion).planBindings;
}

// -----------------------------------------------------------------------------
// Invariants
// -----------------------------------------------------------------------------

const IDENTITY_PATTERN = /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/u;
const PAGE_ID_PATTERN = /^\d+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/** A real calendar date in `YYYY-MM-DD`, checked without a clock: shape, month range and month length. */
function isCalendarDate(text: string): boolean {
  if (!DATE_PATTERN.test(text)) return false;
  const [year, month, day] = text.split('-').map((part) => Number.parseInt(part, 10));
  if (year === undefined || month === undefined || day === undefined) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (lengths[month - 1] ?? 0);
}

/**
 * Keys under which a contract file would be carrying symbolic authority. The
 * registry is the only place methods, facts, operations and mappings exist;
 * a bundle naming them anywhere in its contract data is refused. This is a
 * name denylist and defence in depth only: the gate that cannot be talked
 * around is the content equality with the repository bundle plus the frozen
 * hash - a synonym slips past this list and still fails those.
 */
const SYMBOLIC_AUTHORITY_KEYS: ReadonlySet<string> = new Set([
  'methods', 'method', 'factKinds', 'factKind', 'facts', 'fact', 'factRefs',
  'operations', 'operation', 'approvedDeterministicMappings', 'deterministicMappings',
  'mappings', 'mapping', 'lookupTable', 'lookup', 'enabledSets',
]);

/**
 * Keys a parsed JSON document may carry as OWN properties that a later
 * assignment would turn into prototype manipulation. `JSON.parse` keeps them
 * as data; zod's record output does not. They are refused on the raw input,
 * before any parsing, so no copy can smuggle one past the comparison.
 */
const DANGEROUS_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

function refuseDangerousKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => refuseDangerousKeys(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        throw new SkillContractError(
          'BUNDLE_SCHEMA_INVALID',
          `${path}.${key}: a prototype key is not contract data`,
          { path: `${path}.${key}` },
        );
      }
      refuseDangerousKeys((value as Record<string, unknown>)[key], `${path}.${key}`);
    }
  }
}

function refuseSymbolicAuthority(value: unknown, path: string): void {
  if (typeof value === 'number') {
    throw new SkillContractError(
      'BUNDLE_SCHEMA_INVALID',
      `${path} is a number; a contract weighs, counts and scores nothing`,
      { path },
    );
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => refuseSymbolicAuthority(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SYMBOLIC_AUTHORITY_KEYS.has(key)) {
        throw new SkillContractError(
          'SYMBOLIC_AUTHORITY_REFUSED',
          `${path}.${key}: a contract file may not carry methods, facts, operations or mappings; the released Method Registry is the only source of symbolic authority`,
          { path: `${path}.${key}` },
        );
      }
      refuseSymbolicAuthority(entry, `${path}.${key}`);
    }
  }
}

function collectMethodRefs(core: SkillContractBundleCore): readonly { path: string; methodId: string }[] {
  const found: { path: string; methodId: string }[] = [];
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (key === 'methodRefs' && Array.isArray(entry)) {
          entry.forEach((methodId, index) => {
            if (typeof methodId !== 'string') {
              throw new SkillContractError(
                'BUNDLE_SCHEMA_INVALID',
                `${path}.methodRefs[${index}] is not a method id string`,
                { path: `${path}.methodRefs[${index}]` },
              );
            }
            found.push({ path: `${path}.methodRefs[${index}]`, methodId });
          });
        } else {
          walk(entry, `${path}.${key}`);
        }
      }
    }
  };
  walk(core.semanticEnvelope, 'semanticEnvelope');
  walk(core.wordingBoundaries, 'wordingBoundaries');
  walk(core.individuality, 'individuality');
  return found;
}

/**
 * Every invariant of a bundle core, in the order a reader would check them.
 * Throws on the FIRST violation: a bundle that is wrong in one place is not
 * trusted in any other.
 */
export function validateSkillContractBundleCore(core: SkillContractBundleCore, registry: MethodRegistry): void {
  if (core.bundleId !== SKILL_CONTRACT_BUNDLE_ID || !/^\d+\.\d+\.\d+$/u.test(core.bundleVersion)) {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', 'bundleId or bundleVersion is not a released bundle identity');
  }
  if (core.bundleRef !== `${core.bundleId}@${core.bundleVersion}`) {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', 'bundleRef does not equal `<bundleId>@<bundleVersion>`');
  }

  // 1. Symbolic authority and numbers - before anything else is read.
  refuseSymbolicAuthority(
    {
      parentDecision: core.parentDecision,
      contracts: core.contracts,
      semanticEnvelope: core.semanticEnvelope,
      wordingBoundaries: core.wordingBoundaries,
      individuality: core.individuality,
    },
    'bundle',
  );

  // 2. Every required contract, exactly once, released and well-formed.
  const byKey = new Map<ContractKey, ContractSource>();
  for (const source of core.contracts) {
    if (!(CONTRACT_KEYS as readonly string[]).includes(source.key)) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract key "${source.key}" is not a known contract`, { key: source.key });
    }
    if (byKey.has(source.key)) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${source.key}" occurs twice`, { key: source.key });
    }
    byKey.set(source.key, source);
  }
  for (const key of CONTRACT_KEYS) {
    if (!byKey.has(key)) {
      throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the bundle carries no "${key}" contract; a Skill run without it is not bound`, { key });
    }
  }
  for (const source of core.contracts) {
    if (source.status !== 'CURRENT' && !(source.status === 'CANDIDATE' && isCandidateVersion(core.bundleVersion))) {
      throw new SkillContractError(
        'DRAFT_CONTRACT_REFUSED',
        `contract "${source.key}" has status "${source.status}"; only a CURRENT released page authorises a run, and a CANDIDATE page only a candidate bundle's evaluation run`,
        { key: source.key },
      );
    }
    if (source.identity !== null && !IDENTITY_PATTERN.test(source.identity)) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${source.key}" identity is not \`<name>@<semver>\``, { key: source.key });
    }
    if (!PAGE_ID_PATTERN.test(source.confluencePageId) || !PAGE_ID_PATTERN.test(source.confluencePageVersion)) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${source.key}" page id or page version is not a page reference`, { key: source.key });
    }
    if (source.title.trim() === '' || (source.status === 'CANDIDATE' ? source.releasedOn !== null : source.releasedOn === null || !isCalendarDate(source.releasedOn))) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${source.key}" has no title or no decision date`, { key: source.key });
    }
    if (new Set(source.dependsOn).size !== source.dependsOn.length) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${source.key}" lists a dependency twice`, { key: source.key });
    }
    for (const domain of source.owns) {
      if (!(CONTRACT_DOMAINS as readonly string[]).includes(domain)) {
        throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${source.key}" owns unknown domain "${domain}"`, { key: source.key });
      }
    }
    for (const dependency of source.dependsOn) {
      if (dependency === source.key || !byKey.has(dependency)) {
        throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${source.key}" depends on "${dependency}", which is itself or not bound`, { key: source.key });
      }
    }
  }
  // A dependency cycle would make "the higher-authority contract wins" undecidable.
  const visiting = new Set<ContractKey>();
  const settled = new Set<ContractKey>();
  const visit = (key: ContractKey, trail: readonly ContractKey[]): void => {
    if (settled.has(key)) return;
    if (visiting.has(key)) {
      throw new SkillContractError('PRECEDENCE_CONFLICT', `contract dependencies form a cycle: ${[...trail, key].join(' -> ')}`, { cycle: [...trail, key] });
    }
    visiting.add(key);
    for (const dependency of byKey.get(key)?.dependsOn ?? []) visit(dependency, [...trail, key]);
    visiting.delete(key);
    settled.add(key);
  };
  for (const key of CONTRACT_KEYS) visit(key, []);

  // 3. Precedence: every contract in exactly one tier; every domain exactly one owner.
  const tierOf = new Map<ContractKey, number>();
  core.precedenceTiers.forEach((tier, index) => {
    if (tier.length === 0) {
      throw new SkillContractError('PRECEDENCE_CONFLICT', 'a precedence tier is empty; a rank nothing holds decides nothing');
    }
    for (const key of tier) {
      if (!byKey.has(key)) {
        throw new SkillContractError('PRECEDENCE_CONFLICT', `precedence names "${key}", which the bundle does not carry`, { key });
      }
      if (tierOf.has(key)) {
        throw new SkillContractError('PRECEDENCE_CONFLICT', `contract "${key}" sits in two precedence tiers`, { key });
      }
      tierOf.set(key, index);
    }
  });
  for (const key of CONTRACT_KEYS) {
    if (!tierOf.has(key)) {
      throw new SkillContractError('PRECEDENCE_CONFLICT', `contract "${key}" sits in no precedence tier; a contract without a rank cannot lose a conflict`, { key });
    }
  }
  if ([...core.domains].sort().join(',') !== [...CONTRACT_DOMAINS].sort().join(',')) {
    throw new SkillContractError('PRECEDENCE_CONFLICT', 'the bundle does not list exactly the known contract domains');
  }
  const ownerOf = new Map<ContractDomain, ContractKey>();
  for (const source of core.contracts) {
    for (const domain of source.owns) {
      const existing = ownerOf.get(domain);
      if (existing !== undefined) {
        throw new SkillContractError(
          'PRECEDENCE_CONFLICT',
          `domain "${domain}" is owned by both "${existing}" and "${source.key}"; a conflict there would have no higher authority`,
          { domain, owners: [existing, source.key] },
        );
      }
      ownerOf.set(domain, source.key);
    }
  }
  for (const domain of CONTRACT_DOMAINS) {
    if (!ownerOf.has(domain)) {
      throw new SkillContractError('PRECEDENCE_CONFLICT', `domain "${domain}" has no owning contract`, { domain });
    }
  }

  // 4. The bundle agrees with what the repository already binds.
  const profile = byKey.get('METHOD_PROFILE');
  const lexicon = byKey.get('TERMINOLOGY_LEXICON');
  const lens = byKey.get('INTERPRETATION_LENS');
  const expectBinding = (
    key: ContractKey,
    source: ContractSource | undefined,
    expected: Readonly<{ contractRef: string; confluencePageId: string; confluencePageVersion: string }>,
  ): void => {
    if (
      source === undefined ||
      source.identity !== expected.contractRef ||
      source.confluencePageId !== expected.confluencePageId ||
      source.confluencePageVersion !== expected.confluencePageVersion
    ) {
      throw new SkillContractError(
        'BUNDLE_BINDING_MISMATCH',
        `contract "${key}" differs from the binding the repository already carries (${expected.contractRef}, page ${expected.confluencePageId} version ${expected.confluencePageVersion})`,
        { key },
      );
    }
  };
  const planBindings = specFor(core.bundleVersion).planBindings;
  expectBinding('TERMINOLOGY_LEXICON', lexicon, planBindings.terminologyLexicon);
  expectBinding('INTERPRETATION_LENS', lens, planBindings.interpretationLens);
  if (profile === undefined || profile.identity !== METHOD_PROFILE_REF) {
    throw new SkillContractError('BUNDLE_BINDING_MISMATCH', `the METHOD_PROFILE contract is not ${METHOD_PROFILE_REF}`);
  }
  const releasedRegistryHash = RELEASED_REGISTRY_HASHES[registry.profileVersion];
  const expectedRepository: RepositoryBindings = {
    methodProfileRef: METHOD_PROFILE_REF,
    methodRegistryStructuralHash: methodRegistryStructuralHash(registry),
    interpretationInputSchemaVersion: INTERPRETATION_INPUT_SCHEMA_VERSION,
    featureSetVersion: FEATURE_SET_VERSION,
    interpretiveClaimGraphVersion: INTERPRETIVE_CLAIM_GRAPH_VERSION,
    metaNarrativePlanVersion: META_NARRATIVE_PLAN_VERSION,
  };
  if (releasedRegistryHash === undefined || expectedRepository.methodRegistryStructuralHash !== releasedRegistryHash) {
    throw new SkillContractError('BUNDLE_BINDING_MISMATCH', 'the registry the bundle is built against is not the released one');
  }
  for (const field of Object.keys(expectedRepository) as (keyof RepositoryBindings)[]) {
    if (core.repository[field] !== expectedRepository[field]) {
      throw new SkillContractError(
        'BUNDLE_BINDING_MISMATCH',
        `repository.${field} is not the marker this repository carries`,
        { field },
      );
    }
  }

  // 5. Every method the contract data names is an approved method of the released registry.
  const approved = new Set(registry.methods.filter((method) => isApprovedStatus(method.status)).map((method) => method.methodId));
  for (const { path, methodId } of collectMethodRefs(core)) {
    if (!approved.has(methodId)) {
      throw new SkillContractError(
        'METHOD_REF_OUT_OF_PROFILE',
        `${path} names "${methodId}", which is not an approved method of ${METHOD_PROFILE_REF}; a contract cannot widen the Method Profile`,
        { path, methodId },
      );
    }
  }
}

// -----------------------------------------------------------------------------
// Building and freezing
// -----------------------------------------------------------------------------

/** The bundle without its published hash - listed field by field so nothing else can ride along. */
function coreOf(bundle: SkillContractBundle): SkillContractBundleCore {
  return {
    bundleId: bundle.bundleId,
    bundleVersion: bundle.bundleVersion,
    bundleRef: bundle.bundleRef,
    parentDecision: bundle.parentDecision,
    contracts: bundle.contracts,
    precedenceTiers: bundle.precedenceTiers,
    domains: bundle.domains,
    repository: bundle.repository,
    semanticEnvelope: bundle.semanticEnvelope,
    wordingBoundaries: bundle.wordingBoundaries,
    individuality: bundle.individuality,
  };
}

/**
 * The bundle this repository binds. Composes the registry release gate first:
 * a registry whose content is not released authorises no bundle either.
 */
export function buildSkillContractBundle(
  registry: MethodRegistry = BAZI_METHOD_REGISTRY_V1,
  bundleVersion: string = SKILL_CONTRACT_BUNDLE_VERSION,
): SkillContractBundle {
  assertReleasedRegistry(registry);
  const spec = specFor(bundleVersion);
  const core: SkillContractBundleCore = {
    bundleId: SKILL_CONTRACT_BUNDLE_ID,
    bundleVersion,
    bundleRef: `${SKILL_CONTRACT_BUNDLE_ID}@${bundleVersion}`,
    parentDecision: PARENT_DECISION,
    contracts: spec.contracts,
    precedenceTiers: PRECEDENCE_TIERS,
    domains: CONTRACT_DOMAINS,
    repository: {
      methodProfileRef: METHOD_PROFILE_REF,
      methodRegistryStructuralHash: methodRegistryStructuralHash(registry),
      interpretationInputSchemaVersion: INTERPRETATION_INPUT_SCHEMA_VERSION,
      featureSetVersion: FEATURE_SET_VERSION,
      interpretiveClaimGraphVersion: INTERPRETIVE_CLAIM_GRAPH_VERSION,
      metaNarrativePlanVersion: META_NARRATIVE_PLAN_VERSION,
    },
    semanticEnvelope: spec.semanticEnvelope,
    wordingBoundaries: spec.wordingBoundaries,
    individuality: INDIVIDUALITY_CONTRACT,
  };
  validateSkillContractBundleCore(core, registry);
  return { ...core, structuralHash: structuralHash(core) };
}

/** Fails closed unless `bundle` is, in canonical content, a released bundle version. */
export function assertReleasedSkillContractBundle(bundle: SkillContractBundle): void {
  const actual = structuralHash(coreOf(bundle));
  const released = RELEASED_BUNDLE_HASHES[bundle.bundleVersion];
  if (!HASH_PATTERN.test(bundle.structuralHash) || actual !== bundle.structuralHash || released === undefined || released !== actual) {
    throw new SkillContractError(
      'BUNDLE_NOT_RELEASED',
      `bundle ${bundle.bundleVersion} has content hash ${actual}, which is ${released === undefined ? 'not a released version' : `not the released ${released}`}; reconcile the bundle, the pages it binds and this table before running`,
      { actual, released: released ?? null, published: bundle.structuralHash },
    );
  }
}

/**
 * ETBZ-57: fails closed unless `bundle` is, in canonical content, a CANDIDATE
 * bundle version. Only an evaluation run may accept a candidate; a released
 * run asserts `assertReleasedSkillContractBundle`, which a candidate fails.
 */
export function assertCandidateSkillContractBundle(bundle: SkillContractBundle): void {
  const actual = structuralHash(coreOf(bundle));
  const candidate = isCandidateVersion(bundle.bundleVersion) ? CANDIDATE_BUNDLE_HASHES[bundle.bundleVersion] : undefined;
  if (!HASH_PATTERN.test(bundle.structuralHash) || actual !== bundle.structuralHash || candidate === undefined || candidate !== actual) {
    throw new SkillContractError(
      'BUNDLE_NOT_RELEASED',
      `bundle ${bundle.bundleVersion} has content hash ${actual}, which is ${candidate === undefined ? 'not a candidate version' : `not the candidate ${candidate}`}; an evaluation run binds only a frozen candidate`,
      { actual, candidate: candidate ?? null, published: bundle.structuralHash },
    );
  }
}

// -----------------------------------------------------------------------------
// Resolving and drift
// -----------------------------------------------------------------------------

type RefClassification =
  | Readonly<{ kind: 'RELEASED'; source: ContractSource }>
  | Readonly<{ kind: 'OTHER_VERSION'; source: ContractSource }>
  | Readonly<{ kind: 'UNKNOWN' }>;

function classifyRef(bundle: SkillContractBundleCore, ref: string): RefClassification {
  for (const source of bundle.contracts) {
    if (contractBindingRef(source) === ref) return { kind: 'RELEASED', source };
  }
  const identityName = ref.includes('@') ? ref.slice(0, ref.indexOf('@')) : null;
  const pageMatch = /^confluence:(\d+)@(\d+)$/u.exec(ref);
  for (const source of bundle.contracts) {
    if (identityName !== null && source.identity !== null && source.identity.startsWith(`${identityName}@`)) {
      return { kind: 'OTHER_VERSION', source };
    }
    // A page address is the reference form ONLY for a page that released no
    // identity; for any other page it is the wrong form, not another version.
    if (pageMatch !== null && source.identity === null && source.confluencePageId === pageMatch[1]) {
      return { kind: 'OTHER_VERSION', source };
    }
  }
  return { kind: 'UNKNOWN' };
}

/**
 * The released contract a reference names - a released identity, or the
 * `confluence:<page>@<version>` address of a page that released no identity.
 * Anything else is unknown: a name at another version is a different
 * contract, not this one, and a page address for an identity-bearing page is
 * the wrong reference form.
 */
export function resolveContract(bundle: SkillContractBundleCore, ref: string): ContractSource {
  const found = classifyRef(bundle, ref);
  if (found.kind === 'RELEASED') return found.source;
  throw new SkillContractError(
    'UNKNOWN_CONTRACT_IDENTITY',
    found.kind === 'OTHER_VERSION'
      ? `"${ref}" is not a released contract of ${bundle.bundleRef}; the released one is ${contractBindingRef(found.source)}`
      : `"${ref}" is not a released contract of ${bundle.bundleRef}`,
    { ref },
  );
}

/** The bound contract by key. */
export function contractByKey(bundle: SkillContractBundleCore, key: ContractKey): ContractSource {
  const found = bundle.contracts.find((source) => source.key === key);
  if (found === undefined) {
    throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the bundle carries no "${key}" contract`, { key });
  }
  return found;
}

/**
 * A binding as a run records it must name a released contract AND its
 * released page and page version. The identity being right while the page
 * or version is not is the case a stale copy produces.
 */
export function assertContractSource(bundle: SkillContractBundleCore, binding: ReleasedContractBinding): ContractSource {
  const source = resolveContract(bundle, binding.contractRef);
  if (
    source.confluencePageId !== binding.confluencePageId ||
    source.confluencePageVersion !== binding.confluencePageVersion
  ) {
    throw new SkillContractError(
      'CONTRACT_SOURCE_MISMATCH',
      `${binding.contractRef} is released from page ${source.confluencePageId} version ${source.confluencePageVersion}, not from page ${binding.confluencePageId} version ${binding.confluencePageVersion}`,
      { contractRef: binding.contractRef },
    );
  }
  return source;
}

/**
 * Drift test for a run's evidence: the same bundle, every required contract,
 * each at its released identity, page and version. A known contract at
 * another version is DRIFT; a reference nothing released is UNKNOWN.
 */
export function assertRunEvidenceBound(bundle: SkillContractBundleCore, evidence: SkillRunContractEvidence): void {
  if (evidence.bundleRef !== bundle.bundleRef) {
    throw new SkillContractError(
      'CONTRACT_DRIFT',
      `the run is bound to "${evidence.bundleRef}", this repository binds ${bundle.bundleRef}`,
      { recorded: evidence.bundleRef, bound: bundle.bundleRef },
    );
  }
  const seen = new Set<ContractKey>();
  for (const binding of evidence.contracts) {
    const found = classifyRef(bundle, binding.contractRef);
    if (found.kind === 'OTHER_VERSION') {
      throw new SkillContractError(
        'CONTRACT_DRIFT',
        `the run binds "${binding.contractRef}", this bundle releases ${contractBindingRef(found.source)}; re-bind explicitly, never silently`,
        { recorded: binding.contractRef, bound: contractBindingRef(found.source) },
      );
    }
    const source = assertContractSource(bundle, binding);
    if (seen.has(source.key)) {
      throw new SkillContractError(
        'BUNDLE_SCHEMA_INVALID',
        `the run's evidence binds "${source.key}" twice; nothing here deduplicates`,
        { key: source.key },
      );
    }
    seen.add(source.key);
  }
  for (const key of CONTRACT_KEYS) {
    if (!seen.has(key)) {
      throw new SkillContractError(
        'REQUIRED_CONTRACT_MISSING',
        `the run's evidence records no "${key}" binding; a run bound to fewer contracts than the bundle is not bound`,
        { key },
      );
    }
  }
}

// -----------------------------------------------------------------------------
// Portable form
// -----------------------------------------------------------------------------

/** The bundle as canonical JSON text - what a Skill package ships beside its prompt. */
export function renderPortableSkillContractBundle(bundle: SkillContractBundle): string {
  return canonicalJson(bundle);
}

const contractKeySchema = z.enum(CONTRACT_KEYS);
const domainSchema = z.enum(CONTRACT_DOMAINS);
const portableSchema = z.strictObject({
  bundleId: z.literal(SKILL_CONTRACT_BUNDLE_ID),
  bundleVersion: z.string().min(1),
  bundleRef: z.string().min(1),
  parentDecision: z.strictObject({
    title: z.string().min(1),
    confluencePageId: z.string().min(1),
    section: z.string().min(1),
  }),
  contracts: z.array(
    z.strictObject({
      key: contractKeySchema,
      title: z.string().min(1),
      identity: z.string().min(1).nullable(),
      confluencePageId: z.string().min(1),
      confluencePageVersion: z.string().min(1),
      status: z.enum(CONTRACT_STATUSES),
      releasedOn: z.string().min(1).nullable(),
      owns: z.array(domainSchema),
      dependsOn: z.array(contractKeySchema),
    }),
  ),
  precedenceTiers: z.array(z.array(contractKeySchema)),
  domains: z.array(domainSchema),
  repository: z.strictObject({
    methodProfileRef: z.string().min(1),
    methodRegistryStructuralHash: z.string().min(1),
    interpretationInputSchemaVersion: z.string().min(1),
    featureSetVersion: z.string().min(1),
    interpretiveClaimGraphVersion: z.string().min(1),
    metaNarrativePlanVersion: z.string().min(1),
  }),
  semanticEnvelope: z.record(z.string(), z.unknown()),
  wordingBoundaries: z.record(z.string(), z.unknown()),
  individuality: z.record(z.string(), z.unknown()),
  structuralHash: z.string().regex(HASH_PATTERN),
});

function firstDifference(expected: unknown, actual: unknown, path: string): string | null {
  // A key present on one side only: the difference IS the path, and there is
  // nothing to canonicalise (canonicalJson refuses `undefined`).
  if (expected === undefined || actual === undefined) {
    return expected === actual ? null : path;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return path;
    if (expected.length !== actual.length) return `${path}.length`;
    for (let index = 0; index < expected.length; index += 1) {
      const inner = firstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (inner !== null) return inner;
    }
    return null;
  }
  if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
    const left = expected as Record<string, unknown>;
    const right = actual as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      const inner = firstDifference(left[key], right[key], `${path}.${key}`);
      if (inner !== null) return inner;
    }
    return null;
  }
  return canonicalJson(expected) === canonicalJson(actual) ? null : path;
}

/**
 * Accepts a portable copy ONLY if it equals, in canonical content, the bundle
 * this repository binds. The copy is never returned: the repository's bundle
 * is. A copy that carries a prototype key, a draft, an extra or missing key at
 * any depth, a changed page version, an added method or a different hash is
 * refused with the reason and the path - a carrier cannot become an authority
 * by being edited.
 */
export function acceptPortableSkillContractBundle(
  input: unknown,
  registry: MethodRegistry = BAZI_METHOD_REGISTRY_V1,
  options: CandidateEvaluation = {},
): SkillContractBundle {
  refuseDangerousKeys(input, 'bundle');
  const parsed = portableSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue === undefined || issue.path.length === 0 ? '<root>' : issue.path.map(String).join('.');
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${path}: ${issue?.code ?? 'invalid'}`, { path });
  }
  const { structuralHash: published, ...portableCore } = parsed.data;
  refuseSymbolicAuthority(
    {
      parentDecision: portableCore.parentDecision,
      contracts: portableCore.contracts,
      semanticEnvelope: portableCore.semanticEnvelope,
      wordingBoundaries: portableCore.wordingBoundaries,
      individuality: portableCore.individuality,
    },
    'bundle',
  );
  // A version this repository does not build is refused as such, before anything else is read from it.
  specFor(portableCore.bundleVersion);
  if (isCandidateVersion(portableCore.bundleVersion) && options.candidateEvaluation !== true) {
    throw new SkillContractError(
      'BUNDLE_NOT_RELEASED',
      `bundle ${portableCore.bundleVersion} is a candidate: a copy of it is accepted for an evaluation run only ({ candidateEvaluation: true })`,
      { bundleVersion: portableCore.bundleVersion },
    );
  }
  for (const source of portableCore.contracts) {
    if (source.status !== 'CURRENT' && !(source.status === 'CANDIDATE' && isCandidateVersion(portableCore.bundleVersion))) {
      throw new SkillContractError(
        'DRAFT_CONTRACT_REFUSED',
        `portable contract "${source.key}" has status "${source.status}"; a draft copy authorises nothing`,
        { key: source.key },
      );
    }
  }
  const reference = buildSkillContractBundle(registry, portableCore.bundleVersion);
  const differing = firstDifference(coreOf(reference), portableCore, 'bundle');
  if (differing !== null) {
    throw new SkillContractError(
      'CONTRACT_OVERRIDE_REFUSED',
      `the portable copy differs from the bundle this repository binds at ${differing}; a copy is a carrier, never an authority`,
      { path: differing },
    );
  }
  if (published !== reference.structuralHash) {
    throw new SkillContractError(
      'BUNDLE_NOT_RELEASED',
      `the portable copy publishes hash ${published}, the bound bundle is ${reference.structuralHash}`,
      { published, bound: reference.structuralHash },
    );
  }
  if (isCandidateVersion(reference.bundleVersion)) {
    assertCandidateSkillContractBundle(reference);
  } else {
    assertReleasedSkillContractBundle(reference);
  }
  return reference;
}
