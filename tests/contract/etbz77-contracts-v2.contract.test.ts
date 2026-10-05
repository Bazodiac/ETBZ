/**
 * ETBZ-77 (Canon v2, A1) — the 2.0 contract line beside the unchanged 1.x line.
 *
 * Four contracts with the rest of the repository:
 *   1. the 2.0 context binds the Lens v2 and the Lexicon v2 at their 2.0.0
 *      identities and never a 1.x one (the killer of the "v2 ref -> 1.1 ref"
 *      mutants in scripts/verify-etbz77-contracts-v2.mjs);
 *   2. every 1.x contract value module and both 1.x Skill packages are
 *      byte-identical to main@cb7605e5 - the in-place edit a new version must
 *      never be;
 *   3. 1.0.0 and 1.1.0 stay resolvable as historical run identities under
 *      their own bundles: the two released bundle hashes and the two 1.x
 *      plan-binding pairs stay at their values at the base (this holds the
 *      shared machinery the byte baseline does not pin);
 *   4. the evidence record under docs/evidence/etbz-77/contracts-v2/ re-derives
 *      byte for byte.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BAZI_METHOD_REGISTRY_V1 } from '../../src/application/interpretation/method-registry.js';
import {
  CANON_V2_CONTRACT_SOURCES,
  CONTRACT_SOURCES_V1_1,
  PLAN_CONTRACT_BINDINGS_V2_0,
  RELEASED_BUNDLE_HASHES,
  RELEASED_CANON_V2_CONTRACT_HASHES,
  RELEASED_CONTRACT_SOURCES,
  SEMANTIC_ENVELOPE,
  SEMANTIC_ENVELOPE_V1_1,
  SEMANTIC_ENVELOPE_V2,
  WORDING_BOUNDARIES,
  WORDING_BOUNDARIES_V1_1,
  WORDING_BOUNDARIES_V2,
  assertCanonV2ContractSet,
  assertRunEvidenceBound,
  buildSkillContractBundle,
  contractBindingRef,
  resolveContract,
} from '../../src/application/skill/index.js';
import { PLAN_CONTRACT_BINDINGS_V1_0, PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import {
  ETBZ77_BASE_COMMIT,
  ETBZ77_EVIDENCE_PATH,
  V1_BASELINE_SHA256,
  currentV1Sha256,
  deriveEtbz77Evidence,
  renderJson,
} from '../support/etbz77Evidence.js';

const REPO_ROOT = process.cwd();
const V1_REFS = [...RELEASED_CONTRACT_SOURCES, ...CONTRACT_SOURCES_V1_1].map((source) => contractBindingRef(source));

function attempt<T>(action: () => T): { value: T | undefined; error: string | undefined } {
  try {
    return { value: action(), error: undefined };
  } catch (error) {
    return { value: undefined, error: error instanceof Error ? error.message : String(error) };
  }
}

describe('ETBZ-77 AC2 and DoD mutant (v2 ref -> 1.1 ref): the 2.0 context binds the Lens v2 and the Lexicon v2', () => {
  it('binds the Lens v2 and the Lexicon v2 at their 2.0.0 identities in the 2.0 context, never a 1.x one', () => {
    const set = attempt(() => assertCanonV2ContractSet());
    expect(set.error).toBeUndefined();
    expect(PLAN_CONTRACT_BINDINGS_V2_0).toEqual({
      terminologyLexicon: { contractRef: 'terminology-wording-lexicon@2.0.0', confluencePageId: '85164034', confluencePageVersion: '1' },
      interpretationLens: { contractRef: 'grounded-reflective-synthesis-lens@2.0.0', confluencePageId: '85229569', confluencePageVersion: '1' },
    });
    expect(CANON_V2_CONTRACT_SOURCES.map((source) => source.identity)).toEqual([
      'grounded-reflective-synthesis-lens@2.0.0',
      'terminology-wording-lexicon@2.0.0',
    ]);
    for (const binding of [PLAN_CONTRACT_BINDINGS_V2_0.interpretationLens, PLAN_CONTRACT_BINDINGS_V2_0.terminologyLexicon]) {
      expect(V1_REFS).not.toContain(binding.contractRef);
      expect([PLAN_CONTRACT_BINDINGS_V1_0, PLAN_CONTRACT_BINDINGS_V1_1].flatMap((pair) => [pair.interpretationLens.confluencePageId, pair.terminologyLexicon.confluencePageId])).not.toContain(binding.confluencePageId);
    }
    expect(set.value?.planBindings).toBe(PLAN_CONTRACT_BINDINGS_V2_0);
  });
});

describe('ETBZ-77 AC1: version beside version - nothing of 1.x moved', () => {
  it(`leaves every 1.x contract value module and both 1.x Skill packages byte-identical to main ${ETBZ77_BASE_COMMIT.slice(0, 8)}`, () => {
    expect(Object.keys(V1_BASELINE_SHA256)).toHaveLength(19);
    expect(currentV1Sha256()).toEqual(V1_BASELINE_SHA256);
  });

  it('keeps 1.0.0 and 1.1.0 resolvable as historical run identities, at their released bundle hashes', () => {
    const v1_0 = buildSkillContractBundle(BAZI_METHOD_REGISTRY_V1, '1.0.0');
    const v1_1 = buildSkillContractBundle(BAZI_METHOD_REGISTRY_V1, '1.1.0');
    // The released 1.x hashes as main@cb7605e5 froze them: a later bundle version (ETBZ-81) may join the table, these two never move.
    expect(RELEASED_BUNDLE_HASHES['1.0.0']).toBe('sha256:1c8f80c38b57748e65035a6bd2d671604fb19574cdf3355326352fbe0e19564e');
    expect(RELEASED_BUNDLE_HASHES['1.1.0']).toBe('sha256:9e6762f3cf339f3e03e56d52770629bd30eebe79ab6b7a70cbcc9dbb9ea599c2');
    expect(PLAN_CONTRACT_BINDINGS_V1_0).toEqual({
      terminologyLexicon: { contractRef: 'terminology-wording-lexicon@1.0.0', confluencePageId: '67600385', confluencePageVersion: '1' },
      interpretationLens: { contractRef: 'grounded-reflective-synthesis-lens@1.0.0', confluencePageId: '67371029', confluencePageVersion: '1' },
    });
    expect(PLAN_CONTRACT_BINDINGS_V1_1).toEqual({
      terminologyLexicon: { contractRef: 'terminology-wording-lexicon@1.1.0', confluencePageId: '77529091', confluencePageVersion: '4' },
      interpretationLens: { contractRef: 'grounded-reflective-synthesis-lens@1.1.0', confluencePageId: '77561858', confluencePageVersion: '6' },
    });
    expect(v1_0.structuralHash).toBe(RELEASED_BUNDLE_HASHES['1.0.0']);
    expect(v1_1.structuralHash).toBe(RELEASED_BUNDLE_HASHES['1.1.0']);
    for (const [bundle, pair] of [[v1_0, PLAN_CONTRACT_BINDINGS_V1_0], [v1_1, PLAN_CONTRACT_BINDINGS_V1_1]] as const) {
      for (const binding of [pair.interpretationLens, pair.terminologyLexicon]) {
        expect(contractBindingRef(resolveContract(bundle, binding.contractRef))).toBe(binding.contractRef);
      }
      const evidence = { bundleRef: bundle.bundleRef, contracts: bundle.contracts.map((source) => ({ contractRef: contractBindingRef(source), confluencePageId: source.confluencePageId, confluencePageVersion: source.confluencePageVersion })) };
      expect(attempt(() => assertRunEvidenceBound(bundle, evidence)).error).toBeUndefined();
    }
  });
});

describe('ETBZ-77 AC3: ADR 0019 records the drop inventory and the frozen identities', () => {
  const adr = readFileSync(resolve(REPO_ROOT, 'docs/adr/0019-canon-v2-contracts.md'), 'utf8');

  it('lists every top-level block of the 1.x envelopes and wording boundaries in its drop inventory, each once, and nothing else', () => {
    const start = adr.indexOf('Where the 1.x blocks went');
    const end = adr.indexOf('### 3.', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const listed = [...adr.slice(start, end).matchAll(/`(Lens|Lexicon)\.([A-Za-z0-9]+)`/gu)].map((match) => `${match[1] ?? ''}.${match[2] ?? ''}`);
    const blocks = (prefix: string, ...values: object[]): string[] =>
      [...new Set(values.flatMap((value) => Object.keys(value)).filter((name) => !name.endsWith('Source')))].map((name) => `${prefix}.${name}`);
    const expected = [...blocks('Lens', SEMANTIC_ENVELOPE, SEMANTIC_ENVELOPE_V1_1), ...blocks('Lexicon', WORDING_BOUNDARIES, WORDING_BOUNDARIES_V1_1)].sort();
    expect(expected).toHaveLength(39);
    expect([...listed].sort()).toEqual(expected);
  });

  it('carries no 1.x value into 2.0.0: no 1.x string longer than 20 characters occurs inside any v2 value', () => {
    const leaves = (value: unknown, found: string[] = []): string[] => {
      if (typeof value === 'string') found.push(value);
      else if (Array.isArray(value)) for (const entry of value) leaves(entry, found);
      else if (value !== null && typeof value === 'object') for (const entry of Object.values(value)) leaves(entry, found);
      return found;
    };
    const v1 = [...new Set(leaves([SEMANTIC_ENVELOPE, SEMANTIC_ENVELOPE_V1_1, WORDING_BOUNDARIES, WORDING_BOUNDARIES_V1_1]))].filter((text) => text.length > 20);
    const v2 = leaves([SEMANTIC_ENVELOPE_V2, WORDING_BOUNDARIES_V2]);
    expect(v1.length).toBeGreaterThan(300);
    expect(v1.filter((text) => v2.some((value) => value.includes(text)))).toEqual([]);
  });

  it('quotes the frozen v2 contract hashes the code releases', () => {
    for (const hash of Object.values(RELEASED_CANON_V2_CONTRACT_HASHES)) expect(adr).toContain(hash);
  });
});

describe('ETBZ-77 Evidenz: the evidence record re-derives byte for byte', () => {
  it(`${ETBZ77_EVIDENCE_PATH} equals the record derived from the code`, () => {
    expect(readFileSync(resolve(REPO_ROOT, ETBZ77_EVIDENCE_PATH), 'utf8')).toBe(renderJson(deriveEtbz77Evidence()));
  });
});
