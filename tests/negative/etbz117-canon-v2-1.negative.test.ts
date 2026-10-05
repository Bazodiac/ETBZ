/**
 * ETBZ-117 (Canon v2, R0) — the refusals of the current Canon v2 context and of
 * the 2.1 line.
 *
 * Pattern as in ETBZ-77: the released 2.1.0 contracts and the repository's 2.1
 * binding pair are the green baseline; each case changes as little as the
 * refusal needs, on a copy, and names the code it expects. Any exception that
 * is not a SkillContractError shows as NOT_A_CONTRACT_ERROR, which no case
 * expects. The required negative paths of Jira ETBZ-117 are named in the
 * describe titles: the A1 2.0.0 binding, a 1.x reference, a wrong page or page
 * version, the other lineage, a missing, unknown, malformed or unexpected
 * version, and a method key pulled into the line. The path "stale base or
 * concurrent mutation between plan, CI, review and merge" is not a property of
 * the code: it is enforced at merge (`gh pr merge --match-head-commit <sha>`
 * after a fresh read of the PR head and of main) and by exact-head CI; a head
 * change voids the earlier gate evidence (ADR 0020, section 5).
 */
import { describe, expect, it } from 'vitest';
import { structuralHash } from '../../src/domain/structural-hash.js';
import {
  PLAN_CONTRACT_BINDINGS_V2_0,
  PLAN_CONTRACT_BINDINGS_V2_1,
  SkillContractError,
  assertCanonV2ContractBindings,
  assertCanonV2ContractSet,
  assertCurrentCanonContractBindings,
  assertReleasedCanonV2Contract,
  buildCanonV2Contract,
  canonV2ContractCore,
  releasedCanonV2Contract,
  releasedCurrentCanonContract,
  resolveCanonV2Contract,
  resolveCurrentCanonContract,
  validateCanonV2ContractCore,
} from '../../src/application/skill/index.js';
import { PLAN_CONTRACT_BINDINGS_V1_0, PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { CanonV2Contract, CanonV2ContractCore, CanonV2ContractKey, CanonV2LineVersion } from '../../src/application/skill/index.js';
import { contractCodeOf } from '../support/etbz77Evidence.js';
import * as currentCanon from '../../src/application/skill/current-canon-contracts.js';
import * as canonV2 from '../../src/application/skill/canon-v2-contracts.js';

type Json = Record<string, unknown>;

const lens = PLAN_CONTRACT_BINDINGS_V2_1.interpretationLens;
const lexicon = PLAN_CONTRACT_BINDINGS_V2_1.terminologyLexicon;
const a1Lens = PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens;
const a1Lexicon = PLAN_CONTRACT_BINDINGS_V2_0.terminologyLexicon;
const pair = (interpretationLens: unknown, terminologyLexicon: unknown): Json => ({ interpretationLens, terminologyLexicon });

/** A deep copy of a released 2.1.0 core, edited. Validation is what is under test. */
function coreWith(key: CanonV2ContractKey, edit: (core: Json) => void): CanonV2ContractCore {
  const copy = structuredClone(canonV2ContractCore(key, '2.1.0')) as unknown as Json;
  edit(copy);
  return copy as unknown as CanonV2ContractCore;
}
const at = (value: unknown, ...path: string[]): Json => path.reduce<Json>((current, segment) => current[segment] as Json, value as Json);

/** The refusal message, or '' when nothing was refused. */
function messageOf(action: () => unknown): string {
  try {
    action();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('ETBZ-117 AC4: the current Canon context accepts only the 2.1.0 pair on C1 and C5 page version 2', () => {
  it('accepts the 2.1.0 pair and hands back the repository pair, never the input', () => {
    const input = structuredClone(PLAN_CONTRACT_BINDINGS_V2_1);
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input))).toBe('ACCEPTED');
    expect(assertCurrentCanonContractBindings(input)).toBe(PLAN_CONTRACT_BINDINGS_V2_1);
  });

  it.each([
    ['the whole A1 2.0.0 pair on C1/C5 page version 1', () => pair(a1Lens, a1Lexicon)],
    ['the A1 2.0.0 Lens on C1 page version 1', () => pair(a1Lens, lexicon)],
    ['the A1 2.0.0 Lexicon on C5 page version 1', () => pair(lens, a1Lexicon)],
    ['the A1 2.0.0 Lens identity re-pointed at C1 page version 2', () => pair({ ...a1Lens, confluencePageVersion: '2' }, lexicon)],
    ['the A1 2.0.0 Lexicon identity re-pointed at C5 page version 2', () => pair(lens, { ...a1Lexicon, confluencePageVersion: '2' })],
  ])('refuses the A1 2.0.0 binding in the current context as drift: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('CONTRACT_DRIFT');
  });

  it('names the current 2.1.0 identity and says where the A1 2.0.0 one still resolves', () => {
    const message = messageOf(() => assertCurrentCanonContractBindings(pair(a1Lens, lexicon)));
    expect(message).toContain('grounded-reflective-synthesis-lens@2.1.0');
    expect(message).toContain('resolves only in its own 2.0.0 context');
    expect(message).toContain('page 85229569 version 1');
  });

  it.each([
    ['the whole 1.1.0 pair', () => structuredClone(PLAN_CONTRACT_BINDINGS_V1_1)],
    ['the whole 1.0.0 pair', () => structuredClone(PLAN_CONTRACT_BINDINGS_V1_0)],
    ['the 1.1.0 Lens', () => pair(PLAN_CONTRACT_BINDINGS_V1_1.interpretationLens, lexicon)],
    ['the 1.0.0 Lexicon', () => pair(lens, PLAN_CONTRACT_BINDINGS_V1_0.terminologyLexicon)],
    ['the 1.1.0 Lens identity on C1 page version 2', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@1.1.0' }, lexicon)],
  ])('refuses a 1.x reference in the current context as drift: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('CONTRACT_DRIFT');
  });

  it.each([
    ['the 2.1.0 Lens on C1 page version 1', () => pair({ ...lens, confluencePageVersion: '1' }, lexicon)],
    ['the 2.1.0 Lexicon on C5 page version 1', () => pair(lens, { ...lexicon, confluencePageVersion: '1' })],
    ['the 2.1.0 Lens on a later C1 page version', () => pair({ ...lens, confluencePageVersion: '3' }, lexicon)],
    ['the 2.1.0 Lens on the C5 page', () => pair({ ...lens, confluencePageId: '85164034' }, lexicon)],
    ['the 2.1.0 Lexicon on the C1 page', () => pair(lens, { ...lexicon, confluencePageId: '85229569' })],
    ['the 2.1.0 Lexicon on the Lexicon 1.1 page', () => pair(lens, { ...lexicon, confluencePageId: '77529091', confluencePageVersion: '4' })],
    ['the 2.1.0 Lens on the Canon v2 hub', () => pair({ ...lens, confluencePageId: '85131265', confluencePageVersion: '3' }, lexicon)],
  ])('refuses a wrong page or page version: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('CONTRACT_SOURCE_MISMATCH');
  });

  it.each([
    ['Lens and Lexicon swapped', () => pair(lexicon, lens)],
    ['the Lexicon in both slots', () => pair(lexicon, lexicon)],
    ['the Lens in both slots', () => pair(lens, lens)],
    ['the A1 2.0.0 Lexicon in the Lens slot', () => pair(a1Lexicon, lexicon)],
    ['the 1.1 Lexicon in the Lens slot', () => pair(PLAN_CONTRACT_BINDINGS_V1_1.terminologyLexicon, lexicon)],
  ])('refuses the other lineage in a slot: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('BUNDLE_BINDING_MISMATCH');
  });

  it.each([
    ['no Lens slot', () => ({ terminologyLexicon: lexicon })],
    ['no Lexicon slot', () => ({ interpretationLens: lens })],
    ['an undefined Lexicon slot', () => ({ interpretationLens: lens, terminologyLexicon: undefined })],
    ['an empty object', () => ({})],
  ])('refuses a missing reference: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('REQUIRED_CONTRACT_MISSING');
  });

  it.each([
    ['an unknown contract name', () => pair({ ...lens, contractRef: 'interpretation-lens@2.1.0' }, lexicon)],
    ['a page address instead of an identity', () => pair({ ...lens, contractRef: 'confluence:85229569@2' }, lexicon)],
    ['the Method Profile in the Lens slot', () => pair({ ...lens, contractRef: 'bazi-method-profile@1.0.0' }, lexicon)],
    ['the Lens lineage with no version', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@' }, lexicon)],
    ['the Lens lineage with a two-part version', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.1' }, lexicon)],
    ['the Lens lineage with a four-part version', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.1.0.0' }, lexicon)],
    ['the Lens lineage with a malformed version', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@not-a-version' }, lexicon)],
    ['the 2.1.0 Lens identity with a trailing space', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.1.0 ' }, lexicon)],
    ['the 2.1.0 Lens identity with a leading space', () => pair({ ...lens, contractRef: ' grounded-reflective-synthesis-lens@2.1.0' }, lexicon)],
    ['the 2.1.0 Lexicon identity in upper case', () => pair(lens, { ...lexicon, contractRef: 'TERMINOLOGY-WORDING-LEXICON@2.1.0' })],
    ['the 2.1.0 Lens identity with a pre-release suffix', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.1.0-rc.1' }, lexicon)],
  ])('refuses an unknown or malformed reference: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it.each([
    ['an unreleased 2.1.1 Lens', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.1.1' }, lexicon)],
    ['an unreleased 2.2.0 Lexicon', () => pair(lens, { ...lexicon, contractRef: 'terminology-wording-lexicon@2.2.0' })],
    ['an unreleased 3.0.0 Lens', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@3.0.0' }, lexicon)],
    ['an unreleased 2.0.1 Lexicon', () => pair(lens, { ...lexicon, contractRef: 'terminology-wording-lexicon@2.0.1' })],
  ])('refuses an unexpected version of the lineage as drift: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('CONTRACT_DRIFT');
  });

  it.each([
    ['an extra key in a binding', () => pair({ ...lens, status: 'CURRENT' }, lexicon)],
    ['an extra slot', () => ({ ...pair(lens, lexicon), methodProfile: lens })],
    ['a numeric page version', () => pair({ ...lens, confluencePageVersion: 2 }, lexicon)],
    ['an empty identity', () => pair({ ...lens, contractRef: '' }, lexicon)],
    ['null', () => null],
    ['a list', () => [lens, lexicon]],
    ['a bare identity string', () => 'grounded-reflective-synthesis-lens@2.1.0'],
    ['a class instance carrying both slots', () => Object.assign(new (class BindingPair {})(), pair(lens, lexicon))],
    ['a Map', () => new Map(Object.entries(pair(lens, lexicon)))],
    ['a getter that throws', () => {
      const input = pair(lens, lexicon);
      Object.defineProperty(input, 'terminologyLexicon', { enumerable: true, get() { throw new Error('read refused'); } });
      return input;
    }],
  ])('refuses a binding pair of the wrong JSON shape: %s', (_label, input) => {
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(input()))).toBe('BUNDLE_SCHEMA_INVALID');
  });
});

describe('ETBZ-117: resolving inside the current Canon context', () => {
  it.each([
    'grounded-reflective-synthesis-lens@2.0.0',
    'terminology-wording-lexicon@2.0.0',
    'grounded-reflective-synthesis-lens@1.1.0',
    'terminology-wording-lexicon@1.0.0',
    'grounded-reflective-synthesis-lens@2.1.1',
    'bazi-method-profile@1.0.0',
    'cross-reading-individuality-contract@1.1.0',
    'confluence:85229569@2',
    'grounded-reflective-synthesis-lens@2.1.0 ',
    '',
  ])('does not resolve "%s"', (ref) => {
    expect(contractCodeOf(() => resolveCurrentCanonContract(ref))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it.each([undefined, null, 42])('does not resolve a non-string reference (%s)', (ref) => {
    expect(contractCodeOf(() => resolveCurrentCanonContract(ref as unknown as string))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it('names the current identity when it refuses the A1 2.0.0 one', () => {
    const message = messageOf(() => resolveCurrentCanonContract('terminology-wording-lexicon@2.0.0'));
    expect(message).toContain('terminology-wording-lexicon@2.1.0');
    expect(message).toContain('resolves only in its own 2.0.0 context');
  });
});

describe('ETBZ-117: the historical 2.0 context stays as released and refuses the 2.1.0 pair', () => {
  it('still accepts the A1 2.0.0 pair and resolves the A1 identities to page version 1', () => {
    expect(assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_0))).toBe(PLAN_CONTRACT_BINDINGS_V2_0);
    expect(resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.0.0').confluencePageVersion).toBe('1');
    expect(resolveCanonV2Contract('terminology-wording-lexicon@2.0.0').confluencePageVersion).toBe('1');
  });

  it.each([
    ['the whole 2.1.0 pair', () => structuredClone(PLAN_CONTRACT_BINDINGS_V2_1)],
    ['the 2.1.0 Lens beside the A1 Lexicon', () => pair(lens, a1Lexicon)],
    ['the 2.1.0 Lexicon beside the A1 Lens', () => pair(a1Lens, lexicon)],
  ])('refuses %s in the 2.0 context as drift', (_label, input) => {
    expect(contractCodeOf(() => assertCanonV2ContractBindings(input()))).toBe('CONTRACT_DRIFT');
  });

  it('does not resolve a 2.1.0 identity in the 2.0 context', () => {
    expect(contractCodeOf(() => resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.1.0'))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });
});

describe('ETBZ-117: a context or line version that was never released is refused', () => {
  it.each(['2.0.1', '2.2.0', '3.0.0', '1.1.0', '', 'current', ' 2.1.0', '2.1.0 ', 'constructor', '__proto__', 'toString', 'hasOwnProperty', null, 21, {}, undefined])('refuses the version %s at every function that takes one', (version) => {
    const v = version as CanonV2LineVersion;
    expect(contractCodeOf(() => assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_1), v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.1.0', v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => buildCanonV2Contract('INTERPRETATION_LENS', v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => releasedCanonV2Contract('INTERPRETATION_LENS', v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => canonV2ContractCore('INTERPRETATION_LENS', v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => validateCanonV2ContractCore(canonV2ContractCore('INTERPRETATION_LENS', '2.1.0'), v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(buildCanonV2Contract('INTERPRETATION_LENS', '2.1.0'), v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => assertCanonV2ContractSet(v))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it('reads only an ABSENT version as the A1 2.0 context: an explicit undefined is refused, never defaulted', () => {
    const absent = (): unknown => assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_0));
    const explicitlyUndefined = (): unknown => assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_0), undefined as unknown as CanonV2LineVersion);
    const record: { canonVersion?: CanonV2LineVersion } = {};
    expect(contractCodeOf(absent)).toBe('ACCEPTED');
    expect(contractCodeOf(explicitlyUndefined)).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.0.0', record.canonVersion as CanonV2LineVersion))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    const noVersions: CanonV2LineVersion[] = [];
    expect(contractCodeOf(() => resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.0.0', ...noVersions))).toBe('ACCEPTED');
  });

  it('refuses more than one version argument, so a function handed to Array.map never reads the index as a version', () => {
    const extra = resolveCanonV2Contract as unknown as (ref: string, ...versions: unknown[]) => unknown;
    expect(contractCodeOf(() => extra('grounded-reflective-synthesis-lens@2.1.0', '2.1.0', undefined))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => extra('grounded-reflective-synthesis-lens@2.1.0', '2.1.0', '2.1.0'))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => ['grounded-reflective-synthesis-lens@2.0.0'].map(resolveCanonV2Contract as unknown as (ref: string, index: number, list: string[]) => unknown))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => ['INTERPRETATION_LENS'].map(buildCanonV2Contract as unknown as (key: string, index: number, list: string[]) => unknown))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });
});

describe('ETBZ-117 scope gate: the 2.1 line releases no method', () => {
  it.each(['METHOD_PROFILE', 'LONG_FORM', 'ANTI_BOILERPLATE', 'interpretation_lens', ''])('releases no %s contract on the 2.1 line', (key) => {
    expect(contractCodeOf(() => buildCanonV2Contract(key, '2.1.0'))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => releasedCurrentCanonContract(key))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(contractCodeOf(() => canonV2ContractCore(key as CanonV2ContractKey, '2.1.0'))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it.each<[string, CanonV2ContractKey, (core: Json) => void, string]>([
    ['a method reference in the Vorstoß contract', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'vorstossContract')['methodRefs'] = ['branch_animal_lore']; }, 'METHOD_REF_OUT_OF_PROFILE'],
    ['a methods key in the page rules', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'pageRules')['methods'] = ['branch_animal_lore']; }, 'SYMBOLIC_AUTHORITY_REFUSED'],
    ['a mapping in the style guide', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'styleGuide')['mapping'] = { 午: 'Pferd' }; }, 'SYMBOLIC_AUTHORITY_REFUSED'],
    ['a fact in the authority block', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'authority')['facts'] = ['day_master']; }, 'SYMBOLIC_AUTHORITY_REFUSED'],
    ['a Method Profile key on the core', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['key'] = 'METHOD_PROFILE'; }, 'UNKNOWN_CONTRACT_IDENTITY'],
  ])('refuses %s in a 2.1.0 core', (_label, key, edit, code) => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(coreWith(key, edit), '2.1.0'))).toBe(code);
  });
});

describe('ETBZ-117: a 2.1.0 core is held to its invariants', () => {
  it.each<[string, CanonV2ContractKey, (core: Json) => void, string]>([
    ['the A1 2.0.0 identity on the 2.1 line', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['identity'] = 'grounded-reflective-synthesis-lens@2.0.0'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a 1.1.0 identity on the 2.1 line', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['identity'] = 'terminology-wording-lexicon@1.1.0'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['an unreleased 2.1.1 identity', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['identity'] = 'grounded-reflective-synthesis-lens@2.1.1'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a CANDIDATE page', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['status'] = 'CANDIDATE'; }, 'DRAFT_CONTRACT_REFUSED'],
    ['the A1 2.0.0 identity not moved forward', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes', 'priorCanonVersions')['contractRefs'] = []; }, 'BUNDLE_BINDING_MISMATCH'],
    ['the other lineage moved forward', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes', 'priorCanonVersions')['contractRefs'] = ['terminology-wording-lexicon@2.0.0']; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a 1.x identity recorded as the earlier Canon v2 version', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'supersedes', 'priorCanonVersions')['contractRefs'] = ['terminology-wording-lexicon@1.1.0']; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a supersession of itself', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'supersedes', 'priorCanonVersions')['contractRefs'] = ['terminology-wording-lexicon@2.0.0', 'terminology-wording-lexicon@2.1.0']; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a blank reconcile statement', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes', 'priorCanonVersions')['statement'] = ' '; }, 'BUNDLE_BINDING_MISMATCH'],
    ['no record of the earlier Canon v2 version', 'INTERPRETATION_LENS', (core) => { delete at(core, 'supersedes')['priorCanonVersions']; }, 'BUNDLE_SCHEMA_INVALID'],
    ['an extra key on the record of the earlier version', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'supersedes', 'priorCanonVersions')['note'] = 'x'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a 1.x identity left unsuperseded', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes')['contractRefs'] = ['grounded-reflective-synthesis-lens@1.1.0']; }, 'BUNDLE_BINDING_MISMATCH'],
    ['voice handed to the A1 Lexicon on C5 page version 1', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'voiceAuthority')['binding'] = { ...a1Lexicon }; }, 'BUNDLE_BINDING_MISMATCH'],
    ['voice handed to the Lexicon 2.1.0 on C5 page version 1', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'voiceAuthority', 'binding')['confluencePageVersion'] = '1'; }, 'BUNDLE_BINDING_MISMATCH'],
    ['red lines conceded to the A1 Lens on C1 page version 1', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'authority')['redLinesBinding'] = { ...a1Lens }; }, 'BUNDLE_BINDING_MISMATCH'],
    ['red lines conceded to the Lens 2.1.0 on C1 page version 1', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'authority', 'redLinesBinding')['confluencePageVersion'] = '1'; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a C1 section carried by no block', 'INTERPRETATION_LENS', (core) => { delete at(core, 'content')['supersededModel']; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a style guide block dropped', 'TERMINOLOGY_LEXICON', (core) => { (at(core, 'content', 'styleGuide')['blocks'] as Json[]).splice(4, 1); }, 'BUNDLE_SCHEMA_INVALID'],
    ['a number in the content', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'pageRules')['version'] = 2; }, 'BUNDLE_SCHEMA_INVALID'],
  ])('refuses %s', (_label, key, edit, code) => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(coreWith(key, edit), '2.1.0'))).toBe(code);
  });

  it('refuses a 2.0.0 core held to the 2.1 line, and a 2.1.0 core held to the 2.0 line', () => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(canonV2ContractCore('INTERPRETATION_LENS'), '2.1.0'))).toBe('BUNDLE_SCHEMA_INVALID');
    expect(contractCodeOf(() => validateCanonV2ContractCore(canonV2ContractCore('TERMINOLOGY_LEXICON', '2.1.0')))).toBe('BUNDLE_SCHEMA_INVALID');
  });

  it('accepts the released 2.1.0 cores unedited (the baseline the refusals above depart from)', () => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(canonV2ContractCore('INTERPRETATION_LENS', '2.1.0'), '2.1.0'))).toBe('ACCEPTED');
    expect(contractCodeOf(() => validateCanonV2ContractCore(canonV2ContractCore('TERMINOLOGY_LEXICON', '2.1.0'), '2.1.0'))).toBe('ACCEPTED');
  });
});

describe('ETBZ-117: a 2.1.0 contract is released only at its frozen hash, in its own line', () => {
  const released = buildCanonV2Contract('INTERPRETATION_LENS', '2.1.0');

  it('refuses honestly re-hashed 2.1.0 content that reverts Vorstoß part 5 to the Ja / Nein / Teilweise Prüffrage', () => {
    const core = coreWith('INTERPRETATION_LENS', (copy) => {
      (at(copy, 'content', 'vorstossContract')['parts'] as Json[])[4] = { partId: 'PRUEFFRAGE', text: 'eine Prüffrage, beantwortbar mit Ja / Nein / Teilweise.' };
    });
    expect(contractCodeOf(() => validateCanonV2ContractCore(core, '2.1.0'))).toBe('ACCEPTED');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...core, structuralHash: structuralHash(core) }, '2.1.0'))).toBe('BUNDLE_NOT_RELEASED');
  });

  it('refuses honestly re-hashed 2.1.0 content bound to C1 page version 1', () => {
    const core = coreWith('INTERPRETATION_LENS', (copy) => { at(copy, 'source')['confluencePageVersion'] = '1'; });
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...core, structuralHash: structuralHash(core) }, '2.1.0'))).toBe('BUNDLE_NOT_RELEASED');
  });

  it('refuses a published hash that is not the content hash', () => {
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...released, structuralHash: `sha256:${'0'.repeat(64)}` }, '2.1.0'))).toBe('BUNDLE_NOT_RELEASED');
  });

  it('separates the lines by shape: a 2.0.0 contract lacks the 2.1 record of its earlier version, a 2.1.0 contract carries one the 2.0 line does not know', () => {
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(buildCanonV2Contract('INTERPRETATION_LENS'), '2.1.0'))).toBe('BUNDLE_SCHEMA_INVALID');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(released))).toBe('BUNDLE_SCHEMA_INVALID');
  });

  it('does not release a contract re-shaped to pass the other line\'s schema: its content hash is released on neither line', () => {
    const rehash = (contract: Json): Json => ({ ...contract, structuralHash: structuralHash({ canon: contract['canon'], source: contract['source'], supersedes: contract['supersedes'], content: contract['content'] }) });
    /** The released hash the refusing line names for the identity: null when the identity is not on that line at all. */
    const releasedNamed = (action: () => unknown): unknown => {
      try {
        action();
        return 'ACCEPTED';
      } catch (error) {
        return error instanceof SkillContractError ? `${error.code} ${String(error.detail['released'])}` : 'NOT_A_CONTRACT_ERROR';
      }
    };
    const a1 = structuredClone(buildCanonV2Contract('INTERPRETATION_LENS')) as unknown as Json;
    at(a1, 'supersedes')['priorCanonVersions'] = { statement: 'x', contractRefs: ['grounded-reflective-synthesis-lens@2.0.0'] };
    expect(releasedNamed(() => assertReleasedCanonV2Contract(rehash(a1) as unknown as CanonV2Contract, '2.1.0'))).toBe('BUNDLE_NOT_RELEASED null');
    const forward = structuredClone(released) as unknown as Json;
    delete at(forward, 'supersedes')['priorCanonVersions'];
    expect(releasedNamed(() => assertReleasedCanonV2Contract(rehash(forward) as unknown as CanonV2Contract))).toBe('BUNDLE_NOT_RELEASED null');
  });

  it('accepts each released contract on its own line', () => {
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(buildCanonV2Contract('INTERPRETATION_LENS')))).toBe('ACCEPTED');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(released, '2.1.0'))).toBe('ACCEPTED');
  });

  it('refuses a 2.1.0 contract under a forged identity that was never released', () => {
    const core = coreWith('INTERPRETATION_LENS', (copy) => { at(copy, 'source')['identity'] = 'grounded-reflective-synthesis-lens@2.1.1'; });
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...core, structuralHash: structuralHash(core) }, '2.1.0'))).toBe('BUNDLE_NOT_RELEASED');
  });
});

describe('ETBZ-117: every exported function of the current context refuses JSON-shaped input with a coded, bounded refusal, and never crashes', () => {
  const long = 'x'.repeat(1_000_000);
  const longOtherVersion = `grounded-reflective-synthesis-lens@2.0.${'9'.repeat(1_000_000)}`;
  const ADVERSARIAL: readonly [string, () => unknown][] = [
    ['null', () => null],
    ['undefined', () => undefined],
    ['a number', () => 5],
    ['an empty string', () => ''],
    ['a string of a million characters', () => long],
    ['another version of a lineage, a million characters long', () => longOtherVersion],
    ['an object whose toString names the 2.1.0 Lens', () => JSON.parse('{"toString":"grounded-reflective-synthesis-lens@2.1.0"}') as unknown],
    ['a list nested twenty thousand deep', () => JSON.parse(`${'['.repeat(20_000)}"x"${']'.repeat(20_000)}`) as unknown],
    ['an empty object', () => ({})],
    ['an own __proto__ key', () => JSON.parse('{"__proto__":{"polluted":true}}') as unknown],
    ['a pair with million-character references', () => pair({ ...lens, contractRef: longOtherVersion }, { ...lexicon, confluencePageId: long })],
  ];
  const functions = Object.entries(currentCanon as Record<string, unknown>).filter((entry): entry is [string, (input: unknown) => unknown] => typeof entry[1] === 'function');

  it('finds the exported functions to check', () => {
    expect(functions.map(([name]) => name).sort()).toEqual([
      'assertCurrentCanonContractBindings', 'assertCurrentCanonContractSet', 'releasedCurrentCanonContract', 'resolveCurrentCanonContract',
    ]);
  });

  it.each(functions.map(([name]) => name).filter((name) => name !== 'assertCurrentCanonContractSet'))('%s refuses every adversarial input with a SkillContractError of a bounded message', (name) => {
    const fn = functions.find(([candidate]) => candidate === name)?.[1] as (input: unknown) => unknown;
    const violations: string[] = [];
    for (const [label, input] of ADVERSARIAL) {
      try {
        fn(input());
        violations.push(`${label}: accepted`);
      } catch (error) {
        if (!(error instanceof SkillContractError)) violations.push(`${label}: ${error instanceof Error ? error.name : typeof error}`);
        else if (error.message.length > 2_000) violations.push(`${label}: message of ${error.message.length} characters`);
      }
    }
    expect(violations).toEqual([]);
  });

  it.each(Object.entries(canonV2).filter(([, value]) => typeof value === 'function').map(([name]) => name))(
    '%s refuses every adversarial version or context with a SkillContractError of a bounded message',
    (name) => {
      const fn = (canonV2 as unknown as Record<string, (first: unknown, second: unknown) => unknown>)[name] as (first: unknown, second: unknown) => unknown;
      const first: unknown = name === 'validateCanonV2ContractCore' ? canonV2ContractCore('INTERPRETATION_LENS', '2.1.0')
        : name === 'assertReleasedCanonV2Contract' ? buildCanonV2Contract('INTERPRETATION_LENS', '2.1.0')
          : name === 'assertCanonV2ContractBindings' ? structuredClone(PLAN_CONTRACT_BINDINGS_V2_1)
            : name === 'resolveCanonV2Contract' ? 'grounded-reflective-synthesis-lens@2.1.0'
              : 'INTERPRETATION_LENS';
      const violations: string[] = [];
      for (const [label, input] of ADVERSARIAL) {
        try {
          if (name === 'assertCanonV2ContractSet') fn(input(), undefined);
          else fn(first, input());
          violations.push(`${label}: accepted`);
        } catch (error) {
          if (!(error instanceof SkillContractError)) violations.push(`${label}: ${error instanceof Error ? error.name : typeof error}`);
          else if (error.message.length > 2_000) violations.push(`${label}: message of ${error.message.length} characters`);
        }
      }
      expect(violations).toEqual([]);
    },
  );
});

describe('ETBZ-117: refusals in the current context name the 2.1 line', () => {
  it('names the 2.1 line, not the A1 2.0 one, for a missing slot and for a method reference', () => {
    expect(messageOf(() => assertCurrentCanonContractBindings({ terminologyLexicon: lexicon }))).toContain('a 2.1 run bound to fewer contracts is not bound');
    expect(messageOf(() => validateCanonV2ContractCore(coreWith('INTERPRETATION_LENS', (core) => { at(core, 'content', 'vorstossContract')['methodRefs'] = ['branch_animal_lore']; }), '2.1.0'))).toContain('the 2.1 line binds no method');
    expect(messageOf(() => assertCanonV2ContractBindings({ terminologyLexicon: a1Lexicon }))).toContain('a 2.0 run bound to fewer contracts is not bound');
  });
});

describe('ETBZ-117: a released 2.1.0 contract cannot be changed in memory', () => {
  it('refuses writes into what the current context hands back', () => {
    const contract = releasedCurrentCanonContract('INTERPRETATION_LENS') as CanonV2Contract & { source: { confluencePageVersion: string } };
    expect(contractCodeOf(() => { (contract.source as { confluencePageVersion: string }).confluencePageVersion = '1'; })).toMatch(/^NOT_A_CONTRACT_ERROR:TypeError$/u);
    expect(releasedCurrentCanonContract('INTERPRETATION_LENS').source.confluencePageVersion).toBe('2');
  });
});
