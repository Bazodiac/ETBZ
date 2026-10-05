/**
 * ETBZ-77 — writes the machine-derived record of the Canon v2 contract release,
 * docs/evidence/etbz-77/contracts-v2/contracts-v2.json. The contract suite
 * (`tests/contract/etbz77-contracts-v2.contract.test.ts`) re-derives it byte for
 * byte; this emitter only saves what that suite checks.
 *
 *   npm run etbz77:evidence
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ETBZ77_EVIDENCE_PATH, deriveEtbz77Evidence, renderJson } from './etbz77Evidence.js';

const path = resolve(process.cwd(), ETBZ77_EVIDENCE_PATH);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, renderJson(deriveEtbz77Evidence()));
process.stderr.write(`wrote ${ETBZ77_EVIDENCE_PATH}\n`);
