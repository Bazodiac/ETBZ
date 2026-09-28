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
result. Each page carries `strings`, exactly the strings that page prints (content, running
chrome, page number); `customerStrings` is their union. Page views no longer carry the
fields no page prints as text (the Lexicon family glosses, the full Wu Xing vector on the
glance page, the brand as text where only the wordmark is drawn); the identifiers and
classifications they still carry (relation codes, families, phases, roles) are in no printed
set, which a unit test proves by value. The renderer binds every printed string and drawn
glyph to its projection path and checks each page against it (section 6).

### 2. Input

`buildPresentationProjection({ model, content })`:

- `model` is the validated `HoroscopeModel`, the FuFirE-owned symbolic truth. It carries the
  branch element (`natal.pillars[p].branchElement`), which the ChartFact vocabulary does not.
- `content` is a text-only payload `{ title, chapters[{ title, paragraphs }],
  reflectionQuestions, methodNote }`, the shape of the ETBZ-52 customer projection. The
  fixture is the versioned German payload of the ETBZ-52 fixture run on the D4 chart.
  Mapping an accepted Skill reading onto the projection is ETBZ-56's work: its claims,
  motifs and `visualizationSpecs`, and the slot-to-fact vocabulary ADR 0011 names.

The payload is refused (`PRESENTATION_INPUT_INVALID`) if a text needs normalising or hides
something: a Unicode control or format character (a bell, a zero-width space, a soft
hyphen, a bidi override, a byte-order mark), a lone surrogate, a private-use or unassigned
code point, any default-ignorable code point (a variation selector, a Hangul filler), any
whitespace other than the plain space, a double space, or padding. The display name, the
one string from the end user and printed on every page, is held to the same rule. The texts
the long form does not measure (title, reflection questions, method note, display name) are
held to the coverage the paragraphs meet: every character is in the pinned Inter tables or
is a CJK ideograph (`PRESENTATION_TEXT_UNMEASURABLE` otherwise), so a Braille blank, a
decomposed umlaut or an emoji is refused in every slot alike.

### 3. One template: `bazodiac-final-template@1.0.0`

The template is the ETBZ-49 visual system in German, with the page family, geometry,
tokens, 27 display glyphs, wordmark and pagination rules, the long-form typography (text
styles, line tolerance, running head, continuation column, CJK advance and the Inter
advance tables, since they decide every line break), plus a declared label set. Its
identity is a structural hash over everything it consumes, frozen in
`RELEASED_TEMPLATE_HASHES['1.0.0'] = sha256:d595ab7c…`. The projection refuses a template
that no longer hashes to it, and so does the renderer, which pins the same value. The
labels are the only text the template contributes:

- Each label is one of three kinds: a verbatim part of a released Lexicon term's
  `customerDe` (a test proves containment); the German name of one FuFirE enum value the
  chart carries, for which Lexicon v1 has no wording (`terminology`, today only the three
  Qi roles); or a plain interface label naming a page, a column or a presentation
  convention.
- Labels address the reader informally, like the payload.
- None explains the classical system. The English education copy of the ETBZ-49 harness
  pages is not carried over.

### 4. Binding and cross-checking the chart

Every chart value is taken from the model and checked against a second source.

- **`PRESENTATION_FACT_MISMATCH`:** the stem, branch and hidden-stem phases, the stem
  polarity and the pinyin must equal the glyph contract's entry for that character, and a
  hidden stem's pinyin must equal the released Sizhu table's. The BaZi and natal characters
  and stem elements must agree. The natal Day Master must be the day stem in character,
  element and polarity; the BaZi Day Master fields are compared too, so a hand-built model
  cannot carry a Day Master the pages would contradict.
- **`PRESENTATION_FACT_MISSING`:** a pillar without hidden stems, with more than three, or
  without its relation; a branch without its animal; or a Wu Xing vector without all five
  phases.
- **`PRESENTATION_TEN_GOD_UNBOUND`:** every Ten-God relation must bind to exactly one Lexicon
  relation entry, joined on its pinyin without tone marks. It then shows the Lexicon's
  Hanzi (the simplified form, region policy `CN_SIMPLIFIED`), its pinyin and its German
  wording.
- **Ten-God presence:** a relation is marked per pillar as the visible stem, a hidden stem,
  both, or not present. Both is its own mark with its own label, so a hidden occurrence
  never disappears behind a visible one.
- **Wu Xing:** the vector is shown as supplied, through the one registered transform
  `pt.linear-max-v1`. `dominant` is never shown. The caption that a 0 means 0 is printed
  only when a phase is 0.
- **Birth time:** an unknown or provisional birth time in the input or in any of the three
  chart answers (BaZi, natal, Wu Xing) is refused (`PRESENTATION_UNKNOWN_TIME_UNSUPPORTED`),
  because no source defines an unknown-time rendering.
- **Warnings:** FuFirE's source warnings appear as a data note on the identity page that
  points at the method page, and the method page carries a neutral template data note of
  its own, never a code. Surfacing the warning does not depend on the payload's prose.
  ETBZ-56 inherits this binding.

### 5. The long form

`long-form.ts` is a faithful port of the canonical ETBZ-49 paginator (`paginate.py`). It
includes the opener with two balanced columns, continuation pages with a 104 mm column and
a sidebar, the orphan/widow, keep-with-next and atomic-module rules, and Python's
half-to-even rounding. Two sources prove it line for line, by text, x, baseline and width:

- the two layouts the canonical build recorded in `pagination-report.json`;
- 47 synthetic chapters laid out by the canonical Python paginator itself
  (`tests/support/etbz55-paginator-oracle.json`, generated by
  `tools/pdf-renderer/oracle/build_paginator_oracle.py`). They reach the widow,
  keep-with-next, module-leads-the-next-page and short-band branches, a subhead inside a
  rebalanced opener band, and a module that opens a region. A guard mutant for each of
  these branches is killed by the oracle chapters that reach it. The oracle records the
  sha256 of every file the canonical paginator read; CI cannot run Python, so it re-hashes
  the committed files and requires the same digests.

Measuring uses advance tables projected from the committed Inter binaries
(`font-metrics.ts`, regenerated byte-identically in CI). The port differs from the
original in three declared ways. A character outside the tables is refused rather than
measured as `?`. Geometric findings, a subhead taller than a fresh continuation column
(where the original loops forever) and a layout past 64 pages throw rather than report.
A CJK ideograph counts as one em, where the original measured it against Inter; that
changes line breaks, and the one-em advance is proven only by the renderer's check of
the pinned Noto face. Overflow has one resolution, another page. A chapter outside
600–900 words or 2–3 pages, or one that loses a word, is refused by the visual contract.

### 6. The renderer: `bazodiac-pdf-renderer@1.0.0`, local

`tools/pdf-renderer/` is Python with Playwright/Chromium, pikepdf, fontTools and Pillow,
the engine that produced the PO-approved ETBZ-49 look. It is local-only, imported by
nothing, never run in CI, and adds no npm dependency. Chromium runs in deterministic mode.
Before it writes a PDF it checks:

- identity: the projection hashes to its own `structuralHash` (a Python mirror of
  `canonicalJson`), and its template to its own hash and to the pinned released identity;
- pins: the five Inter faces and the four drawing assets (tokens, glyph sprite, wordmark,
  glyph manifest) equal `ASSET-INTEGRITY.json`; the CJK face equals its pin, and no other
  file in the font directories provides its family or PostScript name;
- glyph and CJK coverage, and the one-em CJK advance;
- the paths each page must print and draw (`page_binding`, a Python mirror of the
  projection's printed-field selection) yield exactly the page's `strings`
  (`PAGE_STRINGS`); a page that cannot be built blocks (`PAGE_BUILD`), and so does any
  unbound value or unknown classification in a builder;
- slot binding: the page is bound before it is built, so every text node carries the path
  of the projection value it prints, every glyph the path of its character, every presence
  mark the path of its value and every phase-coloured element the path of the phase it
  paints. The QA requires each to equal the value at its path; every enclosing slot to be a
  prefix of the path and every entry of the path (each indexed step, such as
  `content.pillars.0`) to have a slot around it; the entries of one list to appear in list
  order; every long-form line at the centipoint position the projection computed for it;
  and every path the page must print, draw or mark to appear. A page-level label shown
  inside an entry may carry only a page-level value. A wrong key, a value or a whole
  sub-entry shown in another entry's slot, two entries trading places, a dropped copy of a
  repeated value, a presence mark in the wrong column, a disc in another phase's colour and
  a Wu Xing ring position showing another phase all block;
- visibility, for text and glyphs alike: no box, hidden, faint (effective alpha below 0.5),
  clipped, masked, filtered, scaled down, covered by a painted element (an overlay with
  `pointer-events:none` included, since the QA forces hit-testing on), a rendered size
  below 11 px, or below a 1.5 contrast ratio of the composited colour against the surface
  under it; no generated `::before`/`::after`/`::marker` content; no element that can carry
  text of its own (images, form controls, lists, SVG text); no non-breaking pair split
  across lines;
- geometry: nothing outside the sheet, clipped by an ancestor or out of its painted
  container, no line wider than its measure, no overlap, the Wu Xing medallion clear, every
  web font loaded; the running head and foot paint above the atmosphere blobs;
- a DevTools platform-font scan proving every character was set in one of exactly six
  PostScript faces: `Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`,
  `InterDisplay-Light`, `InterDisplay-Regular`, `NotoSansCJKsc-Regular`, and every element
  whose own text is Latin only in an Inter face;
- PDF readback: magic, page count, A4 media boxes, embedded fonts limited to the Inter
  faces by exact name (the CJK face embeds as Type3, see below);
- byte-identical PDFs and page images across the last two of three runs.

Chromium renders with the light colour scheme pinned (the tokens redefine every colour
under a dark scheme); the pin has no QA check of its own. A blocked run, including an
unexpected renderer error (`RENDERER_ERROR`), writes the QA report and diagnostics, never
a PDF, and every run writes into a hidden sibling directory that is renamed into place
only when complete.
`tools/pdf-renderer/qa/run_canaries.py` breaks every gate in its table at least once,
runs the real renderer against it, and records the result in `renderer-canaries.json`:
66 canaries, each of
which must end BLOCKED at the expected check with the expected finding, exit 1 and no
PDF or manifest. The record is bound to the renderer source digest and to the digest of
the canary source; the contract suite pins every canary's expected check and finding,
and requires every canary to hold on the same renderer digest the manifest states. The
same record carries the differential test of the Python hash mirror against the
repository's TypeScript `canonicalJson` on a fixed value set.

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
- template reference, structural hash, design system, decision source, glyph-manifest and
  wordmark digests, and the digests of the four drawing assets;
- renderer reference, source digest and engine versions;
- fonts with digests and licences;
- QA status and checks, plus the contact-sheet digest;
- a declared generation record.

`state: ARTIFACT_READY` is written only together with `qa.state: QA_PASSED`, which settles
the ordering the sources disagree on. It carries no wall-clock timestamp besides the
declared execution date. CI re-derives every digest the manifest states for a committed
file. Three things it cannot re-derive are stated as such: the informational CJK face is
a pinned literal (the TTC is a host font, not committed), the QA report's per-page image
digests are recorded only (the page images are not committed), and the engine versions
are a declaration.

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
5. **Qi-role labels are terminology labels.** `Haupt-Qi`, `Mittleres Qi` and `Rest-Qi`
   name the FuFirE hidden-stem roles `principal`, `central` and `residual` (label source
   `terminology`). Lexicon v1 carries no German wording for Qi roles; a Lexicon release
   that does would replace them in a new template version.
6. **CI verifies without rendering.** It checks the projection, the paginator, every
   digest of a committed evidence file and the committed canary record, but never renders.
   The PDF is local evidence with a declared generation record, like the ETBZ-49 proof.
7. **The Ten Gods page lists all ten relations.** The page is tagged "Dein Chart" and
   prints the Lexicon wording for every relation; the ones absent from the chart carry the
   "Nicht vorhanden" mark of the legend. The rows are Lexicon content, the marks are chart
   values.
8. **Slot binding binds values, order and phase, not the template's geometry.** Entries of
   a list must appear in list order and a phase colour must be its entry's phase, so two
   pillars trading columns or a ring position showing another phase block. What stays
   template code, reviewed rather than measured, is where the page layouts place each
   block (the ring order `WX_RING`, the grid of each page); an edit there that keeps every
   value, order and colour consistent is invisible to the QA. Colour classes come from the
   entry's phase, not from the projection's `paint`, which the renderer does not read.
   Three renderer checks have no canary: the one-em CJK advance, the PDF readback checks
   other than the page count, and the light colour-scheme pin.
9. **The rival-face scan covers the listed font directories.** A face with the pinned
   PostScript name in `/System/Library/Fonts` or activated by a font manager would not be
   detected; on the measured host none exists.

## What this ADR does not decide

- Any mapping of Skill output, claims or motifs (ETBZ-56); any new template component
  (ETBZ-43); unknown-time rendering; delivery, storage or a served endpoint.
- Whether the document is sellable. That is the human verdict of ETBZ-54.
