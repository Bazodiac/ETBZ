# ADR 0019 — Canon v2: Interpretation Lens v2 and Terminology & Wording Lexicon v2 beside 1.x (ETBZ-77)

- **Status:** Accepted — Product Owner decision Canon v2 of 2026-10-04 (Confluence 85131265, version 2). The two
  contracts count as released once this ticket is green in `scripts/ci-verify.sh` on `main` (the hub's release
  rule); the merge commit and its CI run are recorded in Jira ETBZ-77, not here.
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
identity.

Until this slice the repository bound only the 1.x line. Bundle 1.0.0 and 1.1.0 are frozen by content hash, every
run and every piece of evidence made under them names their identities, and nothing in the code knew a 2.0
identity.

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
  as one would close a cycle.
- **Status and date.** Both are `CURRENT` with `releasedOn` 2026-10-04, the decision date both page headers name.

### 2. The content is the pages, verbatim, and nothing from 1.x

`semantic-envelope-v2.ts` carries C1 and `wording-boundaries-v2.ts` carries C5. Neither spreads a 1.x module: Canon
v2 replaces the 1.x contracts in content, so a 1.x block that C1 or C5 does not restate is not part of 2.0.0.

- **C1.** Every section is carried and every block names its section by C1's own heading. `(Kopf)` is the text
  above the first heading, `(Schluss)` the closing paragraph. A coverage check refuses a section no block cites.
  - The text is as the page renders it. Characters are unchanged: C1 closes its „…" quotations with a straight
    quote, and that is kept. Markdown emphasis and code marks are removed.
  - "Kapitellänge und Füllquote" is quoted for completeness, with the contract that decides each rule
    (`LONG_FORM`, `ANTI_BOILERPLATE`). The Lens decides neither.
- **C5.** The text is carried whole, block by block and line by line. `styleGuideV3Text()` joins it back into the
  page's code block: 3,846 UTF-8 bytes, 44 lines, SHA-256 `75527bf7…a09196`. SKILL.md 2.0.0 (ETBZ-91) must bind
  those bytes; this slice does not write it.
- **What contract data never holds.** It holds no number (C1's "1–2", "8–12", "≤ 15 %" are text), no fact, no
  method, operation or mapping key, and no `methodRefs`. The 2.0 line binds no method until Method Profile v2 is
  released (ETBZ-78); C1's method id `branch_animal_lore` appears only as part of a section heading.
- **The calibration paragraphs** are about the synthetic fixture chart 庚午 · 壬午 · 辛亥 · 乙未. They contain no
  Golden value and no birth data.

Where the 1.x blocks went:

| 1.x block | Under Canon v2 |
| --- | --- |
| Lens epistemic levels and their posture column; Lexicon uncertainty language | C1 Zone B (origin markers) and C5 WORTREGELN |
| Lexicon prohibited wording classes | C1 Zone A (red lines) and C5 WORTREGELN |
| Ten-God customer wording | C5 ROLLENNAMEN (roles) |
| Lens 1.1 voice invariants (Rebaseline section 17) | superseded at sentence level (section 3 below) |
| Ten-God semantic envelopes, depth operators, metaphor rule, anti-mystification, near-neighbour features, terminology matrix, unknown-time patterns | not restated by C1 or C5, so not part of 2.0.0. Canon v2 puts meaning in C3/C4 (Epic D); whether one of these blocks has a successor there is decided in those slices. |

### 3. What is superseded, and what stays in force

- **Contracts.** Each v2 contract supersedes exactly the released 1.x identities of its lineage: Lens 1.0.0 and
  1.1.0, Lexicon 1.0.0 and 1.1.0. The record is part of its frozen content and quotes C1's replacement sentence.
  Each superseded identity stays resolvable under its own 1.x bundle. A test resolves it and checks its page.
- **Rebaseline section 17** is recorded as superseded by the Lens line, with C1's limit "soweit es um Sicherheit
  auf Satzebene geht". What of section 17 stays in force:
  - **Grounding stays.** No meaning beyond accepted facts, claims and methods: hub precedence 2 (fail-closed,
    FuFirE as the only source of facts, mandatory citation), C1 Zone A item 5 and C5 GRUNDSATZ.
  - **Contract versioning stays.** New versions beside the old, never a rewrite.
  - **Structured animal display stays.** Every displayed Earthly Branch shows its Hanzi, pinyin and animal (as
    clarified in section 20). That is a presentation rule, not sentence-level safety.
  - **The animal-interpretation ban yields to C1, later.** Section 17 forbids reading the year animal as
    personality. C1's animal-lore contract allows it under sources and a binding duty. Under hub precedence 3 C1
    wins, but only once `branch_animal_lore` is released (ETBZ-78) and an entry is sourced (ETBZ-95). Until then
    every entry is `SOURCE_NEEDED` and authorises no customer interpretation.
- **The Rebaseline page itself** does not yet say that section 17 is superseded (version 23 at this slice's start).
  An addendum pointing to Canon v2 and this ADR is part of the ETBZ-77 closeout.

### 4. The 2.0 context

`PLAN_CONTRACT_BINDINGS_V2_0` is the Lexicon/Lens pair a Canon v2 run binds: the pair bundle 2.0.0 (ETBZ-81) will
name as its plan bindings. `assertCanonV2ContractBindings` accepts a pair for that context or refuses it. The
input is untrusted, parsed strictly, and never returned (the repository's pair is):

| Input | Code |
| --- | --- |
| a 1.0.0 or 1.1.0 Lens or Lexicon (or any other version of the lineage, e.g. 2.0.1) in its slot | `CONTRACT_DRIFT`, naming the released 2.0.0 identity and that a 1.x identity resolves only under its own bundle |
| a v2 identity in the other slot (swapped, or the Lexicon twice) | `BUNDLE_BINDING_MISMATCH` |
| the right identity on another page or page version | `CONTRACT_SOURCE_MISMATCH` |
| an unknown name or a page address | `UNKNOWN_CONTRACT_IDENTITY` |
| a missing slot | `REQUIRED_CONTRACT_MISSING` |
| any other shape (extra key, number, null, list, string) | `BUNDLE_SCHEMA_INVALID` |

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
  - Lens `sha256:a33711ca810fb8770d56a85646301dca02fed15a9b2aae9ed7d50baf52a351bd`;
  - Lexicon `sha256:d2f6d5a9b242713caac16d955de5c87e9b040b505d217c45265dd1afe038fe88`.

  A changed rule, page version or precedence is a new version with a new hash, never an edit. A status edit of the
  hub is not such a change: the hub is bound by page and section, like `PARENT_DECISION`.
- **1.x byte baseline.** The eight 1.x contract modules (including `skill-contract-bundle.ts` and the plan
  bindings in `meta-narrative-plan.ts`) and the fourteen files of both 1.x Skill packages are compared, byte for
  byte, with their SHA-256 at the base commit. The table is written once in `tests/support/etbz77Evidence.ts`, so
  regenerating the evidence cannot launder an in-place edit. All 22 were identical at the base.
- **Mutation proof.** `scripts/verify-etbz77-contracts-v2.mjs` (step "guards :: ETBZ-77" of `ci-verify.sh`,
  registered in `ci-contract.test.ts`) weakens eight guards. Each named test must fail an assertion:
  - three "v2 ref → 1.1 ref" mutants: the Lens slot, the Lexicon slot and the Lens source;
  - the drift refusal;
  - an in-place 1.1 edit no bundle hash sees;
  - a dropped red line;
  - a voice binding to another C5 version;
  - the section coverage check.
- **Evidence.** `docs/evidence/etbz-77/contracts-v2/contracts-v2.json` records identities, page bindings, hashes,
  the 2.0 context's answer to each binding case, the historical 1.x resolution and the baseline. The contract
  suite re-derives it byte for byte.

## Consequences

- ETBZ-78, -79 and -80 add Method Profile, Anti-Boilerplate and Long-Form v2 as further keys of the 2.0 line.
  ETBZ-81 then builds bundle 2.0.0 from `CANON_V2_CONTRACT_SOURCES`, `SEMANTIC_ENVELOPE_V2`,
  `WORDING_BOUNDARIES_V2` and `PLAN_CONTRACT_BINDINGS_V2_0`, and composes `assertCanonV2ContractBindings`. The v2
  content already satisfies the bundle's own data guard: strings only, and none of its refused keys.
- Nothing enforces the rules yet. The gates are Epic B, and the Skill that writes in C5's voice is Epic C. Until
  they release, the 1.x runtime stays the only executable path, but the hub forbids using it for new
  interpretation, voice or design work.
- ETBZ-116 leaves open whether the text-level Prüffrage (C1 Vorstoß part 5, C5 REFLEXIONSFRAGE) stays. This
  slice binds C1 v1 and C5 v1 as they are. If the Product Owner changes either page, the result is a new page
  version and a new contract version (2.0.x or 2.1.0) with a new hash. 2.0.0 is never edited.
- The CI job runs close to its 30-minute limit (main: 29.4 min in run 37089150274). This slice adds one mutation
  step: 17 s locally, 8 mutants plus two baseline runs. The limit is not raised here.

## What this ADR does not decide

No method, fact kind, claim, relation, plan field, reading-schema field, gate, Skill package, template or renderer
is added or changed. Whether the text-level Prüffrage stays (ETBZ-116) and the WIP question for Epic E remain with
the Product Owner. The Golden run (ETBZ-33/54) stays frozen.
