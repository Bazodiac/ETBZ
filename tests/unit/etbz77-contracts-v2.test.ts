/**
 * ETBZ-77 (Canon v2, A1) — the Interpretation Lens v2 and the Terminology &
 * Wording Lexicon v2 load as released identities and carry C1 and C5.
 *
 * The refusals live in tests/negative/etbz77-contracts-v2.negative.test.ts, the
 * binding of the 2.0 context, the 1.x byte baseline and the evidence record in
 * tests/contract/etbz77-contracts-v2.contract.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { BAZI_METHOD_REGISTRY_V1 } from '../../src/application/interpretation/method-registry.js';
import {
  C1_SECTIONS,
  C5_SECTIONS,
  CANON_V2_CONTRACT_VERSION,
  CANON_V2_DECISION,
  PLAN_CONTRACT_BINDINGS_V2_0,
  RELEASED_CANON_V2_CONTRACT_HASHES,
  SEMANTIC_ENVELOPE_V2,
  STYLE_GUIDE_V3_BLOCK_NAMES,
  assertCanonV2ContractBindings,
  WORDING_BOUNDARIES_V2,
  assertCanonV2ContractSet,
  buildCanonV2Contract,
  buildSkillContractBundle,
  contractByKey,
  releasedCanonV2Contract,
  resolveCanonV2Contract,
  resolveContract,
  styleGuideV3Text,
} from '../../src/application/skill/index.js';
import type { CanonV2Contract } from '../../src/application/skill/index.js';
import { sha256Hex } from '../support/etbz77Evidence.js';
import * as canonV2Module from '../../src/application/skill/canon-v2-contracts.js';
import * as contractSourcesV2Module from '../../src/application/skill/contract-sources-v2.js';
import * as semanticEnvelopeV2Module from '../../src/application/skill/semantic-envelope-v2.js';
import * as wordingBoundariesV2Module from '../../src/application/skill/wording-boundaries-v2.js';

/** A build that throws is an assertion failure here, never a crashed test body. */
function attempt<T>(action: () => T): { value: T | undefined; error: string | undefined } {
  try {
    return { value: action(), error: undefined };
  } catch (error) {
    return { value: undefined, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Every `source` a block cites, in content order. */
function citedSections(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) citedSections(entry, found);
  } else if (value !== null && typeof value === 'object') {
    for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
      if (name === 'source' && entry !== null && typeof entry === 'object') found.push(String((entry as Record<string, unknown>)['section']));
      else citedSections(entry, found);
    }
  }
  return found;
}

const lensBuild = attempt(() => buildCanonV2Contract('INTERPRETATION_LENS'));
const lexiconBuild = attempt(() => buildCanonV2Contract('TERMINOLOGY_LEXICON'));

describe('ETBZ-77: the Lens v2 and the Lexicon v2 load as released identities', () => {
  it('loads the Lens v2 with its identity and its C1 page binding', () => {
    expect(lensBuild.error).toBeUndefined();
    const source = lensBuild.value?.source;
    expect(source).toEqual({
      key: 'INTERPRETATION_LENS',
      title: 'ETBZ — C1 Interpretationsregeln v2',
      identity: 'grounded-reflective-synthesis-lens@2.0.0',
      confluencePageId: '85229569',
      confluencePageVersion: '1',
      status: 'CURRENT',
      releasedOn: '2026-10-04',
      owns: ['SEMANTIC_ENVELOPE'],
      dependsOn: ['METHOD_PROFILE'],
    });
    expect(resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.0.0')).toBe(source);
  });

  it('loads the Lexicon v2 with its identity and its C5 page binding', () => {
    expect(lexiconBuild.error).toBeUndefined();
    const source = lexiconBuild.value?.source;
    expect(source).toEqual({
      key: 'TERMINOLOGY_LEXICON',
      title: 'ETBZ — Style Guide v3 (kanonisch, einzige zulässige Stimme)',
      identity: 'terminology-wording-lexicon@2.0.0',
      confluencePageId: '85164034',
      confluencePageVersion: '1',
      status: 'CURRENT',
      releasedOn: '2026-10-04',
      owns: ['CUSTOMER_WORDING'],
      dependsOn: ['INTERPRETATION_LENS'],
    });
    expect(resolveCanonV2Contract('terminology-wording-lexicon@2.0.0')).toBe(source);
  });

  it('freezes Lens v2 and Lexicon v2 by content hash', () => {
    expect(lensBuild.value?.structuralHash).toBe(RELEASED_CANON_V2_CONTRACT_HASHES['grounded-reflective-synthesis-lens@2.0.0']);
    expect(lexiconBuild.value?.structuralHash).toBe(RELEASED_CANON_V2_CONTRACT_HASHES['terminology-wording-lexicon@2.0.0']);
    expect(Object.keys(RELEASED_CANON_V2_CONTRACT_HASHES).sort()).toEqual(['grounded-reflective-synthesis-lens@2.0.0', 'terminology-wording-lexicon@2.0.0']);
    expect(attempt(() => releasedCanonV2Contract('INTERPRETATION_LENS')).error).toBeUndefined();
    expect(attempt(() => releasedCanonV2Contract('TERMINOLOGY_LEXICON')).error).toBeUndefined();
  });

  it('binds the Canon v2 deterministically: two builds are the same value and the same hash', () => {
    const first = attempt(() => assertCanonV2ContractSet());
    const second = attempt(() => assertCanonV2ContractSet());
    expect(first.error).toBeUndefined();
    expect(second.error).toBeUndefined();
    expect(canonicalJson(first.value)).toBe(canonicalJson(second.value));
    expect(first.value?.contractVersion).toBe(CANON_V2_CONTRACT_VERSION);
    expect(first.value?.contracts.map((contract: CanonV2Contract) => contract.source.identity)).toEqual([
      'grounded-reflective-synthesis-lens@2.0.0',
      'terminology-wording-lexicon@2.0.0',
    ]);
    expect(first.value?.canon).toBe(CANON_V2_DECISION);
    expect(CANON_V2_DECISION.confluencePageId).toBe('85131265');
    expect(CANON_V2_DECISION.decisionDate).toBe('2026-10-04');
  });
});

describe('ETBZ-77: the 2.0 line is handed out frozen', () => {
  const isDeepFrozen = (value: unknown): boolean =>
    value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every((entry) => isDeepFrozen(entry)));

  it.each([
    ['canon-v2-contracts', canonV2Module],
    ['contract-sources-v2', contractSourcesV2Module],
    ['semantic-envelope-v2', semanticEnvelopeV2Module],
    ['wording-boundaries-v2', wordingBoundariesV2Module],
  ] as const)('deep-freezes every object %s exports', (_name, module) => {
    const objects = Object.entries(module).filter(([, value]) => value !== null && typeof value === 'object');
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.filter(([, value]) => !isDeepFrozen(value)).map(([name]) => name)).toEqual([]);
  });

  it('cannot be changed through a value it hands back', () => {
    const pair = assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_0));
    expect(attempt(() => { (pair.interpretationLens as { contractRef: string }).contractRef = 'grounded-reflective-synthesis-lens@1.1.0'; }).error).toBeDefined();
    expect(attempt(() => { (RELEASED_CANON_V2_CONTRACT_HASHES as Record<string, string>)['grounded-reflective-synthesis-lens@2.0.0'] = 'sha256:0'; }).error).toBeDefined();
    expect(PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens.contractRef).toBe('grounded-reflective-synthesis-lens@2.0.0');
  });
});

describe('ETBZ-77 AC1: the Lens v2 carries C1', () => {
  it('cites every C1 section, in page order', () => {
    expect([...new Set(citedSections(SEMANTIC_ENVELOPE_V2))]).toEqual([...C1_SECTIONS]);
  });

  it('carries the eight red lines of Zone A, numbered as on the page', () => {
    expect(SEMANTIC_ENVELOPE_V2.redLines.lines.map((line) => line.lineId)).toEqual(['RL-1', 'RL-2', 'RL-3', 'RL-4', 'RL-5', 'RL-6', 'RL-7', 'RL-8']);
    expect(SEMANTIC_ENVELOPE_V2.redLines.lines[6]?.text).toBe('Methodentreue: nur Methoden, die in Method Profile v2 (C2) freigegeben sind.');
    expect(SEMANTIC_ENVELOPE_V2.pageRules.redLinesPrevail).toBe('Rote Linien (Zone A) haben immer Vorrang.');
    expect(SEMANTIC_ENVELOPE_V2.pageRules.status).toBe('Normative Zielarchitektur.');
  });

  it('carries the five statement types of Zone B and the free zone of Zone C', () => {
    expect(SEMANTIC_ENVELOPE_V2.originMarkers.statementTypes.map((entry) => entry.statementType)).toEqual(['Chartbefund', 'Tradition', 'Deutung', 'Vorstoß', 'Vorläufig']);
    expect(SEMANTIC_ENVELOPE_V2.originMarkers.statementTypes[0]?.form).toBe('„Dein Chart zeigt …"');
    expect(SEMANTIC_ENVELOPE_V2.freeZone.text).toBe('Stil, Humor, Bilder, Jahreszeiten als Bild, Tiere und Alltagsszenen aus den Erlebensfeldern.');
  });

  it('carries the closed list of six experience fields and the five pillar rooms', () => {
    expect(SEMANTIC_ENVELOPE_V2.freeZone.experienceFields.fields).toHaveLength(6);
    expect(SEMANTIC_ENVELOPE_V2.freeZone.experienceFields.rule).toContain('geschlossene Liste');
    expect(SEMANTIC_ENVELOPE_V2.freeZone.pillarRooms.rooms.map((room) => [room.pillar, room.room])).toEqual([
      ['Jahr', 'Herkunft und erster Eindruck'],
      ['Monat', 'Wirkungsfeld und Grundton'],
      ['Tagesstamm', 'du selbst'],
      ['Tageszweig', 'Nähe'],
      ['Stunde', 'Werk und was bleibt'],
    ]);
  });

  it('carries the Vorstoß contract with its five parts in order, and the light/shadow and animal-lore contracts', () => {
    expect(SEMANTIC_ENVELOPE_V2.vorstossContract.parts.map((part) => part.partId)).toEqual(['ANKER', 'THESE', 'SZENE', 'LICHT_UND_SCHATTEN', 'PRUEFFRAGE']);
    expect(SEMANTIC_ENVELOPE_V2.vorstossContract.frequency).toContain('Pro Kapitel 1–2 Vorstöße, pro Reading 8–12.');
    expect(SEMANTIC_ENVELOPE_V2.lightShadowContract.rule).toBe('Jedes Hauptmotiv bekommt seine Schattenseite.');
    expect(SEMANTIC_ENVELOPE_V2.animalLoreContract.rules).toHaveLength(3);
    expect(SEMANTIC_ENVELOPE_V2.animalLoreContract.unsourcedStatus).toBe('SOURCE_NEEDED');
  });

  it('carries the tension rule and the count-word and number rules', () => {
    expect(SEMANTIC_ENVELOPE_V2.tensionRule.poles).toEqual(['Fakt/Fakt', 'Claim/Claim', 'Überlieferung/Chart']);
    expect(SEMANTIC_ENVELOPE_V2.countWordsAndNumbers.countWords).toBe('Zählwörter sind erlaubt, wenn sich die Zählung aus den zitierten Fakten nachprüfen lässt.');
    expect(SEMANTIC_ENVELOPE_V2.countWordsAndNumbers.numbers).toBe('Zahlen erscheinen als gerundeter Anzeigewert des zitierten Fakts: eine Nachkommastelle, deutsches Komma.');
  });

  it('quotes the chapter-length and filler rules with the contract that owns each, and the abolished model', () => {
    expect(SEMANTIC_ENVELOPE_V2.chapterLengthAndFiller.rules.map((rule) => rule.ownedBy)).toEqual(['LONG_FORM', 'ANTI_BOILERPLATE']);
    expect(SEMANTIC_ENVELOPE_V2.supersededModel.items).toHaveLength(10);
  });
});

describe('ETBZ-77 AC1: the Lexicon v2 carries C5 whole', () => {
  it('cites every C5 part', () => {
    expect([...new Set(citedSections(WORDING_BOUNDARIES_V2))]).toEqual([...C5_SECTIONS]);
  });

  it('carries the style guide block by block in page order, as one text of 44 lines', () => {
    expect(WORDING_BOUNDARIES_V2.styleGuide.blocks.map((block) => block.block)).toEqual([...STYLE_GUIDE_V3_BLOCK_NAMES]);
    const text = styleGuideV3Text();
    expect(text.startsWith('ZIELSTIMME\nEin kluger, trockener Freund')).toBe(true);
    expect(text.endsWith('Lauwarm ist Misserfolg.\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(45);
    expect(sha256Hex(text)).toBe('75527bf7d4f68d9de1b8fad84c78f49997e222898050b9b511e9dfad31a09196');
  });

  it('names the ten roles of C5, role name first and Hanzi in brackets', () => {
    const roles = WORDING_BOUNDARIES_V2.styleGuide.blocks.find((block) => block.block.startsWith('ROLLENNAMEN'))?.lines[0];
    expect(roles?.match(/[^\s,(]+ \([^)]+\)/gu)).toHaveLength(10);
    expect(roles?.startsWith('Weggefährte (比肩), Rivale (劫财)')).toBe(true);
  });
});

describe('ETBZ-77: C5 is the voice authority, consistently', () => {
  it('has the Lens hand voice to exactly the Lexicon v2 it is released with, and the Lexicon concede the red lines to exactly that Lens', () => {
    const lexicon = lexiconBuild.value?.source;
    const lens = lensBuild.value?.source;
    expect(SEMANTIC_ENVELOPE_V2.voiceAuthority.binding).toEqual({ contractRef: lexicon?.identity, confluencePageId: lexicon?.confluencePageId, confluencePageVersion: lexicon?.confluencePageVersion });
    expect(PLAN_CONTRACT_BINDINGS_V2_0.terminologyLexicon).toEqual(SEMANTIC_ENVELOPE_V2.voiceAuthority.binding);
    expect(WORDING_BOUNDARIES_V2.authority.redLinesBinding).toEqual({ contractRef: lens?.identity, confluencePageId: lens?.confluencePageId, confluencePageVersion: lens?.confluencePageVersion });
    expect(PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens).toEqual(WORDING_BOUNDARIES_V2.authority.redLinesBinding);
  });
});

describe('ETBZ-77: version beside version - what the 2.0 line supersedes stays resolvable', () => {
  it.each([
    ['INTERPRETATION_LENS', ['grounded-reflective-synthesis-lens@1.0.0', 'grounded-reflective-synthesis-lens@1.1.0'], [['67371029', '1'], ['77561858', '6']]],
    ['TERMINOLOGY_LEXICON', ['terminology-wording-lexicon@1.0.0', 'terminology-wording-lexicon@1.1.0'], [['67600385', '1'], ['77529091', '4']]],
  ] as const)('%s supersedes exactly the released 1.x identities of its lineage, each still resolving under its own bundle to its own page', (key, refs, pages) => {
    const contract = key === 'INTERPRETATION_LENS' ? lensBuild.value : lexiconBuild.value;
    expect(contract?.supersedes.contractRefs).toEqual(refs);
    refs.forEach((ref, index) => {
      const bundle = buildSkillContractBundle(BAZI_METHOD_REGISTRY_V1, index === 0 ? '1.0.0' : '1.1.0');
      const resolved = resolveContract(bundle, ref);
      expect(resolved).toBe(contractByKey(bundle, key));
      expect([resolved.confluencePageId, resolved.confluencePageVersion]).toEqual(pages[index]);
    });
  });

  it('records Rebaseline section 17 as superseded by the Lens line, as far as sentence-level safety goes', () => {
    expect(lensBuild.value?.supersedes.rebaselineSections).toEqual([{
      confluencePageId: '62128133',
      section: '17',
      title: 'Pre-Golden Product Decision — Safety below the surface, clarity on the surface — 2026-09-30',
      scope: 'soweit es um Sicherheit auf Satzebene geht',
    }]);
    expect(lexiconBuild.value?.supersedes.rebaselineSections).toEqual([]);
  });
});
