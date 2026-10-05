# ADR 0020 — Canon v2 forward fix: Interpretation Lens and Terminology & Wording Lexicon 2.1.0 on C1/C5 page version 2 beside the A1 2.0.0 pair (ETBZ-117)

- **Status:** Proposed — the ETBZ-117 candidate. Following the repository's ADR convention (CLAUDE.md, "Working
  notes"), the merge commit is recorded in this line by a docs closeout after the merge. Until then Jira ETBZ-117
  records the merge commit, its CI runs and the Product Owner's merge authorisation.
- **Date:** 2026-10-05
- **Slice:** ETBZ-117 [CANON-V2/R0], the pre-A2 canonical reconcile between the released A1 (ETBZ-77, ADR 0019) and
  Method Profile v2 (ETBZ-78). It does not touch Method Profile, Anti-Boilerplate or Long-Form (ETBZ-78, -79, -80),
  Skill Contract Bundle 2.0.0 (ETBZ-81), any gate, the Skill, the meaning lexicon, the template or the renderer.
- **Base:** `main@9362f4e21504bc5e01e8ef7ab29507778a8582cc` (the merge of ETBZ-77, PR #31).
- **Canonical product text:** Canon v2 hub `85131265` v3 (precedence unchanged since v2; "Pre-A2 reconcile
  decision — 2026-10-05"); C1 "Interpretationsregeln v2" `85229569` v2; C5 "Style Guide v3" `85164034` v2; Jira
  ETBZ-117 and ETBZ-116.
- **Number:** 0020 is the next free number: `main` holds 0001–0019, and no remote branch or open pull request holds
  a 0020 (checked on 2026-10-05 across all 33 remote refs).

## Context

ETBZ-77 released `grounded-reflective-synthesis-lens@2.0.0` on C1 `85229569` v1 and
`terminology-wording-lexicon@2.0.0` on C5 `85164034` v1, hash-frozen (ADR 0019). On 2026-10-05 the Product Owner
decided the question ETBZ-116 had held open: the reflection question stays, as a rhetorical, non-interactive text
impulse; there is no mandatory Ja / Nein / Teilweise answer and no answer affordance, and page 26 stays a read-only
reflection page. C1 and C5 carry the decision at page version 2. C1 version 2 also says how it is released: the 2.0.0
identities stay bound to the previous page versions and are not changed in place; the updated rule is released as a
new immutable contract identity before ETBZ-78.

The released 2.0.0 contracts therefore no longer bind the current pages. ETBZ-78 would build on them. A forward fix
is required, and A1 must stay exactly as released.

What page version 2 changes, measured with the Confluence version diff (v1 → v2) of each page:

| Page | Place | Version 1 | Version 2 |
| --- | --- | --- | --- |
| C1 | header | — | adds the paragraph "PO-Reconcile 2026-10-05 (ETBZ-117 / ETBZ-116): …" |
| C1 | Zone B, row Vorstoß | "pointiert, widerlegbar, mit Prüffrage" | "pointiert, widerlegbar, mit nicht-interaktiver Reflexionsfrage" |
| C1 | Vorstoß-Kontrakt, part 5 | "eine Prüffrage, beantwortbar mit Ja / Nein / Teilweise." | "eine Reflexionsfrage als rhetorischen Textimpuls, ohne verpflichtendes Antwortformat oder Antwortoptionen." |
| C5 | code block, REFLEXIONSFRAGE | "Direkt, mit Ja / Nein / Teilweise beantwortbar, …" | "Direkt, als rhetorischer Textimpuls … verständlich. Kein verpflichtendes Antwortformat, keine Ja/Nein/Teilweise-Optionen und keine Antwort-Affordance. …" |
| C5 | code block, ZIEL | "„Ja, genau so" oder „Nein, das bin ich nicht". …" | "Der Text soll klare Resonanz oder klaren Widerspruch auslösen. …" |

Nothing else on either page changed, except that C5's code block lost its closing line feed (section 2). From version
2 to version 3 the hub changed its implementation-status line and
its repository observation and added the reconcile decision; its title, decision date and precedence section, which
every v2 contract quotes and freezes, are unchanged.

## Decision

### 1. Two new identities, 2.1.0, beside 2.0.0

| Contract | Identity | Page | Released on | Content hash (`RELEASED_CANON_V2_1_CONTRACT_HASHES`) |
| --- | --- | --- | --- | --- |
| Interpretation Lens | `grounded-reflective-synthesis-lens@2.1.0` | C1 `85229569` v2 | 2026-10-05 | `sha256:b931ae4e2e0f5c8c64f9b4cc143a189247e74d62a99a79952b8822da74d8f983` |
| Terminology & Wording Lexicon | `terminology-wording-lexicon@2.1.0` | C5 `85164034` v2 | 2026-10-05 | `sha256:11a03b11099d77b0c55f4f30317793a2952af58120522bef92bf42cbc34115c4` |

- **Why 2.1.0.** Page version 2 changes a rule of a released contract. On these lineages a changed rule is a new
  minor version: Lens and Lexicon 1.0.0 became 1.1.0 for the ETBZ-57 voice revision (ADR 0013). A patch version
  (2.0.1) would claim that no rule changed. A new major (3.0.0) would claim a new Canon decision; the decision, its
  precedence, the pages and the domains are the same. ADR 0019 named "a later 2.0.x or 2.1.0" as the shape of a
  later version, beside 2.0.0.
- **Both move.** Each v2 contract binds the other's page version: the Lens hands voice to the Lexicon, and the
  Lexicon concedes the red lines to the Lens. A new C5 version therefore also gives the Lens a new version, as ADR
  0019 recorded. Both are 2.1.0.
- **Released on.** 2026-10-05, the date of the Product Owner's reconcile decision (C1 v2 header, hub v3). It is
  not a page-version timestamp. For the Lexicon this departs from the rule of ADR 0010 and ADR 0019 (the decision
  date in the contract's own page header): C5 version 2 changed its code block but not its header, which still names
  only the Canon v2 decision of 2026-10-04. The decision that changed C5 is the pair's shared reconcile of
  2026-10-05 (C1 v2 header, hub v3, C5 version message "ETBZ-117: …"), so both 2.1.0 contracts carry that date.
- **Title, domain, dependency** are 2.0.0's: the Lens owns `SEMANTIC_ENVELOPE` and depends on `METHOD_PROFILE`; the
  Lexicon owns `CUSTOMER_WORDING` and depends on `INTERPRETATION_LENS`.

### 2. The content is the pages at version 2: 2.0.0 with exactly the page delta

`semantic-envelope-v2-1.ts` and `wording-boundaries-v2-1.ts` take every block page version 2 left unchanged from the
2.0.0 modules, and replace exactly the places the table above lists, plus each contract's binding of the other
(version 2). The text rules of ADR 0019 section 2 hold unchanged: C1 as the page renders it, characters unchanged,
emphasis and code marks removed; C5 whole, block by block and line by line. The C1 header paragraph is carried with
its label as `pageRules.poReconcile`. Vorstoß part 5 is labelled `REFLEXIONSFRAGE` (the label is this module's, not
page text; 2.0.0 keeps `PRUEFFRAGE`).

- The unit suite holds the delta to the code: the structural difference between the 2.0.0 and 2.1.0 content is
  exactly six paths for the Lens and four for the Lexicon (`docs/evidence/etbz-117/canon-v2-1/canon-v2-1.json`,
  `pageVersionDelta`).
- The code block of C5 version 2, as the page's ADF returned it through the Atlassian connector, is 3,949 UTF-8 bytes
  and 44 lines, SHA-256 `19d30903c654c13574731e5865c71176e0ef4310384ee05ec5ee5a1fe4c114b8`, and ends without a line
  feed; ADR 0019 recorded the version 1 block with its closing line feed. The 2.1.0 content is the block's lines;
  `styleGuideV3Text(STYLE_GUIDE_V3_BLOCKS_V2_1)` renders them under the 2.0.0 rule (blocks joined, one closing line
  feed): 3,950 UTF-8 bytes, SHA-256 `8d40f0053678a47a87b7563097da7e92f65b6a45d37b053e5457f372b798eabf`, identical to
  the page block plus that one line feed, compared byte for byte. Against the 2.0.0 rendering it differs in exactly
  the two lines the Confluence version diff shows. The content hash does not depend on the line feed (the content is
  lines, not a text); which bytes SKILL.md 2.0.0 binds is ETBZ-91's decision.
- No text of the current Lens or Lexicon asks for an answer: no "beantwortbar", no "Ja / Nein / Teilweise" answer, no
  answer affordance. The only mention of Ja/Nein/Teilweise is C5's prohibition of such options (unit suite, AC5).
- Contract data still holds no number, fact, method, operation, mapping or `methodRefs`.

### 3. What 2.1.0 supersedes

Each 2.1.0 contract records 2.0.0's supersession of the 1.x identities of its lineage unchanged (C1's "Ersetzt …"
sentence, Rebaseline section 17 for the Lens), and in addition `priorCanonVersions`: the A1 2.0.0 identity of its
lineage, with C1 version 2's sentences quoted ("Die unter ETBZ-77 bereits released Lens/Lexicon-Identitäten 2.0.0
bleiben an die vorherige C1/C5-Quellversion gebunden …"). The validator requires exactly that identity. 2.0.0 is
superseded for new work and stays resolvable in its own context for anything bound to it.

### 4. Two contexts, disjoint, and one current

`canon-v2-contracts.ts` holds the Canon v2 line as a version table (`LINES`): for each released version its sources,
supersessions, content, hash table and binding pair. 2.0.0 is not edited: its table entry is the ETBZ-77 release.

- **Every exported function keeps its 2.0 answer without a version.** `assertCanonV2ContractBindings`,
  `resolveCanonV2Contract`, `buildCanonV2Contract`, `releasedCanonV2Contract`, `canonV2ContractCore`,
  `validateCanonV2ContractCore`, `assertReleasedCanonV2Contract` and `assertCanonV2ContractSet` take an optional
  version or context; without one they answer for 2.0.0, exactly as ETBZ-77 released them (the ETBZ-77 suites run
  unchanged and its evidence re-derives byte for byte). Only an ABSENT argument (no argument, or an empty spread)
  means 2.0.0: a version that was never released is refused (`UNKNOWN_CONTRACT_IDENTITY`), and so is an argument
  that is present but `undefined` (a context field missing from a record) and a second version argument (the index
  `Array.map` passes when a function is used as its callback). The one 2.0 answer this changes is for such calls,
  which at the base defaulted or ignored the extra argument; every call with at most the released arguments answers
  as before.
- **The contexts are disjoint.** A context resolves and binds only its own identities. In the 2.1 context the A1 2.0.0
  pair is `CONTRACT_DRIFT`, naming the 2.1.0 identity and that 2.0.0 resolves only in its own 2.0.0 context; in the 2.0
  context the 2.1.0 pair is `CONTRACT_DRIFT`. Each line has its own schema and hash table: a contract of one line fails
  the other line's schema (`BUNDLE_SCHEMA_INVALID`), and re-shaped to pass it, its content hash is released on neither
  line (`BUNDLE_NOT_RELEASED`, naming no released hash: the refusing line's table does not hold the identity).
- **The current context.** `current-canon-contracts.ts` fixes `CURRENT_CANON_V2_VERSION` = `2.1.0` and exports
  `assertCurrentCanonContractBindings`, `resolveCurrentCanonContract`, `releasedCurrentCanonContract` and
  `assertCurrentCanonContractSet`. None takes a version. This is the input boundary ETBZ-78 and later Canon v2 work
  bind through; `PLAN_CONTRACT_BINDINGS_V2_1` is its pair.

What `assertCurrentCanonContractBindings` answers (ADR 0019 section 4 codes; recorded case by case in the evidence).
`resolveCurrentCanonContract` resolves only the two 2.1.0 identities; any other reference - the A1 2.0.0 ones, 1.x,
the Method Profile, an unknown or malformed one - is `UNKNOWN_CONTRACT_IDENTITY`, naming the 2.1.0 identity where it
is another version of the lineage.

| Input | Code |
| --- | --- |
| the 2.1.0 pair on C1/C5 page version 2 | accepted; the repository's frozen pair is returned, never the input |
| the A1 2.0.0 Lens or Lexicon, the whole 2.0.0 pair, a 2.0.0 identity re-pointed at page version 2 | `CONTRACT_DRIFT` |
| a 1.0.0 or 1.1.0 identity, or any other version of the lineage - any digits.digits.digits suffix, zero-padded included (2.0.1, 2.1.1, 2.2.0, 3.0.0, 02.1.0) | `CONTRACT_DRIFT` |
| the 2.1.0 identity on another page or page version (C1 v1, C5 v1, C1 v3, the other page, the hub) | `CONTRACT_SOURCE_MISMATCH` |
| an identity of the other lineage in a slot (swapped, one lineage twice, the A1 Lexicon in the Lens slot) | `BUNDLE_BINDING_MISMATCH` |
| an unknown name, a page address, the Method Profile, a malformed version (`…@`, `…@2.1`, `…@2.1.0.0`, `…@not-a-version`, a pre-release suffix) or a leading or trailing space | `UNKNOWN_CONTRACT_IDENTITY` |
| a missing or undefined slot | `REQUIRED_CONTRACT_MISSING` |
| any other shape | `BUNDLE_SCHEMA_INVALID` |

### 5. Integrity

- **Hash freeze.** `RELEASED_CANON_V2_1_CONTRACT_HASHES` is a table of its own; `RELEASED_CANON_V2_CONTRACT_HASHES`
  keeps exactly the two A1 entries. A changed rule, page version, binding or precedence is a new version, never an
  edit of 2.1.0 or of 2.0.0.
- **A1 byte baseline.** The three 2.0.0 value modules, the freeze helper, the eight files of
  `docs/evidence/etbz-77/contracts-v2/`, the three ETBZ-77 suites, their two support files and the ETBZ-77 guard
  script (18 files) are compared byte for byte with their SHA-256 at the base (`tests/support/etbz117Evidence.ts`).
  The A1 hashes `sha256:638eef2d…178ea` and `sha256:f6c40f7a…b67d6` are held as oracles, and 2.0.0 rebuilds to
  them. The shared machinery is held by those hashes, by the 2.0 context's answers and by the unchanged ETBZ-77
  suites, not by bytes: it is what this slice extends.
- **Method scope.** The Canon v2 line releases exactly the Lens and the Lexicon; `METHOD_PROFILE` is
  `UNKNOWN_CONTRACT_IDENTITY` on the 2.1 line; `method-registry.ts`, `method-scope.ts` and `RELEASED_REGISTRY_HASHES`
  are pinned to the base, and so are the file listings of `src/application` (where new product modules belong),
  `src/application/interpretation` (the registry's module) and `src/domain` (the import-free tables);
  `src/application/skill` is pinned by the ETBZ-51 boundary test. That is what the gate measures: a method added to one
  of those files, or a new module or directory in one of those directories, turns it red; a method placed anywhere
  else (inside another existing subdirectory, or as a file directly in `src/`) is outside its reach. As every scope fence of this repository, it is re-pinned
  deliberately by the slice that brings the capability - Method Profile v2, ETBZ-78, with its own ADR.
- **Stale base and head drift.** "Stale base or concurrent mutation between plan, CI, review and merge" is not a
  property of the code, and this repository does not enforce it: `main` has no branch protection and no ruleset
  (measured 2026-10-05). It is guarded at the merge step: the merge is `gh pr merge --match-head-commit <reviewed
  head>` (GitHub refuses a moved head), and immediately before it a scripted check reads the PR head and base and
  `main` and refuses unless the head is the reviewed and CI-tested commit and `main` is the base that commit was
  tested on. Its output, the exact-head CI run and the reviewed head are recorded in Jira ETBZ-117; a new head voids
  the earlier gate evidence. Whether this procedural guard is enough is the Product Owner's call at the merge gate.
- **Mutation proof.** `scripts/verify-etbz117-canon-v2-1.mjs` (step "guards :: ETBZ-117" of `ci-verify.sh`,
  registered in `ci-contract.test.ts`) runs 24 mutants with the ETBZ-30B semantics; each named test must fail an
  assertion. They cover the ticket's minimum classes: the current binding back to A1 (context version, pair, page
  version, voice binding), the 2.1.0 content freeze, the frozen A1 content, evidence and hash changed in place, the
  drift, source and context guards weakened, the two lines' hash tables merged, a malformed reference, an unreleased,
  an explicitly undefined and a second context version accepted, a method pulled into the line (key, registry, a new
  module beside the registry or as a new product module), and an ADR 0019 closeout that leaves "Proposed" or the
  open reflection question standing (verbatim and in other words), and a second, contradicting ADR 0020 row for a 2.1.0
  identity. The ETBZ-77 guard step runs unchanged beside it.
- **Evidence.** `docs/evidence/etbz-117/canon-v2-1/canon-v2-1.json` records identities, page bindings, hashes, the page
  delta, the current and the historical context's answers, the A1 baseline and the method scope. The contract suite
  re-derives it byte for byte.

### 6. ADR 0019 closeout

ADR 0019 is closed in the same change: its status records the ETBZ-77 merge (`9362f4e2`, PR #31) and its CI runs; its
ETBZ-116 consequence and its "does not decide" paragraph no longer present the reflection question as open; and its
section 4, its forward-work consequence and its bundle 2.0.0 consequence carry dated pointers to the 2.1 line and the
current context. Its 2.0.0 identities, page bindings (C1 v1, C5 v1), hashes, drop inventory and release provenance are
not changed. The contract suite holds both: ADR 0019 is the base text with exactly the declared closeout edits
(`ADR_0019_CLOSEOUT_EDITS`; undoing them gives back the base bytes), and the closeout says what it must.

## Consequences

- **ETBZ-78 onward** binds the current context (`current-canon-contracts.ts`), not the 2.0 context, and does not
  thread a version into the generic functions. How Method Profile v2 joins the Canon v2 line is ETBZ-78's decision,
  with its own ADR: the line machinery today gives every contract of a line that line's version and shares one key
  list across lines, so Method Profile v2 either brings per-key versions to the line or is released in a module of
  its own.
- **Bundle 2.0.0 (ETBZ-81)** composes the current pair (`PLAN_CONTRACT_BINDINGS_V2_1`, Lens and Lexicon 2.1.0), not
  the A1 2.0.0 pair. This follows from the hub's precedence ("If Canon v2 conflicts with an existing page or ticket,
  Canon v2 wins") and from C1 version 2 ("Diese Seitenversion gilt für neue Canon-v2-Arbeit"). ETBZ-81's acceptance
  criterion 4 names the 2.0 context (`PLAN_CONTRACT_BINDINGS_V2_0`); the ETBZ-117 closeout records in Jira that it
  reads against the current context.
- **Confluence closeout.** The hub's Zone B still pairs the Vorstoß with a "check question" (the term C1 version 2
  replaced); it demands no answer format. The ETBZ-117 closeout reconciles that wording on the hub, whose precedence
  section is not touched. C1 and C5 are not edited: a new page version would leave 2.1.0 behind.
- **Rebaseline section 17** is superseded in part by the Lens line; the current identity of that line is 2.1.0.
- **CI budget.** This slice adds one guard step (24 mutants, two baseline runs of three suites). The job ran 24.1 min
  on the last `main` push (run 37253260353) against its 30-minute limit. A timeout is an infrastructure outcome: the
  run is repeated and recorded; raising the limit is a Product Owner decision outside this slice.

## What this ADR does not decide

No method, fact kind, claim, relation, plan field, reading-schema field, gate, Skill package, template or renderer
is added or changed. Page 26 and the PDF design of reflection questions (ETBZ-116's template, renderer and visual
regression criteria) belong to the design slices. The Golden run (ETBZ-33/54) stays frozen. ETBZ-78 is not started.
