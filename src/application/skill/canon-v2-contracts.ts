// =============================================================================
// ETBZ-77 (Canon v2, A1) - the 2.0 contract line: Interpretation Lens v2 and
// Terminology & Wording Lexicon v2 as released, hash-frozen identities beside
// the unchanged 1.0.0 and 1.1.0 ones, and the 2.0 context that binds them.
//
// A v2 contract is its Canon v2 decision, its source (page, page version,
// identity), what it supersedes and its content (`semantic-envelope-v2.ts`,
// `wording-boundaries-v2.ts`), frozen together by content hash exactly like a
// bundle version. A changed rule, page version or precedence is a new contract
// version with a new hash - never an edit of 2.0.0, and never an edit of 1.x.
//
// The 2.0 context is the Lexicon/Lens pair a Canon v2 run binds
// (`PLAN_CONTRACT_BINDINGS_V2_0`). Inside it only the 2.0.0 identities resolve:
// a 1.0.0 or 1.1.0 reference of the same lineage is another version of the
// same contract and is refused by name - the 1.x identity stays resolvable,
// but only under the 1.x bundle its runs were made with (ADR 0019). Skill
// Contract Bundle 2.0.0, which will compose this pair with Method Profile,
// Long-Form and Anti-Boilerplate v2, is ETBZ-81 (A5), not this module.
//
// What this module does NOT do: it reads no page, interprets nothing, defines
// no method, fact or operation, and enforces none of the rules it carries -
// the gates that enforce them are Epic B. Every exported function that takes
// input runs inside one wrapper (`coded`): a refusal of JSON-shaped input is a
// `SkillContractError` with a named code and a message that echoes at most 80
// characters of any reference, key or identity; the first violation throws.
// In-process objects JSON cannot express (symbol keys, non-enumerable or
// inherited properties, non-index properties on a list) are outside that
// promise, as they are for the 1.x bundle (`skill-contract-bundle.ts`).
//
// ETBZ-117 (R0, ADR 0020) adds the 2.1 line beside the 2.0 line, as a version
// table and never as an edit: Lens and Lexicon 2.1.0 carry C1 and C5 at page
// version 2. Each released version is its own context with its own sources,
// supersessions, content, hash table and binding pair (`LINES`); a context
// resolves and accepts only its own identities, so the 2.0.0 pair is drift in
// the 2.1 context and the 2.1.0 pair is drift in the 2.0 context. Every
// exported function keeps its 2.0 answer when it is called without a version;
// the context new work binds is `current-canon-contracts.ts`.
// =============================================================================

import { z } from 'zod';
import { canonicalJson } from '../../domain/canonical-json.js';
import { structuralHash } from '../../domain/structural-hash.js';
import type { PlanContractBindings, ReleasedContractBinding } from '../interpretation/meta-narrative-plan.js';
import {
  CONTRACT_KEYS,
  CONTRACT_SOURCES_V1_1,
  PARENT_DECISION,
  RELEASED_CONTRACT_SOURCES,
} from './contract-sources.js';
import type { ContractDomain, ContractKey, ContractSource } from './contract-sources.js';
import {
  CANON_V2_CONTRACT_SOURCES,
  CANON_V2_DECISION,
  CANON_V2_SUPERSESSIONS,
} from './contract-sources-v2.js';
import type { CanonV2Decision, CanonV2Supersession } from './contract-sources-v2.js';
import { CANON_V2_1_CONTRACT_SOURCES, CANON_V2_1_SUPERSESSIONS } from './contract-sources-v2-1.js';
import { deepFreeze } from './deep-freeze.js';
import { SkillContractError } from './errors.js';
import { C1_SECTIONS, SEMANTIC_ENVELOPE_V2 } from './semantic-envelope-v2.js';
import type { SemanticEnvelopeV2 } from './semantic-envelope-v2.js';
import { SEMANTIC_ENVELOPE_V2_1 } from './semantic-envelope-v2-1.js';
import type { SemanticEnvelopeV2_1 } from './semantic-envelope-v2-1.js';
import { C5_SECTIONS, STYLE_GUIDE_V3_BLOCK_NAMES, WORDING_BOUNDARIES_V2 } from './wording-boundaries-v2.js';
import type { WordingBoundariesV2 } from './wording-boundaries-v2.js';
import { WORDING_BOUNDARIES_V2_1 } from './wording-boundaries-v2-1.js';
import type { WordingBoundariesV2_1 } from './wording-boundaries-v2-1.js';

/** The version both v2 contracts release at; the line a 2.0 context binds. */
export const CANON_V2_CONTRACT_VERSION = '2.0.0' as const;
export const INTERPRETATION_LENS_V2_REF = 'grounded-reflective-synthesis-lens@2.0.0' as const;
export const TERMINOLOGY_LEXICON_V2_REF = 'terminology-wording-lexicon@2.0.0' as const;

/** ETBZ-117: the version of the forward fix to C1 and C5 page version 2; the line a 2.1 context binds. */
export const CANON_V2_1_CONTRACT_VERSION = '2.1.0' as const;
export const INTERPRETATION_LENS_V2_1_REF = 'grounded-reflective-synthesis-lens@2.1.0' as const;
export const TERMINOLOGY_LEXICON_V2_1_REF = 'terminology-wording-lexicon@2.1.0' as const;

/** Every released version of the Canon v2 contract line, in release order. Each is a context of its own; a run binds exactly one. */
export const CANON_V2_LINE_VERSIONS = deepFreeze([CANON_V2_CONTRACT_VERSION, CANON_V2_1_CONTRACT_VERSION] as const);
export type CanonV2LineVersion = (typeof CANON_V2_LINE_VERSIONS)[number];

/** The contracts the 2.0 line releases so far. Method Profile, Anti-Boilerplate and Long-Form v2 are ETBZ-78..80. */
export const CANON_V2_CONTRACT_KEYS = deepFreeze(['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON'] as const);
export type CanonV2ContractKey = (typeof CANON_V2_CONTRACT_KEYS)[number];

export interface CanonV2ContractCore {
  readonly canon: CanonV2Decision;
  readonly source: ContractSource;
  readonly supersedes: CanonV2Supersession;
  readonly content: SemanticEnvelopeV2 | WordingBoundariesV2 | SemanticEnvelopeV2_1 | WordingBoundariesV2_1;
}

export interface CanonV2Contract extends CanonV2ContractCore {
  /** `sha256:` + SHA-256 of the canonical JSON of everything above. */
  readonly structuralHash: string;
}

/**
 * The content hash each released v2 contract is frozen to. A contract whose
 * content is not the released one authorises nothing: a changed C1 or C5 page
 * version, a changed rule or a changed precedence is a new identity with a new
 * hash and a Confluence re-binding - never an in-place edit.
 */
export const RELEASED_CANON_V2_CONTRACT_HASHES: Readonly<Record<string, string>> = deepFreeze({
  'grounded-reflective-synthesis-lens@2.0.0': 'sha256:638eef2dcb822ed94f70002947c642fcf112f8d23f58390825a5c5fdd59178ea',
  'terminology-wording-lexicon@2.0.0': 'sha256:f6c40f7a2383690225b684c89cda4bd3d146c97383c59c78531e33b7a05b67d6',
});

/**
 * The 2.0 context: the Lexicon and Lens pair a Canon v2 run binds - the pair
 * Skill Contract Bundle 2.0.0 (ETBZ-81) names as its plan bindings. Written out
 * like `PLAN_CONTRACT_BINDINGS_V1_1`, and checked against the v2 sources by
 * `assertCanonV2ContractSet`: a pair that names a 1.x identity is refused.
 */
export const PLAN_CONTRACT_BINDINGS_V2_0: PlanContractBindings = deepFreeze({
  terminologyLexicon: {
    contractRef: 'terminology-wording-lexicon@2.0.0',
    confluencePageId: '85164034',
    confluencePageVersion: '1',
  },
  interpretationLens: {
    contractRef: 'grounded-reflective-synthesis-lens@2.0.0',
    confluencePageId: '85229569',
    confluencePageVersion: '1',
  },
});

/**
 * ETBZ-117: the content hash each released 2.1.0 contract is frozen to - a
 * table beside the 2.0.0 one, never an entry in it. The 2.0.0 hashes above do
 * not move: the 2.0.0 contracts keep their page version 1 content.
 */
export const RELEASED_CANON_V2_1_CONTRACT_HASHES: Readonly<Record<string, string>> = deepFreeze({
  'grounded-reflective-synthesis-lens@2.1.0': 'sha256:b931ae4e2e0f5c8c64f9b4cc143a189247e74d62a99a79952b8822da74d8f983',
  'terminology-wording-lexicon@2.1.0': 'sha256:11a03b11099d77b0c55f4f30317793a2952af58120522bef92bf42cbc34115c4',
});

/**
 * ETBZ-117: the 2.1 context - the Lexicon and Lens pair new Canon v2 work binds
 * (C5 and C1 at page version 2). Written out like `PLAN_CONTRACT_BINDINGS_V2_0`
 * and checked against the 2.1 sources by `assertCanonV2ContractSet('2.1.0')`.
 */
export const PLAN_CONTRACT_BINDINGS_V2_1: PlanContractBindings = deepFreeze({
  terminologyLexicon: {
    contractRef: 'terminology-wording-lexicon@2.1.0',
    confluencePageId: '85164034',
    confluencePageVersion: '2',
  },
  interpretationLens: {
    contractRef: 'grounded-reflective-synthesis-lens@2.1.0',
    confluencePageId: '85229569',
    confluencePageVersion: '2',
  },
});

// -----------------------------------------------------------------------------
// Lookup
// -----------------------------------------------------------------------------

interface CanonV2Spec {
  readonly content: SemanticEnvelopeV2 | WordingBoundariesV2 | SemanticEnvelopeV2_1 | WordingBoundariesV2_1;
  /** The page's sections, in page order; every block of the content cites one. */
  readonly sections: readonly string[];
  /** The plan-binding slot the contract fills in the line's context. */
  readonly slot: keyof PlanContractBindings;
}

const SPECS: Readonly<Record<CanonV2ContractKey, CanonV2Spec>> = {
  INTERPRETATION_LENS: { content: SEMANTIC_ENVELOPE_V2, sections: C1_SECTIONS, slot: 'interpretationLens' },
  TERMINOLOGY_LEXICON: { content: WORDING_BOUNDARIES_V2, sections: C5_SECTIONS, slot: 'terminologyLexicon' },
};

/** C1 and C5 keep their sections at page version 2; only the content changes. */
const SPECS_V2_1: Readonly<Record<CanonV2ContractKey, CanonV2Spec>> = {
  INTERPRETATION_LENS: { content: SEMANTIC_ENVELOPE_V2_1, sections: C1_SECTIONS, slot: 'interpretationLens' },
  TERMINOLOGY_LEXICON: { content: WORDING_BOUNDARIES_V2_1, sections: C5_SECTIONS, slot: 'terminologyLexicon' },
};

/**
 * One released version of the Canon v2 line and its context: what it releases,
 * from which pages, what each contract supersedes, the hashes it is frozen to
 * and the pair a run of it binds. `earlier` are the released versions before
 * it, whose identities each of its contracts supersedes by name.
 */
interface CanonV2Line {
  readonly version: CanonV2LineVersion;
  /** The line as refusal messages name it ("the 2.0 line", "the 2.0.0 context"). */
  readonly label: string;
  readonly sources: readonly ContractSource[];
  readonly supersessions: Readonly<Record<CanonV2ContractKey, CanonV2Supersession>>;
  readonly specs: Readonly<Record<CanonV2ContractKey, CanonV2Spec>>;
  readonly releasedHashes: Readonly<Record<string, string>>;
  readonly planBindings: PlanContractBindings;
  readonly earlier: readonly CanonV2Line[];
}

const LINE_2_0: CanonV2Line = {
  version: CANON_V2_CONTRACT_VERSION,
  label: '2.0',
  sources: CANON_V2_CONTRACT_SOURCES,
  supersessions: CANON_V2_SUPERSESSIONS,
  specs: SPECS,
  releasedHashes: RELEASED_CANON_V2_CONTRACT_HASHES,
  planBindings: PLAN_CONTRACT_BINDINGS_V2_0,
  earlier: [],
};

const LINE_2_1: CanonV2Line = {
  version: CANON_V2_1_CONTRACT_VERSION,
  label: '2.1',
  sources: CANON_V2_1_CONTRACT_SOURCES,
  supersessions: CANON_V2_1_SUPERSESSIONS,
  specs: SPECS_V2_1,
  releasedHashes: RELEASED_CANON_V2_1_CONTRACT_HASHES,
  planBindings: PLAN_CONTRACT_BINDINGS_V2_1,
  earlier: [LINE_2_0],
};

const LINES: Readonly<Record<CanonV2LineVersion, CanonV2Line>> = {
  [CANON_V2_CONTRACT_VERSION]: LINE_2_0,
  [CANON_V2_1_CONTRACT_VERSION]: LINE_2_1,
};

/** The line of a released version. Any other value - an unreleased version, a non-string - names no context and is refused. */
function lineFor(version: unknown): CanonV2Line {
  if (typeof version !== 'string' || !Object.hasOwn(LINES, version)) {
    throw new SkillContractError(
      'UNKNOWN_CONTRACT_IDENTITY',
      `${keyText(version)} is not a released Canon v2 contract version; the released ones are ${CANON_V2_LINE_VERSIONS.join(' and ')}`,
      { version: typeof version === 'string' ? version : null },
    );
  }
  return LINES[version as CanonV2LineVersion];
}

function isCanonV2Key(key: string): key is CanonV2ContractKey {
  return (CANON_V2_CONTRACT_KEYS as readonly string[]).includes(key);
}

function v2SourceFor(key: CanonV2ContractKey, line: CanonV2Line): ContractSource {
  const found = line.sources.find((source) => source.key === key);
  if (found === undefined) {
    throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the ${line.label} line carries no "${keyText(key)}" source`, { key });
  }
  return found;
}

/** The released 1.x sources of a lineage, in release order, one per identity. */
function releasedV1Sources(key: ContractKey): readonly ContractSource[] {
  const seen = new Set<string>();
  const found: ContractSource[] = [];
  for (const source of [...RELEASED_CONTRACT_SOURCES, ...CONTRACT_SOURCES_V1_1]) {
    if (source.key !== key || source.identity === null || seen.has(source.identity)) continue;
    seen.add(source.identity);
    found.push(source);
  }
  return found;
}

/** The name before `@` of an identity. */
function lineageOf(identity: string): string {
  const at = identity.indexOf('@');
  return at < 0 ? identity : identity.slice(0, at);
}

/** The lineage a 2.0 contract continues: the identity name its 1.x releases carry. */
function lineageFor(key: CanonV2ContractKey): string {
  const [first] = releasedV1Sources(key);
  if (first?.identity === undefined || first.identity === null) {
    throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `no released 1.x "${keyText(key)}" contract to continue`, { key });
  }
  return lineageOf(first.identity);
}

const bindingOf = (source: ContractSource): ReleasedContractBinding => ({
  contractRef: source.identity ?? '',
  confluencePageId: source.confluencePageId,
  confluencePageVersion: source.confluencePageVersion,
});

/** Canonical equality; a side that is absent equals only an absent side (canonicalJson refuses `undefined`). */
const sameJson = (left: unknown, right: unknown): boolean =>
  left === undefined || right === undefined ? left === right : canonicalJson(left) === canonicalJson(right);

// -----------------------------------------------------------------------------
// Invariants
// -----------------------------------------------------------------------------

const PAGE_ID_PATTERN = /^\d+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/** A real calendar date in `YYYY-MM-DD`, checked without a clock. */
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
 * Keys under which contract data would be carrying symbolic authority - the
 * same names the bundle refuses (`skill-contract-bundle.ts`), so a v2 contract
 * that passes here also passes the bundle that will carry it (ETBZ-81).
 */
const SYMBOLIC_AUTHORITY_KEYS: ReadonlySet<string> = new Set([
  'methods', 'method', 'factKinds', 'factKind', 'facts', 'fact', 'factRefs',
  'operations', 'operation', 'approvedDeterministicMappings', 'deterministicMappings',
  'mappings', 'mapping', 'lookupTable', 'lookup', 'enabledSets',
]);

/**
 * Walks the content once: strings only (a contract weighs, counts and scores
 * nothing), no symbolic-authority key, no method reference (the 2.0 line binds
 * no method before Method Profile v2 is released, ETBZ-78), and every `source`
 * names this contract and a section of its page. Collects the cited sections
 * into `cited`.
 */
function walkContent(value: unknown, path: string, key: CanonV2ContractKey, sections: readonly string[], cited: Set<string>): void {
  if (typeof value === 'string') {
    if (value.trim() === '') {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${shown(path)} is empty; a contract carries no blank rule`, { path });
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${shown(path)} is an empty list`, { path });
    }
    value.forEach((entry, index) => walkContent(entry, `${path}[${index}]`, key, sections, cited));
    return;
  }
  if (value === null || typeof value !== 'object') {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${shown(path)} is a ${value === null ? 'null' : typeof value}; contract data is text`, { path });
  }
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    const at = `${path}.${name}`;
    if (SYMBOLIC_AUTHORITY_KEYS.has(name)) {
      throw new SkillContractError(
        'SYMBOLIC_AUTHORITY_REFUSED',
        `${shown(at)}: a contract may not carry methods, facts, operations or mappings; the released Method Registry is the only source of symbolic authority`,
        { path: at },
      );
    }
    if (name === 'methodRefs') {
      throw new SkillContractError(
        'METHOD_REF_OUT_OF_PROFILE',
        `${shown(at)}: the 2.0 line binds no method until Method Profile v2 is released (ETBZ-78)`,
        { path: at },
      );
    }
    if (name === 'source') {
      const source = entry as Record<string, unknown> | null;
      const section = source !== null && typeof source === 'object' ? source['section'] : undefined;
      if (source === null || typeof source !== 'object' || source['contract'] !== key || typeof section !== 'string' || !sections.includes(section)) {
        throw new SkillContractError(
          'BUNDLE_SCHEMA_INVALID',
          `${shown(at)} does not name a section of the "${key}" page`,
          { path: at },
        );
      }
      cited.add(section);
    }
    walkContent(entry, at, key, sections, cited);
  }
}

/** Reads a nested field of untyped content; undefined where the path does not exist. */
function fieldAt(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Runs a boundary and turns anything but a coded refusal into one: input that
 * cannot be read as plain data (a nesting deeper than the engine's stack, a
 * throwing getter) is BUNDLE_SCHEMA_INVALID, naming the cause, never a crash.
 * It refuses; it never accepts what the boundary did not.
 */
function coded<T>(what: string, action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (error instanceof SkillContractError) throw error;
    const cause = error instanceof Error ? error.name : typeof error;
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `<root>: ${what} cannot be read as plain data (${cause})`, { path: '<root>', cause });
  }
}

const SOURCE_SHAPE = z.strictObject({
  key: z.string(),
  title: z.string(),
  identity: z.string().nullable(),
  confluencePageId: z.string(),
  confluencePageVersion: z.string(),
  status: z.string(),
  releasedOn: z.string().nullable(),
  owns: z.array(z.string()),
  dependsOn: z.array(z.string()),
});
const SUPERSEDES_SHAPE = z.strictObject({
  statement: z.string(),
  contractRefs: z.array(z.string()),
  rebaselineSections: z.array(z.strictObject({ confluencePageId: z.string(), section: z.string(), title: z.string(), scope: z.string() })),
});
const CORE_SHAPE = z.strictObject({
  canon: z.record(z.string(), z.unknown()),
  source: SOURCE_SHAPE,
  supersedes: SUPERSEDES_SHAPE,
  content: z.record(z.string(), z.unknown()),
});
/** A line with earlier versions records, beside the 1.x identities, the earlier 2.x identity each contract moves forward. */
const CORE_SHAPE_WITH_PRIOR_VERSIONS = CORE_SHAPE.extend({
  supersedes: SUPERSEDES_SHAPE.extend({
    priorCanonVersions: z.strictObject({ statement: z.string(), contractRefs: z.array(z.string()) }),
  }),
});

/**
 * Refuses a core that is not the declared JSON shape of its line (path and code
 * only, never the value). Its callers run inside `coded`, which turns an
 * unreadable input into a coded refusal.
 */
function refuseMalformedCore(core: unknown, line: CanonV2Line): void {
  const parsed = (line.earlier.length === 0 ? CORE_SHAPE : CORE_SHAPE_WITH_PRIOR_VERSIONS).safeParse(core);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue === undefined || issue.path.length === 0 ? '<root>' : issue.path.map(String).join('.');
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${shown(path)}: ${issue?.code ?? 'invalid'}`, { path });
  }
}

/**
 * The invariants of a v2 contract core, in reading order: its JSON shape, the
 * decision it hangs under, its source, what it supersedes, its content and the
 * pair's binding of each other. The exact released values are the freeze's
 * (`assertReleasedCanonV2Contract`), not the validator's. Throws on the FIRST
 * violation: a contract that is wrong in one place is not trusted in any other.
 * The core is held to the line of `version` (2.0.0 when none is named): a
 * core of another version is refused, never re-read as one of this line.
 */
export function validateCanonV2ContractCore(core: CanonV2ContractCore, version: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): void {
  coded('the contract core', () => validateCore(core, lineFor(version)));
}

function validateCore(core: CanonV2ContractCore, line: CanonV2Line): void {
  refuseMalformedCore(core, line);
  const { source } = core;
  if (!isCanonV2Key(source.key)) {
    throw new SkillContractError('UNKNOWN_CONTRACT_IDENTITY', `the ${line.label} line releases no "${keyText(source.key)}" contract yet`, { key: source.key });
  }
  const key = source.key;
  const spec = line.specs[key];

  // 1. The decision it hangs under is Canon v2, unchanged.
  if (!sameJson(core.canon, CANON_V2_DECISION)) {
    throw new SkillContractError('BUNDLE_BINDING_MISMATCH', 'the contract does not hang under the Canon v2 decision this repository binds (hub 85131265, precedence as quoted)');
  }

  // 2. The source: on the line of its own lineage, released, well-formed, owning what its lineage owns.
  const expectedIdentity = `${lineageFor(key)}@${line.version}`;
  if (source.identity !== expectedIdentity) {
    throw new SkillContractError(
      'BUNDLE_SCHEMA_INVALID',
      `contract "${key}" carries identity ${keyText(source.identity)}; the ${line.label} line releases it as ${expectedIdentity}`,
      { key, identity: source.identity },
    );
  }
  if (source.status !== 'CURRENT') {
    throw new SkillContractError('DRAFT_CONTRACT_REFUSED', `contract "${key}" has status "${keyText(source.status)}"; only a CURRENT page authorises a ${line.label} run`, { key });
  }
  if (!PAGE_ID_PATTERN.test(source.confluencePageId) || !PAGE_ID_PATTERN.test(source.confluencePageVersion)) {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${key}" page id or page version is not a page reference`, { key });
  }
  if (source.title.trim() === '' || source.releasedOn === null || !isCalendarDate(source.releasedOn)) {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${key}" has no title or no decision date`, { key });
  }
  const lineageDomains: readonly ContractDomain[] = releasedV1Sources(key).flatMap((released) => released.owns);
  if ([...new Set(lineageDomains)].sort().join(',') !== [...source.owns].sort().join(',') || new Set(source.owns).size !== source.owns.length) {
    throw new SkillContractError(
      'PRECEDENCE_CONFLICT',
      `contract "${key}" owns ${shown(source.owns.join(', ')) || 'nothing'}; a new version decides exactly the domains its lineage decides`,
      { key },
    );
  }
  if (new Set(source.dependsOn).size !== source.dependsOn.length || source.dependsOn.some((dependency) => dependency === key || !(CONTRACT_KEYS as readonly string[]).includes(dependency))) {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `contract "${key}" lists a dependency twice, on itself or on no known contract`, { key });
  }
  // Inside its line, with this source in its key's place: a cycle would make "the higher authority wins" undecidable.
  const graph = new Map(line.sources.map((entry) => [entry.key, entry.key === key ? source : entry]));
  const reaches = (from: ContractKey, target: ContractKey, seen: Set<ContractKey>): boolean =>
    (graph.get(from)?.dependsOn ?? []).some((next) => next === target || (!seen.has(next) && reaches(next, target, seen.add(next))));
  if (reaches(key, key, new Set())) {
    throw new SkillContractError('PRECEDENCE_CONFLICT', `contract "${key}" depends, through the ${line.label} line, on itself`, { key });
  }

  // 3. What it supersedes: every released 1.x identity of its lineage, each still resolvable, and nothing else.
  const expectedRefs = releasedV1Sources(key).map((released) => released.identity);
  if (!sameJson(core.supersedes.contractRefs, expectedRefs) || core.supersedes.statement.trim() === '') {
    throw new SkillContractError(
      'BUNDLE_BINDING_MISMATCH',
      `contract "${key}" must supersede exactly the released ${lineageFor(key)} identities ${expectedRefs.join(', ')}, each of which stays bound to its own runs`,
      { key, recorded: core.supersedes.contractRefs },
    );
  }
  for (const section of core.supersedes.rebaselineSections) {
    if (section.confluencePageId !== PARENT_DECISION.confluencePageId || section.section.trim() === '' || section.scope.trim() === '') {
      throw new SkillContractError('BUNDLE_BINDING_MISMATCH', `contract "${key}" supersedes a section of a page that is not the Rebaseline, or without its scope`, { key });
    }
  }
  // ... and, on a line with earlier versions, exactly the earlier 2.x identity of its lineage, each staying in its own context.
  if (line.earlier.length > 0) {
    const prior = fieldAt(core.supersedes, ['priorCanonVersions']);
    const expectedPrior = line.earlier.map((earlier) => v2SourceFor(key, earlier).identity);
    const statement = fieldAt(prior, ['statement']);
    if (!sameJson(fieldAt(prior, ['contractRefs']), expectedPrior) || typeof statement !== 'string' || statement.trim() === '') {
      throw new SkillContractError(
        'BUNDLE_BINDING_MISMATCH',
        `contract "${key}" must move forward exactly the earlier ${lineageFor(key)} identities ${expectedPrior.join(', ')}, each of which stays bound to its own pages and context`,
        { key },
      );
    }
  }

  // 4. The content: text only, no symbolic authority, every block citing a section of its page, every section cited.
  const cited = new Set<string>();
  walkContent(core.content, key === 'INTERPRETATION_LENS' ? 'lens' : 'lexicon', key, spec.sections, cited);
  const uncited = spec.sections.filter((section) => !cited.has(section));
  if (uncited.length > 0) {
    throw new SkillContractError(
      'BUNDLE_SCHEMA_INVALID',
      `contract "${key}" carries no block for the page section(s) ${uncited.join(' | ')}; the representation is complete or it is not released`,
      { key, uncited },
    );
  }

  // 5. The pair binds each other at the versions released together.
  if (key === 'INTERPRETATION_LENS') {
    if (!sameJson(fieldAt(core.content, ['voiceAuthority', 'binding']), bindingOf(v2SourceFor('TERMINOLOGY_LEXICON', line)))) {
      throw new SkillContractError('BUNDLE_BINDING_MISMATCH', 'the Lens v2 hands voice to another C5 binding than the Lexicon v2 released with it');
    }
    const owners = fieldAt(core.content, ['chapterLengthAndFiller', 'rules']);
    if (!Array.isArray(owners) || owners.some((rule) => {
      const owner = fieldAt(rule, ['ownedBy']);
      return typeof owner !== 'string' || owner === key || !(CONTRACT_KEYS as readonly string[]).includes(owner);
    })) {
      throw new SkillContractError('PRECEDENCE_CONFLICT', 'a quoted C1 rule outside the Lens domain names no other contract as its owner');
    }
  } else {
    if (!sameJson(fieldAt(core.content, ['authority', 'redLinesBinding']), bindingOf(v2SourceFor('INTERPRETATION_LENS', line)))) {
      throw new SkillContractError('BUNDLE_BINDING_MISMATCH', 'the Lexicon v2 concedes the red lines to another C1 binding than the Lens v2 released with it');
    }
    const blocks = fieldAt(core.content, ['styleGuide', 'blocks']);
    const names = Array.isArray(blocks) ? blocks.map((block) => fieldAt(block, ['block'])) : [];
    if (!sameJson(names, STYLE_GUIDE_V3_BLOCK_NAMES)) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', 'the style guide does not carry the blocks of C5 in page order; it is carried whole or not at all');
    }
  }
}

// -----------------------------------------------------------------------------
// Building and freezing
// -----------------------------------------------------------------------------

/** The unvalidated core of a v2 contract - what the hash freezes. A key the line does not release is refused. */
export function canonV2ContractCore(key: CanonV2ContractKey, version: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): CanonV2ContractCore {
  return coded('the key', () => coreFor(key, lineFor(version)));
}

function refuseUnreleasedKey(key: unknown, line: CanonV2Line): asserts key is CanonV2ContractKey {
  if (typeof key !== 'string' || !isCanonV2Key(key)) {
    throw new SkillContractError(
      'UNKNOWN_CONTRACT_IDENTITY',
      `the ${line.label} line releases no "${keyText(key)}" contract yet; it releases ${CANON_V2_CONTRACT_KEYS.join(' and ')}`,
      { key: typeof key === 'string' ? key : null },
    );
  }
}

function coreFor(key: CanonV2ContractKey, line: CanonV2Line): CanonV2ContractCore {
  refuseUnreleasedKey(key, line);
  return {
    canon: CANON_V2_DECISION,
    source: v2SourceFor(key, line),
    supersedes: line.supersessions[key],
    content: line.specs[key].content,
  };
}

/** Builds and validates one v2 contract of a line (2.0.0 when none is named). A key the line does not release is refused. */
export function buildCanonV2Contract(key: string, version: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): CanonV2Contract {
  return coded('the key', () => buildContract(key, lineFor(version)));
}

function buildContract(key: string, line: CanonV2Line): CanonV2Contract {
  refuseUnreleasedKey(key, line);
  const core = coreFor(key, line);
  validateCore(core, line);
  return { ...core, structuralHash: structuralHash(core) };
}

/**
 * Fails closed unless `contract` is, in canonical content, the released v2
 * contract of its identity on the line of `version` (2.0.0 when none is
 * named): each line checks only its own hash table.
 */
export function assertReleasedCanonV2Contract(contract: CanonV2Contract, version: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): void {
  coded('the contract', () => assertReleased(contract, lineFor(version)));
}

function assertReleased(contract: CanonV2Contract, line: CanonV2Line): void {
  if (contract === null || typeof contract !== 'object' || Object.getPrototypeOf(contract) !== Object.prototype
    || Object.keys(contract).sort().join(',') !== 'canon,content,source,structuralHash,supersedes') {
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', 'a released v2 contract is exactly its core and its structural hash; nothing rides beside them');
  }
  refuseMalformedCore({ canon: contract.canon, source: contract.source, supersedes: contract.supersedes, content: contract.content }, line);
  const core: CanonV2ContractCore = { canon: contract.canon, source: contract.source, supersedes: contract.supersedes, content: contract.content };
  const actual = structuralHash(core);
  const identity = contract.source.identity ?? '';
  const released = Object.hasOwn(line.releasedHashes, identity) ? line.releasedHashes[identity] : undefined;
  if (typeof contract.structuralHash !== 'string' || !HASH_PATTERN.test(contract.structuralHash) || actual !== contract.structuralHash || released === undefined || released !== actual) {
    throw new SkillContractError(
      'BUNDLE_NOT_RELEASED',
      `contract ${identity === '' ? '<no identity>' : keyText(identity)} has content hash ${actual}, which is ${released === undefined ? `not a released ${line.label} contract` : `not the released ${released}`}; a changed rule, page version or precedence is a new version, never an edit`,
      { actual, released: released ?? null, published: contract.structuralHash },
    );
  }
}

/** The released v2 contract of a key on a line (2.0.0 when none is named): built, validated and checked against its frozen hash. */
export function releasedCanonV2Contract(key: string, version: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): CanonV2Contract {
  return coded('the key', () => {
    const line = lineFor(version);
    const contract = buildContract(key, line);
    assertReleased(contract, line);
    return contract;
  });
}

// -----------------------------------------------------------------------------
// The 2.0 context: resolving references and accepting a binding pair
// -----------------------------------------------------------------------------

type CanonV2Classification =
  | Readonly<{ kind: 'RELEASED'; source: ContractSource }>
  | Readonly<{ kind: 'OTHER_VERSION'; source: ContractSource }>
  | Readonly<{ kind: 'UNKNOWN' }>;

/** A reference as one line's context reads it: one of its own identities, another version of one of its lineages, or unknown. */
function classifyCanonV2Ref(ref: string, line: CanonV2Line): CanonV2Classification {
  for (const source of line.sources) {
    if (source.identity === ref) return { kind: 'RELEASED', source };
  }
  // Only `<lineage>@<major>.<minor>.<patch>` is another version; any other suffix is an unknown reference.
  const name = /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/u.test(ref) ? lineageOf(ref) : null;
  for (const source of line.sources) {
    if (name !== null && source.identity !== null && lineageOf(source.identity) === name) return { kind: 'OTHER_VERSION', source };
  }
  return { kind: 'UNKNOWN' };
}

/** A reference as a refusal message shows it: at most 80 characters, so a message never grows with its input. */
function shown(ref: string): string {
  return ref.length <= 80 ? ref : `${ref.slice(0, 80)}… (${ref.length} characters)`;
}

/** A key or identity as a refusal message shows it, whatever its type. */
function keyText(value: unknown): string {
  return typeof value === 'string' ? shown(value) : `<${value === null ? 'null' : typeof value}>`;
}

/**
 * Says, for a refused reference, whether it is a released identity that stays
 * resolvable elsewhere: a 1.x identity under its own 1.x bundle, or an
 * identity of an earlier 2.x line in that line's own context.
 */
function historicalNote(ref: string, line: CanonV2Line): string {
  const historical = [...RELEASED_CONTRACT_SOURCES, ...CONTRACT_SOURCES_V1_1].some((source) => source.identity === ref);
  if (historical) return ' - it stays bound to the runs made under its own 1.x bundle and resolves only there';
  for (const earlier of line.earlier) {
    const source = earlier.sources.find((candidate) => candidate.identity === ref);
    if (source !== undefined) {
      return ` - it stays bound to page ${source.confluencePageId} version ${source.confluencePageVersion} and resolves only in its own ${earlier.version} context`;
    }
  }
  return '';
}

/**
 * The v2 contract a reference names inside the context of `version` (the 2.0
 * context when none is named). Only that line's identities resolve: a 1.0.0 or
 * 1.1.0 identity of the same lineage - or one of another 2.x line - is another
 * version of the same contract, refused by name; a page address or any other
 * name is unknown here.
 */
export function resolveCanonV2Contract(ref: string, context: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): ContractSource {
  return coded('the reference', () => resolveRef(ref, lineFor(context)));
}

function resolveRef(ref: string, line: CanonV2Line): ContractSource {
  if (typeof ref !== 'string') {
    throw new SkillContractError('UNKNOWN_CONTRACT_IDENTITY', `a reference of type ${ref === null ? 'null' : typeof ref} is not a contract reference`, {});
  }
  const found = classifyCanonV2Ref(ref, line);
  if (found.kind === 'RELEASED') return found.source;
  throw new SkillContractError(
    'UNKNOWN_CONTRACT_IDENTITY',
    found.kind === 'OTHER_VERSION'
      ? `"${shown(ref)}" is not a contract of the ${line.version} context; the released one is ${String(found.source.identity)}${historicalNote(ref, line)}`
      : `"${shown(ref)}" is not a contract of the ${line.version} context`,
    { ref },
  );
}

const bindingSchema = z.strictObject({
  contractRef: z.string().min(1),
  confluencePageId: z.string().min(1),
  confluencePageVersion: z.string().min(1),
});
const bindingPairSchema = z.strictObject({
  terminologyLexicon: bindingSchema,
  interpretationLens: bindingSchema,
});

/**
 * Accepts a Lexicon/Lens pair for the 2.0 context, or refuses it - the binding
 * a Canon v2 plan, package or run records. The input is untrusted: its shape is
 * parsed first, then each slot must name exactly its v2 contract at its
 * released page and page version. An identity of the slot's own lineage at
 * another version is CONTRACT_DRIFT (re-binding is explicit, never silent), an
 * identity of the other lineage (any version) BUNDLE_BINDING_MISMATCH, the right
 * identity on another page or page version CONTRACT_SOURCE_MISMATCH, and input
 * that cannot be read as plain data BUNDLE_SCHEMA_INVALID. The input is never
 * returned: the repository's (frozen) pair is.
 *
 * `context` names the line (the 2.0 context when none is named). Each context
 * accepts only its own pair: the 2.0.0 pair is CONTRACT_DRIFT in the 2.1
 * context, the 2.1.0 pair CONTRACT_DRIFT in the 2.0 context.
 */
export function assertCanonV2ContractBindings(input: unknown, context: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): PlanContractBindings {
  return coded('the binding pair', () => {
    const line = lineFor(context);
    return checkBindingPair(parseBindingPair(input), line);
  });
}

/** Only plain JSON-shaped data: a plain object at the root and in each slot (no Date, Map, class instance or null prototype), each slot present. */
function parseBindingPair(input: unknown): ReturnType<typeof bindingPairSchema.safeParse> {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    if (Object.getPrototypeOf(input) !== Object.prototype) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', '<root>: the binding pair is not a plain object', { path: '<root>' });
    }
    for (const slot of ['interpretationLens', 'terminologyLexicon'] as const) {
      if (!Object.hasOwn(input, slot) || (input as Record<string, unknown>)[slot] === undefined) {
        throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the binding pair has no ${slot}; a 2.0 run bound to fewer contracts is not bound`, { slot });
      }
      const value: unknown = (input as Record<string, unknown>)[slot];
      if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) !== Object.prototype) {
        throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${slot}: the binding is not a plain object`, { path: slot });
      }
    }
  }
  return bindingPairSchema.safeParse(input);
}

function checkBindingPair(parsed: ReturnType<typeof bindingPairSchema.safeParse>, line: CanonV2Line): PlanContractBindings {
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue === undefined || issue.path.length === 0 ? '<root>' : issue.path.map(String).join('.');
    throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `${shown(path)}: ${issue?.code ?? 'invalid'}`, { path });
  }
  for (const key of CANON_V2_CONTRACT_KEYS) {
    const slot = line.specs[key].slot;
    const binding = parsed.data[slot];
    const found = classifyCanonV2Ref(binding.contractRef, line);
    if (found.kind === 'UNKNOWN') {
      throw new SkillContractError('UNKNOWN_CONTRACT_IDENTITY', `${slot}: "${shown(binding.contractRef)}" is not a contract of the ${line.version} context`, { slot, ref: binding.contractRef });
    }
    if (found.source.key !== key) {
      throw new SkillContractError(
        'BUNDLE_BINDING_MISMATCH',
        `${slot} names "${shown(binding.contractRef)}", the ${found.source.key} lineage; the slot binds ${String(v2SourceFor(key, line).identity)}`,
        { slot, ref: binding.contractRef },
      );
    }
    if (found.kind === 'OTHER_VERSION') {
      throw new SkillContractError(
        'CONTRACT_DRIFT',
        `${slot} binds "${shown(binding.contractRef)}"; the ${line.version} context binds ${String(found.source.identity)}${historicalNote(binding.contractRef, line)}`,
        { slot, recorded: binding.contractRef, bound: found.source.identity },
      );
    }
    if (binding.confluencePageId !== found.source.confluencePageId || binding.confluencePageVersion !== found.source.confluencePageVersion) {
      throw new SkillContractError(
        'CONTRACT_SOURCE_MISMATCH',
        `${shown(binding.contractRef)} is released from page ${found.source.confluencePageId} version ${found.source.confluencePageVersion}, not from page ${shown(binding.confluencePageId)} version ${shown(binding.confluencePageVersion)}`,
        { slot, contractRef: binding.contractRef },
      );
    }
  }
  return line.planBindings;
}

/** One line as one value: its version, its decision, its released contracts and the pair a run binds. */
export interface CanonV2ContractSet {
  readonly contractVersion: CanonV2LineVersion;
  readonly canon: CanonV2Decision;
  readonly contracts: readonly CanonV2Contract[];
  readonly planBindings: PlanContractBindings;
}

/**
 * Builds a whole line (the 2.0 line when none is named) and holds it to
 * itself: every contract released, and the repository's own binding pair
 * accepted by the line's context (which requires each slot to name its
 * released source, page and page version). Deterministic: two calls return the
 * same value.
 */
export function assertCanonV2ContractSet(version: CanonV2LineVersion = CANON_V2_CONTRACT_VERSION): CanonV2ContractSet {
  return coded('the version', () => {
    const line = lineFor(version);
    const contracts = CANON_V2_CONTRACT_KEYS.map((key) => releasedCanonV2Contract(key, line.version));
    if (line.sources.length !== CANON_V2_CONTRACT_KEYS.length) {
      throw new SkillContractError('BUNDLE_SCHEMA_INVALID', `the ${line.label} line carries a source it does not release`);
    }
    const planBindings = assertCanonV2ContractBindings(line.planBindings, line.version);
    return { contractVersion: line.version, canon: CANON_V2_DECISION, contracts, planBindings };
  });
}
