/**
 * ETBZ-57 — writes the machine-derived evidence of the voice revision:
 * accepted-reading.json, customer-reading.json, manifest.json and ../evals.json. The contract
 * suite (`tests/contract/etbz57-skill-voice.contract.test.ts`) re-derives all
 * three byte for byte; this emitter only saves what that suite checks.
 *
 *   npm run etbz57:evidence
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ETBZ57_FIXTURE_DIR, deriveEtbz57Evidence, renderJson } from './etbz57Evidence.js';

const evidence = deriveEtbz57Evidence();
const dir = resolve(process.cwd(), ETBZ57_FIXTURE_DIR);
writeFileSync(resolve(dir, 'accepted-reading.json'), renderJson(evidence.accepted));
writeFileSync(resolve(dir, 'customer-reading.json'), renderJson(evidence.customer));
writeFileSync(resolve(dir, '..', 'evals.json'), renderJson(evidence.evals));
writeFileSync(resolve(dir, 'manifest.json'), renderJson(evidence.manifest));
process.stderr.write(`accepted ${evidence.accepted.structuralHash}\n`);
