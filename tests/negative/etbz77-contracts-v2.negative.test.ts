/**
 * ETBZ-77 (Canon v2, A1) — the refusals of the 2.0 contract line.
 *
 * Pattern as in ETBZ-51: the released v2 contracts and the repository's 2.0
 * binding pair are the green baseline; each test changes as little as the
 * refusal needs, on a copy, and names the code it expects. The four boundaries
 * turn input they cannot read into a coded BUNDLE_SCHEMA_INVALID by design
 * (`coded`), so the shape cases also pin the field path and the issue of the
 * refusal: a targeted refusal is told from a caught crash by its path. Any other
 * exception shows as NOT_A_CONTRACT_ERROR, which no case expects.
 */
import { describe, expect, it } from 'vitest';
import { structuralHash } from '../../src/domain/structural-hash.js';
import {
  PLAN_CONTRACT_BINDINGS_V2_0,
  SkillContractError,
  assertCanonV2ContractBindings,
  assertReleasedCanonV2Contract,
  buildCanonV2Contract,
  canonV2ContractCore,
  resolveCanonV2Contract,
  validateCanonV2ContractCore,
} from '../../src/application/skill/index.js';
import { PLAN_CONTRACT_BINDINGS_V1_0, PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { CanonV2Contract, CanonV2ContractCore, CanonV2ContractKey } from '../../src/application/skill/index.js';
import { contractCodeOf } from '../support/etbz77Evidence.js';

type Json = Record<string, unknown>;

const lens = PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens;
const lexicon = PLAN_CONTRACT_BINDINGS_V2_0.terminologyLexicon;
const pair = (interpretationLens: unknown, terminologyLexicon: unknown): Json => ({ interpretationLens, terminologyLexicon });

/** A deep copy of a released core, edited. Validation is what is under test. */
function coreWith(key: CanonV2ContractKey, edit: (core: Json) => void): CanonV2ContractCore {
  const copy = structuredClone(canonV2ContractCore(key)) as unknown as Json;
  edit(copy);
  return copy as unknown as CanonV2ContractCore;
}
const at = (value: unknown, ...path: string[]): Json => path.reduce<Json>((current, segment) => current[segment] as Json, value as Json);

/** The refusal as `<code> <path> <first word of the message after the path>`, e.g. `BUNDLE_SCHEMA_INVALID source.title invalid_type`. */
function refusalOf(action: () => unknown): string {
  try {
    action();
    return 'ACCEPTED';
  } catch (error) {
    if (!(error instanceof SkillContractError)) return `NOT_A_CONTRACT_ERROR:${error instanceof Error ? error.name : typeof error}`;
    const path = String(error.detail['path'] ?? '');
    const issue = error.message.slice(error.message.indexOf(`${path}: `) + path.length + 2).split(' ')[0] ?? '';
    return `${error.code} ${path} ${issue}`;
  }
}

describe('ETBZ-77 AC2: the 2.0 context refuses a 1.x reference by name', () => {
  it('accepts the 2.0.0 pair and hands back the repository pair, never the input', () => {
    const input = structuredClone(PLAN_CONTRACT_BINDINGS_V2_0);
    expect(contractCodeOf(() => assertCanonV2ContractBindings(input))).toBe('ACCEPTED');
    expect(assertCanonV2ContractBindings(input)).toBe(PLAN_CONTRACT_BINDINGS_V2_0);
  });

  it('refuses a 1.1 Lens reference in the 2.0 context', () => {
    expect(contractCodeOf(() => assertCanonV2ContractBindings(pair(PLAN_CONTRACT_BINDINGS_V1_1.interpretationLens, lexicon)))).toBe('CONTRACT_DRIFT');
  });

  it('refuses a 1.1 Lexicon reference in the 2.0 context', () => {
    expect(contractCodeOf(() => assertCanonV2ContractBindings(pair(lens, PLAN_CONTRACT_BINDINGS_V1_1.terminologyLexicon)))).toBe('CONTRACT_DRIFT');
  });

  it.each([
    ['the 1.0 Lens', () => pair(PLAN_CONTRACT_BINDINGS_V1_0.interpretationLens, lexicon)],
    ['the 1.0 Lexicon', () => pair(lens, PLAN_CONTRACT_BINDINGS_V1_0.terminologyLexicon)],
    ['the whole 1.1 pair', () => structuredClone(PLAN_CONTRACT_BINDINGS_V1_1)],
    ['the whole 1.0 pair', () => structuredClone(PLAN_CONTRACT_BINDINGS_V1_0)],
    ['the 1.1 Lens identity on the v2 page', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@1.1.0' }, lexicon)],
  ])('refuses %s in the 2.0 context as drift', (_label, input) => {
    expect(contractCodeOf(() => assertCanonV2ContractBindings(input()))).toBe('CONTRACT_DRIFT');
  });

  it('names the released 2.0.0 identity and says where the 1.x one still resolves', () => {
    let message = '';
    try {
      assertCanonV2ContractBindings(pair(PLAN_CONTRACT_BINDINGS_V1_1.interpretationLens, lexicon));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('grounded-reflective-synthesis-lens@2.0.0');
    expect(message).toContain('resolves only there');
  });

  it.each([
    ['an unreleased 2.0.1 Lens', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.0.1' }, lexicon), 'CONTRACT_DRIFT'],
    ['an unreleased 3.0.0 Lexicon', () => pair(lens, { ...lexicon, contractRef: 'terminology-wording-lexicon@3.0.0' }), 'CONTRACT_DRIFT'],
    ['an unknown contract name', () => pair({ ...lens, contractRef: 'interpretation-lens@2.0.0' }, lexicon), 'UNKNOWN_CONTRACT_IDENTITY'],
    ['the Lens lineage with a malformed version', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@not-a-version' }, lexicon), 'UNKNOWN_CONTRACT_IDENTITY'],
    ['the Lens lineage with no version', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@' }, lexicon), 'UNKNOWN_CONTRACT_IDENTITY'],
    ['the Lens identity with a trailing space', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.0.0 ' }, lexicon), 'UNKNOWN_CONTRACT_IDENTITY'],
    ['the 1.1 Lexicon in the Lens slot', () => pair(PLAN_CONTRACT_BINDINGS_V1_1.terminologyLexicon, lexicon), 'BUNDLE_BINDING_MISMATCH'],
    ['a page address instead of an identity', () => pair({ ...lens, contractRef: 'confluence:85229569@1' }, lexicon), 'UNKNOWN_CONTRACT_IDENTITY'],
    ['Lens and Lexicon swapped', () => pair(lexicon, lens), 'BUNDLE_BINDING_MISMATCH'],
    ['the Lexicon in both slots', () => pair(lexicon, lexicon), 'BUNDLE_BINDING_MISMATCH'],
    ['the 2.0.0 Lens on another page version', () => pair({ ...lens, confluencePageVersion: '2' }, lexicon), 'CONTRACT_SOURCE_MISMATCH'],
    ['the 2.0.0 Lexicon on the 1.1 page', () => pair(lens, { ...lexicon, confluencePageId: '77529091', confluencePageVersion: '4' }), 'CONTRACT_SOURCE_MISMATCH'],
    ['the 2.0.0 Lens on the C5 page at the bound version', () => pair({ ...lens, confluencePageId: '85164034' }, lexicon), 'CONTRACT_SOURCE_MISMATCH'],
    ['no Lens slot', () => ({ terminologyLexicon: lexicon }), 'REQUIRED_CONTRACT_MISSING'],
    ['no Lexicon slot', () => ({ interpretationLens: lens }), 'REQUIRED_CONTRACT_MISSING'],
    ['an undefined Lens slot', () => ({ interpretationLens: undefined, terminologyLexicon: lexicon }), 'REQUIRED_CONTRACT_MISSING'],
    ['a class instance carrying both slots', () => Object.assign(new (class BindingPair {})(), pair(lens, lexicon)), 'BUNDLE_SCHEMA_INVALID'],
    ['a null-prototype object carrying both slots', () => Object.assign(Object.create(null) as object, pair(lens, lexicon)), 'BUNDLE_SCHEMA_INVALID'],
    ['a Map', () => new Map(Object.entries(pair(lens, lexicon))), 'BUNDLE_SCHEMA_INVALID'],
    ['a class instance in the Lens slot', () => pair(Object.assign(new (class Binding {})(), lens), lexicon), 'BUNDLE_SCHEMA_INVALID'],
    ['a Date in the Lexicon slot', () => pair(lens, new Date(0)), 'BUNDLE_SCHEMA_INVALID'],
    ['a getter that throws', () => {
      const input = pair(lens, lexicon);
      Object.defineProperty(input, 'interpretationLens', { enumerable: true, get() { throw new Error('read refused'); } });
      return input;
    }, 'BUNDLE_SCHEMA_INVALID'],
    ['an extra slot', () => ({ ...pair(lens, lexicon), antiBoilerplate: lens }), 'BUNDLE_SCHEMA_INVALID'],
    ['an extra key in a binding', () => pair({ ...lens, status: 'CURRENT' }, lexicon), 'BUNDLE_SCHEMA_INVALID'],
    ['an empty identity', () => pair({ ...lens, contractRef: '' }, lexicon), 'BUNDLE_SCHEMA_INVALID'],
    ['an empty page id', () => pair({ ...lens, confluencePageId: '' }, lexicon), 'BUNDLE_SCHEMA_INVALID'],
    ['an empty page version', () => pair(lens, { ...lexicon, confluencePageVersion: '' }), 'BUNDLE_SCHEMA_INVALID'],
    ['a two-part version of the Lens lineage', () => pair({ ...lens, contractRef: 'grounded-reflective-synthesis-lens@2.0' }, lexicon), 'UNKNOWN_CONTRACT_IDENTITY'],
    ['a numeric page version', () => pair({ ...lens, confluencePageVersion: 1 }, lexicon), 'BUNDLE_SCHEMA_INVALID'],
    ['null', () => null, 'BUNDLE_SCHEMA_INVALID'],
    ['a list', () => [lens, lexicon], 'BUNDLE_SCHEMA_INVALID'],
    ['a bare identity string', () => 'grounded-reflective-synthesis-lens@2.0.0', 'BUNDLE_SCHEMA_INVALID'],
  ])('fails closed on %s', (_label, input, code) => {
    expect(contractCodeOf(() => assertCanonV2ContractBindings(input()))).toBe(code);
  });
});

describe('ETBZ-77: resolving inside the 2.0 context', () => {
  it.each([
    'grounded-reflective-synthesis-lens@1.1.0',
    'grounded-reflective-synthesis-lens@1.0.0',
    'terminology-wording-lexicon@1.1.0',
    'terminology-wording-lexicon@1.0.0',
    'terminology-wording-lexicon@2.1.0',
    'cross-reading-individuality-contract@1.1.0',
    'bazi-method-profile@1.0.0',
    'confluence:85164034@1',
    'grounded-reflective-synthesis-lens@not-a-version',
    '',
  ])('does not resolve "%s"', (ref) => {
    expect(contractCodeOf(() => resolveCanonV2Contract(ref))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it.each([undefined, null, 42])('does not resolve a non-string reference (%s)', (ref) => {
    expect(contractCodeOf(() => resolveCanonV2Contract(ref as unknown as string))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it('does not resolve an object whose toString names the 2.0.0 Lens', () => {
    const disguised: unknown = JSON.parse('{"toString":"grounded-reflective-synthesis-lens@2.0.0"}');
    expect(contractCodeOf(() => resolveCanonV2Contract(disguised as string))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });

  it('keeps a refusal message short however long the reference', () => {
    let message = '';
    try {
      resolveCanonV2Contract(`grounded-reflective-synthesis-lens@${'9'.repeat(1_000_000)}`);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message.length).toBeGreaterThan(0);
    expect(message.length).toBeLessThan(400);
  });

  it.each(['ANTI_BOILERPLATE', 'METHOD_PROFILE', 'LONG_FORM', 'interpretation_lens', ''])('releases no %s contract on the 2.0 line yet', (key) => {
    expect(contractCodeOf(() => buildCanonV2Contract(key))).toBe('UNKNOWN_CONTRACT_IDENTITY');
  });
});

describe('ETBZ-77: a v2 contract core is held to its invariants', () => {
  it.each<[string, CanonV2ContractKey, (core: Json) => void, string]>([
    ['an identity on the 1.1 line', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['identity'] = 'grounded-reflective-synthesis-lens@1.1.0'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['an identity of another lineage', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['identity'] = 'style-guide@2.0.0'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a key the 2.0 line does not release', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['key'] = 'ANTI_BOILERPLATE'; }, 'UNKNOWN_CONTRACT_IDENTITY'],
    ['a CANDIDATE page', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['status'] = 'CANDIDATE'; }, 'DRAFT_CONTRACT_REFUSED'],
    ['a DRAFT page', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['status'] = 'DRAFT'; }, 'DRAFT_CONTRACT_REFUSED'],
    ['no decision date', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['releasedOn'] = null; }, 'BUNDLE_SCHEMA_INVALID'],
    ['an impossible decision date', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['releasedOn'] = '2026-02-30'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a page id that is not a page reference', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['confluencePageId'] = 'C5'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a page version that is not a page reference', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['confluencePageVersion'] = 'v1'; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a blank title', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['title'] = ' '; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a dependency listed twice', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['dependsOn'] = ['METHOD_PROFILE', 'METHOD_PROFILE']; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a dependency on no known contract', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['dependsOn'] = ['STYLE_GUIDE']; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a Lens that depends on the Lexicon (a cycle through the 2.0 line)', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['dependsOn'] = ['METHOD_PROFILE', 'TERMINOLOGY_LEXICON']; }, 'PRECEDENCE_CONFLICT'],
    ['the Lexicon domain owned by the Lens', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['owns'] = ['CUSTOMER_WORDING']; }, 'PRECEDENCE_CONFLICT'],
    ['a second domain', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['owns'] = ['CUSTOMER_WORDING', 'NARRATIVE_STRUCTURE']; }, 'PRECEDENCE_CONFLICT'],
    ['a dependency on itself', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['dependsOn'] = ['TERMINOLOGY_LEXICON']; }, 'BUNDLE_SCHEMA_INVALID'],
    ['an edited Canon v2 precedence', 'INTERPRETATION_LENS', (core) => { at(core, 'canon', 'precedence')['conflictRule'] = 'If Canon v2 conflicts with a red line, Canon v2 wins.'; }, 'BUNDLE_BINDING_MISMATCH'],
    ['another decision page', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'canon')['confluencePageId'] = '62128133'; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a 1.x identity left unsuperseded', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes')['contractRefs'] = ['grounded-reflective-synthesis-lens@1.0.0']; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a supersession of itself', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'supersedes')['contractRefs'] = ['terminology-wording-lexicon@1.0.0', 'terminology-wording-lexicon@1.1.0', 'terminology-wording-lexicon@2.0.0']; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a blank replacement statement', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes')['statement'] = ' '; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a superseded Rebaseline section without its number', 'INTERPRETATION_LENS', (core) => { ((at(core, 'supersedes')['rebaselineSections'] as Json[])[0] as Json)['section'] = ' '; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a superseded Rebaseline section without its scope', 'INTERPRETATION_LENS', (core) => { ((at(core, 'supersedes')['rebaselineSections'] as Json[])[0] as Json)['scope'] = ' '; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a superseded section of another page', 'INTERPRETATION_LENS', (core) => { (at(core, 'supersedes')['rebaselineSections'] as Json[])[0] = { confluencePageId: '85131265', section: '17', title: 'x', scope: 'y' }; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a number in the content', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'vorstossContract')['perChapter'] = 2; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a methods key in the content', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'authority')['methods'] = ['ten_gods']; }, 'SYMBOLIC_AUTHORITY_REFUSED'],
    ['a mapping in the content', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'animalLoreContract')['mapping'] = { 午: 'Pferd' }; }, 'SYMBOLIC_AUTHORITY_REFUSED'],
    ['a method reference before Method Profile v2', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'animalLoreContract')['methodRefs'] = ['branch_animal_lore']; }, 'METHOD_REF_OUT_OF_PROFILE'],
    ['a block citing a C5 part in the Lens', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'principle')['source'] = { contract: 'INTERPRETATION_LENS', section: '(Codeblock)' }; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a block citing the Lens in the Lexicon', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'binding')['source'] = { contract: 'INTERPRETATION_LENS', section: 'Bindung' }; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a block citing a section C1 does not have', 'INTERPRETATION_LENS', (core) => { at(core, 'content')['extra'] = { text: 'x', source: { contract: 'INTERPRETATION_LENS', section: 'Erfunden' } }; }, 'BUNDLE_SCHEMA_INVALID'],
    ['a C1 section carried by no block', 'INTERPRETATION_LENS', (core) => { delete at(core, 'content')['supersededModel']; }, 'BUNDLE_SCHEMA_INVALID'],
    ['an empty rule', 'INTERPRETATION_LENS', (core) => { (at(core, 'content', 'tensionRule')['poles'] as string[])[0] = ' '; }, 'BUNDLE_SCHEMA_INVALID'],
    ['an empty list', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'freeZone', 'experienceFields')['fields'] = []; }, 'BUNDLE_SCHEMA_INVALID'],
    ['voice handed to another C5 version', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'voiceAuthority', 'binding')['confluencePageVersion'] = '2'; }, 'BUNDLE_BINDING_MISMATCH'],
    ['voice handed to the 1.1 Lexicon', 'INTERPRETATION_LENS', (core) => { at(core, 'content', 'voiceAuthority')['binding'] = { ...PLAN_CONTRACT_BINDINGS_V1_1.terminologyLexicon }; }, 'BUNDLE_BINDING_MISMATCH'],
    ['red lines conceded to the 1.1 Lens', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'authority')['redLinesBinding'] = { ...PLAN_CONTRACT_BINDINGS_V1_1.interpretationLens }; }, 'BUNDLE_BINDING_MISMATCH'],
    ['a style guide block dropped', 'TERMINOLOGY_LEXICON', (core) => { (at(core, 'content', 'styleGuide')['blocks'] as Json[]).splice(4, 1); }, 'BUNDLE_SCHEMA_INVALID'],
    ['style guide blocks reordered', 'TERMINOLOGY_LEXICON', (core) => { (at(core, 'content', 'styleGuide')['blocks'] as Json[]).reverse(); }, 'BUNDLE_SCHEMA_INVALID'],
    ['a quoted C1 rule owned by no known contract', 'INTERPRETATION_LENS', (core) => { ((at(core, 'content', 'chapterLengthAndFiller')['rules'] as Json[])[1] as Json)['ownedBy'] = 'STYLE_GUIDE'; }, 'PRECEDENCE_CONFLICT'],
    ['a quoted C1 rule owned by the Lens itself', 'INTERPRETATION_LENS', (core) => { ((at(core, 'content', 'chapterLengthAndFiller')['rules'] as Json[])[0] as Json)['ownedBy'] = 'INTERPRETATION_LENS'; }, 'PRECEDENCE_CONFLICT'],
  ])('refuses %s', (_label, key, edit, code) => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(coreWith(key, edit)))).toBe(code);
  });

  it.each<[string, CanonV2ContractKey, (core: Json) => void, string]>([
    ['the superseded Rebaseline sections as null', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes')['rebaselineSections'] = null; }, 'supersedes.rebaselineSections invalid_type'],
    ['a null Rebaseline section', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes')['rebaselineSections'] = [null]; }, 'supersedes.rebaselineSections.0 invalid_type'],
    ['a Rebaseline section number as a number', 'INTERPRETATION_LENS', (core) => { ((at(core, 'supersedes')['rebaselineSections'] as Json[])[0] as Json)['section'] = 17; }, 'supersedes.rebaselineSections.0.section invalid_type'],
    ['the supersession record as null', 'TERMINOLOGY_LEXICON', (core) => { core['supersedes'] = null; }, 'supersedes invalid_type'],
    ['no supersession record', 'TERMINOLOGY_LEXICON', (core) => { delete core['supersedes']; }, 'supersedes invalid_type'],
    ['the replacement statement as a number', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes')['statement'] = 7; }, 'supersedes.statement invalid_type'],
    ['owns as null', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['owns'] = null; }, 'source.owns invalid_type'],
    ['owns as a nested list', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['owns'] = [['SEMANTIC_ENVELOPE']]; }, 'source.owns.0 invalid_type'],
    ['dependsOn as null', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['dependsOn'] = null; }, 'source.dependsOn invalid_type'],
    ['dependsOn as a string', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['dependsOn'] = 'METHOD_PROFILE'; }, 'source.dependsOn invalid_type'],
    ['dependsOn as an object', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['dependsOn'] = {}; }, 'source.dependsOn invalid_type'],
    ['the title as null', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['title'] = null; }, 'source.title invalid_type'],
    ['the title as a number', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['title'] = 7; }, 'source.title invalid_type'],
    ['the decision date as a list', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['releasedOn'] = ['2026-10-04']; }, 'source.releasedOn invalid_type'],
    ['the page id as a number', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['confluencePageId'] = 85229569; }, 'source.confluencePageId invalid_type'],
    ['the page version as a one-element list', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['confluencePageVersion'] = ['1']; }, 'source.confluencePageVersion invalid_type'],
    ['the status as a number', 'INTERPRETATION_LENS', (core) => { at(core, 'source')['status'] = 5; }, 'source.status invalid_type'],
    ['the identity as a number', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['identity'] = 5; }, 'source.identity invalid_type'],
    ['an extra key on the core', 'INTERPRETATION_LENS', (core) => { core['methods'] = ['ten_gods']; }, '<root> unrecognized_keys'],
    ['an extra key on the source', 'TERMINOLOGY_LEXICON', (core) => { at(core, 'source')['note'] = 'x'; }, 'source unrecognized_keys'],
    ['an extra key on the supersession record', 'INTERPRETATION_LENS', (core) => { at(core, 'supersedes')['note'] = 'x'; }, 'supersedes unrecognized_keys'],
  ])('refuses a core of the wrong JSON shape at its field: %s', (_label, key, edit, where) => {
    expect(refusalOf(() => validateCanonV2ContractCore(coreWith(key, edit)))).toBe(`BUNDLE_SCHEMA_INVALID ${where}`);
  });

  it.each([
    ['2026-10-00', 'BUNDLE_SCHEMA_INVALID'],
    ['2026-00-04', 'BUNDLE_SCHEMA_INVALID'],
    ['2026-13-04', 'BUNDLE_SCHEMA_INVALID'],
    ['2100-02-29', 'BUNDLE_SCHEMA_INVALID'],
    ['2025-02-29', 'BUNDLE_SCHEMA_INVALID'],
    ['2000-02-29', 'ACCEPTED'],
    ['2024-02-29', 'ACCEPTED'],
  ])('holds the decision date %s to the calendar (%s)', (date, code) => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(coreWith('INTERPRETATION_LENS', (core) => { at(core, 'source')['releasedOn'] = date; })))).toBe(code);
  });

  it.each([
    'methods', 'method', 'factKinds', 'factKind', 'facts', 'fact', 'factRefs', 'operations', 'operation',
    'approvedDeterministicMappings', 'deterministicMappings', 'mappings', 'mapping', 'lookupTable', 'lookup', 'enabledSets',
  ])('refuses the symbolic-authority key "%s" anywhere in the content', (name) => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(coreWith('TERMINOLOGY_LEXICON', (core) => { at(core, 'content', 'binding')[name] = 'x'; })))).toBe('SYMBOLIC_AUTHORITY_REFUSED');
  });

  it('refuses quoted C1 rules whose owner list is not a list', () => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(coreWith('INTERPRETATION_LENS', (core) => { at(core, 'content', 'chapterLengthAndFiller')['rules'] = 'LONG_FORM'; })))).toBe('PRECEDENCE_CONFLICT');
  });

  it('refuses no core at all', () => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(null as unknown as CanonV2ContractCore))).toBe('BUNDLE_SCHEMA_INVALID');
  });

  it('accepts the released cores unedited (the baseline the refusals above depart from)', () => {
    expect(contractCodeOf(() => validateCanonV2ContractCore(canonV2ContractCore('INTERPRETATION_LENS')))).toBe('ACCEPTED');
    expect(contractCodeOf(() => validateCanonV2ContractCore(canonV2ContractCore('TERMINOLOGY_LEXICON')))).toBe('ACCEPTED');
  });
});

describe('ETBZ-77: a v2 contract is released only at its frozen hash', () => {
  const released = buildCanonV2Contract('INTERPRETATION_LENS');

  it('refuses honestly re-hashed content that is not the released content', () => {
    const core = coreWith('INTERPRETATION_LENS', (copy) => { (at(copy, 'content', 'redLines')['lines'] as Json[]).pop(); });
    const edited: CanonV2Contract = { ...core, structuralHash: structuralHash(core) };
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(edited))).toBe('BUNDLE_NOT_RELEASED');
  });

  it('refuses a published hash that is not the content hash', () => {
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...released, structuralHash: `sha256:${'0'.repeat(64)}` }))).toBe('BUNDLE_NOT_RELEASED');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...released, structuralHash: 'not-a-hash' }))).toBe('BUNDLE_NOT_RELEASED');
  });

  it('refuses an identity that was never released on the 2.0 line', () => {
    const core = coreWith('INTERPRETATION_LENS', (copy) => { at(copy, 'source')['identity'] = 'grounded-reflective-synthesis-lens@2.0.1'; });
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...core, structuralHash: structuralHash(core) }))).toBe('BUNDLE_NOT_RELEASED');
  });

  it('refuses, at its field, a released contract whose identity is a number', () => {
    const copy = JSON.parse(JSON.stringify(released)) as Json;
    at(copy, 'source')['identity'] = 5;
    expect(refusalOf(() => assertReleasedCanonV2Contract(copy as unknown as CanonV2Contract))).toBe('BUNDLE_SCHEMA_INVALID source.identity invalid_type');
  });

  it.each(['source', 'supersedes', 'content', 'canon'])('refuses a released contract whose %s is null', (field) => {
    const copy = JSON.parse(JSON.stringify(released)) as Json;
    copy[field] = null;
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(copy as unknown as CanonV2Contract))).toBe('BUNDLE_SCHEMA_INVALID');
  });

  it('refuses, coded, a nesting deeper than the engine can walk - in the validator and at the freeze', () => {
    const nested: unknown = JSON.parse(`${'['.repeat(20_000)}"x"${']'.repeat(20_000)}`);
    const core = coreWith('INTERPRETATION_LENS', (copy) => { ((at(copy, 'content', 'redLines')['lines'] as Json[])[0] as Json)['text'] = nested; });
    expect(contractCodeOf(() => validateCanonV2ContractCore(core))).toBe('BUNDLE_SCHEMA_INVALID');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...core, structuralHash: released.structuralHash }))).toBe('BUNDLE_SCHEMA_INVALID');
  });

  it('refuses data riding beside the released core and its hash', () => {
    expect(contractCodeOf(() => assertReleasedCanonV2Contract({ ...released, methods: ['ten_gods'] } as unknown as CanonV2Contract))).toBe('BUNDLE_SCHEMA_INVALID');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(null as unknown as CanonV2Contract))).toBe('BUNDLE_SCHEMA_INVALID');
  });

  it('accepts the released contracts', () => {
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(released))).toBe('ACCEPTED');
    expect(contractCodeOf(() => assertReleasedCanonV2Contract(buildCanonV2Contract('TERMINOLOGY_LEXICON')))).toBe('ACCEPTED');
  });
});
