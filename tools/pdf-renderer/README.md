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
emit is the `·` separator. The long-form lines are placed absolutely at the centipoint
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
4. **Page build.** A page no builder can build (an unknown kind, a missing field, a
   glyph outside the contract) blocks as `PAGE_BUILD`.
5. **Page QA** (per page, in Chromium): the printed text equals the page's projection
   `strings` exactly — nothing added, nothing missing; no `::before`/`::after` content;
   no invisible text (transparent, hidden, zero opacity, tiny); every display glyph is a
   projection glyph; nothing leaves the sheet, is clipped by an ancestor or runs out of
   its painted container; no long-form line is wider than its measure; no two text boxes
   overlap; the Wu Xing medallion stays clear; no web font failed; and — through the
   DevTools `CSS.getPlatformFontsForNode` — every character was set in one of exactly six
   PostScript faces (`Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`,
   `InterDisplay-Light`, `InterDisplay-Regular`, `NotoSansCJKsc-Regular`).
6. **PDF readback.** `%PDF-` magic, page count equal to the projection, A4 media boxes,
   every font embedded and every named font one of the Inter faces (Chromium sets the
   CFF-based CJK face as Type3 glyph procedures, which must carry a ToUnicode map; the
   face that drew them is proven by step 5).
7. **Determinism.** The whole document is rendered `--runs` times (default 3: the first
   warms the font caches); the last two PDFs and all page images must be byte-identical.

A failed check writes `qa-report.json` with `BLOCKED` and the page images under
`diagnostics/` — never a PDF. There is no partial artefact. The staging directory is
removed however the run ends.

## Proving the gates can fail

`qa/run_canaries.py` breaks each gate once — the projection, a pin, the host fonts or
one page builder — and runs the real renderer against it in a child process. Each of
the 25 canaries must end `BLOCKED` at the expected check with the expected finding, exit
1, and leave no PDF and no manifest. The results go to
`docs/evidence/etbz-55/renderer-canaries.json`, bound to the renderer source digest; the
contract suite requires every canary to hold on the digest the committed manifest states.
Any change to `*.py` or `*.css` in this directory changes that digest, so re-render and
re-run the canaries.

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
