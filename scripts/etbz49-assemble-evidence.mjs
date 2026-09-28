#!/usr/bin/env node
// =============================================================================
// ETBZ-49 - assemble the tracked visual evidence from proof runs.
//
// The declared proof (`.agent-proofs.json` -> tools/visual-proof-harness/proof/
// run_proof.py) renders the 29 pages, writes `proof-report.json`, the per-page
// structure dumps and the merged deliverables into its --out directory, and
// changes no tracked file. This script is the declared, reproducible step that
// carries such runs INTO the tree:
//
//   node scripts/etbz49-assemble-evidence.mjs <run1> <run2> [run3 ...]
//
//   run1  the run whose artefacts become the tracked evidence, and
//         determinism run 1
//   run2  determinism run 2 - a separate full proof run
//   run3+ further runs on the same source, recorded (not selected) so the
//         PNG-byte stability of the environment is disclosed, not curated
//
// Every run directory is a `--out` of run_proof.py, relative to the repository
// root. What the script writes, and only this:
//
//   docs/evidence/etbz-49/        the 29 PNGs, the contact sheet, both merged PDFs
//   assets/visual-system-v1/structures/*.json
//                                 every dump that differs from the committed one
//   assets/visual-system-v1/render-receipt.json
//                                 values in place - same keys, same order, same
//                                 line count, so the reviewed secret-scanner
//                                 fingerprint on line 373 keeps naming the
//                                 tokens.json hash
//   assets/visual-system-v1/design-system.json
//                                 the customer-page structural hashes that moved
//   assets/visual-system-v1/determinism-report.json
//                                 rebuilt from run1/run2, plus the stability of
//                                 every further run
//
// It does NOT regenerate the TypeScript contract or the integrity index. Run
//   npm run etbz49:contract && node scripts/etbz49-asset-integrity.mjs
// afterwards, then the suites. The script refuses rather than guesses: a run
// that did not pass, a page without a tracked counterpart, a receipt that does
// not round-trip, a hash that occurs twice, or a moved line 373 all stop it.
// =============================================================================

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = resolve(REPO_ROOT, 'assets/visual-system-v1');
const EVIDENCE = resolve(REPO_ROOT, 'docs/evidence/etbz-49');
const RECEIPT_TOKENS_LINE = 373;

const runArgs = process.argv.slice(2);
if (runArgs.length < 2) {
  console.error('usage: node scripts/etbz49-assemble-evidence.mjs <run1> <run2> [run3 ...]');
  process.exit(2);
}

const refuse = (message) => {
  console.error(`refusing: ${message}`);
  process.exit(1);
};
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const runs = runArgs.map((relative) => {
  const dir = resolve(REPO_ROOT, relative);
  const reportPath = resolve(dir, 'proof-report.json');
  if (!existsSync(reportPath)) refuse(`${relative}: no proof-report.json`);
  const report = readJson(reportPath);
  if (report.passed !== true) refuse(`${relative}: the proof did not pass`);
  if (!Array.isArray(report.pages) || report.pages.length !== 29) refuse(`${relative}: expected 29 pages`);
  return { relative, dir, report, byId: Object.fromEntries(report.pages.map((p) => [p.pageId, p])) };
});
const [run1, run2, ...moreRuns] = runs;
const revisions = new Set(runs.map((r) => r.report.sourceRevision));
if (revisions.size !== 1) refuse(`runs come from different source revisions: ${[...revisions].join(', ')}`);

const log = [];

// 1. evidence PNGs, contact sheet, merged PDFs ----------------------------------------
let copied = 0;
for (const page of run1.report.pages) {
  const dst = resolve(EVIDENCE, page.png);
  if (!existsSync(dst)) refuse(`${page.png} is not a tracked evidence file`);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(resolve(run1.dir, page.png), dst);
  copied++;
}
for (const name of ['final-contact-sheet.png', 'customer-sample.pdf', 'developer-proof.pdf']) {
  copyFileSync(resolve(run1.dir, name), resolve(EVIDENCE, name));
  copied++;
}
log.push(`evidence files copied from ${run1.relative}: ${copied}`);

// 2. structures ---------------------------------------------------------------------------
const dumpDir = resolve(run1.dir, 'structures');
if (!existsSync(dumpDir)) refuse(`${run1.relative}/structures is missing - the proof entrypoint writes it`);
const replacedStructures = [];
for (const file of readdirSync(dumpDir).filter((f) => f.endsWith('.json'))) {
  const committed = resolve(ASSETS, 'structures', file);
  if (!existsSync(committed)) refuse(`dumped structure ${file} has no committed counterpart`);
  const dumped = resolve(dumpDir, file);
  if (sha(committed) !== sha(dumped)) {
    copyFileSync(dumped, committed);
    replacedStructures.push(file);
  }
}
log.push(`structures replaced: [${replacedStructures.join(', ')}]`);

// 3. render-receipt.json ------------------------------------------------------------------
const receiptPath = resolve(ASSETS, 'render-receipt.json');
const receiptRaw = readFileSync(receiptPath, 'utf8');
const receipt = JSON.parse(receiptRaw);
if (JSON.stringify(receipt, null, 2) !== receiptRaw) refuse('render-receipt.json does not round-trip byte-identically');
receipt.generatedAt = run1.report.startedAt ?? refuse('proof-report.json carries no startedAt');
const movedHashes = [];
for (const page of receipt.pages) {
  const rendered = run1.byId[page.pageId];
  if (rendered === undefined) refuse(`receipt page ${page.pageId} is not in ${run1.relative}`);
  const pdf = resolve(run1.dir, 'stage', 'out', page.surface, `${page.pageId}.pdf`);
  if (!existsSync(pdf)) refuse(`per-page pdf missing: ${pdf}`);
  if (page.structuralSha256 !== rendered.structuralSha256) movedHashes.push({ pageId: page.pageId, from: page.structuralSha256, to: rendered.structuralSha256 });
  page.structuralSha256 = rendered.structuralSha256;
  page.pngSha256 = `sha256:${rendered.pngSha256}`;
  page.pdfSha256 = `sha256:${sha(pdf)}`;
  page.domFindings = rendered.domFindings.length;
  page.dom = rendered.domFindings;
}
for (const name of ['customer-sample.pdf', 'final-contact-sheet.png', 'developer-proof.pdf']) {
  receipt.artifacts[name] = run1.report.artifacts[name];
}
const receiptOut = JSON.stringify(receipt, null, 2);
const receiptLines = receiptOut.split('\n');
if (receiptLines.length !== receiptRaw.split('\n').length) refuse('render-receipt.json line count changed');
if (!receiptLines[RECEIPT_TOKENS_LINE - 1].includes('"tokens.json"')) refuse(`line ${RECEIPT_TOKENS_LINE} is no longer the tokens.json hash`);
writeFileSync(receiptPath, receiptOut, 'utf8');
log.push(`render-receipt.json: generatedAt=${receipt.generatedAt}; structural hashes moved: [${movedHashes.map((m) => m.pageId).join(', ')}]; line ${RECEIPT_TOKENS_LINE} intact`);

// 4. design-system.json (customer pages carry a structuralSha256 there) -------------------
const designSystemPath = resolve(ASSETS, 'design-system.json');
let designSystem = readFileSync(designSystemPath, 'utf8');
let designSystemReplacements = 0;
for (const moved of movedHashes) {
  const oldHash = moved.from.replace(/^sha256:/, '');
  const newHash = moved.to.replace(/^sha256:/, '');
  const occurrences = designSystem.split(oldHash).length - 1;
  if (occurrences === 0) continue; // developer pages are not part of design-system.json
  if (occurrences !== 1) refuse(`${oldHash} occurs ${occurrences} times in design-system.json`);
  designSystem = designSystem.replace(oldHash, newHash);
  designSystemReplacements++;
  log.push(`design-system.json: ${moved.pageId} ${oldHash.slice(0, 12)} -> ${newHash.slice(0, 12)}`);
}
writeFileSync(designSystemPath, designSystem, 'utf8');
log.push(`design-system.json replacements: ${designSystemReplacements}`);

// 5. determinism-report.json -------------------------------------------------------------
const determinismPath = resolve(ASSETS, 'determinism-report.json');
const determinismRaw = readFileSync(determinismPath, 'utf8');
const determinism = JSON.parse(determinismRaw);
if (JSON.stringify(determinism, null, 2) !== determinismRaw) refuse('determinism-report.json does not round-trip byte-identically');

const compare = (a, b) => {
  let structural = 0, png = 0, pdf = 0;
  const differing = [];
  for (const page of a.report.pages) {
    const other = b.byId[page.pageId];
    if (page.structuralSha256 === other.structuralSha256) structural++;
    if (page.pngSha256 === other.pngSha256) png++;
    else differing.push(page.pageId);
    const pa = resolve(a.dir, 'stage', 'out', page.surface, `${page.pageId}.pdf`);
    const pb = resolve(b.dir, 'stage', 'out', page.surface, `${page.pageId}.pdf`);
    if (existsSync(pa) && existsSync(pb) && sha(pa) === sha(pb)) pdf++;
  }
  return { structural, png, pdf, differing };
};

const pair = compare(run1, run2);
determinism.runs = [run1.report.startedAt, run2.report.startedAt];
determinism.pages = 29;
determinism.structuralSha256Identical = pair.structural;
determinism.pngSha256Identical = pair.png;
determinism.perPagePdfIdentical = pair.pdf;
const merged = determinism.mergedArtifacts;
const setPair = (name, a, b) => {
  if (merged[name] === undefined) merged[name] = {};
  merged[name].run1 = a;
  merged[name].run2 = b;
  merged[name].identical = a === b;
};
for (const name of ['customer-sample.pdf', 'final-contact-sheet.png', 'developer-proof.pdf']) {
  setPair(name, run1.report.artifacts[name], run2.report.artifacts[name]);
}
const manifestFileSha = sha(resolve(ASSETS, 'glyphs/manifest.json'));
const manifestDigest = readJson(resolve(ASSETS, 'glyphs/manifest.json')).manifestSha256.replace(/^sha256:/, '');
setPair('glyphs/manifest.json', manifestFileSha, manifestFileSha);
setPair('glyphs/manifest.json#manifestSha256', manifestDigest, manifestDigest);
const tokensSha = sha(resolve(ASSETS, 'tokens.json'));
setPair('tokens.json', tokensSha, tokensSha);
const wordmarkSha = sha(resolve(ASSETS, 'brand/wordmark.svg'));
setPair('assets/wordmark.svg', wordmarkSha, wordmarkSha);
determinism.domFindingsTotal = run1.report.domFindingsTotal + run2.report.domFindingsTotal;
determinism.pngByteStability = {
  note:
    'Every further passing run of the same source revision and environment, compared with run 1. ' +
    'Structural hashes are what the contract binds to; PNG bytes can differ by anti-aliasing on ' +
    'pages whose rasterisation is not byte-stable, and pages that print PNG hashes (D08) follow.',
  runs: moreRuns.map((run) => {
    const result = compare(run1, run);
    return {
      startedAt: run.report.startedAt,
      structuralSha256Identical: result.structural,
      pngSha256Identical: result.png,
      differingPages: result.differing,
    };
  }),
};
writeFileSync(determinismPath, JSON.stringify(determinism, null, 2), 'utf8');
log.push(
  `determinism-report.json: run1/run2 structural ${pair.structural}/29, png ${pair.png}/29, per-page pdf ${pair.pdf}/29; ` +
    `further runs: ${determinism.pngByteStability.runs.map((r) => `${r.pngSha256Identical}/29`).join(' ') || 'none'}`,
);

for (const line of log) console.log(line);
