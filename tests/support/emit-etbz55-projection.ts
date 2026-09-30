/**
 * ETBZ-55 — writes the committed projection evidence.
 *
 * The fixture chain is reachable only through the test toolchain, so the
 * projection the renderer draws is emitted by this file under `vite-node`
 * (`npm run etbz55:projection`) and required byte-identical by
 * `tests/contract/etbz55-presentation-evidence.contract.test.ts`. Not a test
 * file. `vite-node` is not a declared dependency: it resolves transitively
 * through vitest 3.2.x (see CLAUDE.md).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { PRESENTATION_PROJECTION_EVIDENCE, presentationFixture } from './presentationFixture.js';

const out = resolve(process.cwd(), process.argv[2] ?? PRESENTATION_PROJECTION_EVIDENCE);
const { projection } = presentationFixture();
writeFileSync(out, `${canonicalJson(projection)}\n`, 'utf8');
process.stdout.write(`${out}\n${projection.structuralHash}\npages ${String(projection.pageCount)}\n`);
