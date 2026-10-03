# ETBZ-68 visual review checklist (synthetic design-review fixture)

This is a synthetic design-review document, **not a customer artifact**: the synthetic known-time
development chart (Musterkundin A, no real birth data) and a neutral placeholder corpus about paper,
type and book-making. The body text is placeholder; review the **design**, not the prose.

Generated from `page-behaviour-map.json`. That file is read from the projection the renderer drew,
not from intent. The PO fills in the last column and the verdict below.

| Page | Render | What the page exercises | PO note |
| --- | --- | --- | --- |
| 1 | `pages/01-cover.png` | Cover: wordmark, Day Master glyph 辛, title, prepared-for name | |
| 2 | `pages/02-identity.png` | Identity / document note ("Über dieses Dokument") | |
| 3 | `pages/03-contents.png` | Contents: front matter, chart pages, the seven chapters with their start pages, closing pages | |
| 4 | `pages/04-glance.png` | Chart at a Glance: Day Master, four pillars, Wu Xing values as delivered | |
| 5 | `pages/05-four-pillars.png` | Four Pillars: stems and branches with pinyin and animal label, hidden stems, fact-bound phase colours | |
| 6 | `pages/06-foundation.png` | Foundation ("Die acht Zeichen"): the eight characters with pinyin, animal and phase | |
| 7 | `pages/07-day-master.png` | Day Master: glyph, day pillar, hidden stems of the day branch (two slots without approved content stay empty by design) | |
| 8 | `pages/08-wu-xing-distribution.png` | Wu Xing Distribution: all five phases with values as delivered | |
| 9 | `pages/09-five-phases.png` | Five Phases Education (general, separate from the chart distribution) | |
| 10 | `pages/10-ten-gods.png` | Ten Gods: relation table to the Day Master | |
| 11 | `pages/11-hidden-stems.png` | Hidden Stems per branch with Qi roles | |
| 12 | `pages/12-chapter-01-p1.png` | Chapter 1, page 1: opener; two columns; paragraph split across the columns; paragraph continues on the next page; short paragraph; long paragraph (fill 1) | |
| 13 | `pages/13-chapter-01-p2.png` | Chapter 1, page 2: continuation; one column; paragraph continues on the next page; paragraph continued from the previous page; short paragraph; long paragraph; dense page with sidebar (fill 0.978) | |
| 14 | `pages/14-chapter-01-p3.png` | Chapter 1, page 3: continuation; one column; paragraph continued from the previous page; 2-line orphan/widow boundary; sparse final page with reference panel (fill 0.17) | |
| 15 | `pages/15-chapter-02-p1.png` | Chapter 2, page 1: opener; two columns; short paragraph; long paragraph (fill 1) | |
| 16 | `pages/16-chapter-02-p2.png` | Chapter 2, page 2: continuation; one column; paragraph moved whole to this page; long paragraph; sparse final page with reference panel (fill 0.468) | |
| 17 | `pages/17-chapter-03-p1.png` | Chapter 3, page 1: opener; two columns; paragraph split across the columns; long paragraph (fill 1) | |
| 18 | `pages/18-chapter-03-p2.png` | Chapter 3, page 2: continuation; one column; paragraph moved whole to this page; long paragraph; dense page with sidebar (fill 0.745) | |
| 19 | `pages/19-chapter-04-p1.png` | Chapter 4, page 1: opener; two columns; paragraph split across the columns; long paragraph (fill 1) | |
| 20 | `pages/20-chapter-04-p2.png` | Chapter 4, page 2: continuation; one column; paragraph moved whole to this page; long paragraph; dense page with sidebar (fill 0.702) | |
| 21 | `pages/21-chapter-05-p1.png` | Chapter 5, page 1: opener; two columns; paragraph split across the columns; short paragraph; long paragraph (fill 1) | |
| 22 | `pages/22-chapter-05-p2.png` | Chapter 5, page 2: continuation; one column; paragraph moved whole to this page; long paragraph; sparse final page with reference panel (fill 0.532) | |
| 23 | `pages/23-chapter-06-p1.png` | Chapter 6, page 1: opener; two columns; long paragraph (fill 0.975) | |
| 24 | `pages/24-chapter-06-p2.png` | Chapter 6, page 2: continuation; one column; paragraph moved whole to this page; long paragraph; sparse final page with reference panel (fill 0.511) | |
| 25 | `pages/25-chapter-07-p1.png` | Chapter 7, page 1: opener; two columns; paragraph split across the columns; 2-line orphan/widow boundary; short paragraph; long paragraph (fill 1) | |
| 26 | `pages/26-chapter-07-p2.png` | Chapter 7, page 2: continuation; one column; paragraph moved whole to this page; long paragraph; sparse final page with reference panel (fill 0.511) | |
| 27 | `pages/27-reflection.png` | Reflection ("Fragen zur Reflexion"): pillar strip and four reflection questions | |
| 28 | `pages/28-summary.png` | Summary ("Dein Chart in Kürze") | |
| 29 | `pages/29-closing.png` | Closing: title, prepared-for name, wordmark | |
| 30 | `pages/30-method-note.png` | Method / data note ("Methodenhinweis") with the data note box | |

## Not rendered in this fixture (PO decision 2026-10-03, scope A)

| Component | Why |
| --- | --- |
| ChapterDivider | No such component exists in the template contract, `src/` or `tools/` (ADR 0012 limitation 1). It is open on ETBZ-43 (AC 2/5/10, comment 17069). |
| ChartMotifSummary | No such component exists, and the projection has no motif input (ADR 0012 limitation 1, ETBZ-43). |
| KeyInsightPanel | `pages.py` can draw it, but the released content schema accepts only paragraphs. Exposing it would change production code. |
| Pull quote | Same as KeyInsightPanel. |

Each chapter opener shows only the kicker ("KAPITEL 0n") and the title. That is the existing
opener header, not a ChapterDivider.

## Verdict (Human Product Owner)

Choose exactly one:

- [ ] `VISUAL_DESIGN_ACCEPTED_FOR_CONTENT_REVIEW`
- [ ] `CHANGES_REQUIRED` (list the pages and changes)

Verdict: _pending_
