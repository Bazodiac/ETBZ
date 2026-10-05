/**
 * ETBZ-117 — writes the machine-derived record of the Canon v2 forward fix,
 * docs/evidence/etbz-117/canon-v2-1/canon-v2-1.json. The contract suite
 * (`tests/contract/etbz117-canon-v2-1.contract.test.ts`) re-derives it byte for
 * byte; this emitter only saves what that suite checks.
 *
 *   npm run etbz117:evidence
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ETBZ117_EVIDENCE_PATH, deriveEtbz117Evidence, renderJson } from './etbz117Evidence.js';

const path = resolve(process.cwd(), ETBZ117_EVIDENCE_PATH);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, renderJson(deriveEtbz117Evidence()));
process.stderr.write(`wrote ${ETBZ117_EVIDENCE_PATH}\n`);
