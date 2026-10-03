# ETBZ-68 — synthetic 30-page design-review document

**This is not a customer artifact.** It is a synthetic design-review fixture for the Product Owner's
visual acceptance of the canonical Bazodiac PDF design. It is not a reading, not Golden, and not for sale.

- **Chart:** the synthetic known-time development chart of `tests/support/narrativeFixture.ts`
  ("Musterkundin A", no real birth data), unchanged. It is the same chart model as the ETBZ-55 evidence
  (equal `chartModelStructuralHash`).
- **Body text:** a small, versioned, neutral German placeholder corpus, `fixture/placeholder-corpus.v1.json`
  (version 1.2.0). It has 93 unique sentences about paper, type,
  book-making and related images from craft and architecture, composed deterministically into seven chapters,
  each with its own stride. Sentences recur across chapters by design, but no two chapters share two
  consecutive sentences, and no paragraph recurs. The loader refuses a sentence that opens by pointing back
  ("Danach …", "Deshalb …"), because the composer reorders sentences. The corpus makes no customer,
  psychological, astrological or biographical claim.
- **Method note:** its data-note sentence is the accepted ETBZ-57 wording for the fixture chart's
  `DAY_ANCHOR_UNVERIFIED` source warning, so page 2's "Siehe Methodenhinweis, Seite 30" resolves.
- **No calls:** no FuFirE, LLM or provider call. No code under `src/` or `tools/` changed.

Jira ETBZ-68 (sub-task of ETBZ-43); slice start: comment 17207.

## Files

| File | What it is | Produced by |
| --- | --- | --- |
| `fixture/placeholder-corpus.v1.json` | sentences, chapter titles, reflection questions, method note and the composition plan | hand-written, versioned |
| `fixture/design-review-content.json` | the composed content the projection consumes | `npm run etbz68:projection` |
| `presentation-projection.json` | the page model the renderer drew: released `buildPresentationProjection`, every customer-text gate | `npm run etbz68:projection` |
| `page-behaviour-map.json` | per page, the editorial behaviours read from the projection (see below) | `npm run etbz68:projection` |
| `synthetic-design-review.pdf` | the PDF, 30 A4 pages; the renderer names it `bazodiac-reading.pdf`, renamed so the file says what it is | `tools/pdf-renderer/render_pdf.py` |
| `contact-sheet.png` | all 30 pages in a 6 × 5 grid | the renderer |
| `pages/*.png` | all 30 full-size page renders of the same run | the renderer (digests in `qa-report.json`) |
| `qa-report.json`, `artifact-manifest.json` | `ARTIFACT_READY`, `QA_PASSED`, 11/11 checks PASS, 0 findings on 30 pages | the renderer |
| `run-record.json` | fixture identity, the two-process determinism comparison, the network-denial controls, the components not rendered | `npm run etbz68:record` |
| `visual-review-checklist.md` | pages 1–30 with what each exercises and which items are inherited, plus the PO verdict | `npm run etbz68:record` |
| `contract-canaries.json` | the canary run that proved the contract test can fail, bound to the test's and the fixture module's digests | `npm run etbz68:canaries` |

`tests/contract/etbz68-design-review-evidence.contract.test.ts` re-derives in CI everything that needs no
browser:
- the content, projection and behaviour map, byte for byte;
- the 30-page sequence, the chapter split 3 + 6 × 2, and every required behaviour;
- that the printed corpus names no symbol from a fixed vocabulary: no CJK, no display-glyph pinyin with or
  without tones, no animal, phase or pillar term as a whole word;
- that no two chapters share two consecutive sentences, and no paragraph recurs;
- the PDF digest, length, page count and A4 media boxes, read from the bytes;
- every page image against the QA report;
- template and renderer identities, both equal to the ETBZ-55 evidence;
- the run record against the manifest, and the network-denial controls;
- the verdict vocabulary;
- the canary record against the current test.

The symbol check and the loader's anaphora check are lexical guards against known patterns: an inflected or
compound form, or a back-reference outside the word list, would pass them. That the prose is neutral and
self-contained rests on three independent read-only reviews of the corpus, not on these checks.

`scripts/etbz68-contract-canaries.mjs` proves that the contract test can fail. Each canary names the test
that must fail. `ci-verify` re-runs it as `npm run guards:etbz68` (`--check`), and
`tests/architecture/ci-contract.test.ts` pins that step.

The 30 is asserted only there. The released visual contract already numbers its page family for a
30-page document (`pageFamily.ts`: pages 1–14 and 27–30, long form 12–26), but no production module
counts pages against it. The page count is `pages.length`.

## Behaviours on pages 12–26 (from `page-behaviour-map.json`)

| Behaviour | Pages |
| --- | --- |
| opener, two columns | 12, 15, 17, 19, 21, 23, 25 |
| continuation, one column | 13, 14, 16, 18, 20, 22, 24, 26 |
| paragraph split across the opener columns | 12, 15, 17, 21 |
| paragraph continues onto the next page | 12, 13, 17, 19, 25 |
| a split lands on the 2-line orphan/widow minimum | 14, 15, 17 |
| paragraph moved whole although one line still fitted (the paginator's own condition) | 23 |
| short paragraph (≤ 15 words) | 12, 13, 17, 19, 21, 22 |
| long paragraph (≥ 90 words) | 12, 13, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26 |
| continuation page with sidebar | 13, 16, 24, 26 |
| short final page (fill < 0.6) with reference panel | 14, 18, 20, 22 |
| inherited: opener-width wrap carried onto a continuation page | 13, 16, 18, 20, 22, 24, 26 |

## Identities

Structural hashes are canonical-JSON hashes of the value. File digests are SHA-256 of the committed bytes.

| | |
| --- | --- |
| Base | `main` = `cb7605e58bee57cfff68c2a3b0a6a889ca1634c6` |
| Render head | `f62e6638cf0184f6f6866615348bbbc6a6ad9a22` (declared generation record, an ancestor of the tested commit) |
| Template | `bazodiac-final-template@1.0.0`, structural `sha256:d595ab7cccdf9f99fe23d03fa7789366a2d3951f130aa6eabee626489c2562d6` |
| Renderer | `bazodiac-pdf-renderer@1.0.0`, sources `sha256:f971a44b5eaa2721a2cb46156786a5485f521d7bfcd8f8d545ab19c04c4de820` |
| Engine | Chromium 136.0.7103.25, Playwright 1.52.0, Python 3.13.3 |
| Projection | `bazodiac-presentation-projection.v1`, structural `sha256:8ca028ebb2027d9feffd0c56ccde496cc875ea866f9f89cc76ac7db223e49dff` |
| Corpus file | file `sha256:e79ee72f1e464a733031613421fdb8a378a858be18f73de89a5c97ae8700f25f` |
| Content | structural `sha256:7b80fdd43b519537c11b008f8b0ac5506f6fcb18f3007b8a05e2723bdd4f32e8` |
| Chart model | structural `sha256:31e4b229b555f04f03020ff469a0694790385a2fb3fa0b8413a4e7419c725c91` (= ETBZ-55) |
| PDF | file `sha256:e84536b21192c7ffaa480d5d87d76ea2f159a42a8653270a7ccb7a6a527766f2`, 1974708 bytes, 30 pages |
| Contact sheet | file `sha256:bdd0021786d0c22472297fe123eb2d807c024c6aa83dea8d857145da46fd805f` |

## How it was produced (2026-10-03)

```sh
npm run etbz68:projection                         # pages 30, chapter pages 3,2,2,2,2,2,2
PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
P='(version 1)(allow default)(deny network*)'
for run in a b; do
  sandbox-exec -p "$P" "$PY" tools/pdf-renderer/render_pdf.py \
    --projection docs/evidence/etbz-68/presentation-projection.json \
    --out .etbz-verify/etbz68-render-$run --executed-at 2026-10-03 --repository-head f62e6638cf0184f6f6866615348bbbc6a6ad9a22
done                                              # both exit 0, PASSED, 11/11 checks
A=.etbz-verify/etbz68-render-a E=docs/evidence/etbz-68
cp $A/bazodiac-reading.pdf $E/synthetic-design-review.pdf
cp $A/contact-sheet.png $A/qa-report.json $A/artifact-manifest.json $E/ && cp $A/pages/*.png $E/pages/
npm run etbz68:record -- .etbz-verify/etbz68-render-a .etbz-verify/etbz68-render-b
npm run etbz68:canaries                           # last: mutates files while it runs, writes contract-canaries.json
```

**Determinism.** The two render processes produced byte-identical files: the PDF, the contact sheet, the QA
report, the manifest and 30 of 30 page
images. Each process also passed its own in-process DETERMINISM check.

**No network.** Both render processes ran under the sandbox profile above, which applies to the whole process
tree (Python, Playwright, Chromium). The record generator re-runs the controls. Outside the profile, Node DNS
gives `status 200`, Python DNS gives `status 200`, and a Python connect
to an IP literal gives `connected`. Inside it, these give `error ENOTFOUND`,
`error URLError` and `error PermissionError 1`. The projection itself is pure: an emitter run
under the same profile reproduced the committed inputs byte for byte.

## Not rendered (PO decision 2026-10-03, scope A: no production change)

- **ChapterDivider**: no such component in the template contract, src/ or tools/ (ADR 0012 limitation 1; ETBZ-43 AC 2/5/10 open, comment 17069)
- **ChartMotifSummary**: no such component and no motif input in the projection (ADR 0012 limitation 1; ETBZ-43)
- **KeyInsightPanel**: drawn by pages.py, but the released content schema is paragraphs only (projection.ts contentSchema); PO decision 2026-10-03: scope A, no production change
- **pull quote**: drawn by pages.py, but the released content schema is paragraphs only; PO decision 2026-10-03: scope A, no production change

The brief's component criterion is therefore PARTIAL. Each chapter opener shows the existing kicker and title
header, which is not a ChapterDivider.

## Inherited production behaviour the reviewer will see

These come from the released renderer and projection. They are not artefacts of this fixture, and scope A does
not change them. A `CHANGES_REQUIRED` that names them is a production decision.

- **Opener-width wrap on continuation pages.** A paragraph that starts on an opener, or moves whole from it,
  keeps its narrow opener wrap inside the wider continuation column (ADR 0012 limitation 4). This shows on
  pages 13, 16, 18, 20, 22, 24, 26.
- **Reference block twice in a three-page chapter.** A continuation page that is not the short final page gets
  the reference sidebar, and the short final page gets the same block as a panel. Chapter 1 therefore shows
  it on pages 13 and 14.
- **Wu Xing values use a decimal point.** They print as delivered (`1.8`, `2.5`) on pages 4, 8, 28.
- **A separator can end a wrapped line.** A "·" separator ends a line before the wrap: on page 4
  ("YIN METALL ·" / "TAGESMEISTER"), page 28 (the Wu Xing row) and every reference sidebar
  ("Tagesmeister · xīn ·" / "Yin Metall", pages 13, 16, 24, 26).
- **Data-note box.** The box on page 30 only says that a note exists; the note itself is the method-note
  sentence.
- **Page 2 line break.** In "Siehe Methodenhinweis, Seite 30", the page number wraps onto its own line.
- **Day Master slots.** Page 7 leaves its two content slots empty, because no approved content exists for
  them (ADR 0012 limitation 2).
- **Hidden stems.** The hour-branch hidden stems keep the fixture order, which the PO accepted as a
  fixture-versus-live discrepancy (ETBZ-58 comment 17024).
- **Lexicon.** The fixture path binds Lexicon 1.0.0; the Skill path and Golden use 1.1.0.
- **Displayed name.** "Musterkundin A" prints on the cover, the identity page, the running heads and the
  closing page. No birth data prints anywhere.

## Human gate

The Product Owner inspects the PDF, the contact sheet and the 30 page renders. The PO records one verdict
(`CHANGES_REQUIRED` may be followed by the pages and changes),
`VISUAL_DESIGN_ACCEPTED_FOR_CONTENT_REVIEW` or `CHANGES_REQUIRED`, on Jira ETBZ-68, which is
authoritative. It can be mirrored in `visual-review-checklist.md`. The delivery does not declare the
design accepted.

The generation record's ancestry check expects merge commits, which is how ETBZ merges (`CLAUDE.md`). A
squash or rebase merge would orphan the declared render head.
