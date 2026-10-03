# ETBZ-68 — synthetic 30-page design-review document

**This is not a customer artifact.** It is a synthetic design-review fixture for the Product Owner's
visual acceptance of the canonical Bazodiac PDF design: not a reading, not Golden, and not for sale.

- **Chart:** the synthetic known-time development chart of `tests/support/narrativeFixture.ts`
  ("Musterkundin A", no real birth data), unchanged. It is the same chart model as the ETBZ-55 evidence
  (`chartModelStructuralHash` equal).
- **Body text:** a small, versioned, neutral German placeholder corpus about paper, type and book-making
  (`fixture/placeholder-corpus.v1.json`), composed deterministically into seven chapters. The corpus makes
  no customer, psychological, astrological or biographical claim.
- **No calls:** no FuFirE, LLM or provider call. No code under `src/` or `tools/` changed.

Jira ETBZ-68 (sub-task of ETBZ-43). Slice start: comment 17207.

## Files

| File | What it is | Produced by |
| --- | --- | --- |
| `fixture/placeholder-corpus.v1.json` | 93 unique sentences, 7 chapter titles, 4 reflection questions, the method note and the composition plan | hand-written, versioned |
| `fixture/design-review-content.json` | the composed content the projection consumes | `npm run etbz68:projection` |
| `presentation-projection.json` | the page model the renderer drew: released `buildPresentationProjection`, every customer-text gate | `npm run etbz68:projection` |
| `page-behaviour-map.json` | per page, the editorial behaviours read from the projection: opener, columns, splits, moved paragraphs, orphan/widow boundary, dense or sparse | `npm run etbz68:projection` |
| `synthetic-design-review.pdf` | the PDF: 30 A4 pages (the renderer names it `bazodiac-reading.pdf`; renamed here so the file says what it is) | `tools/pdf-renderer/render_pdf.py` |
| `contact-sheet.png` | all 30 pages, 6 × 5 | the renderer |
| `pages/*.png` | all 30 full-size page renders of the same run | the renderer (digests in `qa-report.json`) |
| `qa-report.json`, `artifact-manifest.json` | `ARTIFACT_READY`, `QA_PASSED`, 11 of 11 checks PASS, 0 findings on 30 pages | the renderer |
| `run-record.json` | fixture identity, the two-process determinism comparison, the network-denied run, the components not rendered | measured from the two runs |
| `visual-review-checklist.md` | pages 1–30 with what each exercises, and the PO verdict | generated from the behaviour map |

`tests/contract/etbz68-design-review-evidence.contract.test.ts` re-derives in CI everything that needs no
browser:
- content, projection and behaviour map, byte for byte;
- the 30-page sequence, the chapter split 3 + 6 × 2, and every required behaviour;
- the PDF digest, length, page count and A4 media boxes, read from the bytes;
- every page image against the QA report;
- template and renderer identities, both equal to the ETBZ-55 evidence;
- the run record against the manifest.

The 30 is asserted only there. It is a property of this fixture, not a production page quota.

## Identities

| | |
| --- | --- |
| Base | `main` = `cb7605e58bee57cfff68c2a3b0a6a889ca1634c6` |
| Render head | `3e7a966160bc5a909bd4b80caac097a9a1a3b409` (declared generation record, ancestor of the tested commit) |
| Template | `bazodiac-final-template@1.0.0`, `sha256:d595ab7cccdf9f99fe23d03fa7789366a2d3951f130aa6eabee626489c2562d6` |
| Renderer | `bazodiac-pdf-renderer@1.0.0`, sources `sha256:f971a44b5eaa2721a2cb46156786a5485f521d7bfcd8f8d545ab19c04c4de820` |
| Engine | Chromium 136.0.7103.25, Playwright 1.52.0, Python 3.13.3 |
| Projection | `bazodiac-presentation-projection.v1`, `sha256:2f57f724f9be703f0cb2af216099e39550b9adb79815f2a1bfa6b2099f68ef8e` |
| Corpus file | `sha256:47e7616509c52a64c50c098a5f940f19024141675bf3e8b31497c84b54db2ae9` |
| Content | `sha256:ea87c2a7c4eb07a92bb29f2fc24e9053add8a8b68c1d8495bdf86e7ba6054381` |
| Chart model | `sha256:31e4b229b555f04f03020ff469a0694790385a2fb3fa0b8413a4e7419c725c91` (= ETBZ-55) |
| PDF | `sha256:d80fbbf1ec7c326f46633e514d6b0f2eef860e4d1087b6ef776081f16e30a61f`, 1972336 bytes, 30 pages |
| Contact sheet | `sha256:1ebb6ce3f73026e6069c94eccaa89b8f807a5a49a3db5e7dbe6b12e494b92df9` |

## How it was produced (2026-10-03)

```sh
npm run etbz68:projection                                   # exit 0: pages 30, chapter pages 3,2,2,2,2,2,2
PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
P='(version 1)(allow default)(deny network*)'
for run in a b; do
  sandbox-exec -p "$P" "$PY" tools/pdf-renderer/render_pdf.py \
    --projection docs/evidence/etbz-68/presentation-projection.json \
    --out .etbz-verify/etbz68-render-$run --executed-at 2026-10-03 --repository-head 3e7a966160bc5a909bd4b80caac097a9a1a3b409
done                                                        # both exit 0, status PASSED, 11/11 checks
```

Run A's files are committed.

**Determinism.** The two render processes produced byte-identical files: the PDF, contact sheet, QA report
and manifest, and 30 of 30 page images.
Each process also passed its own in-process DETERMINISM check.

**No network.** Both renders and an emitter run ran under the macOS sandbox profile above, which denies all
network access. The emitter run reproduced all three committed inputs byte for byte. As a positive control,
`fetch("https://example.com")` returns 200 without the profile and fails with `ENOTFOUND` (exit 3) under it.

**The contract test was seen red.** Five canaries each mutated one committed file, ran the test and
restored the bytes. Every canary failed the test with an `AssertionError`:

| Canary | Tests that failed |
| --- | --- |
| One PDF byte flipped | 1 (PDF digest) |
| One corpus sentence edited | 4 (content regeneration, input binding, QA projection hash, run record) |
| Chapter 1 cut to two pages | 7 (including "expected 29 to be 30" and the chapter split) |
| One page image altered | 1 (page image against the QA report) |
| Verdict prefilled in the checklist | 1 (verdict left to the PO) |

## Not rendered (PO decision 2026-10-03, scope A: no production change)

- **ChapterDivider**: no such component in the template contract, src/ or tools/ (ADR 0012 limitation 1; ETBZ-43 AC 2/5/10 open, comment 17069)
- **ChartMotifSummary**: no such component and no motif input in the projection (ADR 0012 limitation 1; ETBZ-43)
- **KeyInsightPanel**: drawn by pages.py, but the released content schema is paragraphs only (projection.ts contentSchema); PO decision 2026-10-03: scope A, no production change
- **pull quote**: drawn by pages.py, but the released content schema is paragraphs only; PO decision 2026-10-03: scope A, no production change

The brief's component criterion is therefore PARTIAL. Each chapter opener shows the existing kicker and
title header, which is not a ChapterDivider.

## Known, inherited facts

- The hour-branch hidden stems of the fixture chart keep the fixture order, which differs from live FuFirE.
  The PO accepted this as a fixture-versus-live discrepancy (ETBZ-58 comment 17024).
- The fixture path binds Lexicon 1.0.0 (`projection.ts`); the Skill path and Golden use 1.1.0.
- Page 7 (Day Master) always leaves two slots empty because they have no approved content
  (ADR 0012 limitation 2).
- The name "Musterkundin A" prints on the cover, the identity page, the running head and the closing page.
  No birth data prints anywhere.

## Human gate

The Product Owner inspects the PDF, the contact sheet and the 30 page renders, and records one verdict in
`visual-review-checklist.md` and on ETBZ-68: `VISUAL_DESIGN_ACCEPTED_FOR_CONTENT_REVIEW` or
`CHANGES_REQUIRED`. The delivery does not declare the design accepted.
