/**
 * ETBZ-53 — the committed Golden freeze record states what the freeze measured, and nothing of the case.
 *
 * The record's sources (the Product Owner's input, the response bodies, the InterpretationInput, the HMAC key) stay
 * in the local archive outside every repository by decision (Jira ETBZ-53 comments 17026, 17029), so CI cannot
 * re-derive it: the re-derivation is `npm run etbz53:freeze -- verify` on the machine that holds the archive
 * (recorded in docs/evidence/etbz-53/README.md). What CI checks: the runtime is the one ETBZ-58 attested, every gate
 * of the freeze passed, the live stage ran on a head of this history, every digest is keyed (a plain digest of a
 * body determined by the chart and a coarse timestamp could be searched back to the birth data), and the record
 * carries no birth data, coordinate, time of day, chart symbol, length or count.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRecordedRun } from '../support/etbz58Rehearsal.js';
import { BIRTH_INPUT_FIELDS, ETBZ53_RECORD, GOLDEN_CASE_REF } from '../support/etbz53GoldenFreeze.js';

const text = readFileSync(resolve(process.cwd(), ETBZ53_RECORD), 'utf8');
const record = JSON.parse(text) as {
  recordVersion: string;
  caseRef: string;
  frozenAt: string;
  liveStageRepositoryHead: string;
  birthInput: { ref: string; validated: boolean; birthTimeKnown: boolean; fields: string[] };
  runtime: {
    runtimeImage: string;
    attestation: { status: string; sourceRevisionExpected: string; documentSha256Expected: string };
    probes: { health: number; ready: number; withoutCredentials: number };
    exchanges: { label: string; status: number }[];
  };
  interpretationInput: { productionEligible: boolean; blockers: string[] };
  oracle: { tool: string; categories: string[]; allFactsEqual: boolean; coverage: string };
  digests: { algorithm: string; keyFingerprint: string; files: Record<string, string> };
  archive: { location: string; note: string };
};
const KEYED = /^hmac-sha256:[0-9a-f]{64}$/u;

describe('ETBZ-53: the Golden freeze record', () => {
  it('is the only file of the evidence folder besides its README', () => {
    expect(readdirSync(resolve(process.cwd(), 'docs/evidence/etbz-53')).sort()).toEqual(['README.md', 'freeze-record.json']);
  });

  it('freezes GOLDEN-KT-01 as a validated known-time input with only the BirthInput fields', () => {
    expect(record.recordVersion).toBe('etbz53-golden-freeze-record.v2');
    expect(record.caseRef).toBe(GOLDEN_CASE_REF);
    expect(record.birthInput).toEqual({ ref: GOLDEN_CASE_REF, validated: true, birthTimeKnown: true, fields: [...BIRTH_INPUT_FIELDS] });
  });

  it('read from the runtime ETBZ-58 attested: same revision and OpenAPI document, ready, credentials enforced', () => {
    const { readback } = loadRecordedRun();
    expect(record.runtime.attestation).toEqual({
      status: 'PASS',
      sourceRevisionExpected: readback.attestation.expectation.sourceRevision,
      documentSha256Expected: readback.attestation.expectation.openapiSha256,
    });
    expect(record.runtime.runtimeImage).toBe(readback.runtime.runtimeImage);
    expect(record.runtime.probes).toEqual({ health: 200, ready: 200, withoutCredentials: 401 });
    expect(record.runtime.exchanges).toEqual([{ label: 'bazi', status: 200 }, { label: 'wuxing', status: 200 }, { label: 'natal', status: 200 }]);
  });

  it('reached a production-eligible InterpretationInput, and the independent oracle agreed on every fact', () => {
    expect(record.interpretationInput).toEqual({ productionEligible: true, blockers: [] });
    expect(record.oracle.tool).toBe('lunar-python==1.4.8 (6tail), sect 2');
    expect(record.oracle.allFactsEqual).toBe(true);
    expect(record.oracle.categories).toEqual(['Element', 'Hanzi', 'Pinyin', 'Polarity', 'dayMaster', 'hiddenStem', 'monthCommand', 'pillar', 'tenGod', 'tier', 'wuxing']);
  });

  it('keys every digest with a key that stays in the archive, and names the key only by a keyed fingerprint', () => {
    expect(record.digests.algorithm.startsWith('HMAC-SHA256')).toBe(true);
    expect(record.digests.keyFingerprint).toMatch(KEYED);
    expect(Object.keys(record.digests.files).sort()).toEqual([
      'bazi.response.json',
      'interpretation-input.json',
      'interpretationInput.structuralHash',
      'natal.response.json',
      'runtime-readback.json',
      'wuxing.response.json',
    ]);
    for (const [name, digest] of Object.entries(record.digests.files)) expect(digest, name).toMatch(KEYED);
    // No plain digest anywhere; the one plain hex value is the public OpenAPI digest the attestation pinned.
    expect(text).not.toMatch(/(?<!hmac-)sha256:[0-9a-f]{64}/u);
    expect([...text.matchAll(/(?<![0-9a-f:])[0-9a-f]{64}(?![0-9a-f])/gu)].map((match) => match[0])).toEqual([record.runtime.attestation.documentSha256Expected]);
    expect(record.archive.location.startsWith('/Users/Shared/ETBZ-golden/')).toBe(true);
  });

  it('ran its live stage on a head of this history', () => {
    expect(() => execFileSync('git', ['merge-base', '--is-ancestor', record.liveStageRepositoryHead, 'HEAD'])).not.toThrow();
  });

  it('carries no date but its own, no time of day, no coordinate, no chart symbol, no length and no count', () => {
    expect([...text.matchAll(/\d{4}-\d{2}-\d{2}/gu)].map((match) => match[0])).toEqual([record.frozenAt]);
    expect(text).not.toMatch(/"\d{1,2}:\d{2}"/u);
    // The oracle's version (1.4.8) is the one decimal the record carries by design.
    expect(text.replace(record.oracle.tool, '')).not.toMatch(/-?\d{1,3}\.\d+/u);
    expect(text).not.toMatch(/[\u4e00-\u9fff]/u);
    expect(text).not.toMatch(/byteLength|"compared"|"equal"/u);
    // `label` and `location` are keys of the record itself (exchange label, archive location); the location's values
    // are left to the coordinate pattern above and to the freeze's value guard.
    for (const field of ['birthDate', 'birthTime', 'lat', 'lon', 'timezone', 'displayName']) expect(text).not.toContain(`"${field}":`);
  });
});
