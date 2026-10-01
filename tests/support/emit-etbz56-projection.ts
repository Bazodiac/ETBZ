/**
 * ETBZ-56 — writes the committed projection evidence of the accepted Skill reading.
 *
 * Like `emit-etbz55-projection.ts`: the chain is reachable only through the test
 * toolchain, so the projection the renderer draws is emitted by this file under
 * `vite-node` (`npm run etbz56:projection`) and required byte-identical by
 * `tests/contract/etbz56-skill-presentation-evidence.contract.test.ts`. Not a
 * test file.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { SKILL_PROJECTION_EVIDENCE, skillPresentationFixture } from './skillPresentationFixture.js';

const out = resolve(process.cwd(), process.argv[2] ?? SKILL_PROJECTION_EVIDENCE);
const { projection } = skillPresentationFixture();
writeFileSync(out, `${canonicalJson(projection)}\n`, 'utf8');
process.stdout.write(`${out}\n${projection.structuralHash}\npages ${String(projection.pageCount)}\n`);
