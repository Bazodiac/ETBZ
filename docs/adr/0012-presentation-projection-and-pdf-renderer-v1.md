# ADR 0012 — PresentationProjection v1 and the local PDF renderer (ETBZ-55)

- **Status:** Proposed — PR open. Merge is governed by the Product Owner's standing
  authorisation D1 of 2026-09-28 (Jira ETBZ-2 comment 16690), subject to the merge
  gate on the exact head.
- **Date:** 2026-09-28
- **Slice:** ETBZ-55 [RUN-06] — fixture-first `PresentationProjection → Visual System v1 →
  PdfRenderer → PDF QA → ArtifactManifest` into a real `application/pdf`. Parent delivery
  capability ETBZ-26. Does not map a Skill reading (ETBZ-56) and adds no interpretation.
- **Base:** `main@c801f383797c308b35a8c0848d116f395e765128`
- **Canonical product text:** Rebaseline `62128133` sections 6–8; the visual decision
  `66650114` v2 (ETBZ-43) as implemented by ETBZ-49 (ADR 0009); the released Lexicon
  `67600385` v1; ETBZ-26 and ETBZ-55 acceptance criteria.

## Context

ETBZ-49 left a contract nothing consumed: "It answers *what does the contract say* and
*is this allowed*. It does not answer *what does the page look like*. […] The renderer
that consumes this contract is **ETBZ-55**." The sources a renderer must obey leave gaps
that this slice had to close without inventing meaning. They name no renderer technology
(ETBZ-26: "kleinsten geeigneten CJK-fähigen Renderer"), give no released template identity,
list the ArtifactManifest fields differently in five places, and ADR 0009 states that
"ETBZ-55 decides how the renderer pins its informational face". They also bind hard limits:
production dependencies stay exactly `express` + `zod`, `playwright`/`puppeteer`/`pdfkit` are
forbidden even as devDependencies, the application layer reads no files, and CI installs no
browser. The Rebaseline resolves the tension for the concierge MVP: "rendering may be
skill-owned/local rather than an always-on ETBZ server service, provided the same
deterministic template/versioning/CJK/readback/ArtifactManifest gates are met" (section 8).

## Decision

### 1. Every decision in the projection; the renderer decides nothing

`src/application/presentation/` computes the complete page model of the document: page
sequence, the value in every slot, every label, every long-form line and its centipoint
position, the contents with their page numbers. It is pure (no file, clock, randomness,
network or document) and a leaf. It is the only consumer of `visual/` and `skill/`, each
through its index; the two leaf tests were widened by exactly this consumer and assert the
allowance is used. The renderer places and draws what the projection lists and checks the
result. `customerStrings` enumerates every string the renderer may print, and the
renderer's QA refuses any other text on a page.

### 2. Input

`buildPresentationProjection({ model, content })`:

- `model` is the validated `HoroscopeModel`, the FuFirE-owned symbolic truth. It carries the
  branch element (`natal.pillars[p].branchElement`), which the ChartFact vocabulary does not.
- `content` is a text-only payload `{ title, chapters[{ title, paragraphs }],
  reflectionQuestions, methodNote }`, the shape of the ETBZ-52 customer projection. The
  fixture is the versioned German payload of the ETBZ-52 fixture run on the D4 chart.
  Mapping an accepted Skill reading onto the projection is ETBZ-56's work: its claims,
  motifs and `visualizationSpecs`, and the slot-to-fact vocabulary ADR 0011 names.

The payload is refused (`PRESENTATION_INPUT_INVALID`) if a text needs normalising: a
control character, a double space, or padding.

### 3. One template: `bazodiac-final-template@1.0.0`

The template is the ETBZ-49 visual system in German, with the page family, geometry,
tokens, 27 display glyphs, wordmark and pagination rules, plus a declared label set. Its
identity is a structural hash over everything it consumes, frozen in
`RELEASED_TEMPLATE_HASHES['1.0.0'] = sha256:5c401d0b…`. The projection refuses a template
that no longer hashes to it. The labels are the only text the template contributes:

- Each label is either a verbatim part of a released Lexicon term's `customerDe` (a test
  proves containment) or a plain interface label naming a page, a column or a
  presentation convention.
- Labels address the reader informally, like the payload.
- None explains the classical system. The English education copy of the ETBZ-49 harness
  pages is not carried over.

### 4. Binding and cross-checking the chart

Every chart value is taken from the model and checked against a second source.

- **`PRESENTATION_FACT_MISMATCH`:** the stem, branch and hidden-stem phases, the stem
  polarity and the pinyin must equal the glyph contract's entry for that character. The
  BaZi and natal characters and stem elements must agree. The Day Master must be the day
  stem.
- **`PRESENTATION_FACT_MISSING`:** a pillar without hidden stems or its relation, a branch
  without its animal, or a Wu Xing vector without all five phases.
- **`PRESENTATION_TEN_GOD_UNBOUND`:** every Ten-God relation must bind to exactly one Lexicon
  relation entry, joined on its pinyin without tone marks. It then shows the Lexicon's
  Hanzi (the simplified form, region policy `CN_SIMPLIFIED`), its pinyin and its German
  wording.
- **Wu Xing:** the vector is shown as supplied, through the one registered transform
  `pt.linear-max-v1`. `dominant` is never shown.
- **Birth time:** an unknown or provisional birth time is refused
  (`PRESENTATION_UNKNOWN_TIME_UNSUPPORTED`), because no source defines an unknown-time
  rendering.
- **Warnings:** FuFirE's source warnings appear as a data note pointing at the method note,
  never as a code.

### 5. The long form

`long-form.ts` is a faithful port of the canonical ETBZ-49 paginator (`paginate.py`). It
includes the opener with two balanced columns, continuation pages with a 104 mm column and
a sidebar, the orphan/widow, keep-with-next and atomic-module rules, and Python's
half-to-even rounding. Two sources prove it line for line, by text, x, baseline and width:

- the two layouts the canonical build recorded in `pagination-report.json`;
- 31 synthetic chapters laid out by the canonical Python paginator itself
  (`tests/support/etbz55-paginator-oracle.json`, generated by
  `tools/pdf-renderer/oracle/build_paginator_oracle.py`). They reach the branches the
  recovered fixtures never reach.

Measuring uses advance tables projected from the committed Inter binaries
(`font-metrics.ts`, regenerated byte-identically in CI). A character outside them is
refused rather than measured as `?`, and a CJK ideograph counts as one em. Overflow has
one resolution, another page. A chapter outside 600–900 words or 2–3 pages, or one that
loses a word, is refused by the visual contract.

### 6. The renderer: `bazodiac-pdf-renderer@1.0.0`, local

`tools/pdf-renderer/` is Python with Playwright/Chromium, pikepdf, fontTools and Pillow,
the engine that produced the PO-approved ETBZ-49 look. It is local-only, imported by
nothing, never run in CI, and adds no npm dependency. Chromium runs in deterministic mode.
Before it writes a PDF it checks:

- font pins;
- glyph and CJK coverage;
- per-page DOM QA: text nodes limited to projection strings, glyphs limited to projection
  glyphs, nothing outside the sheet, no line wider than its measure, no overlap, the Wu Xing
  medallion clear;
- a DevTools platform-font scan proving every character was set in `Inter-*`,
  `InterDisplay-*` or `NotoSansCJKsc-*`;
- PDF readback: magic, page count, A4 media boxes, embedded fonts;
- byte-identical PDFs and page images across the last two of three runs.

A blocked run writes the QA report and diagnostics, never a PDF.

**The informational CJK face** (ADR 0009's open point) is pinned to
`NotoSansCJK-Regular.ttc`, `sha256:b76b0433…690a`, byte-identical to upstream
`notofonts/noto-cjk`. It is installed as a host font and selected as `Noto Sans CJK SC` by
family name, because a web font would load the collection's first, Japanese face. Every
text stack falls back to it and to nothing else. Chromium embeds this CFF face as Type3
glyph procedures. Those must carry a ToUnicode map, and the platform-font scan proves
which face drew them.

### 7. ArtifactManifest (`bazodiac-artifact-manifest.v1`)

The field set is the union of the sources:

- PDF sha256, byte length and page count;
- input hashes: chart model, content, and the Lexicon binding;
- presentation version, structural hash and file digest;
- template reference and structural hash;
- renderer reference, source digest and engine versions;
- fonts with digests and licences;
- QA status and checks, plus the contact-sheet digest;
- a declared generation record.

`state: ARTIFACT_READY` is written only together with `qa.state: QA_PASSED`, which settles
the ordering the sources disagree on. It carries no wall-clock timestamp besides the
declared execution date. CI re-derives every digest from the committed files.

### 8. Determinism

"Deterministically equivalent presentation structure" (ETBZ-55 AC6) means two things:

- The projection is identical, pinned by its structural hash and regenerated byte for byte
  in CI.
- On one host and engine, the PDF bytes and page images of consecutive runs are identical.
  The PDF carries no creation date, and its `/ID` is content-derived.

## Consequences

- ETBZ-56 feeds the accepted Skill reading through the same projection and renderer. It
  validates `visualizationSpecs` against the page slots, binds claims and motifs, and
  extends the manifest with Skill, contract and reading identities. The template stays
  `1.0.0` unless a label changes.
- ETBZ-54 renders the real golden reading with the same renderer and hands the PDF to the
  human verdict.

## Accepted limitations and observations

1. **`ChartMotifSummary` and `ChapterDivider` are not rendered.** The template contract
   (66650114 v2 / ETBZ-49) defines no such components, and `KeyInsightPanel` exists only as
   an atomic long-form block the payload does not use. Adding components is a template
   decision for ETBZ-43, not a renderer's.
2. **The Day-Master content slots stay empty.** The fixture carries no approved content for
   them, so they are listed in `emptyContentSlots` and never filled.
3. **The glyph-style record stays as ETBZ-49 left it.**
   `HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED = 'OPEN'` is carried in the template binding
   as-is; the PO approval of the shipped style is recorded in Jira (ETBZ-49 comment 16514,
   ADR 0009 limitation 3).
4. **The canonical paginator's wrap carries over.** A paragraph crossing from the opener to
   a continuation page keeps the opener's column wrap, and the port reproduces this on
   purpose.
5. **Qi-role labels are template labels.** `Haupt-Qi`, `Mittleres Qi` and `Rest-Qi` are
   interface labels; Lexicon v1 carries no German wording for Qi roles.
6. **CI verifies without rendering.** It checks the projection, the paginator and every
   digest of the committed evidence, but never renders. The PDF is local evidence with a
   declared generation record, like the ETBZ-49 proof.

## What this ADR does not decide

- Any mapping of Skill output, claims or motifs (ETBZ-56); any new template component
  (ETBZ-43); unknown-time rendering; delivery, storage or a served endpoint.
- Whether the document is sellable. That is the human verdict of ETBZ-54.
