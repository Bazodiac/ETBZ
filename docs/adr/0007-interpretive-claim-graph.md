# ADR 0007 — InterpretiveClaimGraph (ETBZ-30A)

- **Status:** Proposed (PR open; merge requires explicit PO authorisation)
- **Date:** 2026-09-19
- **Slice:** ETBZ-30A — the first of two increments of ETBZ-30. `MetaNarrativePlan`
  is ETBZ-30B and is **not** part of this change.
- **Base:** `main@bebb0411401fd61c93351795fde090cb88f7ebc5` (ETBZ-34 / PR #5 merged)
- **Canonical product text:** Confluence ETBZ — *Long-Form Meta-Narrative Contract v1*
  (`57802765`), *BaZi Method Profile v1* (`63012866`, version 1.0.0), *Rebaseline v1*
  (`62128133`); Jira ETBZ-30, section "ETBZ-30 Reconcile & Refinement — 2026-09-18".

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
through `validateInterpretiveClaim`; PD-5 is `assertCentralClaimSignals`. Their
refusals surface unchanged (`ClaimError`, `MethodRegistryError`). The graph adds
only graph-level refusals (`ClaimGraphError`).

| Concern | Rule | Refusal |
|---|---|---|
| Brief binding | The chain is re-derived from the `HoroscopeModel`; the supplied brief is compared, never trusted. The draft names the brief it was written for. The graph carries `sourceBriefStructuralHash` and `featureSetStructuralHash`. | `CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL`, `CLAIM_GRAPH_BRIEF_HASH_MISMATCH` |
| Method Profile binding | The graph carries `methodProfileRef`, `methodProfileVersion` and the content hash of the released registry. Release and version are checked by the claim validator for every claim. | `CLAIM_PROFILE_MISMATCH`, `REGISTRY_NOT_RELEASED` |
| Claims | Every claim passes the current claim contract (grounding, I1–I5, PD-10, provisional lineage, closed relation vocabulary). One refused claim refuses the graph. | the `CLAIM_*` codes of `interpretive-claim.ts` |
| Themes | A `themeRef` must be a theme of the bound brief (primary or candidate). It never grounds a claim. | `CLAIM_GRAPH_UNKNOWN_THEME` |
| Relations | A target must resolve to an ACCEPTED claim of the same graph; a claim may not relate to itself. Cycles between two claims are allowed — the contract names no acyclicity rule, and mutual contrast is one. | `CLAIM_GRAPH_DANGLING_RELATION`, `CLAIM_GRAPH_SELF_RELATION` |
| Duplication | Refused, never merged and never counted: two claims under one handle, the same meaning under two handles, a repeated `factRef` / `themeRef` / relation. (`methodRefs`: already `CLAIM_DUPLICATE_METHOD_REF`.) | `CLAIM_GRAPH_DUPLICATE_CLAIM_ID`, `CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT`, `CLAIM_GRAPH_DUPLICATE_REF` |
| Shape | The draft is untrusted and its schema is closed (`z.strictObject`). A `salience`, `confidence`, `rank`, `providerId`, `model` or `runId` field is a refusal, not something dropped quietly. Refusals name path and code, never the value. | `CLAIM_GRAPH_SCHEMA_INVALID` |
| Empty | A draft without claims is refused. | `CLAIM_GRAPH_EMPTY` |

### Identity and normalisation

A draft's `claimId` is a **handle**: unique inside the draft and the thing
`relations[].targetClaimId` points at. The accepted `claimId` is derived:

```
claim.<structuralHash({ methodProfileRef, statement, factRefs, themeRefs,
                        methodRefs, epistemicClass, provisionalFactRefs })>
```

with every ref list sorted. Handles, provider or run identifiers and input order
therefore never enter identity; the same meaning has the same id whoever drafted
it. Relations are outside the claim *identity* (an identity containing its own
targets cannot be computed for a cycle) and inside each claim's I6 hash
(`interpretiveClaimStructuralHash`), which the graph stores per claim and which
is inside the graph hash.

Normalisation is ordering only: claims by `claimId`, refs lexicographically,
relations by `type -> target`. Nothing is repaired, deduplicated or defaulted.
The builder is idempotent on its own output, which is what
`assertInterpretiveClaimGraphIntact` uses to detect a graph edited after
acceptance or presented for another chart.

Identity is **structural**. Two differently worded statements over the same
facts are two claims — that is what `ALTERNATIVE_READING` needs. Detecting
paraphrase is not decidable here and belongs to ETBZ-37.

### Hash / version

`graphVersion = etbz-30.interpretive-claim-graph.v1`. `structuralHash` is
`sha256:` + SHA-256 of the canonical JSON of every other field; the unit suite
re-derives it with `node:crypto`.

### PD-5

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
the ETBZ-34 contracts: content-derived claim identity (extended here by
`methodProfileRef`, `methodRefs` and provisional lineage, which the donor did
not have); re-derivation of the brief from the model; refusal of the same
content under two handles; the permutation, handle-rename, idempotence and
independent-hash test ideas. Rejected as obsolete: theme-only grounded claims;
claims without `methodRefs`; no Method Profile binding; the provider port with
`providerId` and echoed fact values; provisionality computed over a theme
closure (main: exactly the provisional subset of `factRefs`); a graph-level
edge list (main: relations belong to the claim and sit inside its I6 hash);
silent de-duplication of refs and relations (here: refusal); the empty graph.

## Acceptance mapping (ETBZ-30A)

| Criterion | Where it is enforced / proven |
|---|---|
| Versioned graph, hash defined | `INTERPRETIVE_CLAIM_GRAPH_VERSION`, `structuralHash`; unit G1, G2 |
| NarrativeBrief binding | re-derivation + draft brief hash; unit G3 |
| Method Profile binding (AC 9, 13) | graph fields + claim validator; unit G1, negative N2 |
| Every claim passes the claim contract (AC 1, 10, 12) | `validateInterpretiveClaim` composed; negative N1–N3 |
| Relation targets fail closed (AC 3) | negative N4 |
| Determinism, order, duplicates (AC 6, 14) | unit G2, negative N5 |
| Provisional lineage unchanged (AC 2) | unit G4, negative N3 |
| Counterfactual / ablation (AC 7) | unit G3, negative N4 |
| PD-5 stays fail-closed (AC 11) | unit G5 |
| No numeric metric | unit G1, negative N6 |
| Guards are not decoration | `npm run guards:etbz30a` — source mutants, baseline proven green first |

## What this change deliberately does NOT do

- No `MetaNarrativePlan`, `ChapterContract`, `NarrativeDelta`, `NarrativeState`,
  chapter prose, editorial pass, customer projection, PDF or Etsy.
- No provider port, no model selection, no LLM call. The draft is a plain value.
- No new chart fact, no new method, no astrology. The registry and the feature
  set are untouched; `RELEASED_REGISTRY_HASHES` is unchanged.
- No propagation of provisionality *through relations*. A claim's epistemic
  class is decided by the facts it cites, exactly as ETBZ-34 defined it; a
  relation creates no evidence and changes no claim.
- No rule that a `themeRef` must share a fact with the claim, and no floor on
  the number of claims: the "three central claims" stop condition of the Method
  Profile is a statement about the plan (ETBZ-30B).

## Consequences

- ETBZ-30B binds its plan to `graph.structuralHash` and refers to claims by the
  derived `claimId`.
- Rollback is a revert of this change: one new module, two new suites and their
  fixture, one script, one `package.json` line, this ADR. No existing source
  file is modified, no data and no runtime are touched.
