# ADR 0007 — InterpretiveClaimGraph (ETBZ-30A)

- **Status:** Proposed (PR open; merge requires explicit PO authorisation)
- **Date:** 2026-09-19
- **Slice:** ETBZ-30A — the first of two increments of ETBZ-30. `MetaNarrativePlan`
  is ETBZ-30B and is **not** part of this change.
- **Base:** `main@bebb0411401fd61c93351795fde090cb88f7ebc5` (ETBZ-34 / PR #5 merged)
- **Canonical product text:** Confluence ETBZ — *Long-Form Meta-Narrative Contract v1*
  (`57802765`), *BaZi Method Profile v1* (`63012866`, version 1.0.0), *Rebaseline v1*
  (`62128133`). Acceptance list: Jira ETBZ-30, sections "ETBZ-30 Reconcile &
  Refinement — 2026-09-18" and "DRS — ETBZ-30A InterpretiveClaimGraph".

## Context

A long-form reading needs its meaning persisted as structure before any prose is
written. ETBZ-34 delivered the smallest unit of that structure — one
`InterpretiveClaim`, validated fail-closed against the released Method Profile.
What no single claim can know is whether the *set* is sound: whether a relation
points at a claim that was actually accepted, whether the set belongs to this
chart, and whether the order or repetition of the input has quietly become
importance.

## Decision

`src/application/interpretation/interpretive-claim-graph.ts` adds one acceptance
boundary:

```
NarrativeBrief + InterpretiveClaim drafts -> validation -> normalisation -> InterpretiveClaimGraph
```

It composes the existing gates and re-implements none of them. Every claim goes
through `validateInterpretiveClaim`; PD-5 is `assertCentralClaimSignals`. From
the builder their refusals surface unchanged (`ClaimError`,
`MethodRegistryError`). The graph adds only graph-level refusals
(`ClaimGraphError`).

| Concern | Rule | Refusal |
|---|---|---|
| Brief binding | The chain is re-derived from the `HoroscopeModel`; the supplied brief is compared as a whole object, never trusted by the hash it prints on itself (a brief that cannot be canonicalised is not this model's brief). The draft names the brief it was written for. The graph carries `sourceBriefStructuralHash` and `featureSetStructuralHash`. | `CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL`, `CLAIM_GRAPH_BRIEF_HASH_MISMATCH` |
| Method Profile binding | The graph carries `methodProfileRef`, `methodProfileVersion` and the content hash of the released registry. Release and version are checked by the claim validator for every claim. | `CLAIM_PROFILE_MISMATCH`, `REGISTRY_NOT_RELEASED` |
| Claims | Every claim passes the current claim contract (grounding, I1–I5, PD-10, provisional lineage, closed relation vocabulary). One refused claim refuses the graph. | the `CLAIM_*` codes of `interpretive-claim.ts` |
| Themes | A `themeRef` must be a theme of the bound brief (primary or candidate) **and** the claim must cite at least one of that theme's facts. A theme's `factIds` are "its entire evidence" (`theme-graph.ts`); a claim that shares none of them has no basis for the reference and would borrow the theme's standing — e.g. a supported claim filed under a provisional theme. A theme never grounds a claim. | `CLAIM_GRAPH_UNKNOWN_THEME`, `CLAIM_GRAPH_THEME_NOT_GROUNDED` |
| Relations | A target must resolve to an ACCEPTED claim of the same graph; a claim may not relate to itself. Cycles between claims are allowed — the contract names no acyclicity rule, and mutual contrast is one. | `CLAIM_GRAPH_DANGLING_RELATION`, `CLAIM_GRAPH_SELF_RELATION` |
| Duplication | Refused, never merged and never counted: two claims under one handle; one statement made twice, whatever label (epistemic class, themes, method set, grounding) was changed to tell the two apart; a repeated `factRef` / `themeRef` / relation. (`methodRefs`: already `CLAIM_DUPLICATE_METHOD_REF`.) | `CLAIM_GRAPH_DUPLICATE_CLAIM_ID`, `CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT`, `CLAIM_GRAPH_DUPLICATE_REF` |
| Statement form | A statement must be in canonical form: NFC; U+0020 as the only white-space character, single and not at the ends (no tab, line break, no-break / thin / ideographic space, U+2028); no control, format or default-ignorable character and no blank Braille pattern (zero-width marks, soft hyphen, variation selectors, Hangul fillers). Refused, not repaired — otherwise a trailing or no-break space makes a second claim and an invisible statement passes as one. **Not** covered: look-alike letters of another script (that needs a confusables table nobody approved). Cost: zero-width joiners and variation selectors are refused too, so emoji sequences and scripts that need ZWNJ cannot appear in a statement. | `CLAIM_GRAPH_STATEMENT_NOT_CANONICAL` |
| Shape | The draft is untrusted and its schema is closed (`z.strictObject`). A `salience`, `confidence`, `rank`, `providerId`, `model` or `runId` field is a refusal, not something dropped quietly. Id-like strings are bounded (256 each), because later refusals name the offending id; the *number* of refs is not bounded (the Method Profile sets no maximum). Schema refusals name path and code, never the value. | `CLAIM_GRAPH_SCHEMA_INVALID` |
| Empty | A draft without claims is refused. | `CLAIM_GRAPH_EMPTY` |
| Consistency | A presented graph must be exactly what the builder produces from its own claims for this chart and profile (see below). | `CLAIM_GRAPH_NOT_INTACT` |
| Central claim lookup | The `claimId` must be a derived id of this graph; a draft handle is not. | `CLAIM_GRAPH_UNKNOWN_CLAIM` |

### Identity and normalisation

A draft's `claimId` is a **handle**: unique inside the draft and the thing
`relations[].targetClaimId` points at. The accepted `claimId` is derived:

```
claim.<structuralHash({ methodProfileRef, statement,
                        citedFacts: [{ id, value }...],   // sorted by id
                        themeRefs, methodRefs, epistemicClass, provisionalFactRefs })>
```

with every list sorted. Handles, provider or run identifiers and input order
therefore never enter identity; the same meaning has the same id whoever drafted
it. The **value** of every cited fact is part of the identity (hashed, never
published): two charts "share a fact" only when the value is the same, so the
same words about a fact that changed are a different claim. That is what lets a
counterfactual be observed on the graph rather than argued about.

Relations are outside the claim *identity* (an identity containing its own
targets cannot be computed for a cycle) and inside each claim's I6 hash
(`interpretiveClaimStructuralHash`), which the graph stores per claim and which
is inside the graph hash.

Normalisation is ordering only: claims by `claimId`, refs lexicographically,
relations by `type -> target`. Nothing is repaired, deduplicated or defaulted.

Identity is **structural**. Two differently worded statements over the same
facts are two claims — that is what `ALTERNATIVE_READING` needs. Detecting
paraphrase is not decidable here; it is left to the cross-reading individuality
contract (Jira ETBZ-37).

### Hash / version

`graphVersion = etbz-30.interpretive-claim-graph.v1`. `structuralHash` is
`sha256:` + SHA-256 of the canonical JSON of every other field; the unit suite
re-derives it with `node:crypto`.

### Consistency check and PD-5

`claimGraphDraftOf(graph)` is the draft a graph is the acceptance of. The
builder is idempotent on that projection, and
`assertInterpretiveClaimGraphIntact(graph, context)` uses exactly that: a graph
that is not, byte for byte, what the builder produces from the graph's own
claims for this chart and profile — an edited claim, a claim the claim contract
refuses, an added field, another chart, a value that is not graph-shaped at all —
is refused (`CLAIM_GRAPH_NOT_INTACT`). It is a **consistency proof, not
tamper evidence**: the hashes are plain SHA-256, so an edit that is itself
acceptable, re-hashed, is an intact *different* graph. Whoever must know that a
graph is still the one they accepted pins its `structuralHash` — which is what
ETBZ-30B will do. A wrong *context* is not a damaged graph: an unreleased
registry (`REGISTRY_NOT_RELEASED`) and a brief that does not belong to the model
surface as what they are.

`assertCentralGraphClaim(graph, claimId, context)` is what ETBZ-30B will call for
a claim that carries `reportThesis` or a primary-motif core: the graph must be
intact, the claim must be one of its claims, and the floor is
`assertCentralClaimSignals` — no option, no flag, no `TENTATIVE` bypass. The
graph itself marks no claim as central; that is the plan's statement to make.

### No numbers

Graph, claims and relations carry strings and string lists only. There is no
salience, rank, weight, count, confidence or score, and a test walks the whole
graph to prove it.

## Donor (PR #4) — what was and was not reused

PR #4 is `DONOR / SUPERSEDED_IMPLEMENTATION`. No file, function or test of it
was copied or cherry-picked. Reused as *concepts*, after re-validation against
the ETBZ-34 contracts:

- content-derived claim identity — extended here by `methodProfileRef`,
  `methodRefs`, provisional lineage and the cited fact values, none of which the
  donor had;
- re-derivation of the brief from the model, and the draft naming the brief it
  was written for (retained deliberately: without it a draft written for one
  chart would be accepted for another whenever its claims happen to validate
  there);
- refusal of a dangling relation endpoint and of a self relation; no acyclicity
  rule;
- the permutation, handle-rename, idempotence and independent-hash test ideas.

Rejected as obsolete: theme-only grounded claims; claims without `methodRefs`;
no Method Profile binding; the provider port with `providerId` and echoed fact
values; provisionality computed over a theme closure (main: exactly the
provisional subset of `factRefs`); a graph-level edge list (main: relations
belong to the claim and sit inside its I6 hash); silent de-duplication of refs
and relations (here: refusal); the empty graph.

The version literal `etbz-30.interpretive-claim-graph.v1` is the same string the
donor used for a different, never-merged shape. It first enters `main` here.

## Acceptance mapping (ETBZ-30A)

| Criterion | Where it is enforced / proven |
|---|---|
| Versioned graph, hash defined | `INTERPRETIVE_CLAIM_GRAPH_VERSION`, `structuralHash`; unit G1, G2 |
| NarrativeBrief binding | re-derivation + draft brief hash; unit G3 |
| Method Profile binding (AC 9, 13) | graph fields + claim validator; unit G1, negative N2 |
| Every claim passes the claim contract (AC 1, 10, 12) | `validateInterpretiveClaim` composed; negative N1–N3 |
| Relation targets fail closed (AC 3) | unit G1 (the seven names, pinned), negative N4 |
| Determinism and order (AC 6) | unit G2: claims, factRefs, themeRefs, methodRefs, lineage, relations, handles |
| Duplicates never become importance (AC 6, 14) | negative N5 |
| Provisional lineage unchanged (AC 2) | unit G4, negative N3 |
| Counterfactual / ablation (AC 7) | unit G3: a lost identity refuses the claim; a changed cited value changes the claim's identity and no other; negative N4: ablating a related claim |
| PD-5 stays fail-closed (AC 11) | unit G5 |
| No numeric metric | unit G1, negative N6 |
| Guards are not decoration | `npm run guards:etbz30a` — source mutants, baseline proven green first |

## What this change deliberately does NOT do

- No `MetaNarrativePlan`, `ChapterContract`, `NarrativeDelta`, `NarrativeState`,
  chapter prose, editorial pass, customer projection, PDF or Etsy.
- No provider port, no model selection, no LLM call. The draft is a plain value.
- No new chart fact, no new method, no astrology. The registry and the feature
  set are untouched; `RELEASED_REGISTRY_HASHES` is unchanged. The graph cannot
  judge whether a statement is *true* of the facts it cites — only that the
  facts exist, may be cited, and are read by approved methods.
- No propagation of provisionality *through relations* or *through themes*. A
  claim's epistemic class is decided by the facts it cites, exactly as ETBZ-34
  defined it; a relation creates no evidence and changes no claim.
- No floor on the number of claims: the "three central claims" stop condition of
  the Method Profile is a statement about the plan (ETBZ-30B).
- No production-eligibility statement. Whether a chart may be used for a paid
  reading (`RUNTIME_ATTESTATION_NOT_PASSED`, the unknown-time producer contract)
  belongs to `BazodiacInterpretationInput v1`; the graph accepts an unknown-time
  chart semantically and says nothing about eligibility.

## Open observation for the Product Owner (not changed here)

`assertCentralClaimSignals` (ETBZ-34) counts `methodRefs.length`, so the modifier
`positional_context` counts as one of the ">= 2 approved method contributions" of
PD-5: two fact kinds read by one method plus the modifier satisfy the floor.
Whether a modifier is a *contribution* is a product decision about ETBZ-34 code;
this slice composes that gate unchanged and does not pin the behaviour.

## Consequences

- ETBZ-30B binds its plan to `graph.structuralHash` and refers to claims by the
  derived `claimId`.
- Rollback is a revert of this change: one new module, two new suites and their
  fixture, one script, one `package.json` line, this ADR. No existing source
  file is modified, no data and no runtime are touched.
