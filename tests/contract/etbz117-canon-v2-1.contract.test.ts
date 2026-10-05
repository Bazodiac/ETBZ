/**
 * ETBZ-117 (Canon v2, R0) — the forward fix beside the released A1 line.
 *
 * Five contracts with the rest of the repository:
 *   1. the current Canon context binds Lens and Lexicon 2.1.0 on C1 and C5 page
 *      version 2 and never the A1 2.0.0 pair (the killer of the "current
 *      binding back to A1" mutants in scripts/verify-etbz117-canon-v2-1.mjs);
 *   2. A1 is immutable: its value modules, its evidence, its suites and its
 *      guard script are byte-identical to main@9362f4e2, its two hashes are the
 *      released ones, and the 2.0 context answers as released;
 *   3. the method scope is untouched: no method, no Method Profile key, the
 *      registry and its released hash byte-identical to main@9362f4e2;
 *   4. ADR 0019 is closed (Accepted, no open reflection-question decision, its
 *      A1 facts intact) and ADR 0020 records what the code releases;
 *   5. the evidence record under docs/evidence/etbz-117/canon-v2-1/ re-derives
 *      byte for byte.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANON_V2_1_CONTRACT_SOURCES,
  CANON_V2_CONTRACT_KEYS,
  CANON_V2_CONTRACT_SOURCES,
  CANON_V2_LINE_VERSIONS,
  CURRENT_CANON_V2_VERSION,
  PLAN_CONTRACT_BINDINGS_V2_0,
  PLAN_CONTRACT_BINDINGS_V2_1,
  RELEASED_CANON_V2_1_CONTRACT_HASHES,
  RELEASED_CANON_V2_CONTRACT_HASHES,
  assertCanonV2ContractBindings,
  assertCanonV2ContractSet,
  assertCurrentCanonContractBindings,
  assertCurrentCanonContractSet,
  buildCanonV2Contract,
} from '../../src/application/skill/index.js';
import { RELEASED_REGISTRY_HASHES } from '../../src/application/interpretation/method-registry.js';
import { contractCodeOf } from '../support/etbz77Evidence.js';
import {
  A1_BASELINE_SHA256,
  A1_RELEASED_HASHES,
  ADR_0019_BASE_SHA256,
  ADR_0019_CLOSEOUT_EDITS,
  METHOD_SCOPE_DIRECTORIES_AT_BASE,
  adr0019WithoutCloseout,
  currentDirectoryListings,
  sha256Hex,
  ETBZ117_ADR,
  ETBZ117_BASE_COMMIT,
  ETBZ117_EVIDENCE_PATH,
  METHOD_SCOPE_BASELINE_SHA256,
  RELEASED_REGISTRY_HASHES_AT_BASE,
  currentSha256,
  deriveEtbz117Evidence,
  renderJson,
} from '../support/etbz117Evidence.js';

const REPO_ROOT = process.cwd();
const read = (path: string): string => readFileSync(resolve(REPO_ROOT, path), 'utf8');

function attempt<T>(action: () => T): { value: T | undefined; error: string | undefined } {
  try {
    return { value: action(), error: undefined };
  } catch (error) {
    return { value: undefined, error: error instanceof Error ? error.message : String(error) };
  }
}

describe('ETBZ-117 AC3/AC4: the current Canon context binds the forward identities', () => {
  it('binds Lens and Lexicon 2.1.0 on C1 and C5 page version 2 in the current context, never the A1 2.0.0 pair', () => {
    const set = attempt(() => assertCurrentCanonContractSet());
    expect(set.error).toBeUndefined();
    expect(CURRENT_CANON_V2_VERSION).toBe('2.1.0');
    expect(CANON_V2_LINE_VERSIONS).toEqual(['2.0.0', '2.1.0']);
    expect(PLAN_CONTRACT_BINDINGS_V2_1).toEqual({
      terminologyLexicon: { contractRef: 'terminology-wording-lexicon@2.1.0', confluencePageId: '85164034', confluencePageVersion: '2' },
      interpretationLens: { contractRef: 'grounded-reflective-synthesis-lens@2.1.0', confluencePageId: '85229569', confluencePageVersion: '2' },
    });
    expect(CANON_V2_1_CONTRACT_SOURCES.map((source) => [source.key, source.identity, source.confluencePageId, source.confluencePageVersion, source.releasedOn])).toEqual([
      ['INTERPRETATION_LENS', 'grounded-reflective-synthesis-lens@2.1.0', '85229569', '2', '2026-10-05'],
      ['TERMINOLOGY_LEXICON', 'terminology-wording-lexicon@2.1.0', '85164034', '2', '2026-10-05'],
    ]);
    expect(set.value?.contractVersion).toBe('2.1.0');
    expect(set.value?.planBindings).toBe(PLAN_CONTRACT_BINDINGS_V2_1);
    expect(contractCodeOf(() => assertCurrentCanonContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_0)))).toBe('CONTRACT_DRIFT');
    for (const binding of [PLAN_CONTRACT_BINDINGS_V2_1.interpretationLens, PLAN_CONTRACT_BINDINGS_V2_1.terminologyLexicon]) {
      expect(Object.keys(RELEASED_CANON_V2_CONTRACT_HASHES)).not.toContain(binding.contractRef);
      expect(binding.confluencePageVersion).toBe('2');
    }
  });
});

describe('ETBZ-117 AC2: A1 2.0.0 is immutable', () => {
  it(`leaves the A1 value modules, its evidence, its suites and its guard script byte-identical to main ${ETBZ117_BASE_COMMIT.slice(0, 8)}`, () => {
    expect(Object.keys(A1_BASELINE_SHA256)).toHaveLength(18);
    expect(currentSha256(A1_BASELINE_SHA256)).toEqual(A1_BASELINE_SHA256);
  });

  it('keeps the A1 2.0.0 hashes at their released values, rebuilds 2.0.0 to them and keeps the 2.0 context answering as released', () => {
    expect(RELEASED_CANON_V2_CONTRACT_HASHES).toEqual(A1_RELEASED_HASHES);
    expect(buildCanonV2Contract('INTERPRETATION_LENS').structuralHash).toBe(A1_RELEASED_HASHES['grounded-reflective-synthesis-lens@2.0.0']);
    expect(buildCanonV2Contract('TERMINOLOGY_LEXICON').structuralHash).toBe(A1_RELEASED_HASHES['terminology-wording-lexicon@2.0.0']);
    expect(CANON_V2_CONTRACT_SOURCES.map((source) => [source.identity, source.confluencePageVersion, source.releasedOn])).toEqual([
      ['grounded-reflective-synthesis-lens@2.0.0', '1', '2026-10-04'],
      ['terminology-wording-lexicon@2.0.0', '1', '2026-10-04'],
    ]);
    expect(PLAN_CONTRACT_BINDINGS_V2_0).toEqual({
      terminologyLexicon: { contractRef: 'terminology-wording-lexicon@2.0.0', confluencePageId: '85164034', confluencePageVersion: '1' },
      interpretationLens: { contractRef: 'grounded-reflective-synthesis-lens@2.0.0', confluencePageId: '85229569', confluencePageVersion: '1' },
    });
    expect(assertCanonV2ContractSet().contractVersion).toBe('2.0.0');
    expect(assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_0))).toBe(PLAN_CONTRACT_BINDINGS_V2_0);
    expect(contractCodeOf(() => assertCanonV2ContractBindings(structuredClone(PLAN_CONTRACT_BINDINGS_V2_1)))).toBe('CONTRACT_DRIFT');
  });

  it('keeps the 2.1.0 hashes in a table of their own, distinct from the A1 ones', () => {
    expect(Object.keys(RELEASED_CANON_V2_1_CONTRACT_HASHES).sort()).toEqual(['grounded-reflective-synthesis-lens@2.1.0', 'terminology-wording-lexicon@2.1.0']);
    for (const hash of Object.values(RELEASED_CANON_V2_1_CONTRACT_HASHES)) expect(Object.values(A1_RELEASED_HASHES)).not.toContain(hash);
  });
});

describe('ETBZ-117 AC7 scope gate: no method enters the Canon v2 line', () => {
  it(`adds no method: the line releases exactly the Lens and the Lexicon, and the method registry is byte-identical to main ${ETBZ117_BASE_COMMIT.slice(0, 8)}`, () => {
    expect(CANON_V2_CONTRACT_KEYS).toEqual(['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON']);
    expect([...CANON_V2_CONTRACT_SOURCES, ...CANON_V2_1_CONTRACT_SOURCES].map((source) => source.key)).not.toContain('METHOD_PROFILE');
    expect(contractCodeOf(() => buildCanonV2Contract('METHOD_PROFILE', '2.1.0'))).toBe('UNKNOWN_CONTRACT_IDENTITY');
    expect(RELEASED_REGISTRY_HASHES).toEqual(RELEASED_REGISTRY_HASHES_AT_BASE);
    expect(currentSha256(METHOD_SCOPE_BASELINE_SHA256)).toEqual(METHOD_SCOPE_BASELINE_SHA256);
    expect(currentDirectoryListings()).toEqual(METHOD_SCOPE_DIRECTORIES_AT_BASE);
  });
});

describe('ETBZ-117 AC6: ADR 0019 is closed and ADR 0020 records the forward fix', () => {
  const adr0019 = read('docs/adr/0019-canon-v2-contracts.md');
  const adr0020 = read(ETBZ117_ADR);
  const statusOf = (text: string): string => text.slice(text.indexOf('- **Status:**'), text.indexOf('\n- **Date:**'));

  it('closes ADR 0019: Accepted with its merge, no open reflection-question decision, its A1 facts intact', () => {
    // Every A1 fact: ADR 0019 is the base text plus exactly the declared closeout edits, nothing else.
    const reverted = adr0019WithoutCloseout(adr0019);
    expect(reverted.missing).toBeNull();
    expect(sha256Hex(reverted.text)).toBe(ADR_0019_BASE_SHA256);
    expect(ADR_0019_CLOSEOUT_EDITS.map((edit) => edit.closeout).filter((text) => /Proposed|leaves open whether|Whether the text-level Prüffrage stays/u.test(text))).toEqual([]);
    const status = statusOf(adr0019);
    expect(status.startsWith('- **Status:** Accepted')).toBe(true);
    expect(status).not.toMatch(/Proposed/u);
    expect(status).toContain('9362f4e2');
    expect(adr0019).not.toMatch(/leaves open whether the text-level Prüffrage/u);
    expect(adr0019).not.toMatch(/Whether the text-level Prüffrage stays \(ETBZ-116\)/u);
    expect(adr0019).toContain('sha256:638eef2dcb822ed94f70002947c642fcf112f8d23f58390825a5c5fdd59178ea');
    expect(adr0019).toContain('sha256:f6c40f7a2383690225b684c89cda4bd3d146c97383c59c78531e33b7a05b67d6');
    expect(adr0019).toContain('C1 `85229569` v1');
    expect(adr0019).toContain('C5 `85164034` v1');
    expect(adr0019).toContain('ADR 0020');
  });

  it('records in ADR 0020 the identities, page versions and hashes the code releases', () => {
    // Each identity in its own row, with its page, version, date and hash as the code releases them.
    for (const source of CANON_V2_1_CONTRACT_SOURCES) {
      const name = source.key === 'INTERPRETATION_LENS' ? 'Interpretation Lens' : 'Terminology & Wording Lexicon';
      const page = source.key === 'INTERPRETATION_LENS' ? 'C1' : 'C5';
      const hash = RELEASED_CANON_V2_1_CONTRACT_HASHES[String(source.identity)] ?? '<none>';
      const row = `| ${name} | \`${String(source.identity)}\` | ${page} \`${source.confluencePageId}\` v${source.confluencePageVersion} | ${String(source.releasedOn)} | \`${hash}\` |`;
      // Exactly one table row names the identity, and it is this one: no second, contradicting row.
      expect(adr0020.split('\n').filter((line) => line.startsWith('|') && line.includes(`\`${String(source.identity)}\``))).toEqual([row]);
    }
    expect(adr0020).toContain('C1 `85229569` v2');
    expect(adr0020).toContain('C5 `85164034` v2');
    expect(adr0020).toContain(`\`${CURRENT_CANON_V2_VERSION}\``);
    expect(statusOf(adr0020).startsWith('- **Status:**')).toBe(true);
  });
});

describe('ETBZ-117 Evidenz: the evidence record re-derives byte for byte', () => {
  it(`${ETBZ117_EVIDENCE_PATH} equals the record derived from the code`, () => {
    expect(read(ETBZ117_EVIDENCE_PATH)).toBe(renderJson(deriveEtbz117Evidence()));
  });
});
