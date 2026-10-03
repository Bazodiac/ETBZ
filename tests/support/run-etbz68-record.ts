/**
 * ETBZ-68 — writes the run record and the visual review checklist.
 *
 * `npm run etbz68:record -- <render-a> <render-b>` takes two output folders of
 * `tools/pdf-renderer/render_pdf.py`, rendered by separate processes from the
 * committed projection, and:
 * - compares them file by file, every page image included;
 * - re-runs the network-denial controls of the sandbox profile the renders ran
 *   under (outside it a request succeeds; inside it Node DNS, Python DNS and a
 *   direct IP connect from Python all fail);
 * - writes `run-record.json` and `visual-review-checklist.md` next to the
 *   committed evidence, from the manifest and the page behaviour map.
 * It copies nothing: publishing render A into the evidence folder is the
 * README's documented step. Not a test file.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DESIGN_REVIEW_BEHAVIOUR_MAP, DESIGN_REVIEW_CORPUS, DESIGN_REVIEW_CONTENT } from './designReviewFixture.js';
import type { PageBehaviour } from './designReviewFixture.js';

const EVIDENCE = 'docs/evidence/etbz-68';
const BASE = 'cb7605e58bee57cfff68c2a3b0a6a889ca1634c6';
const SANDBOX_PROFILE = '(version 1)(allow default)(deny network*)';
const PYTHON = '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3';

const [renderA, renderB] = process.argv.slice(2);
if (renderA === undefined || renderB === undefined) throw new Error('usage: run-etbz68-record.ts <render-a> <render-b>');

const sha = (path: string): string => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

interface Manifest {
  sha256: string;
  byteLength: number;
  pageCount: number;
  contactSheetSha256: string;
  input: { chartModelStructuralHash: string; contentStructuralHash: string };
  presentation: { projectionVersion: string; structuralHash: string };
  template: { ref: string; structuralHash: string };
  renderer: { ref: string; sourceSha256: string; engine: Record<string, unknown> };
  generation: { executedAt: string; repositoryHead: string };
}

// The PO's state is checked before anything is written: a checklist that carries a verdict or any PO
// note is the PO's, and a refused run must leave every evidence file as it was.
const checklistPath = resolve(EVIDENCE, 'visual-review-checklist.md');
const existing = (() => {
  try {
    return readFileSync(checklistPath, 'utf8');
  } catch {
    return null;
  }
})();
if (existing !== null) {
  const notes = existing.split('\n').filter((line) => /^\| \d+ \|/u.test(line) && !/\| \|$/u.test(line.trimEnd()));
  if (!/^Verdict: _pending_$/mu.test(existing) || notes.length > 0) {
    throw new Error('the checklist carries a PO verdict or PO notes; refusing to overwrite any evidence');
  }
}

const manifest = read<Manifest>(resolve(renderA, 'artifact-manifest.json'));
const etbz55 = read<Manifest>(resolve('docs/evidence/etbz-55/artifact-manifest.json'));
const pages = readdirSync(resolve(renderA, 'pages')).sort();
const same = (file: string): boolean => sha(resolve(renderA, file)) === sha(resolve(renderB, file));

function probe(command: string, args: readonly string[], sandboxed: boolean): { exit: number | null; output: string } {
  const run = sandboxed ? spawnSync('sandbox-exec', ['-p', SANDBOX_PROFILE, command, ...args], { encoding: 'utf8' }) : spawnSync(command, args, { encoding: 'utf8' });
  return { exit: run.status, output: `${run.stdout}${run.stderr}`.trim().split('\n').pop() ?? '' };
}
const NODE_DNS = ['-e', 'fetch("https://example.com").then(r=>console.log("status "+r.status)).catch(e=>{console.log("error "+(e.cause?.code??e.message));process.exit(3)})'];
const PY_DNS = ['-c', 'import urllib.request\ntry:\n print("status", urllib.request.urlopen("https://example.com", timeout=10).status)\nexcept Exception as e:\n print("error", type(e).__name__); raise SystemExit(3)'];
// An IP literal skips DNS: this is the socket-level denial (the address need not answer; EPERM comes first).
const PY_IP = ['-c', 'import socket\ns=socket.socket()\ns.settimeout(5)\ntry:\n s.connect(("1.1.1.1", 443)); print("connected")\nexcept Exception as e:\n print("error", type(e).__name__, getattr(e, "errno", None)); raise SystemExit(3)'];
const controls = {
  outside: { nodeDns: probe('node', NODE_DNS, false), pythonDns: probe(PYTHON, PY_DNS, false), pythonIp: probe(PYTHON, PY_IP, false) },
  inside: { nodeDns: probe('node', NODE_DNS, true), pythonDns: probe(PYTHON, PY_DNS, true), pythonIp: probe(PYTHON, PY_IP, true) },
};
// Both directions are required: outside, each probe must succeed (or the inside failures could just mean an
// offline machine); inside, each must fail with the probe's own denial exit (3) and a denial message - not with
// a missing binary (127/71) or a spawn error (null).
const DENIED = /^error (?:ENOTFOUND|EAI_AGAIN|URLError|PermissionError 1)$/u;
const SUCCEEDED = /^(?:status 200|connected)$/u;
for (const [name, result] of Object.entries(controls.outside)) {
  if (result.exit !== 0 || !SUCCEEDED.test(result.output)) throw new Error(`network control ${name} failed outside the sandbox profile (machine offline?): ${String(result.exit)} ${result.output}`);
}
for (const [name, result] of Object.entries(controls.inside)) {
  if (result.exit !== 3 || !DENIED.test(result.output)) {
    throw new Error(`network control ${name} was not denied by the sandbox profile: ${String(result.exit)} ${result.output}`);
  }
}

const record = {
  recordVersion: 'etbz68-design-review-run-record.v2',
  slice: 'ETBZ-68',
  nature: 'SYNTHETIC_DESIGN_REVIEW_FIXTURE',
  notACustomerArtifact: true,
  statement:
    'Synthetic design-review document for the Product Owner visual acceptance. Not a customer artifact, not a reading, not Golden. Chart: the synthetic known-time development chart (Musterkundin A, no real birth data). Body text: neutral placeholder corpus.',
  base: BASE,
  repositoryHead: manifest.generation.repositoryHead,
  executedAt: manifest.generation.executedAt,
  fixture: {
    corpusFile: DESIGN_REVIEW_CORPUS,
    corpusFileSha256: sha(DESIGN_REVIEW_CORPUS),
    composedContentFile: DESIGN_REVIEW_CONTENT,
    contentStructuralHash: manifest.input.contentStructuralHash,
    chartModelStructuralHash: manifest.input.chartModelStructuralHash,
    chartEqualsEtbz55Chart: manifest.input.chartModelStructuralHash === etbz55.input.chartModelStructuralHash,
    projectionStructuralHash: manifest.presentation.structuralHash,
  },
  identities: {
    template: manifest.template.ref,
    templateStructuralHash: manifest.template.structuralHash,
    renderer: manifest.renderer.ref,
    rendererSourceSha256: manifest.renderer.sourceSha256,
    rendererEqualsEtbz55: manifest.renderer.sourceSha256 === etbz55.renderer.sourceSha256,
    projectionVersion: manifest.presentation.projectionVersion,
    engine: manifest.renderer.engine,
  },
  output: {
    pdfFile: `${EVIDENCE}/synthetic-design-review.pdf`,
    pdfSha256: manifest.sha256,
    byteLength: manifest.byteLength,
    pageCount: manifest.pageCount,
    contactSheetSha256: manifest.contactSheetSha256,
    pageImages: pages.length,
  },
  determinism: {
    method: 'two separate render_pdf.py processes, same projection, same --executed-at and --repository-head; each also passed its own in-process DETERMINISM check',
    pdfIdentical: same('bazodiac-reading.pdf'),
    contactSheetIdentical: same('contact-sheet.png'),
    qaReportIdentical: same('qa-report.json'),
    manifestIdentical: same('artifact-manifest.json'),
    pageImagesIdentical: pages.filter((page) => same(`pages/${page}`)).length,
    pageImagesCompared: pages.length,
  },
  networkDenied: {
    tool: 'macOS sandbox-exec',
    profile: SANDBOX_PROFILE,
    scope: 'both render processes (python3 with its Playwright and Chromium children) and the emitter ran under the profile; sandbox-exec applies it to the whole process tree',
    controls,
  },
  notRendered: [
    { component: 'ChapterDivider', reason: 'no such component in the template contract, src/ or tools/ (ADR 0012 limitation 1; ETBZ-43 AC 2/5/10 open, comment 17069)' },
    { component: 'ChartMotifSummary', reason: 'no such component and no motif input in the projection (ADR 0012 limitation 1; ETBZ-43)' },
    { component: 'KeyInsightPanel', reason: 'drawn by pages.py, but the released content schema is paragraphs only (projection.ts contentSchema); PO decision 2026-10-03: scope A, no production change' },
    { component: 'pull quote', reason: 'drawn by pages.py, but the released content schema is paragraphs only; PO decision 2026-10-03: scope A, no production change' },
  ],
};
writeFileSync(resolve(EVIDENCE, 'run-record.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');

// --- the checklist -------------------------------------------------------------

const map = read<readonly PageBehaviour[]>(DESIGN_REVIEW_BEHAVIOUR_MAP);
// Pages whose printed strings carry a number with a decimal point (released projection: values as delivered).
const projectionPages = read<{ pages: { pageNumber: number; strings: unknown }[] }>(resolve(EVIDENCE, 'presentation-projection.json')).pages;
const decimalPages = new Set(projectionPages.filter((page) => /\d\.\d/u.test(JSON.stringify(page.strings))).map((page) => page.pageNumber));
const decimalNote = 'Inherited: Wu Xing values print with a decimal point (1.8, 2.5)';
// The template, not the projection, joins these strings with "·", so the wrap is observed on the render, not derived.
const SEPARATOR_NOTE = 'Inherited: a "·" separator can end a wrapped line (observed on this render)';
const separatorKinds = new Set(['glance', 'summary']);
const FIXED: Readonly<Record<string, string>> = {
  cover: 'Cover: wordmark, Day Master glyph, title, prepared-for name',
  identity: 'Identity / document note ("Über dieses Dokument"). Inherited: the page number in "Siehe Methodenhinweis, Seite 30" wraps onto its own line',
  contents: 'Contents: front matter, chart pages, the seven chapters with their start pages, closing pages',
  glance: 'Chart at a Glance: Day Master, four pillars, Wu Xing values as delivered',
  fourPillars: 'Four Pillars: stems and branches with pinyin and animal label, hidden stems, fact-bound phase colours',
  foundation: 'Foundation ("Die acht Zeichen"): the eight characters with pinyin, animal and phase',
  dayMaster: 'Day Master: glyph, day pillar, hidden stems of the day branch. Inherited: two slots without approved content stay empty (ADR 0012 limitation 2)',
  wuXing: 'Wu Xing Distribution: all five phases with values as delivered',
  fivePhases: 'Five Phases Education (general, separate from the chart distribution)',
  tenGods: 'Ten Gods: relation table to the Day Master',
  hiddenStems: 'Hidden Stems per branch with Qi roles (fixture order at the hour branch, ETBZ-58 comment 17024)',
  reflection: 'Reflection ("Fragen zur Reflexion"): pillar strip and four reflection questions',
  summary: 'Summary ("Dein Chart in Kürze")',
  closing: 'Closing: title, prepared-for name, wordmark',
  methodNote: 'Method / data note ("Methodenhinweis"). Inherited: the data-note box only says a note exists; the note itself is the method-note sentence',
};
const LABEL: Readonly<Record<string, string>> = {
  opener: 'opener',
  continuation: 'continuation',
  'two-column': 'two columns',
  'one-column': 'one column',
  'column-split': 'paragraph split across the columns',
  'continues-across-page': 'paragraph continues on the next page',
  'continued-from-previous-page': 'paragraph continued from the previous page',
  'split-at-2-line-minimum': 'a split lands on the 2-line orphan/widow minimum',
  'paragraph-moved-whole': 'paragraph moved whole although one line still fitted',
  'opener-width-carry-over': 'inherited: a paragraph keeps the narrower opener wrap (ADR 0012 limitation 4)',
  'short-paragraph': 'short paragraph',
  'long-paragraph': 'long paragraph',
  'continuation-with-sidebar': 'sidebar (page not short-final)',
  'short-final-with-reference-panel': 'short final page (fill < 0.6) with reference panel',
};
const ORDER = Object.keys(LABEL);
const chaptersWithBoth = new Set(
  map
    .filter((page) => page.behaviours.includes('continuation-with-sidebar'))
    .map((page) => page.chapter)
    .filter((chapter) => map.some((page) => page.chapter === chapter && page.behaviours.includes('short-final-with-reference-panel'))),
);
const rows = map.map((page) => {
  let what: string | undefined;
  if (page.kind === 'longForm') {
    const labels = ORDER.filter((behaviour) => page.behaviours.includes(behaviour)).map((behaviour) => LABEL[behaviour]);
    if (page.behaviours.includes('continuation-with-sidebar')) labels.push('inherited: a "·" separator ends a wrapped line in the sidebar (observed on this render)');
    if (chaptersWithBoth.has(page.chapter) && (page.behaviours.includes('continuation-with-sidebar') || page.behaviours.includes('short-final-with-reference-panel'))) {
      labels.push('inherited: this chapter shows the same reference block twice, as sidebar and as panel');
    }
    what = `Chapter ${String(page.chapter)}, page ${String(page.chapterPage)}: ${labels.join('; ')} (fill ${String(page.fill)})`;
  } else {
    const fixed = FIXED[page.kind];
    const notes = [...(decimalPages.has(page.pageNumber) ? [decimalNote] : []), ...(separatorKinds.has(page.kind) ? [SEPARATOR_NOTE] : [])];
    what = fixed === undefined ? undefined : [fixed, ...notes].join('. ');
  }
  if (what === undefined) throw new Error(`no description for ${page.kind}`);
  return `| ${String(page.pageNumber)} | \`pages/${String(page.pageNumber).padStart(2, '0')}-${page.pageId}.png\` | ${what} | |`;
});

const checklist = `# ETBZ-68 visual review checklist (synthetic design-review fixture)

This is a synthetic design-review document, **not a customer artifact**. It uses the synthetic known-time
development chart (Musterkundin A, no real birth data) and a neutral placeholder corpus about paper,
type and book-making. The body text is placeholder, so review the **design**, not the prose. Sentences
recur across chapters by design, but no two chapters share two consecutive sentences in the same order.

Generated by \`npm run etbz68:record\` from \`page-behaviour-map.json\`. The behaviours are read from the
projection the renderer drew, not from intent. "fill" is the projection's own measure. Items marked
**inherited** are released production behaviour, not artefacts of this fixture.

| Page | Render | What the page exercises | PO note |
| --- | --- | --- | --- |
${rows.join('\n')}

## Not rendered in this fixture (PO decision 2026-10-03, scope A)

| Component | Why |
| --- | --- |
| ChapterDivider | No such component exists in the template contract, \`src/\` or \`tools/\` (ADR 0012 limitation 1). It is open on ETBZ-43 (AC 2/5/10, comment 17069). |
| ChartMotifSummary | No such component exists, and the projection has no motif input (ADR 0012 limitation 1, ETBZ-43). |
| KeyInsightPanel | \`pages.py\` can draw it, but the released content schema accepts only paragraphs. Exposing it would change production code. |
| Pull quote | Same as KeyInsightPanel. |

Each chapter opener shows only the kicker ("KAPITEL 0n") and the title. That is the existing opener
header, not a ChapterDivider.

## Verdict (Human Product Owner)

The authoritative verdict is the PO's comment on Jira ETBZ-68. It may be mirrored here by replacing
\`_pending_\` with exactly one of the two values; \`CHANGES_REQUIRED\` may be followed by the pages and changes.

- \`VISUAL_DESIGN_ACCEPTED_FOR_CONTENT_REVIEW\`
- \`CHANGES_REQUIRED\` (list the pages and changes)

Verdict: _pending_
`;
writeFileSync(checklistPath, checklist, 'utf8');
process.stdout.write(`${JSON.stringify(record.determinism)}\n${JSON.stringify(controls)}\n`);
