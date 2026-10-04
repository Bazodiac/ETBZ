# ADR 0019 — Canon v2: Interpretation Lens v2 and Terminology & Wording Lexicon v2 beside 1.x (ETBZ-77)

- **Status:** Proposed — the ETBZ-77 candidate. Following the repository's ADR convention (CLAUDE.md, "Working
  notes"), the merge commit is recorded in this line by a docs closeout after the merge. Until then Jira ETBZ-77
  records the merge commit, its CI run and the Product Owner's merge authorisation.
- **Date:** 2026-10-04
- **Slice:** ETBZ-77 [CANON-V2/A1], the first slice of Epic ETBZ-69 (Verträge v2). It does not touch Method
  Profile, Long-Form or Anti-Boilerplate (ETBZ-78, -80, -79), Skill Contract Bundle 2.0.0 (ETBZ-81), any gate
  (Epic B), SKILL.md 2.0.0 (ETBZ-91), the meaning lexicon (Epic D), the template or the renderer (Epic E).
- **Base:** `main@cb7605e58bee57cfff68c2a3b0a6a889ca1634c6`.
- **Canonical product text:** Canon v2 hub `85131265` v2 (precedence, zones); C1 "Interpretationsregeln v2"
  `85229569` v1; C5 "Style Guide v3" `85164034` v1; Jira ETBZ-77 and its parent ETBZ-69.
- **Number:** Jira ETBZ-77 and the Canon v2 Coding-Plan (`85065745` v1) planned this record as "ADR 0018 Canon
  v2". `main` already holds `0018-wuxing-weight-display-text.md` (ETBZ-61, PR #27 and #29), and no remote branch
  holds a 0019. The record is therefore 0019. This is a numbering repair, not a product change; the two places that
  name 0018 are reconciled to 0019 after the merge.

## Context

On 2026-10-04 the Product Owner made Canon v2 the authority for new interpretation, method, voice and design
work. Its hub states the precedence: Canon v2 replaces in content the Interpretation Lens 1.0/1.1, the
Terminology & Wording Lexicon 1.0/1.1 and Rebaseline 62128133 section 17 as far as sentence-level safety goes
(plus parts of Anti-Boilerplate 1.1, Long-Form 1 and Method Profile 1 that later slices handle). The repository's
process and integrity rules stay in force: a contract is released only as a new version beside the old one, with
its own release identity, an ADR, a hash freeze and a mutation proof per gate. If Canon v2 conflicts with an
existing page or ticket, Canon v2 wins; if it conflicts with a red line (Zone A), the red line wins.

Two of its pages carry the rules that replace the Lens and the Lexicon. C1 says what may be said and with which
origin marker: zones A, B and C, the Vorstoß, light/shadow and animal-lore contracts, tension, count words and
numbers. C1 hands voice and wording to C5 ("Stimme und Formulierung regelt verbindlich: C5 Style Guide v3"), and
C5 declares its own text "wörtlich verbindlich" and not to be paraphrased. Neither page publishes a release
identity. The hub records the decision; it does not name identities or this ADR.

Until this slice the repository bound only the 1.x line: bundles 1.0.0 and 1.1.0, frozen by content hash, and the
runs and evidence made under them. No source module named a 2.x identity of either lineage; tests used one only as
an unreleased reference the 1.x boundaries refuse.

## Decision

### 1. Two identities on the existing lineages, assigned here

| Contract | Identity | Page | Owns | Depends on |
| --- | --- | --- | --- | --- |
| Interpretation Lens v2 | `grounded-reflective-synthesis-lens@2.0.0` | C1 `85229569` v1 | `SEMANTIC_ENVELOPE` | `METHOD_PROFILE` |
| Terminology & Wording Lexicon v2 | `terminology-wording-lexicon@2.0.0` | C5 `85164034` v1 | `CUSTOMER_WORDING` | `INTERPRETATION_LENS` |

- **Why these names.** C1 and C5 publish no identity, so this ADR assigns them. Keeping the lineage names makes a
  1.x reference *another version of the same contract*. The 2.0 context can then refuse a 1.1 reference by name and
  point at the released 2.0.0 one, instead of treating it as an unknown string.
- **Domains.** Each v2 contract decides exactly the domain its lineage decided in 1.x (checked:
  `PRECEDENCE_CONFLICT` otherwise). C1 owns semantic permission, C5 owns voice and wording.
- **Dependencies.** Neither page has a "Normative dependencies" section. The dependencies recorded are the ones
  the pages state in their text. C1 Zone A item 7 binds every method to Method Profile v2. C5's header concedes
  precedence to the red lines of C1. C1's hand-over of voice to C5 is a delegation, not a dependency; recording it
  as one would close a cycle, which the validator refuses (`PRECEDENCE_CONFLICT`).
- **Status and date.** Both are `CURRENT` with `releasedOn` 2026-10-04, the decision date both page headers name.

### 2. The content is the pages, verbatim, and nothing from 1.x

`semantic-envelope-v2.ts` carries C1 and `wording-boundaries-v2.ts` carries C5. Neither spreads a 1.x module: Canon
v2 replaces the 1.x contracts in content, so no 1.x block is part of 2.0.0.

- **C1.** Every section is carried and every block names its section by C1's own heading. A coverage check refuses
  a section no block cites.
  - `(Kopf)` is the header above the first heading. Its rules and its status ("Normative Zielarchitektur.") are
    carried as text. Its decision line is held structurally: the Canon v2 decision record and `releasedOn`. Its
    "Ersetzt …" paragraph is the supersession record. `(Schluss)` is the closing paragraph.
  - The text is as the page renders it. Characters are unchanged: C1 closes its „…" quotations with a straight
    quote, and that is kept. Markdown emphasis and code marks are removed.
  - "Kapitellänge und Füllquote" is quoted for completeness, with the contract that decides each rule
    (`LONG_FORM`, `ANTI_BOILERPLATE`). The Lens decides neither.
- **C5.** The text is carried whole, block by block and line by line. `styleGuideV3Text()` joins it back into the
  page's code block: 3,846 UTF-8 bytes, 44 lines, SHA-256 `75527bf7…a09196`. It was compared with the code block
  text of the page's ADF (version 1) as the Atlassian connector returned it, byte for byte, and is identical. SKILL.md 2.0.0 (ETBZ-91) must bind those bytes; this slice does
  not write it.
- **What contract data never holds.** It holds no number (C1's "1–2", "8–12", "≤ 15 %" are text), no fact, no
  method, operation or mapping key, and no `methodRefs`. The 2.0 line binds no method until Method Profile v2 is
  released (ETBZ-78); C1's method id `branch_animal_lore` appears only as part of a section heading.
- **The calibration paragraphs** are about the synthetic fixture chart 庚午 · 壬午 · 辛亥 · 乙未. They contain no
  Golden value and no birth data.

Where the 1.x blocks went. All 39 top-level blocks of the 1.0/1.1 Lens envelopes (23) and Lexicon wording
boundaries (16) are superseded: none of them is part of 2.0.0, and all of them stay in 1.0.0/1.1.0 for the runs bound
there. The right column only points a reader to the C1/C5 section that addresses the same topic. It claims no
equivalence and no coverage; "none" means no C1/C5 section addresses the topic. Canon v2 puts meaning in C3/C4
(Epic D) and judging in C8 (Epic F); whether a block has a successor there is decided in those slices.
`tests/contract/etbz77-contracts-v2.contract.test.ts` holds the list of blocks to the code.

| 1.x block | Related C1/C5 section (orientation only) |
| --- | --- |
| `Lens.epistemicLevels`, `Lens.epistemicHardLaw`, `Lens.epistemicHardLawReading` | C1 Zone B |
| `Lens.uncertaintyCarriedNotAdded`, `Lexicon.uncertaintyCarriedNotAdded`, `Lexicon.uncertaintyLanguage` | C1 Zone B (the row "Vorläufig"); C5 WORTREGELN |
| `Lens.languagePosture`, `Lexicon.globalLanguageRules` | C5 ZIELSTIMME and WORTREGELN; C1 Zone B; C1 "Ausdrücklich abgeschafft" |
| `Lens.tensionRule`, `Lens.depthOperators` | C1 Spannung |
| `Lens.reflectionJobs`, `Lexicon.reflectionBoundary` | C5 REFLEXIONSFRAGE and ZIELSTIMME; C1 Zone A |
| `Lens.antiMystificationForbidden`, `Lexicon.prohibitedWordingClasses` | C1 Zone A; C5 ZIELSTIMME and WORTREGELN |
| `Lens.barnumRiskPatterns`, `Lens.nearNeighbourFeatures` | C5 SPEZIFITÄTSTEST |
| `Lens.tenGodFamilies`, `Lens.tenGodVariants`, `Lens.variantHardRule`, `Lexicon.tenGodFamilyWording`, `Lexicon.tenGodRelationWording`, `Lexicon.tenGodsHardRule` | C5 ROLLENNAMEN (role names only) |
| `Lexicon.antiPhraseBankRule` | C5 DEUTUNGSKETTE |
| `Lexicon.unknownTimeRules`, `Lexicon.unknownTimePatterns`, `Lexicon.unknownTimePlacement` | C1 Zone B (the row "Vorläufig") |
| `Lexicon.chartTerminology` | C1 Zone C (the pillars as classical rooms) |
| `Lens.metaphorRule`, `Lexicon.metaphorConditions` | C1 Zone C (images) |
| `Lens.voiceInvariants` | Rebaseline section 17, superseded at sentence level (section 3 below) |
| `Lens.surfaceInteriorNeverInfer`, `Lens.claimTypes`, `Lens.alternativeBinding`, `Lexicon.sourceWarningWording`, `Lexicon.customerWordingIsAnAnchor` | none |
| `Lens.evaluationDimensions`, `Lens.llmJudgeNeverSoleOracleFor`, `Lens.voiceEvaluationDimensions`, `Lens.voiceReviewLabels` | none (judging is C8, Epic F) |

### 3. What is superseded, and what stays in force

- **Contracts.** Each v2 contract supersedes exactly the released 1.x identities of its lineage: Lens 1.0.0 and
  1.1.0, Lexicon 1.0.0 and 1.1.0. The record is part of its frozen content and quotes C1's replacement sentence.
  Each superseded identity stays resolvable under its own 1.x bundle; a test resolves each and checks its page and
  page version.
- **Rebaseline section 17** is recorded as superseded by the Lens line, with C1's limit "soweit es um Sicherheit
  auf Satzebene geht". What of section 17 stays in force:
  - **Grounding stays.** No meaning beyond accepted facts, claims and methods: hub precedence 2 (fail-closed,
    FuFirE as the only source of facts, mandatory citation), C1 Zone A item 5 and C5 GRUNDSATZ.
  - **Contract versioning stays.** New versions beside the old, never a rewrite.
  - **Structured animal display stays.** Every structured display of an Earthly Branch shows its Hanzi, pinyin and
    animal (section 17, as narrowed by section 20). That is a presentation rule, not sentence-level safety.
  - **The animal-interpretation ban yields to C1, later.** Section 17 forbids reading the year animal as
    personality. C1's animal-lore contract allows it under sources and a binding duty. Under hub precedence 3 C1
    wins, but only once `branch_animal_lore` is released (ETBZ-78) and an entry is sourced (ETBZ-95). Until then
    every entry is `SOURCE_NEEDED` and authorises no customer interpretation.
- **The Rebaseline page itself** does not yet say that section 17 is superseded (version 23 at this slice's start).
  An addendum pointing to Canon v2 and this ADR is part of the ETBZ-77 closeout.

### 4. The 2.0 context

`PLAN_CONTRACT_BINDINGS_V2_0` is the Lexicon/Lens pair a Canon v2 run binds: the pair bundle 2.0.0 (ETBZ-81) will
name as its plan bindings. `assertCanonV2ContractBindings` accepts a pair for that context or refuses it. The
input is untrusted: the root and each slot must be plain objects, the shape is parsed strictly, and the input is
never returned (the repository's pair is):

| Input | Code |
| --- | --- |
| a 1.0.0 or 1.1.0 Lens or Lexicon (or any other version of the lineage, e.g. 2.0.1) in its slot | `CONTRACT_DRIFT`, naming the released 2.0.0 identity and that a 1.x identity resolves only under its own bundle |
| a v2 identity in the other slot (swapped, or the Lexicon twice) | `BUNDLE_BINDING_MISMATCH` |
| the right identity on another page or page version | `CONTRACT_SOURCE_MISMATCH` |
| an unknown name or a page address | `UNKNOWN_CONTRACT_IDENTITY` |
| a missing or undefined slot | `REQUIRED_CONTRACT_MISSING` |
| any other shape (extra key, number, null, list, string, a non-plain object at the root or in a slot, a getter that throws) | `BUNDLE_SCHEMA_INVALID` |

`resolveCanonV2Contract` resolves only the 2.0.0 identities; a 1.x identity is `UNKNOWN_CONTRACT_IDENTITY` there,
naming the 2.0.0 one. `buildCanonV2Contract` refuses a key the 2.0 line does not release yet (Method Profile,
Long-Form, Anti-Boilerplate). `assertCanonV2ContractSet` builds the whole line, deterministically, and holds the
repository's own pair to the released sources. The 1.x boundaries are unchanged:
- `buildSkillContractBundle()` still defaults to 1.0.0;
- bundles 1.0.0 and 1.1.0 build to their released hashes;
- `assertRunEvidenceBound` still binds a 1.x run to its 1.x bundle.

### 5. Integrity

- **Hash freeze.** `RELEASED_CANON_V2_CONTRACT_HASHES` freezes each contract over its Canon v2 decision (including
  the quoted precedence), its source, what it supersedes and its content:
  - Lens `sha256:638eef2dcb822ed94f70002947c642fcf112f8d23f58390825a5c5fdd59178ea`;
  - Lexicon `sha256:f6c40f7a2383690225b684c89cda4bd3d146c97383c59c78531e33b7a05b67d6`.

  A changed rule, page version, dependency, supersession or precedence is a new version with a new hash, never an
  edit. The validator checks the JSON shape and the invariants; the freeze, not the validator, pins the exact
  values. The hub is bound by page id, title, decision date and the text of its precedence section, not by page
  version: an edit elsewhere on the hub (its status lines, for example) re-releases nothing.
- **1.x byte baseline.** The five 1.x contract value modules (Lens, Lexicon and Anti-Boilerplate tables 1.0/1.1)
  and the fourteen files of both 1.x Skill packages are compared, byte for byte, with their SHA-256 at the base
  commit. All 19 were identical at the base. The table is written once in `tests/support/etbz77Evidence.ts`, so
  regenerating the evidence cannot launder an in-place edit.

  Shared machinery is not pinned by bytes: the bundle builder, the plan module and the source tables are what
  ETBZ-80/81 must extend. What that machinery binds for 1.x is held by the contract suite instead:
  - the sources, envelopes, wording, tiers and repository markers are inside the two released bundle hashes, which
    the suite pins to their values at the base;
  - the 1.x plan bindings are not inside those hashes. The suite pins both pairs (`PLAN_CONTRACT_BINDINGS_V1_0`,
    `_V1_1`) to their values at the base, and the bundle build refuses a plan binding that disagrees with its
    contracts (`BUNDLE_BINDING_MISMATCH`).
- **Mutation proof.** `scripts/verify-etbz77-contracts-v2.mjs` (step "guards :: ETBZ-77" of `ci-verify.sh`,
  registered in `ci-contract.test.ts`) runs nine mutants; each named test must fail an assertion.
  - Three weaken guard code: the drift refusal, the page-id half of the source check, and the section coverage
    check.
  - Six inject a defect the freeze, the baseline or a binding test must catch: three "v2 ref → 1.1 ref" mutants
    (the Lens slot, the Lexicon slot, the Lens source), an in-place 1.1 edit no bundle hash sees, a dropped red
    line, and a voice binding to another C5 version.
- **Evidence.** `docs/evidence/etbz-77/contracts-v2/contracts-v2.json` records identities, page bindings, hashes,
  the 2.0 context's answer to each binding case, the historical 1.x resolution and the baseline. The contract
  suite re-derives it byte for byte. The mutation protocol and the gate run are recorded beside it.

## Consequences

- **Forward work.** ETBZ-78, -79 and -80 release Method Profile, Anti-Boilerplate and Long-Form v2 beside these.
  The 2.0-line module accepts only the two keys and only 2.0.0 today, so those slices extend it or add their own:
  - Long-Form has no 1.x identity to continue (its 1.x binding is a page address);
  - a later 2.0.x or 2.1.0 needs a version table beside 2.0.0, not a replacement of it.
- **Bundle 2.0.0 (ETBZ-81)** composes `CANON_V2_CONTRACT_SOURCES`, `SEMANTIC_ENVELOPE_V2`, `WORDING_BOUNDARIES_V2`
  and `PLAN_CONTRACT_BINDINGS_V2_0`. It must also carry the 1.1-reference refusal of `assertCanonV2ContractBindings`
  at bundle level: this slice proves that refusal in the 2.0 context, not yet under a 2.0.0 bundle. The v2 content
  already satisfies the bundle's own data guard: strings only, and none of its refused keys.
- **Precedence in bundle 2.0.0.** The 1.x `PRECEDENCE_TIERS` rank Method Profile and Long-Form above the Lens, and
  every bundle version is built under `PARENT_DECISION` (Rebaseline section 4). Canon v2 puts the red lines, which
  live in the Lens v2, above everything. Bundle 2.0.0 has to record that precedence and its parent decision; this
  slice does not change the 1.x tiers.
- **Nothing enforces the rules yet.** The gates are Epic B, and the Skill that writes in C5's voice is Epic C.
  Until they release, the 1.x runtime stays the only executable path, but the hub forbids using it for new
  interpretation, voice or design work.
- **ETBZ-116.** It leaves open whether the text-level Prüffrage (C1 Vorstoß part 5, C5 REFLEXIONSFRAGE) stays. This
  slice binds C1 v1 and C5 v1 as they are. If the Product Owner changes either page, the result is a new page
  version and a new contract version with a new hash. The pair moves together: each v2 contract binds the other's
  page version (the Lens's voice authority, the Lexicon's red-lines binding), so a new C5 version also gives the
  Lens a new version. 2.0.0 is never edited.
- **CI budget.** The CI job runs close to its 30-minute limit (main: 29.4 min in run 37089150274). This slice adds
  one mutation step of nine mutants and two baseline runs; the recorded mutation protocol gives its measured
  duration. The limit is not raised here.

## What this ADR does not decide

No method, fact kind, claim, relation, plan field, reading-schema field, gate, Skill package, template or renderer
is added or changed. Whether the text-level Prüffrage stays (ETBZ-116) and the WIP question for Epic E remain with
the Product Owner. The Golden run (ETBZ-33/54) stays frozen.
