/**
 * ETBZ-59 — the committed evidence of the Anti-Boilerplate fixture rehearsal (contract 77266967 v3, section 8).
 *
 * The variants were computed live by FuFirE through the ETBZ-58 live stage (`npm run etbz59:variants`); the suite
 * replays the recorded bytes offline and checks what the run claims: the attested runtime of ETBZ-58, readiness, the
 * call without credentials refused, and that each variant differs from Musterkundin A exactly as defined.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import type { HoroscopeModel, PillarName } from '../../src/application/horoscope-model.js';
import { loadRecordedRun } from '../support/etbz58Rehearsal.js';
import { VARIANT_BIRTH_INPUTS, VARIANT_DEFINITIONS, VARIANT_LABELS, loadVariantRun, sourceChart, variantChart, variantReadbackFile } from '../support/etbz59Variants.js';

const read = (path: string): Buffer => readFileSync(resolve(process.cwd(), path));
const sha256Of = (bytes: Uint8Array | string): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const PILLARS: readonly PillarName[] = ['year', 'month', 'day', 'hour'];
const pillarOf = (model: HoroscopeModel, name: PillarName): string => `${model.pillars[name].stem}-${model.pillars[name].branch}`;

describe('ETBZ-59: the synthetic variants, computed by the attested runtime', () => {
  const { readback: source } = loadRecordedRun();

  it.each(VARIANT_LABELS)('%s: attested as in ETBZ-58, ready, credentials enforced, the case it names', (label) => {
    const { readback } = loadVariantRun(label);
    expect(readback.attestation.status).toBe('PASS');
    expect(readback.attestation.expectation).toEqual(source.attestation.expectation);
    expect(readback.runtime).toEqual(source.runtime);
    expect([readback.probes.health.status, readback.probes.ready.status]).toEqual([200, 200]);
    expect(readback.probes.unauthorised.refused).toBe(true);
    expect(readback.exchanges.map((exchange) => [exchange.label, exchange.status])).toEqual([['bazi', 200], ['wuxing', 200], ['natal', 200]]);
    expect(readback.birthInput).toEqual({ ref: VARIANT_DEFINITIONS[label].ref, canonicalSha256: sha256Of(canonicalJson(VARIANT_BIRTH_INPUTS[label])) });
    expect(() => execFileSync('git', ['merge-base', '--is-ancestor', readback.repositoryHead, 'HEAD'])).not.toThrow();
  });

  it('N differs from Musterkundin A in the hour pillar and nothing else of the pillars', async () => {
    const [s, n] = [await sourceChart(), await variantChart('near')];
    expect(PILLARS.filter((name) => pillarOf(s.model, name) !== pillarOf(n.model, name))).toEqual(['hour']);
    expect(n.input.productionEligibility.eligible).toBe(true);
    expect(n.model.displayName).toBe('Variante N (synthetisch)');
  });

  it('D shares no stem and no branch with Musterkundin A but the hour branch (same clock time)', async () => {
    const [s, d] = [await sourceChart(), await variantChart('distant')];
    const shared = PILLARS.flatMap((name) => [
      ...(s.model.pillars[name].stem === d.model.pillars[name].stem ? [`${name}.stem`] : []),
      ...(s.model.pillars[name].branch === d.model.pillars[name].branch ? [`${name}.branch`] : []),
    ]);
    expect(shared).toEqual(['hour.branch']);
    expect(d.model.dayMaster.stem).not.toBe(s.model.dayMaster.stem);
    expect(d.input.productionEligibility.eligible).toBe(true);
    expect(d.model.displayName).toBe('Variante D (synthetisch)');
  });
});

describe('ETBZ-59: the secret-scanner exemptions (.gitleaksignore bar C)', () => {
  // Exempted from gitleaks' generic-api-key rule by a whole-line fingerprint (one-line JSON). Safe only while these
  // bytes are exactly these, and the only credential-shaped pair is the public OpenAPI digest the attestation pinned.
  const PINNED: Readonly<Record<string, string>> = {
    [variantReadbackFile('near')]: 'sha256:092a6e41f9d35399e18edf966b0be4e3abd616e669c87984dc0794895a56a1af',
    [variantReadbackFile('distant')]: 'sha256:5c56659fa14a5036203d199ce4b0948361ad31c98f6056ad1577cec1da4c917a',
  };

  it('pins the exempted files byte for byte and names them in .gitleaksignore', () => {
    const ignore = read('.gitleaksignore').toString('utf8').split('\n');
    for (const [path, digest] of Object.entries(PINNED)) {
      expect(sha256Of(read(path)), path).toBe(digest);
      expect(ignore, path).toContain(`${path}:generic-api-key:1`);
    }
  });

  it('holds no credential-shaped pair in them but the attested OpenAPI digest', () => {
    const attested = loadRecordedRun().readback.attestation.expectation.openapiSha256;
    expect(attested).toMatch(/^[0-9a-f]{64}$/u);
    for (const path of Object.keys(PINNED)) {
      const text = read(path).toString('utf8');
      const pairs = [...text.matchAll(/"([^"]*(?:api|key|token|secret|passw|auth|credential)[^"]*)":"([^"]{10,})"/giu)].map((match) => [match[1], match[2]]);
      expect(pairs.length, path).toBeGreaterThan(0);
      for (const [key, value] of pairs) expect([key, value], path).toEqual(['openapiSha256', attested]);
    }
  });
});
