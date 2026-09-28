# Bazodiac visual system — PROOF HARNESS

**This directory is a PROOF HARNESS. It is not part of the ETBZ production contract.**

Nothing under `src/` imports it, no npm dependency comes from it, and
`tsconfig.json` does not include it.
`tests/architecture/etbz49-visual-boundary.test.ts` asserts all three, so the
separation is measured rather than promised.

## What the production contract is

The contract ETBZ-55 will consume is:

| Where | What |
| --- | --- |
| `src/application/visual/` | the contract as values: tokens, geometry in centipoints, 27 glyph identities and outlines, the wordmark, the pagination rules, the page family and its fact bindings, and the refusals |
| `assets/visual-system-v1/` | the recovered artefacts those values are a projection of: `tokens.json`, `design-system.json`, `glyphs/`, `brand/`, `structures/`, `fixtures/`, `longform/`, `fonts/` |

Everything in this directory produced the evidence that the contract is
buildable. None of it is required to consume the contract.

## What this harness is

The Python build system recovered with the ETBZ-43 convergence package. It
renders the 29 proof pages through Chromium and writes the structural hashes,
the DOM overlap scan, the pagination report and the determinism report that
`docs/evidence/etbz-49/` carries.

```
build/extract_glyphs.py   27 SVG assets + manifest + OFL (Noto Sans CJK SC Black, pinned by SHA-256)
build/wordmark.py         the static wordmark from Inter SemiBold outlines
build/tokens.py           tokens.json / tokens.css / centipoint geometry
build/build_all.py        every page -> PNG/PDF, DOM scan, receipts, contact sheet
build/contract.py         design-system.json + source-manifest.json
```

`src/base.css` is the harness's own rendering input. `src/pages/*.html` are the
page compositions the last proof run generated (the builders under `build/`
write them; `proof/run_proof.py` reads none of them back). They are kept as a
readable reference of what Chromium rendered and are refreshed together with
the evidence; they are not the renderer ETBZ-55 will build, and the production
contract does not name them.

## Requirements (local only, never in CI)

Python 3 with `fontTools`, `Pillow`, `pikepdf` and `playwright` (Chromium).

Two Noto faces play different roles:

- `NotoSansCJK-Black.ttc` is needed only to **re-extract** the 27 display
  glyphs (`build/extract_glyphs.py`, which pins that font by SHA-256 and exits
  `GLYPH_SOURCE_FACE_NOT_FOUND` rather than substituting a face). The proof
  never runs it; the extracted SVG assets are committed.
- `NotoSansCJK-Regular.ttc` is the informational CJK text face
  (`--font-cjk: "Noto Sans CJK SC", …`). It is not committed. When it is
  installed on the host the proof records its path and SHA-256 in
  `proof-report.json` (`environment.informationalCjkFace`) and compares them to
  the face pinned in `assets/visual-system-v1/render-receipt.json`; when it is
  absent Chromium falls back to a host face and the report says so. Display
  glyphs are SVG and are unaffected either way.

Nothing here runs in `scripts/ci-verify.sh`. What CI verifies is that the
committed contract still equals the committed assets — see
`tests/contract/etbz49-visual-assets.contract.test.ts` and
`scripts/verify-etbz49-visual-system.mjs`.

## Refreshing the tracked evidence

The proof changes no tracked file. Carrying a run into the tree is a separate,
declared step, so that `docs/evidence/etbz-49/`, `structures/*.json`,
`render-receipt.json`, `design-system.json` and `determinism-report.json` are
never edited by hand:

```
PY=python3   # an interpreter with playwright, Pillow, pikepdf and fontTools
for run in 1 2 3; do $PY tools/visual-proof-harness/proof/run_proof.py --out .etbz-verify/visual-proof-$run; done
node scripts/etbz49-assemble-evidence.mjs .etbz-verify/visual-proof-1 .etbz-verify/visual-proof-2 .etbz-verify/visual-proof-3
npm run etbz49:contract && node scripts/etbz49-asset-integrity.mjs
npm test && npm run guards:etbz49
```

Run 1 becomes the evidence and determinism run 1, run 2 is determinism run 2,
every further run is recorded in `determinism-report.json` under
`pngByteStability` so the environment's PNG-byte stability is disclosed rather
than selected. The assembler refuses on a failed run, a page without a tracked
counterpart, or a receipt whose reviewed secret-scanner line would move.

## Running it as a project-native proof

`proof/run_proof.py` is the declared entrypoint (see the repository-root
`.agent-proofs.json`). It stages the layout above from committed files only —
`build/` and `src/base.css` from here, everything else from
`assets/visual-system-v1/` — runs the guards, renders all 29 pages through the
harness's own builders, DOM scan and Wu Xing geometry oracle, renders the Wu Xing
page once more with the prior defective geometry and requires the oracle to reject
it, and exits non-zero on any finding. `build/build_all.py` on its own exits 0 even
with findings.

```
python3 tools/visual-proof-harness/proof/run_proof.py --out .etbz-verify/visual-proof
```

Output (never tracked, `.etbz-verify/` is ignored): `proof-report.json`, the
regenerated `final-contact-sheet.png`, every page PNG under `customer/` and
`developer/`, the counterexample under `counterexample/`, and the merged PDFs.
The report covers artifact integrity, guards and rendered geometry; whether a page
looks right is a separate, human or model inspection.
