# ETBZ-49 — visual evidence

Human-inspectable proof for the canonical visual system. JSON equality can show
that two builds agree; it cannot show whether a page is beautiful, whether a
glyph reads at 30 pt, or whether a chapter breaks where a reader would want it
to. These are the artefacts for the parts a person has to look at.

All of it was produced by the proof harness in `tools/visual-proof-harness/`.
None of it is part of the production contract.

## Determinism

Two full builds, 29 pages each:

| Measure | Result |
| --- | --- |
| Structural hashes identical | 29 / 29 |
| PNG hashes identical | 29 / 29 |
| DOM overlap and out-of-bounds findings | 0 |
| Merged deliverables byte-identical | `customer-sample.pdf`, `developer-proof.pdf`, `final-contact-sheet.png`, `tokens.json`, `glyphs/manifest.json`, `brand/wordmark.svg` |

Per-page PDFs are *not* byte-identical and are deliberately not shipped:
Chromium writes a `/CreationDate` and a random trailer ID into each one. Those
bytes are non-structural, and keeping them in the repository would mean carrying
29 files that change on every build for no information. The merged PDFs are
re-serialised with deterministic IDs and are byte-identical.

Source: [`../../../assets/visual-system-v1/determinism-report.json`](../../../assets/visual-system-v1/determinism-report.json).

## The open human decision

[**`GLYPH-STYLE-DECISION.md`**](GLYPH-STYLE-DECISION.md) —
`HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED` is OPEN. That sheet carries the
decision image, all 27 assets with their digests, and the three answers
available. Nothing in this repository closes it.

## Customer surface — 18 designed pages

`customer/` · also merged as [`customer-sample.pdf`](customer-sample.pdf).

| Page | File | What it proves |
| --- | --- | --- |
| 01 | `customer/01-cover.png` | display glyph at hero size, atmospheric forms, brand → product → customer hierarchy, no evidence chrome |
| 02 | `customer/02-identity.png` | chart parameters placed, nothing derived |
| 03 | `customer/03-contents.png` | the report architecture, Luck Pillars removed |
| 04 | `customer/04-glance.png` | Day Master stage, pillar strip, Wu Xing tally — three bindings, no transform |
| 05 | `customer/05-four-pillars.png` | **region-scoped colour**: Stem, Branch and each Hidden Stem carry their own phase; the container stays neutral |
| 06 | `customer/06-foundation.png` | the eight characters as structure |
| 07 | `customer/07-day-master.png` | **Day Master treatment**: light page, neutral ground, gold selection edge, one dark panel — no full-black page |
| 08 | `customer/08-wu-xing.png` | **Wu Xing Distribution**: all five visible, `pt.linear-max-v1`, zero labelled not hidden |
| 09 | `customer/09-five-phases.png` | five equal anchors, no relation edges, no star |
| 10 | `customer/10-ten-gods.png` | dense presence matrix in `InformationalCjkText`, relations supplied not derived |
| 11 | `customer/11-hidden-stems.png` | per-branch rows in Qi order, each hidden stem its own phase |
| 12–14 | `customer/12-longform-p1.png` … `14-longform-p3.png` | **the long-form stress proof**: 749 words → 3 pages → 89 lines (48 / 38 / 3), 0 findings |
| 27 | `customer/27-reflection.png` | non-predictive closing guidance |
| 28 | `customer/28-summary.png` | one-page facts, identical values to pages 04–11 |
| 29 | `customer/29-closing.png` | **closing composition**: light, personal, non-predictive |
| 30 | `customer/30-method-note.png` | glossary and conventions; no internal states printed |

Pages 15–26 are interpretive chapter slots. They consume approved content-layer
text that does not exist yet; pages 12–14 are the proven container for them.

## Developer surface — 11 evidence pages

`developer/` · also merged as [`developer-proof.pdf`](developer-proof.pdf).

| File | What it proves |
| --- | --- |
| `developer/D01-glyph-proof.png` | all 27 assets, digests, licence basis |
| `developer/D02-glyph-style.png` | ink pass vs plain outline — the open PO decision |
| `developer/D03-wordmark.png` | the static wordmark contract |
| `developer/D04-bindings.png` | the fact-slot binding of every customer page |
| `developer/D05-negative.png` | 18 executed negative guards |
| `developer/D06-layout.png`, `D07-layout.png` | layout evidence with fragment tables |
| `developer/D08-receipts.png` | render receipts |
| `developer/dev-wu-xing-zero.png` | the tie-and-zero fixture through the customer template |
| `developer/dev-v6-01-longform-p1.png`, `dev-v6-02-longform-p2.png` | the V6 continuity fixture verbatim: 679 words → 2 pages → 79 lines, 0 findings |

## Long-form stress evidence

| Fixture | Surface | Words | Pages | Lines | Findings |
| --- | --- | ---: | ---: | ---: | ---: |
| `bazodiac-final/fixture/long-form/general-education-chapter-v1` | customer | 749 | 3 | 89 | 0 |
| `etbz43/fixture/long-form/pagination-stress-v1` | developer | 679 | 2 | 79 | 0 |

Both sit inside the 600–900 word / 2–3 page contract of Confluence 66650114 v2
section 12. Line-level placement with centipoint coordinates is in
[`../../../assets/visual-system-v1/longform/pagination-report.json`](../../../assets/visual-system-v1/longform/pagination-report.json).

The V6 fixture result differs from V6's own 3 pages / 62 lines because the
paginator was re-implemented at the V2 column measures rather than ported. That
is a different layout, not a regression: 0 findings, every word placed in order.

## Font provenance

The five Inter binaries are byte-identical to the official `rsms/inter` **v4.1**
release (`Inter-4.1.zip`, `sha256:9883fdd4…b11e`, inner path `extras/ttf/`). The
upstream `LICENSE.txt` is vendored as `assets/visual-system-v1/fonts/OFL.txt`.
Negative control: the same five filenames in v4.0 hash differently.

`FONT_LICENSE_PROVENANCE = VERIFIED`. Asserted in
`tests/contract/etbz49-visual-assets.contract.test.ts`.
