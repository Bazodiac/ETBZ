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
one string from the end user and printed on every page, is held to the same rule. Every
printed string the long form does not measure (title, reflection questions, method note,
display name, and every other string a page prints) is held to the coverage the
paragraphs meet: every character is in the pinned Inter tables or is a CJK ideograph
(`PRESENTATION_TEXT_UNMEASURABLE` otherwise; the exact set is limitation 9), so a Braille
blank, a decomposed umlaut or an emoji is refused in every slot alike. For a model value
that check is defence in depth: the value is first compared with its second source
(section 4).

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

Every chart value is taken from the model. The values a second source defines are checked
against it; the rest (which hidden stems a branch holds and their Qi roles, which Ten-God
relation a pillar and each hidden stem carries, the Wu Xing values) are FuFirE's own
answers: FuFirE owns
symbolic truth, so they are shown as supplied.

- **`PRESENTATION_FACT_MISMATCH`:** the stem, branch and hidden-stem phases, the stem
  polarity and the pinyin must equal the glyph contract's entry for that character, and a
  hidden stem's pinyin and a branch's animal label must equal the released Sizhu table's.
  The BaZi and natal characters and stem elements must agree. The natal Day Master must be
  the day stem in character, element and polarity; the BaZi Day Master fields are compared
  too, so a hand-built model cannot carry a Day Master the pages would contradict.
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

What the QA guards against is a page builder or stylesheet edit that prints a wrong value,
puts one in the wrong place or hides one by mistake. The builders and `base.css` are
reviewed renderer code, bound by the renderer digest; the QA is not a sandbox for hostile
CSS. It measures the mechanisms listed below and claims nothing beyond them; limitation 8
names what it does not measure. Two layers do this. The page QA reads the browser's page
(DOM, computed styles, the page image) and binds every item to its projection path, slot,
order and paint. The final-artifact readback then reads the merged PDF itself - its text
layer and its painted shapes - against what each page printed, so that a channel the page
QA does not read cannot change the customer PDF behind it: for text and for the drawn
glyphs and wordmark, the PDF is the authority. Before it writes a PDF it checks:

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
- slot binding: the page is bound before it is built, so every text node carries the path of
  the projection value it prints, every glyph the path of its character, every presence mark
  the path of its value and every phase-coloured element the path of the phase it paints.
  The QA requires each to equal the value at its path (a glyph drawn by exactly one sprite
  `<use>` whose `href` attribute names that character; what the `<use>` actually draws is
  proven by the final vector layer below), and printed text only at the
  paths the page prints (never an identifier or classification it carries); every enclosing
  slot to be a prefix of the path and every entry of the path (each indexed step, such as
  `content.pillars.0`) to have a slot around it; on the page, the centre of every bound item
  to lie inside the box of every enclosing slot that draws one; the entries of one list to
  appear in list order in the DOM and on the page (no entry wholly above the one before it,
  nor left of it on the same row; the Wu Xing ring keeps its template order); every
  long-form line at the centipoint position the projection computed for it; every table
  presence mark bound to its own column and standing under that column's header; and every
  path the page must print, draw or mark to appear. A page-level label shown inside an entry
  may carry only a page-level value. A key printed in place of another (the other then
  missing), a value or a whole sub-entry shown in another entry's slot or moved there by
  CSS, two entries trading places in the DOM or on the page, a dropped copy of a repeated
  value, a printed identifier and a presence mark under another column all block. Two keys
  of one entry trading places, or a page label moved on its page, is layout: template code
  (limitation 8);
- drawn classifications, measured as painted: every phase paint (a field, a disc, a dot, a
  phase-coloured glyph) must compute one of its declared phase's two tokens as resolved on
  the page, and no other phase's; a field, disc or dot must carry no background image; and
  in the page image, of the five phases' tokens, its own must be the one its box shows most
  (exact pixels; measured locally on the evidence document, not recorded in the committed
  evidence: at least 107 of its own against at most 2 of any
  other), so another phase's colour painted through a glyph's `<use>`, a background image or
  an inset shadow is caught. A phase of 0 draws no bar fill, an empty track. A phase paint
  holds only its own entry's values (the Day-Master field paints the Day Master's phase, not
  a pillar's). Every presence mark has the look of its value in its computed style: stem
  filled, hidden a ring, both filled with a halo, none a bar, where a shadow or an outline
  counts as a halo and a background image, which no template mark uses, is refused. A disc
  in another phase's colour, a phase class remapped by CSS (on the element, on a glyph's
  `<use>`, or through a background image), a Wu Xing ring position showing another phase and
  a mark drawn with another value's look all block;
- visibility, for text and glyphs alike: no box, hidden, faint (effective alpha below 0.5),
  clipped, masked, filtered, scaled down, covered at the centre of any character by an
  element painting a background or a visible border, or by an SVG shape's fill or stroke
  (an overlay with `pointer-events:none` included, since the QA forces hit-testing on per
  element), a rendered size below 11 px (either axis of a transform), or below a 1.5
  contrast ratio of the composited colour against the surface under it; no right-to-left
  `direction` on the printed element and no `unicode-bidi` override or embedding on it or
  an ancestor; not mirrored by a `transform` or `scale` with a negative determinant on the
  element or an ancestor (for a glyph: on its `svg` or an ancestor); presence marks and
  phase paints must be visible too. A right-to-left run inherited from an ancestor, the
  individual `rotate` property and a transform on a glyph's `<use>` are not read here; the
  final layers catch what they do to the PDF;
- nothing drawn but the projection, as far as the page QA reads it: no `content` in the
  `::before`/`::after`/`::marker` pseudo-elements of any element, the root and body
  included; no image, picture, form control, canvas, frame, embed or list element; SVG on
  the sheet is an element allowlist (a display glyph is one sprite `<use>`, the wordmark
  carries the pinned file's element inventory), so an SVG path, text, image, filter image or
  pattern element is refused; no `url()` in the background, border, mask, mask-box or
  list-style image of any element or of its `::before`, `::after`, `::first-letter`,
  `::first-line` or `::marker`, and no replaced content; exactly the template's one
  `@page` rule (A4, no margin) among all stylesheet rules, imported ones included, and no
  page margin box; the condition of an `@media` or `@import` rule names a media type and
  the colour scheme only (`MEDIA_RULE_FORBIDDEN`: `page.pdf()` evaluates width and height
  features against another box than the emulated viewport, so such a rule could change
  the PDF alone; measured, the two differ only in a sub-pixel window of width and height).
  The `media` attribute of a `<style>` or `<link>` element - the stylesheet's own media
  list - is held to the same condition (ETBZ-56, ADR 0014; canaries `style-media-attribute`
  and `link-media-attribute`); no
  text or element outside the sheet; no non-breaking pair split across lines. Text or
  shapes that reach the PDF another way (a list marker from `display:list-item`, a shadow
  tree, a hyphenation character, CSS `d` on a path, a clip path) are the final layers' to
  catch;
- ink, on the page image: every printed string (each line box on its own, and each
  character in its own box), glyph, presence mark and phase paint must leave pixels close
  to its own colour (for text, the fill composited over its backdrop) inside its own box in
  the screenshot, within a band. Too few is a hidden item or one covered in another colour
  (an SVG shape, a border, a shadow, a blend); too many is a cover in the item's own
  colour. The QA report records the lowest and highest share each kind left on the
  evidence document and the contract suite pins them: floors at 30 to 45 % of the lowest
  share (text 0.03 of 0.083, glyph 0.06 of 0.192, mark 0.05 of 0.162, phase paint 0.2 of
  0.474), ceilings above 1.3 times the highest and below a solid box (text 0.5 over 0.190,
  glyph 0.75 over 0.448, mark 0.92 over 0.691; phase paints are solid fields and have
  none); per character a floor of 0.005 (a third of the lowest, 0.0151) and a ceiling of
  0.6 (over twice the highest, 0.263), so a cover over a whole character, in any colour,
  blocks;
- geometry: nothing outside the sheet, clipped by an ancestor or out of its painted
  container, no line wider than its measure, no overlap, the Wu Xing medallion clear, at
  least 3 mm between the two parts of the running head and of the running foot, every web
  font loaded; the running head and foot paint above the atmosphere blobs;
- a DevTools platform-font scan proving every character was set in one of exactly six
  PostScript faces: `Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`,
  `InterDisplay-Light`, `InterDisplay-Regular`, `NotoSansCJKsc-Regular`, and every element
  whose own text is Latin only in an Inter face;
- PDF readback: magic, page count, A4 media boxes, embedded fonts limited to the Inter
  faces by exact name (the CJK face embeds as Type3, see below);
- the final text layer (`PDF_TEXT_LAYER`) and the final vector layer (`PDF_VECTOR_LAYER`)
  of the merged PDF, below;
- byte-identical PDFs and page images across the last two of three runs.

**Final-artifact readback** (`tools/pdf-renderer/pdf_layer.py`, pikepdf only). While each
page is open, the renderer records its ledger: every text node on the sheet with the box
of each of its characters, and the box of every display glyph and wordmark. The readback
then walks the merged PDF's content streams (form XObjects included), page by page:

- *clips*: every clip path the PDF sets is one convex contour - turning one way only and
  once around, so neither a doubly wound star nor a concave bay walked in tiny steps
  counts - or a convex frame around one such hole (Chromium paints a box shadow outside its
  box that way); a clip path of any other shape - a word cut out of a shape - blocks
  (`PDF_VECTOR_UNEXPECTED`). The clips are tracked through the graphics state, so each
  glyph and each path is judged under the clips it is drawn under;
- *text layer*: every non-whitespace glyph the PDF shows, with its text from the font's
  ToUnicode map or from the ActualText span it sits in, counts as printed unless it is
  drawn in the invisible render modes 3 or 7. A glyph drawn under a frame clip, or with its
  centre outside a clip it is drawn under, blocks (`PDF_TEXT_CLIPPED`: the template clips no
  text). Each printed glyph must be bound by its centre to exactly one printed node of its
  page, and each node's glyphs, read in visual order (baseline rows top-down, each row left
  to right), must spell the projection value at the node's path (the template separator
  for a separator), compared without whitespace and case-insensitively: both sides are
  upper-cased as the template's `text-transform` would, then case-folded and composed (so
  `ß`/`SS` and a dotless `ı`/`I` agree). Every glyph must stand upright: its text matrix
  neither rotated, skewed nor mirrored. Text the page does not hold as a printed node, a
  missing or doubled string, an inserted character, a string printed out of its order and a
  turned or mirrored glyph block (`PDF_TEXT_UNBOUND`, `PDF_TEXT_MISMATCH`,
  `PDF_TEXT_NOT_UPRIGHT`, `PDF_TEXT_CLIPPED`). On the evidence document: 33,394 text units
  bound to 1,608 printed strings on 29 pages, none clipped;
- *vector layer*: every painted path (fill or stroke) must be either a canonical outline -
  one of the 27 sprite glyphs or the wordmark path, recognised by its segment sequence
  (each of the 28 is unique) and an axis-aligned scale-and-shift fit to the pinned path
  data within 0.01 px (measured locally on the evidence document: within 0.000003 px) - drawn with positive
  scales at the size and position its box's viewBox gives (within 1.5 px: Chromium snaps an
  SVG viewport to whole pixels in the PDF, by at most 0.94 px on the evidence document),
  lying wholly (every segment end and curve middle, 1 px tolerance) in the box of the
  display glyph of that very character (or of a wordmark), never under a frame clip and
  wholly inside every convex clip it is drawn under; or a single convex contour (the rules, fields, discs, bars, rounded
  panels and atmosphere shapes of the template, and the wordmark's dot). Every display
  glyph must be drawn by exactly one canonical fill (and at most one stroke); every
  wordmark by one canonical path fill and one convex fill in the box its pinned circle
  takes under the same fit (its dot, unclipped). No image, inline image, shading, pattern,
  soft mask or annotation appears (the template paints flat shapes and text). A glyph drawn
  from other path data, mirrored or turned, scaled or moved, redrawn as another character,
  clipped, missing or doubled, and a changed or clipped wordmark or one without its dot,
  block (`PDF_VECTOR_MISSING`, `PDF_VECTOR_NOT_UPRIGHT`, `PDF_VECTOR_MISPLACED`,
  `PDF_VECTOR_NOT_ITS_VALUE`, `PDF_VECTOR_CLIPPED`, `PDF_VECTOR_UNEXPECTED`). On the evidence document: 146 canonical
  fills (116 display glyphs, 30 wordmarks), 30 wordmark dots and 566 convex shapes, nothing
  else.

Two pre-reviews of this readback (before its evidence was committed) reproduced defects
in its first two versions, and each is now a canary or a positive control: a dotless `ı`
refused; a value turned 180 degrees passed; clip paths ignored (a glyph clipped into
another character, a word cut out of a shape, a clipped wordmark); the wordmark's dot
unchecked; a glyph moved out of its box; then a frame clip's hole taking a stroke between
the tested points, a doubly wound star and a crescent walked in tiny steps passing as
convex clips, a sentence under a strip-shaped hole counted as clipped away, a glyph
squashed through its `<use>`, and a print rule keyed on the page width that `page.pdf()`
applies while the emulation does not.

The readback compares the PDF with the page it was printed from: which string a node holds
is the page QA's binding (its path and value), what the PDF shows of it is the readback's.
It measures neither colour nor size in the PDF (the ink and size checks do, on the page
image), nor the shape of a single convex contour (limitation 14).

Chromium renders with the light colour scheme pinned (the tokens redefine every colour
under a dark scheme); the pin has no QA check of its own. Print media is emulated before
each page's screenshot and set again after `page.pdf()` (which keeps it on the pinned
Chromium) for the DOM checks, the Wu Xing check and the page ledger. What resets it is
detaching the DevTools session of the platform-font scan, so every check that reads the
layout runs before that scan; until review round 9 the Wu Xing check ran after it, in
screen media, and a print-only rule could move a disc into the medallion
(`wx-print-only-medallion` canary). Paged media itself (the `@page` box) is not rendered on
screen, so the page QA restricts it: the one template rule, no margin box; the final text
layer sees any margin-box text that reaches the PDF. A blocked run, including an
unexpected renderer error (`RENDERER_ERROR`), writes the QA report and diagnostics, never
a PDF, and every run writes into a hidden sibling directory that is renamed into place
only when complete.
`tools/pdf-renderer/qa/run_canaries.py` breaks every gate in its table at least once,
runs the real renderer against it, and records the result in `renderer-canaries.json`:
167 canaries (ETBZ-56 added four), each of which must end BLOCKED at the expected check with the expected
finding, exit 1 and no PDF or manifest; the `partial-write` canary instead proves that a
failure after a passing render leaves no `--out` directory at all. The record is bound
to the renderer source digest and to the digest of the canary source; the contract
suite pins every canary's expected check and finding, requires every canary to hold on
the same renderer digest the manifest states, and requires every code the renderer can
emit to appear in the record except the six limitation 8 names. Four positive controls
must pass with a PDF and a manifest (a Wu Xing value of 0, body text and plain display
glyphs at opacity 0.7, a display name with a dotless `ı` that the running head
upper-cases), so the fixes that keep those legitimate pages from failing closed
are proven too. The same record carries the differential test of the Python hash mirror
against the repository's TypeScript `canonicalJson` on a fixed value set.

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
  wordmark digests, and the digests of the four drawing assets (`glyphManifestSha256` is
  the ETBZ-49 glyph manifest's own content hash, its `manifestSha256` field; the asset
  entry for `glyphs/manifest.json` is the file's byte digest - two different measures);
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

- ETBZ-56 feeds the accepted Skill reading through the same projection and renderer
  (ADR 0014): it validates `visualizationSpecs` against the page slots, binds the reading,
  its package and the chart, and records the Skill, contract and reading identities in the
  manifest. The template stays `1.0.0`.
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
4. **The canonical paginator's wrap carries over.** A paragraph is wrapped once, at the
   width of the column current when it comes up, and keeps that wrap: the tail of a
   paragraph that crosses onto a continuation page is set at the opener width (pages 13, 19,
   21 and 23), and a paragraph that cannot put two lines on the opener moves whole to the
   continuation page, still at the opener width (pages 15, 17 and 25). The port reproduces
   the canonical ETBZ-49 paginator on purpose; re-wrapping at the continuation width would
   change the canonical paginator, a template decision.
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
8. **The QA measures the mechanisms section 6 lists, not the template's geometry and not
   every CSS channel.** CSS that changes how a string's characters look without reordering
   them (`text-transform`, font features, letter-spacing) or paints outside the listed
   channels is reviewed template code, not measured by the page QA; what such a channel does
   to the PDF's text layer or to its drawn glyphs and wordmark is caught by the final layers
   (limitation 14 names what those leave out). What stays template code, reviewed
   rather than measured, is where the page layouts place each block (the ring order
   `WX_RING`, the grid of each page), which of an entry's keys sits where inside the entry,
   and which path a page-level element shows when it holds no value of its own entry; an
   edit there that keeps every value, order, colour and slot consistent is invisible to the
   QA. Colour classes come from the entry's phase, not from the projection's `paint`, which
   the renderer does not read; what a phase paint paints is measured against the tokens. A
   phase paint is recognised by its `f-`/`m-` class or a `--phase-*` variable; an element
   painted in a phase colour any other way (a literal colour, a stylesheet rule keyed on an
   attribute) is neither bound nor measured. A mark's look is judged by which paint channels
   it uses; the colour of its halo is not measured. The QA proves that every character is
   present, inked and, at its centre, not covered by a painted background, a visible border
   or an SVG fill or stroke; it does not prove that the character's shape is intact (the
   final text layer proves which character each PDF glyph encodes and where it stands, and
   the font pins which faces draw them, not the drawn shape of each glyph). A box
   shadow and an outline are not hit-testable, so a cover drawn as one is caught only when
   it takes a character below 0.005 or a line below 0.03, or, in the item's own colour,
   lifts one above its ceiling; and a cover over part of every character that leaves each
   centre uncovered and each share at or above 0.005 (measured: the upper half of every line
   of a page; the dots of an umlaut) is not detected. A phase-coloured glyph drawn
   translucent would fail the pixel classification (its pixels match no token): no template
   glyph is translucent, and the failure is closed. For a glyph, a mark or a phase paint the
   ink band is judged over its whole box, so a cover over part of one of those that leaves
   its share within the band is not detected either. The ink check proves a band of the
   item's own colour in its box, not legibility: a cover that reproduces an item's own ink
   density (a pattern in its colour, the wordmark drawn across a line in the text's colour)
   passes it. Six finding codes in two groups have no canary, because breaking them needs a
   doctored font or PDF writer rather than a doctored page: the one-em CJK advance
   (`CJK_ADVANCE_NOT_ONE_EM`) and the PDF readback checks other than the page count
   (`PDF_MAGIC`, `PDF_MEDIA_BOX`, `PDF_FONT_NOT_EMBEDDED`, `PDF_FONT_NOT_PINNED`,
   `PDF_TYPE3_WITHOUT_TOUNICODE`). Round 9 found a page route to `PDF_FONT_NOT_PINNED` - an
   imported page margin box, which is no DOM node, set in a system face - which the page QA's
   rule walk now refuses first, since it follows imports; text in a shadow tree or a list
   marker set in a system face is caught first by the platform-font scan. The light
   colour-scheme pin has no QA check at all. Every other check id and finding code has at
   least one canary in the committed record; the evidence contract test derives the codes of
   every renderer module from its source and pins exactly these six as the ones no canary
   observed.
9. **Customer text is limited to the pinned advance tables.** Every printed string must be
   in the Inter advance tables the long form measures with: U+0020–007E, U+00A0–024F,
   U+2010–2027, U+2030–203A and U+20AC, as far as the pinned Inter cmap carries them (so
   not U+00AD, U+0149 or U+01C4); or be a CJK Unified Ideograph (U+4E00–9FFF) or one of
   Extension A (U+3400–4DBF). Other ideographs (〇 U+3007, the compatibility ideographs,
   Extensions B and later) are refused. So a display name or payload in Vietnamese,
   Cyrillic or Greek is refused (`PRESENTATION_TEXT_UNMEASURABLE`) although the Inter faces
   carry those letters. Three characters inside the tables (U+01C5 ǅ, U+01C6 ǆ, U+023F ȿ)
   pass the projection but block every page with running chrome, because the template's
   upper-casing turns them into code points no pinned face carries (the platform-font scan
   refuses the fallback face, as `TEXT_SET_IN_UNPINNED_FACE` and `LATIN_SET_IN_CJK_FACE`
   both, although the fallback is a system face, not the CJK face) - review round 10, fails
   closed.
   Widening the tables changes the font metrics and the released template hash; it is a
   Product Owner decision for a new template version.
10. **The rival-face scan covers the listed font directories.** A face with the pinned
   PostScript name in `/System/Library/Fonts` or activated by a font manager would not be
   detected; on the measured host none exists.
11. **A display name wider than the running head leaves room for is refused.** The running
   head and foot never wrap the name and must keep 3 mm between their two parts, so a wide
   name fails closed (`CHROME_CROWDED`). The limit is a width, not a character count, and the
   binding part is the running head beside its tag: in local probes with names built by the
   real projection, a family of names passed at 34 characters and was refused at 37, 40 and
   43 (at 45 the foot also leaves the sheet), while a narrow 40-character name passed and a
   31-character name of wide capitals was refused. A running head or foot with other than its
   two parts fails closed as well. The projection caps no name length; a length rule, or a
   smaller running-chrome type for long names, is a template decision.
12. **A pull quote could not pass the every-word check - resolved in ETBZ-56 (ADR 0014).**
   The paginator's own check stripped U+201C and U+201D from the placed lines but not from
   the source, so a pull quote failed, and so did any paragraph quoting with German marks
   (`„…“` closes with U+201C) - the first real 1.1.0 reading hit it. Both checks now compare
   the text a block places (`placedBlockText`: a pull quote inside the marks it is wrapped
   in) with the placed lines, stripping nothing. The quotation-mark style of a pull quote
   stays the canonical paginator's `“…”` (a template decision); no Skill reading carries a
   pull quote, so none is drawn yet.
13. **A Wu Xing value far below the largest fails closed.** A value under about 0.5 % of the
   largest draws a bar fill narrower than half a pixel, which the phase-paint visibility rule
   refuses (`PHASE_INVISIBLE`). A value of exactly 0 draws no fill and passes (a positive
   control proves it). FuFirE's vectors carry values of one decimal, so the case needs a value
   of 0.0x next to a maximum of several points.
14. **What the final-artifact readback leaves out.** It reads what the PDF encodes and where
   it draws it. It compares text case-insensitively and without whitespace, so the case and
   the spacing of a string are template code (the template upper-cases its labels); the `·`
   separator is template text, bound to no projection path. A node's expected string comes
   from its path, which the page QA binds; the readback proves what the PDF shows of each
   printed node, not which node prints which path. Visual order is read per baseline row, so
   the order of rows of one string is top-down by construction, and nothing orders one
   string against another (no global reading order is claimed). A glyph's text is what its
   font's ToUnicode map or its ActualText span says; a PDF writer that encodes one character
   and draws another is outside it (the engine is pinned, and no canary doctors a PDF
   writer). Colour and size in the PDF are not compared (the page QA's ink, contrast and
   size checks are). A shape that is itself one convex contour is not classified further,
   so words drawn as convex strokes or blocks (letters without a counter, one shape each)
   would pass the vector layer; the page QA's SVG allowlist refuses drawing elements on the
   sheet, but a builder adding one box per letter is not measured. Clips are judged by their
   control polygons, which hold their curves: a glyph centre or an outline point is tested
   against that polygon (0.5 px tolerance), and an outline only at its segment ends and curve
   middles, so a convex clip that takes a sliver of a curve between those points, or lies
   in the slack between a curved clip and its polygon, is not detected (a frame clip is
   refused outright over text and canonical shapes); a convex clip or a frame with one
   convex hole over a convex shape is not classified further. A canonical outline's size
   and position are held to its box within 1.5 px, so a change smaller than that passes. The wordmark's dot is
   recognised by its box under the wordmark's fit, not by its shape or colour.

## What this ADR does not decide

- Any mapping of Skill output, claims or motifs (ETBZ-56); any new template component
  (ETBZ-43); unknown-time rendering; delivery, storage or a served endpoint.
- Whether the document is sellable. That is the human verdict of ETBZ-54.
