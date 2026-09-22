# Bazodiac FINAL — Design Provenance (ETBZ-43 convergence)

**Status:** converged implementation candidate · not release acceptance · one open human decision (`HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED`)
**Date:** 2026-09-21 · **Composite:** V4 35 % · V6 25 % · V3 20 % · V2 12 % · V5 6 % · V1 2 %
**Source ZIP hashes:** see `source-manifest.json` (carried from `ETBZ-43-source-manifest.json`).

This document makes the final design reproducible without the chat: every page and component names its donors, the decisions inherited, the decisions changed and why, and the source behaviour excluded.

## 0. Rebuild in five commands

```
python3 build/extract_glyphs.py     # 27 SVG assets + manifest + OFL (Noto Sans CJK SC Black, pinned by SHA-256)
python3 build/wordmark.py           # static wordmark from Inter SemiBold outlines
python3 build/tokens.py             # tokens.json / tokens.css / centipoint geometry
python3 build/build_all.py          # all pages → PNG/PDF, DOM scan, receipts, contact sheet (run twice for determinism-report)
python3 build/contract.py           # design-system.json + source-manifest.json
```
Proof tooling (Chromium/Playwright, Pillow, pikepdf) is harness, not contract. The production contract is: tokens, geometry in centipoints, the 27 glyph assets, the wordmark asset, the paginator rules, the fixtures, and the structures in `structures/*.json`.

## 1. Global decisions

| Decision | Primary donor | Secondary | Inherited | Changed / why | Excluded |
|---|---|---|---|---|---|
| Visual shell | **V4** `agent-x-etbz-4/5/6.png`, `_html_head…html` | V1 whitespace | warm paper, overlapping pastel forms, Inter Display light titles, gold kickers, one dark panel per page max, halos per character | `SAMPLE · NOT CUSTOMER DATA` / `SAMPLE DATA` tags removed from the customer surface (V5 boundary) | V4 7–8 px micro type (below the 9 pt floor) |
| Page geometry | **V5** tokens | V6 centipoints | A4, 22/20/20 mm, 170×255 mm, 5 mm baseline, 10.5/14.17 pt, floor 9 pt, scale lock 1.0, orphan/widow 2 | compiled to integer cp: page 59528×84189, content 48189×72283, baseline 1417, 51 lines/page | — |
| Palette | **V5** tokens | V4 atmosphere | all paper/ink/rule/gold/phase field+mark values verbatim | added `atmos-*` tokens (decorative forms, V4 opacity look) — explicitly non-fact-bearing | V1 semantic colour defects; V5 gold-as-metal risk (metal stays grey) |
| Type floor | **V5** `pg-size-floor` 9 pt | — | applied to *every* customer text incl. captions, kickers, chips | V4/V2 micro labels lifted to 9 pt; hidden-stem chips reduced to glyph + pinyin so 9 pt fits | developer proof uses 7.5 pt mono (evidence surface, not customer) |
| CJK contract | **V5** two roles | V6 pipeline, V4 target | Role A = 27 assets, Role B = Noto Sans CJK SC 400/500, `CN_SIMPLIFIED` | Role A extracted from **Noto Sans CJK SC Black** (not V6's Serif Regular) to match V4's heavy geometric target; deterministic ink pass (SVG stroke 14 units, round joins, under fill) | image-generated Hanzi; guessed font identity; outline distortion |
| Wordmark | **V4** variant B | V6 static contract | tracked caps `BAZODIAC` 0.34 em, gold point 0.4×cap on baseline | letters converted to outlines from Inter SemiBold → `assets/wordmark.svg`, font-independent | any glyph slot; V4 variants A and C |
| IA / page family | **V3** contact sheet | — | Contents, Chart at a Glance, Ten Gods/Hidden Stems, Closing, 30-page architecture | Luck Pillars / Da Yun removed; sequence per PO (1 Cover … 30 Method note) | V3 dark closing page, V3 luck-pillar timeline |
| Long-form | **V2** `agent_x_ETBZ-6.png` | V6 `paginate.ts`, V5 budgets, V4 short-page rule | two-column opener, pull quote, Key Insight panel, theme reference | paginator re-implemented in Python on pinned Inter metrics; continuation pages 104 mm column + 60 mm sidebar; short final page (<60 %) receives chapter reference panel | shrink-to-fit, clipping, justification, hyphenation |
| Customer / evidence | **V5** `47-customer-copy-boundary` | V6 receipts | two explicit outputs | customer HTML scanned for engineering vocabulary (clean) | any mixing |

## 2. Page-by-page provenance

| Pg | Page | Primary donor (file) | Secondary | Inherited visual | Inherited contract | Changed & why | Excluded |
|---|---|---|---|---|---|---|---|
| 01 | Cover | V4 `agent-x-etbz-4.png` | V6 wordmark, V1 | five pastel forms, full hero Hanzi, caption `Day Master · xīn · Yin Metal`, gold hairline, brand→product→customer stack | primary glyph = Day Master fact; wordmark static | top-right sample chrome removed; hero via vector asset, not font | decorative duplicate glyph (allowed, not used) |
| 02 | This document | V3 identity (p02) | V4, V5 | quiet page, facts table | parameters bound to `chart_parameters` | birth timestamp not printed in the fixture (no design-side calculation possible → no invented mapping); "Your chart / General education" tags explained here | V3 script/ruleset codes |
| 03 | Contents | V3 p03 | V4 type, V5 | four sections, CJK column marks | 30 pages listed | repainted in V4 kickers/Inter; C-section pages 12–25 as chapter slots | Luck Pillars entries |
| 04 | Chart at a Glance | V3 p04 | V4 colour/glyph, V6 bindings | Day Master stage, mini pillar strip, tally row, gives/leaves-out lists | three bindings, tally carries no transform | Day Master halo uses its own phase field; values repeat unchanged | V3 "CHART ENGINE · VALIDATED" chrome |
| 05 | Four Pillars | V4 `agent-x-etbz-5.png` | V6 region guard, V5 neutral ground + gold edge | four containers, halos, chips, ten-god row, reading keys, legend | stem/branch/hidden regions each own phase; Day = paper-200 + gold edge, `isPhase:false` | hidden chips reduced to glyph + pinyin (9 pt floor); per-pillar hidden Ten-God list moved to p11 | whole-column tint; V4 `ruleset standard_bazi_2026` line |
| 06 | Reading the pillars | V3 chart-foundation IA | V4 shell, V2 rhythm | two-column explainer + eight-character list | fact list bound | new page: fills V3's "structure" gap in V4 language | — |
| 07 | Day Master | V4 `agent-x-etbz-6.png` | V6 placement, V5 boundary | paper-200 stage, two pastel discs, hero, pinyin, facts table, gold-edged reading panel, one dark panel | slots `dayMaster.reading` (900) / `pillarReading` (500) content-layer | slot labels `INTERPRETIVE SLOT · MAX 900 CHARS` and lorem removed; neutral structural copy stands in (no stock personality prose) | full-page black |
| 08 | Wu Xing Distribution | V2 `agent_x_ETBZ-4.png` | V4, V6 transform, V5 zero rule | five discs on a ring, centre 五行, per-phase bars, five-column table | `pt.linear-max-v1` registered; zero → "0.0 in this distribution" | ring tightened to keep labels clear of the gold circle | V4 v1.0 decorative blobs on the data stage |
| 09 | The Five Phases | V5 WuXingEducationPage | V4 pastels, V6 guard | five equal anchors, pinyin, labels, stems/branches | no relation edges; not personalised | atmospheric forms added | Sheng/Ke arrows, star, relation prose |
| 10 | Ten Gods overview | V3 p08 | V5 Role B, V6 fail-closed | dense presence matrix | relations supplied, none derived | restyled in V4 tokens; marks: filled/open/rule | V3 sample banner |
| 11 | Hidden Stems | V3 p08 | V4 fields, V5 Role B | per-branch rows in Qi order | each hidden stem its own phase; BLOCKED state on missing facts | row layout instead of chips (9 pt floor) | inherited tint |
| 12–14 | Long-form chapter | V2 `agent_x_ETBZ-6.png` | V6 paginate, V5 budgets, V4 reference panel | opener 2-col, gold-ruled pull quote, dark Key Insight, sidebar reference | 749 words → 3 pages → 89 lines · 0 findings · structural `4c60d302…` | customer-safe general-education prose (not V6's typography fixture, which stays in the developer proof) | slot ids, word budgets |
| 27 | Bringing it together | V3 guidance IA | V4, V2 | eight-character strip, three prompts | non-predictive | new page | — |
| 28 | Summary | V3 closing column | V4 | one-page facts | same values as 04–11 | — | — |
| 29 | Closing | V3 p28 | V4 atmosphere, V6 wordmark | resolution statement, prepared-for | no prediction | light, not black | V3 full-black page |
| 30 | Method note & glossary | V3 symbol key / method note | V5 | glossary + conventions | general | internal states (`METHOD_SCOPE_BLOCKED`, ruleset ids) never printed | — |

## 3. Developer proof (evidence surface)

D01 glyph proof (27 assets, hashes, licence) · D02 ink-pass vs plain outline + `HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED` · D03 wordmark contract · D04 fact-slot bindings for every customer page · D05 18 executed negative guards (all pass) · D06 Wu Xing tie-and-zero fixture (V6, `etbz43/fixture/wu-xing-distribution/tie-and-zero-v1`) rendered through the customer template · D07–D08 V6 `pagination-stress-v1` fixture verbatim through the final layout (679 words → 2 pages → 79 lines · 0 findings) · D09–D10 layout evidence with fragment tables · D11 receipts.

## 4. Evidence summary (this build)

* Pages: 18 customer + 11 developer. DOM overlap/bounds scan on every rendered page: **0 findings**.
* Determinism: two full builds → 29/29 structural hashes identical, 29/29 PNG hashes identical, all merged artefacts byte-identical (`determinism-report.json`). Per-page PDFs differ only by Chromium's `/CreationDate` and trailer ID.
* `customer-sample.pdf` sha256 `2d9f1b42876ae08d61129c990a86c8db27a603499df3cbc53927e7f4f480e475` · `developer-proof.pdf` `b9f459a8…` · `tokens.json` `e8c6818d…` · `glyphs/manifest.json` `54f0ed0d…` · `assets/wordmark.svg` `c542552e…`.
* Customer surface scan for engineering vocabulary (hashes, fixture, METHOD_SCOPE_BLOCKED, rule ids, slot chrome): clean.
* All 27 pinyin labels tone-marked; branch character and animal label separated on every page.

## 5. Intentional deviations from the brief

1. **9 pt floor applied literally.** V4's 7–8 px labels were the most recognisable part of its refinement; they are lifted to 9 pt everywhere on the customer surface. Where that broke a V4 composition (hidden-stem chips, per-pillar hidden Ten-God lists) the information moved to page 11 rather than shrinking.
2. **Customer long-form prose.** The V6 677-word fixture is about typography and would read as nonsense in a customer PDF; it is kept verbatim as the developer-proof continuity fixture, and a 749-word customer-safe general-education chapter is the shipped stress proof.
3. **Birth timestamp not printed in the fixture.** V3's sample birth data does not produce V3's or V4's chart; printing a date next to a chart the template did not compute would fabricate a mapping. A real order prints the supplied fields in the same slot.
4. **Display glyph source.** V6 pinned Noto *Serif* CJK Regular; the V4 target is heavy sans. The final assets are extracted from Noto Sans CJK SC Black (same OFL basis, same pipeline) with a deterministic ink pass. This is an approximation of the V4 look, not an identification of the 金土木 reference — hence the open PO decision.
5. **V6 pagination re-implemented, not ported.** Same contract (cp, orphans/widows, atomic modules, no shrink), different measures (V2 column rhythm), plus one V4 rule (short final page → reference panel). The V6 fixture result therefore differs from V6's 3 pages/62 lines (here 2 pages/79 lines at wider measures) — a different layout, not a regression: 0 findings, every word placed in order.

## 6. Open items for the PO

* `HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED` — accept the ink-pass asset set, supply the reference face, or ship plain outlines.
* Interpretive chapters 15–26 are IA slots; they consume approved content-layer text that does not exist yet. The chapter template (12–14) is the proven container.
* Production renderer choice (V4 §15 / V6 ADR-0008) remains undecided; this build proves the layout contract with Chromium as harness only.
