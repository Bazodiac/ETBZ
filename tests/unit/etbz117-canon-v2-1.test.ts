/**
 * ETBZ-117 (Canon v2, R0) — Lens and Lexicon 2.1.0 load as released identities
 * on C1 and C5 page version 2, carry exactly what page version 2 changed, and
 * keep the reflection question a non-interactive text impulse.
 *
 * The refusals live in tests/negative/etbz117-canon-v2-1.negative.test.ts, the
 * current-context binding, the A1 byte baseline, the method scope, the ADR
 * closeout and the evidence record in
 * tests/contract/etbz117-canon-v2-1.contract.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import {
  C1_SECTIONS,
  C5_SECTIONS,
  CANON_V2_1_CONTRACT_SOURCES,
  CANON_V2_DECISION,
  CURRENT_CANON_V2_VERSION,
  PLAN_CONTRACT_BINDINGS_V2_0,
  PLAN_CONTRACT_BINDINGS_V2_1,
  RELEASED_CANON_V2_1_CONTRACT_HASHES,
  SEMANTIC_ENVELOPE_V2,
  SEMANTIC_ENVELOPE_V2_1,
  STYLE_GUIDE_V3_BLOCK_NAMES,
  STYLE_GUIDE_V3_BLOCKS_V2_1,
  WORDING_BOUNDARIES_V2,
  WORDING_BOUNDARIES_V2_1,
  assertCurrentCanonContractSet,
  buildCanonV2Contract,
  releasedCanonV2Contract,
  releasedCurrentCanonContract,
  resolveCanonV2Contract,
  resolveCurrentCanonContract,
  styleGuideV3Text,
} from '../../src/application/skill/index.js';
import type { CanonV2Contract } from '../../src/application/skill/index.js';
import { jsonDelta, sha256Hex } from '../support/etbz117Evidence.js';
import * as contractSourcesV2_1Module from '../../src/application/skill/contract-sources-v2-1.js';
import * as currentCanonModule from '../../src/application/skill/current-canon-contracts.js';
import * as semanticEnvelopeV2_1Module from '../../src/application/skill/semantic-envelope-v2-1.js';
import * as wordingBoundariesV2_1Module from '../../src/application/skill/wording-boundaries-v2-1.js';
import * as canonV2Module from '../../src/application/skill/canon-v2-contracts.js';

/** A build that throws is an assertion failure here, never a crashed test body. */
function attempt<T>(action: () => T): { value: T | undefined; error: string | undefined } {
  try {
    return { value: action(), error: undefined };
  } catch (error) {
    return { value: undefined, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Every string leaf of a value. */
function leaves(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) for (const entry of value) leaves(entry, found);
  else if (value !== null && typeof value === 'object') for (const entry of Object.values(value)) leaves(entry, found);
  return found;
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

const lensBuild = attempt(() => buildCanonV2Contract('INTERPRETATION_LENS', '2.1.0'));
const lexiconBuild = attempt(() => buildCanonV2Contract('TERMINOLOGY_LEXICON', '2.1.0'));

describe('ETBZ-117: Lens and Lexicon 2.1.0 load as released identities on C1 and C5 page version 2', () => {
  it('loads the Lens 2.1.0 with its identity and its C1 page version 2 binding', () => {
    expect(lensBuild.error).toBeUndefined();
    const source = lensBuild.value?.source;
    expect(source).toEqual({
      key: 'INTERPRETATION_LENS',
      title: 'ETBZ — C1 Interpretationsregeln v2',
      identity: 'grounded-reflective-synthesis-lens@2.1.0',
      confluencePageId: '85229569',
      confluencePageVersion: '2',
      status: 'CURRENT',
      releasedOn: '2026-10-05',
      owns: ['SEMANTIC_ENVELOPE'],
      dependsOn: ['METHOD_PROFILE'],
    });
    expect(resolveCurrentCanonContract('grounded-reflective-synthesis-lens@2.1.0')).toBe(source);
    expect(resolveCanonV2Contract('grounded-reflective-synthesis-lens@2.1.0', '2.1.0')).toBe(source);
  });

  it('loads the Lexicon 2.1.0 with its identity and its C5 page version 2 binding', () => {
    expect(lexiconBuild.error).toBeUndefined();
    const source = lexiconBuild.value?.source;
    expect(source).toEqual({
      key: 'TERMINOLOGY_LEXICON',
      title: 'ETBZ — Style Guide v3 (kanonisch, einzige zulässige Stimme)',
      identity: 'terminology-wording-lexicon@2.1.0',
      confluencePageId: '85164034',
      confluencePageVersion: '2',
      status: 'CURRENT',
      releasedOn: '2026-10-05',
      owns: ['CUSTOMER_WORDING'],
      dependsOn: ['INTERPRETATION_LENS'],
    });
    expect(resolveCurrentCanonContract('terminology-wording-lexicon@2.1.0')).toBe(source);
  });

  it('freezes Lens and Lexicon 2.1.0 by content hash, in a table of their own', () => {
    expect(lensBuild.value?.structuralHash).toBe('sha256:b931ae4e2e0f5c8c64f9b4cc143a189247e74d62a99a79952b8822da74d8f983');
    expect(lexiconBuild.value?.structuralHash).toBe('sha256:11a03b11099d77b0c55f4f30317793a2952af58120522bef92bf42cbc34115c4');
    expect(lensBuild.value?.structuralHash).toBe(RELEASED_CANON_V2_1_CONTRACT_HASHES['grounded-reflective-synthesis-lens@2.1.0']);
    expect(lexiconBuild.value?.structuralHash).toBe(RELEASED_CANON_V2_1_CONTRACT_HASHES['terminology-wording-lexicon@2.1.0']);
    expect(Object.keys(RELEASED_CANON_V2_1_CONTRACT_HASHES).sort()).toEqual(['grounded-reflective-synthesis-lens@2.1.0', 'terminology-wording-lexicon@2.1.0']);
    expect(attempt(() => releasedCanonV2Contract('INTERPRETATION_LENS', '2.1.0')).error).toBeUndefined();
    expect(attempt(() => releasedCurrentCanonContract('TERMINOLOGY_LEXICON')).error).toBeUndefined();
  });

  it('builds the current Canon v2 line deterministically: two builds are the same value', () => {
    const first = attempt(() => assertCurrentCanonContractSet());
    const second = attempt(() => assertCurrentCanonContractSet());
    expect(first.error).toBeUndefined();
    expect(second.error).toBeUndefined();
    expect(canonicalJson(first.value)).toBe(canonicalJson(second.value));
    expect(CURRENT_CANON_V2_VERSION).toBe('2.1.0');
    expect(first.value?.contractVersion).toBe('2.1.0');
    expect(first.value?.contracts.map((contract: CanonV2Contract) => contract.source.identity)).toEqual([
      'grounded-reflective-synthesis-lens@2.1.0',
      'terminology-wording-lexicon@2.1.0',
    ]);
    expect(first.value?.canon).toBe(CANON_V2_DECISION);
    expect(first.value?.planBindings).toBe(PLAN_CONTRACT_BINDINGS_V2_1);
  });
});

describe('ETBZ-117: the 2.1 line is handed out frozen', () => {
  const isDeepFrozen = (value: unknown): boolean =>
    value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every((entry) => isDeepFrozen(entry)));

  it.each([
    ['canon-v2-contracts', canonV2Module],
    ['contract-sources-v2-1', contractSourcesV2_1Module],
    ['semantic-envelope-v2-1', semanticEnvelopeV2_1Module],
    ['wording-boundaries-v2-1', wordingBoundariesV2_1Module],
  ] as const)('deep-freezes every object %s exports', (_name, module) => {
    const objects = Object.entries(module).filter(([, value]) => value !== null && typeof value === 'object');
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.filter(([, value]) => !isDeepFrozen(value)).map(([name]) => name)).toEqual([]);
  });

  it('exports no object from the current-context module, only its version and its functions', () => {
    expect(Object.entries(currentCanonModule).filter(([, value]) => typeof value !== 'function').map(([name]) => name)).toEqual(['CURRENT_CANON_V2_VERSION']);
  });

  it('cannot be changed through a value it hands back', () => {
    const set = assertCurrentCanonContractSet();
    expect(attempt(() => { (set.planBindings.interpretationLens as { contractRef: string }).contractRef = 'grounded-reflective-synthesis-lens@2.0.0'; }).error).toBeDefined();
    expect(attempt(() => { (RELEASED_CANON_V2_1_CONTRACT_HASHES as Record<string, string>)['grounded-reflective-synthesis-lens@2.1.0'] = 'sha256:0'; }).error).toBeDefined();
    expect(PLAN_CONTRACT_BINDINGS_V2_1.interpretationLens.contractRef).toBe('grounded-reflective-synthesis-lens@2.1.0');
  });
});

describe('ETBZ-117: the 2.1.0 content is C1 and C5 at page version 2 - exactly what the page changed, nothing else', () => {
  it('differs from the Lens 2.0.0 in exactly the places C1 version 2 changed, and in its C5 binding', () => {
    expect(jsonDelta(SEMANTIC_ENVELOPE_V2, SEMANTIC_ENVELOPE_V2_1)).toEqual([
      '~.originMarkers.statementTypes[3].form',
      '+.pageRules.poReconcile',
      '~.voiceAuthority.binding.confluencePageVersion',
      '~.voiceAuthority.binding.contractRef',
      '~.vorstossContract.parts[4].partId',
      '~.vorstossContract.parts[4].text',
    ]);
  });

  it('differs from the Lexicon 2.0.0 in exactly the two style guide blocks C5 version 2 rewrote, and in its C1 binding', () => {
    expect(jsonDelta(WORDING_BOUNDARIES_V2, WORDING_BOUNDARIES_V2_1)).toEqual([
      '~.authority.redLinesBinding.confluencePageVersion',
      '~.authority.redLinesBinding.contractRef',
      '~.styleGuide.blocks[4].lines[0]',
      '~.styleGuide.blocks[8].lines[0]',
    ]);
  });

  it('carries C1 version 2 verbatim where it changed: the PO-Reconcile paragraph, Zone B and Vorstoß part 5', () => {
    expect(SEMANTIC_ENVELOPE_V2_1.pageRules.poReconcile).toBe('PO-Reconcile 2026-10-05 (ETBZ-117 / ETBZ-116): Diese Seitenversion gilt für neue Canon-v2-Arbeit. Die unter ETBZ-77 bereits released Lens/Lexicon-Identitäten 2.0.0 bleiben an die vorherige C1/C5-Quellversion gebunden und werden nicht in place verändert. Die aktualisierte Regel wird über eine neue immutable Contract-Identity vor ETBZ-78 released.');
    expect(SEMANTIC_ENVELOPE_V2_1.originMarkers.statementTypes.find((entry) => entry.statementType === 'Vorstoß')?.form).toBe('pointiert, widerlegbar, mit nicht-interaktiver Reflexionsfrage');
    expect(SEMANTIC_ENVELOPE_V2_1.vorstossContract.parts.map((part) => part.partId)).toEqual(['ANKER', 'THESE', 'SZENE', 'LICHT_UND_SCHATTEN', 'REFLEXIONSFRAGE']);
    expect(SEMANTIC_ENVELOPE_V2_1.vorstossContract.parts[4]?.text).toBe('eine Reflexionsfrage als rhetorischen Textimpuls, ohne verpflichtendes Antwortformat oder Antwortoptionen.');
    expect([...new Set(citedSections(SEMANTIC_ENVELOPE_V2_1))]).toEqual([...C1_SECTIONS]);
  });

  it('carries the C5 version 2 code block whole: 44 lines, 3,950 UTF-8 bytes, the page bytes', () => {
    expect(WORDING_BOUNDARIES_V2_1.styleGuide.blocks.map((block) => block.block)).toEqual([...STYLE_GUIDE_V3_BLOCK_NAMES]);
    const text = styleGuideV3Text(STYLE_GUIDE_V3_BLOCKS_V2_1);
    expect(text.split('\n')).toHaveLength(45);
    expect(Buffer.byteLength(text, 'utf8')).toBe(3950);
    expect(sha256Hex(text)).toBe('8d40f0053678a47a87b7563097da7e92f65b6a45d37b053e5457f372b798eabf');
    expect(WORDING_BOUNDARIES_V2_1.styleGuide.blocks[4]?.lines).toEqual([
      'Direkt, als rhetorischer Textimpuls auf eine erinnerbare Lage der letzten Wochen bezogen und ohne BaZi-Wissen verständlich. Kein verpflichtendes Antwortformat, keine Ja/Nein/Teilweise-Optionen und keine Antwort-Affordance. Keine zwei Fragen mit gleichem Satzanfang, keine semantischen Dubletten.',
    ]);
    expect(WORDING_BOUNDARIES_V2_1.styleGuide.blocks[8]?.lines).toEqual([
      'Der Text soll klare Resonanz oder klaren Widerspruch auslösen. Beides ist Erfolg. Lauwarm ist Misserfolg.',
    ]);
    expect([...new Set(citedSections(WORDING_BOUNDARIES_V2_1))]).toEqual([...C5_SECTIONS]);
  });
});

describe('ETBZ-117 AC5: the reflection question stays a non-interactive text impulse', () => {
  const current = leaves([SEMANTIC_ENVELOPE_V2_1, WORDING_BOUNDARIES_V2_1]);

  it('asks for no answer anywhere in the current Lens and Lexicon: no answer format, no answer options, no answer affordance', () => {
    expect(current.filter((text) => /beantwortbar|Ja \/ Nein \/ Teilweise|Ja · Nein · Teilweise|„Ja, genau so"|Prüffrage/u.test(text))).toEqual([]);
    expect(current.filter((text) => text.includes('Ja/Nein/Teilweise'))).toEqual([
      'Direkt, als rhetorischer Textimpuls auf eine erinnerbare Lage der letzten Wochen bezogen und ohne BaZi-Wissen verständlich. Kein verpflichtendes Antwortformat, keine Ja/Nein/Teilweise-Optionen und keine Antwort-Affordance. Keine zwei Fragen mit gleichem Satzanfang, keine semantischen Dubletten.',
    ]);
  });

  it('keeps the A1 2.0.0 record as released: page version 1 still says what it said', () => {
    expect(SEMANTIC_ENVELOPE_V2.vorstossContract.parts[4]).toEqual({ partId: 'PRUEFFRAGE', text: 'eine Prüffrage, beantwortbar mit Ja / Nein / Teilweise.' });
    expect(WORDING_BOUNDARIES_V2.styleGuide.blocks[4]?.lines[0]?.startsWith('Direkt, mit Ja / Nein / Teilweise beantwortbar')).toBe(true);
  });
});

describe('ETBZ-117: Lens and Lexicon 2.1.0 bind each other at page version 2', () => {
  it('has the Lens 2.1.0 hand voice to exactly the Lexicon 2.1.0, and the Lexicon concede the red lines to exactly that Lens', () => {
    const lexicon = lexiconBuild.value?.source;
    const lens = lensBuild.value?.source;
    expect(SEMANTIC_ENVELOPE_V2_1.voiceAuthority.binding).toEqual({ contractRef: lexicon?.identity, confluencePageId: lexicon?.confluencePageId, confluencePageVersion: '2' });
    expect(WORDING_BOUNDARIES_V2_1.authority.redLinesBinding).toEqual({ contractRef: lens?.identity, confluencePageId: lens?.confluencePageId, confluencePageVersion: '2' });
    expect(PLAN_CONTRACT_BINDINGS_V2_1).toEqual({
      terminologyLexicon: SEMANTIC_ENVELOPE_V2_1.voiceAuthority.binding,
      interpretationLens: WORDING_BOUNDARIES_V2_1.authority.redLinesBinding,
    });
    expect(CANON_V2_1_CONTRACT_SOURCES.map((source) => [source.identity, source.confluencePageId, source.confluencePageVersion])).toEqual([
      ['grounded-reflective-synthesis-lens@2.1.0', '85229569', '2'],
      ['terminology-wording-lexicon@2.1.0', '85164034', '2'],
    ]);
  });
});

describe('ETBZ-117: version beside version - what 2.1.0 supersedes stays resolvable in its own context', () => {
  it.each([
    ['INTERPRETATION_LENS', ['grounded-reflective-synthesis-lens@1.0.0', 'grounded-reflective-synthesis-lens@1.1.0'], 'grounded-reflective-synthesis-lens@2.0.0', '85229569'],
    ['TERMINOLOGY_LEXICON', ['terminology-wording-lexicon@1.0.0', 'terminology-wording-lexicon@1.1.0'], 'terminology-wording-lexicon@2.0.0', '85164034'],
  ] as const)('%s supersedes the 1.x identities and moves the A1 2.0.0 identity forward, which still resolves in the 2.0 context to page version 1', (key, v1Refs, a1Ref, pageId) => {
    const contract = key === 'INTERPRETATION_LENS' ? lensBuild.value : lexiconBuild.value;
    expect(contract?.supersedes.contractRefs).toEqual(v1Refs);
    const prior = (contract?.supersedes as { priorCanonVersions?: { statement: string; contractRefs: readonly string[] } } | undefined)?.priorCanonVersions;
    expect(prior?.contractRefs).toEqual([a1Ref]);
    expect(prior?.statement).toContain('bleiben an die vorherige C1/C5-Quellversion gebunden und werden nicht in place verändert');
    const a1 = resolveCanonV2Contract(a1Ref);
    expect([a1.identity, a1.confluencePageId, a1.confluencePageVersion]).toEqual([a1Ref, pageId, '1']);
    expect(PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens.confluencePageVersion).toBe('1');
  });
});
