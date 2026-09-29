# Bazodiac PDF renderer — `bazodiac-pdf-renderer@1.0.0` (ETBZ-55)

The product renderer behind the PresentationProjection. It turns one
`bazodiac-presentation-projection.v1` (built and hash-bound by
`src/application/presentation`, verified in CI) into one `application/pdf` of the
template `bazodiac-final-template@1.0.0`, checks it, and writes an ArtifactManifest.
Decision record: `docs/adr/0012-presentation-projection-and-pdf-renderer-v1.md`.

**Local only.** Rendering is a concierge step on the operator's machine, as the
Canonical Rebaseline (Confluence 62128133 section 8) allows: "rendering may be
skill-owned/local rather than an always-on ETBZ server service, provided the same
deterministic template/versioning/CJK/readback/ArtifactManifest gates are met".
Nothing here runs in CI; CI verifies the projection, the paginator and the committed
evidence. Nothing under `src/` imports this directory and it adds no npm dependency.

## What it decides: nothing

Every page, value, label and long-form line position comes from the projection. The
page builders (`pages.py`) port the page layouts of the approved ETBZ-49 customer page
family and print each projection string in its own element; the only literal text they
emit is the `·` separator. Before a page is built it is bound: every string becomes a
value that carries its projection path, and the builders can print (`t()`) and draw
(`Context.glyph()`) only bound values, each tagged with `data-p`, and mark every
repeated entry as a slot (`data-slot`). An unbound value or an unknown classification (a
tag kind, a presence mark, a text style) raises, which blocks the render as `PAGE_BUILD`. The long-form lines are placed absolutely at the centipoint
positions the projection computed — the browser never breaks a line. Strings that belong
together (a polarity and its phase, a phase and its value) sit in one non-breaking group,
and a separator after which a line may wrap carries a `<wbr>`.

## What it checks before it writes a PDF

1. **Identity.** The projection hashes to its own `structuralHash` (a Python mirror of
   `src/domain/canonical-json.ts`), and its template hashes to its own hash and to the
   released identity pinned in `render_pdf.py` (`TEMPLATE_STRUCTURAL_HASH`, which the
   contract suite requires to equal `RELEASED_TEMPLATE_HASHES['1.0.0']`).
2. **Pins.** The five Inter faces and the four drawing assets (`tokens.css`,
   `glyphs/sprite.svg`, `brand/wordmark.svg`, `glyphs/manifest.json`) equal their
   digests in `assets/visual-system-v1/ASSET-INTEGRITY.json`. The informational CJK face
   is `NotoSansCJK-Regular.ttc`, `sha256:b76b0433…690a` (upstream `notofonts/noto-cjk`,
   SIL OFL 1.1, licence text at `assets/visual-system-v1/glyphs/OFL.txt`), installed as
   a host font; a missing or different file blocks the render, and so does any other
   font file in the font directories that names the same family or PostScript face.
3. **Glyphs and CJK.** Every display glyph is one of the 27 vector assets; every CJK
   character the projection sets as text is covered by the pinned *SC* face and is one
   em wide — the advance the long-form layout measured.
4. **Page strings and page build.** The paths each page must print (`page_binding`)
   yield exactly the page's `strings` (`PAGE_STRINGS`). A page no builder can build (an
   unknown kind, a missing field, an unbound value, a glyph outside the contract) blocks
   as `PAGE_BUILD`.
5. **Page QA** (per page, in Chromium, light colour scheme pinned, print media emulated
   before the screenshot and again before the DOM checks, so the QA sees the rendering the
   PDF is made from). It guards against a builder or stylesheet edit that prints a wrong
   value, misplaces one or hides one by mistake; it measures the mechanisms below and
   nothing else (ADR 0012 section 6 and limitation 8):
   - binding: every text node, glyph, presence mark and phase colour is the projection
     value at its path (a glyph drawn by exactly one sprite `<use>` of that character),
     and text only at the paths the page prints (never an identifier it carries); every
     enclosing `data-slot` is a prefix of that path and every entry of
     the path has a slot around it, and on the page the item's centre lies inside the
     box of every enclosing slot that draws one; a page label (`data-page-label`)
     carries only a page-level value; the entries of a list appear in list order in the
     DOM and on the page (the Wu Xing ring keeps its template order); long-form lines
     stand at the positions the projection computed; each table mark names its own
     column and stands under that column's header; every path the page must print, draw
     or mark appears — so a key printed in place of another, a value or sub-entry in
     another entry's slot or moved there by CSS, two entries trading places, a dropped
     copy, a printed identifier and a mark under another column all block. Two keys of
     one entry trading places is layout (template code), not caught;
   - drawn classifications, as painted: each phase paint (field, disc, dot,
     phase-coloured glyph) computes one of its phase's two tokens resolved on the page,
     shows its own token most among the five phases' in the page image (exact pixels),
     and holds only its own entry's values; a field, disc or dot carries no background
     image; each presence
     mark has its value's look in its computed style (a shadow or an outline counts as a
     halo; a background image, which no template mark uses, is refused) — so a wrong
     phase colour, a CSS-remapped phase class (on the element, a glyph's `<use>`, a
     background image or an inset shadow), the Day-Master field painting a pillar's phase
     and a mark drawn with another value's look all block. A phase of 0 draws an empty bar
     track, no fill;
   - visibility, for text and glyphs alike: no box, hidden, faint (effective alpha
     below 0.5), clipped, masked, filtered, scaled down, covered at the centre of any
     character by an element painting a background or a visible border, or by an SVG
     shape's fill or stroke (hit-testing is forced on per element, so an overlay with
     `pointer-events:none`, even inline `!important`, counts), rendered below 11 px on
     either axis, or below a 1.5 contrast ratio of the composited colour against the
     surface under it; printed in the value's order (no bidi override or embedding, no
     right-to-left run) and not mirrored (no transform or `scale` with a negative
     determinant); presence marks and phase paints visible;
   - nothing drawn but the projection: no `::before`/`::after`/`::marker` content on
     any element, root and body included; no image, form control, canvas, frame or list
     element; SVG only as a display glyph (one sprite `<use>`) or the pinned wordmark; no
     `url()` in a background, border, mask, mask-box or list-style image of any element
     or pseudo-element, and no replaced content; exactly the template's `@page` rule and
     no page margin box; nothing outside the sheet; no non-breaking pair split across
     lines;
   - ink, on the screenshot: every printed string (each line box, and each character in
     its own box), glyph, presence mark and phase paint leaves pixels of its own colour
     inside its own box, within a band — so an SVG shape, a border or a shadow painted
     over it, over a whole character, blocks too, and so does a cover in its own colour
     (floors text 0.03, glyph 0.06, mark 0.05, phase 0.2, character 0.005; ceilings text
     0.5, glyph 0.75, mark 0.92, character 0.6, none for the solid phase fields; the QA
     report records the band each kind left, and the contract suite pins it);
   - geometry: nothing leaves the sheet, is clipped by an ancestor or runs out of its
     painted container; no long-form line is wider than its measure; no two text boxes
     overlap; the Wu Xing medallion stays clear; at least 3 mm between the two parts of
     the running head and of the running foot; no web font failed;
   - faces, through the DevTools `CSS.getPlatformFontsForNode`: every character was set
     in one of exactly six PostScript faces (`Inter-Regular`, `Inter-Medium`,
     `Inter-SemiBold`, `InterDisplay-Light`, `InterDisplay-Regular`,
     `NotoSansCJKsc-Regular`), and every element whose own text is Latin only in an
     Inter face.
6. **PDF readback.** `%PDF-` magic, page count equal to the projection, A4 media boxes,
   every font embedded and every named font one of the Inter faces (Chromium sets the
   CFF-based CJK face as Type3 glyph procedures, which must carry a ToUnicode map; the
   face that drew them is proven by step 5).
7. **Determinism.** The whole document is rendered `--runs` times (default 3: the first
   warms the font caches); the last two PDFs and all page images must be byte-identical.

A failed check writes `qa-report.json` with `BLOCKED` and the page images under
`diagnostics/` — never a PDF. There is no partial artefact: every run writes into a
hidden sibling of `--out` and renames it into place only when complete, and the staging
directory is removed however the run ends. An unexpected renderer error is reported as a
blocked `RENDERER_ERROR` check, not only as a trace.

## Proving the gates can fail

`qa/run_canaries.py` breaks each gate once — the projection, a pin, the host fonts or
one page builder — and runs the real renderer against it in a child process; six codes
that need a doctored font or PDF writer have no canary (ADR 0012 limitation 8). Each of
the 138 canaries must end `BLOCKED` at the expected check with the expected finding (the
`partial-write` canary instead proves that no `--out` directory appears),
exit 1, and leave no PDF and no manifest; three positive controls (a Wu Xing value of 0,
body text and plain glyphs at opacity 0.7) must pass with a PDF and a manifest. The results go to
`docs/evidence/etbz-55/renderer-canaries.json`, bound to the renderer source digest and
to the digest of `qa/run_canaries.py`, together with the differential test of the
Python hash mirror against the TypeScript `canonicalJson`. The contract suite pins every
canary's expected check and finding and requires every canary to hold on the digest the
committed manifest states. Any change to `*.py` or `*.css` in this directory changes the
renderer digest, and any change to `qa/run_canaries.py` the canary digest: re-render
and re-run the canaries.

```sh
"$PY" tools/pdf-renderer/qa/run_canaries.py --executed-at <YYYY-MM-DD>
```

`oracle/build_paginator_oracle.py` regenerates `tests/support/etbz55-paginator-oracle.json`
with the canonical ETBZ-49 paginator; it records the digests of every file it read.

## Running it

Requirements: Python 3 with `playwright` (Chromium), `pikepdf`, `fontTools`, `Pillow`;
the pinned Noto Sans CJK TTC installed as a host font. Measured environment of the
committed evidence: Python 3.13.3, Playwright 1.52.0, Chromium 136.0.7103.25 headless
shell, macOS (see `docs/evidence/etbz-55/artifact-manifest.json`).

```sh
npm run etbz55:projection                      # docs/evidence/etbz-55/presentation-projection.json
PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
"$PY" tools/pdf-renderer/render_pdf.py \
  --projection docs/evidence/etbz-55/presentation-projection.json \
  --out .etbz-verify/pdf-render --executed-at <YYYY-MM-DD> --repository-head <sha>
```

The output directory must not exist. On success it holds `bazodiac-reading.pdf`,
`contact-sheet.png`, `pages/*.png`, `qa-report.json` and `artifact-manifest.json`
(state `ARTIFACT_READY`, QA `QA_PASSED`).
