/**
 * ETBZ-68 — writes the committed design-review evidence inputs.
 *
 * Like `emit-etbz55-projection.ts`: the fixture chain is reachable only through
 * the test toolchain, so the composed content, the projection the renderer
 * draws and the page behaviour map are emitted by this file under `vite-node`
 * (`npm run etbz68:projection`) and required byte-identical by
 * `tests/contract/etbz68-design-review-evidence.contract.test.ts`. Not a test
 * file. An optional first argument redirects all three files into that
 * directory (used to measure a corpus change before committing it).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import {
  DESIGN_REVIEW_BEHAVIOUR_MAP,
  DESIGN_REVIEW_CONTENT,
  DESIGN_REVIEW_PROJECTION_EVIDENCE,
  designReviewFixture,
  pageBehaviourMap,
} from './designReviewFixture.js';

const outDir = process.argv[2];
const target = (path: string): string => (outDir === undefined ? resolve(process.cwd(), path) : resolve(outDir, basename(path)));
if (outDir !== undefined) mkdirSync(outDir, { recursive: true });

const { content, projection } = designReviewFixture();
const map = pageBehaviourMap(projection, content);
writeFileSync(target(DESIGN_REVIEW_CONTENT), `${canonicalJson(content)}\n`, 'utf8');
writeFileSync(target(DESIGN_REVIEW_PROJECTION_EVIDENCE), `${canonicalJson(projection)}\n`, 'utf8');
writeFileSync(target(DESIGN_REVIEW_BEHAVIOUR_MAP), `${canonicalJson(map)}\n`, 'utf8');

const chapters = new Map<number, number>();
for (const page of map) if (page.chapter !== null) chapters.set(page.chapter, (chapters.get(page.chapter) ?? 0) + 1);
process.stdout.write(
  `${target(DESIGN_REVIEW_PROJECTION_EVIDENCE)}\n${projection.structuralHash}\npages ${String(projection.pageCount)}\n` +
    `chapter pages ${[...chapters.values()].join(',')}\n`,
);
