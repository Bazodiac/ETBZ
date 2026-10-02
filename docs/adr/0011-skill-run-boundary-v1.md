# ADR 0011 — Bazodiac Interpretation Skill v1: package, input package and reading boundary (ETBZ-52)

- **Status:** Accepted — merged to `main` as `c801f383` (PR #16, 2026-09-28). Merged under the Product Owner's standing authorisation D1 of 2026-09-28 (Jira ETBZ-2 comment 16690) after the merge gate on the exact head.
- **Date:** 2026-09-28
- **Slice:** ETBZ-52 [RUN-05] — an executable Bazodiac Interpretation Skill v1 package
  with a portable execution contract and ChatGPT/Claude wrappers, the input package a
  run is handed, the acceptance boundary for the reading it returns, and one
  controlled fixture run in the Claude runtime. Does not implement a renderer, a
  provider route or any Anti-Boilerplate check.
- **Base:** `main@15648b2a3f630c37c7b7744f344954d2f4f8fbde`
- **Canonical product text:** Rebaseline `62128133` sections 3, 4.4 and 7; Long-Form
  Contract `57802765`; the five contracts bound by `bazodiac-skill-contract-bundle@1.0.0`
  (ADR 0010). Runtime decision D2 (ETBZ-2 comment 16690): the Skill runs in the Claude
  runtime available to the Delivery Runner; no other provider or model.

## Context

The Rebaseline makes the Skill an execution host: "The skill/runtime is an execution
host for the canonical interpretation contract. It is not a second astrology engine
and does not own symbolic truth." Until this slice nothing in the repository said
what a Skill is handed, what it may return, or how a returned text is accepted or
refused. ADR 0008 left the hand-off open: "ETBZ-38 can hand the Skill
`BazodiacInterpretationInput v1` + graph + plan as plain JSON; `constraints` states
what the Skill may render." The Skill package itself — instructions a model
executes — had no home, and the only prose producer in the repository was the
deterministic ETBZ-25 provider, which interprets nothing.

Two facts of the existing code shaped every decision below. First, the fixture
chain (`knownTimeChart` → interpretation input → claim graph → plan) is reachable
only from vitest, because fixtures are not compiled; so the fixture run is a contract
suite over committed evidence, not a CLI. Second, the ETBZ-25 citation rule
(`findUncitedSymbols`) treats every stem and branch name as a chart symbol, including
the branch `You`; English second-person prose therefore cannot pass it, and the
fixture reading is German, for which the Lexicon carries wording throughout.

## Decision

### 1. Three artefacts, one module

`src/application/skill/` gains `skill-run-errors.ts`, `skill-package.ts` and
`skill-reading.ts` beside the ETBZ-51 bundle. The module stays a leaf
(`tests/architecture/etbz51-skill-boundary.test.ts`, pinned list widened by the three
files) and imports nothing but zod, the interpretation modules it binds and the
domain hashing primitives. It may not import the visual module (ETBZ-49 leaf rule);
the slot ids a reading may bind arrive in the package from the caller that owns
the visual contract.

### 2. The input package (`bazodiac-skill-input.v1`)

`buildSkillInputPackage` is what a runtime is handed and the ONLY thing it reads:
the Skill identity `bazodiac-interpretation-skill@1.0.0`, the bundle reference and
hash, the released contract set, the subject (display name, birth-time-known), the
hash of the exact `BazodiacInterpretationInput v1`, the **interpretable** facts by id
with value and source label, the excluded and provisional fact ids, the source
warnings verbatim, the precision block, the accepted claim graph, the accepted plan
and the allowed slot ids — hash-bound. It carries **no raw producer body** and no
display of an excluded fact. Building it re-proves that its parts describe one chart
under one contract set (`PACKAGE_BINDING_MISMATCH`: graph under another profile or
version, plan against another graph, input of another feature set or profile, plan
bound to another Lexicon or Lens release) and refuses a malformed subject or slot
list (`PACKAGE_SCHEMA_INVALID`).

### 3. The reading (`bazodiac-skill-reading.v1`)

A reading is structured, never free prose: binding fields (skill, bundle, package,
graph, plan hashes, contract set); a title; chapters in the plan's order, each with
its plan chapter id and operation, typed paragraphs (`FACT`, `FRAME`,
`INTERPRETATION`, `REFLECTION`) carrying `factRefs`, `claimRefs` and a posture
(`NONE`, `SUPPORTED`, `TENTATIVE`), a declared `semanticDelta` and declared
`callbacks`; grounded reflection questions; a method note with the warning codes
verbatim; visualization specs over slot ids, facts and claims. `reading-schema.json`
is the JSON Schema exported from the boundary's own zod schema.

### 4. The acceptance boundary

`acceptSkillReading(draft, { bundle, inputPackage })` throws on the first violation
and returns a hash-bound accepted reading otherwise. In order: shape; bindings
(skill, bundle, package/graph/plan hashes; contract set through the bundle's drift
gate); chapters exactly the plan's sequence; per chapter — every planned claim
rendered by an INTERPRETATION paragraph (a FRAME or REFLECTION paragraph cites a
claim, it does not render it) and no other claim, a FACT paragraph carries no claim,
facts known, interpretable and (for interpretive paragraphs) grounding a cited
claim, posture fits kind (an interpretive paragraph is SUPPORTED or TENTATIVE; a
FACT or FRAME paragraph is NONE, or TENTATIVE exactly when it rests on a provisional
fact or a tentative claim), no laundering of a tentative claim or a provisional fact,
no symbol or number in prose that no cited fact carries (the ETBZ-25 rule, reused —
on every paragraph, on a chapter title against the chapter's cited facts, on the
reading title and the method note against the chart), no prohibited wording
(Lexicon §12 and Lens §9.2 phrase lists in EN and DE), no deferred-method vocabulary
(Method Profile §6.3, EN and DE, pinyin spaced and concatenated), no evidence chrome,
600–900 words (the budget equals the visual system's, pinned by a test); at least
one semantic delta over rendered claims, every first rendering declared as
`NEW_CLAIM` and `NEW_CLAIM` only for a first rendering, every re-rendered claim
declared as a callback with a delta; thesis rendered; reflection grounded in planned
claims; warnings verbatim; specs over declared slots, known facts and planned claims,
unique ids. Thirty-one `READING_*` codes and two `PACKAGE_*` codes
(`skill-run-errors.ts`).

The boundary repairs nothing. What it cannot judge — whether a sentence is true of a
person, whether prose is Barnum residue — stays with the Anti-Boilerplate checks
(ETBZ-54) and the human gate. The mechanical wording gates are conservative by
design: "always" and "never" are not matched, everyday words that also name a
method ("root", "strong") are not matched; a human reads for those.

### 5. The customer projection

`projectCustomerReading` is text only — title, chapter titles and paragraph texts,
reflection questions, method note — and refuses any chrome that reaches it. It
invents and repairs nothing; the same content as the accepted reading, projected.

### 6. The Skill package on disk

`skill/bazodiac-interpretation-skill-v1/` holds `SKILL.md` (the instructions: hard
laws, input, writing procedure, refusal codes), `wrappers/claude.md` and
`wrappers/chatgpt.md` (invocation only; no rule lives there), `contract-bundle.json`
(the portable bundle, canonical JSON), `reading-schema.json`, `README.md` and
`MANIFEST.json` (identities, bundle hash, contract set, SHA-256 of every file,
`packageStructuralHash` over them). `npm run etbz52:package` regenerates the machine
parts from the compiled module; the contract suite requires them byte-identical and
the digests to match. The directory is dockerignored and imported by nothing under
`src/`. It is not under `contracts/`, which stays README-only, and not under
`src/application/`, which admits no data file.

### 7. The controlled fixture run

`docs/evidence/etbz-52/fixture/` holds the package the runtime was handed
(`skill-input.json`, regenerated byte-identically from the fixtures), the reading the
Claude runtime returned (`skill-reading.json`), its accepted form and customer
projection (regenerated byte-identically), and `manifest.json`: every hash measured
by `scripts/etbz52-fixture-manifest.mjs` plus a **declared** generation record
(runtime, model `claude-fable-5-1`, date, operator, repository head) marked
`declared: true`, because nothing in a repository can prove which model wrote a text.
The run accepted on the first accepted attempt after two refusals repaired in the
reading only (`READING_UNCITED_SYMBOL` — "Verantwortung" is a Ten-God label;
`READING_CHAPTER_LENGTH_OUT_OF_CONTRACT` — three chapters under 600 words). The
independent review of the delivering PR tightened `SKILL.md` and the boundary
(section 4) after the run; the reading was not changed and is re-accepted unchanged
under the revised boundary, so the accepted-reading hash is the run's, while the
package hash in `manifest.json` is the revised package's.

### 8. Proven

`tests/unit/etbz52-skill-reading.test.ts`, `tests/negative/etbz52-skill-reading.negative.test.ts`
and `tests/contract/etbz52-skill-fixture-run.contract.test.ts` pin the package, the
accepted reading (hash stated literally), every refusal code and the regeneration of
every generated file. `scripts/verify-etbz52-skill-reading.mjs` (`npm run
guards:etbz52`, a step of `ci-verify.sh`) weakens each guard of the boundary and the
package builder — sixty mutants, one per guard site a test reaches (the stray-file
mutant is killed by the contract suite) — with the ETBZ-30B kill semantics.

## Consequences

- ETBZ-56 maps an accepted reading to the PresentationProjection: it reads
  `visualizationSpecs` (slot id → facts / claims) and the customer projection; the
  slot-to-fact-kind vocabulary mapping it needs does not exist yet and is its work.
- ETBZ-54 hands a real package to the same runtime under the same `SKILL.md` and
  accepts the reading through the same boundary; its evidence names the package
  hash, the reading hash and the declared generation record.
- Observations for contract owners, recorded not repaired: the Lexicon has no
  customer wording per element, so element names appear in FACT paragraphs only as
  source labels; the symbol rule's treatment of `You` forbids English second-person
  prose under this boundary; a display name that is itself a stem or branch name is
  left out of the title (SKILL.md section 2), because the title is under the symbol
  rule and a name is not a citation.

## What this ADR does not decide

- The renderer, the PDF, the ArtifactManifest (ETBZ-55/56).
- Any Anti-Boilerplate check; the reading carries the vocabulary's obligations, the
  run executes the checks (ETBZ-54).
- Any BaZi method, mapping or fact kind — none is added, none is enabled.
- A second runtime run: the ChatGPT wrapper is written, not executed, under D2.
