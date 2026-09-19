# ADR 0007 — InterpretiveClaimGraph (ETBZ-30A)

- **Status:** Accepted — merged via PR #7; canonical on `main` at merge commit
  `b29279c20a4f19a36ba2a73b6bff7e26554d881e`
- **Date:** 2026-09-19
- **Slice:** ETBZ-30A — the first of two increments of ETBZ-30. `MetaNarrativePlan`
  is ETBZ-30B and is **not** part of this change.
- **Base:** `main@bebb0411401fd61c93351795fde090cb88f7ebc5` (ETBZ-34 / PR #5 merged)
- **Canonical product text:** Confluence ETBZ — *Long-Form Meta-Narrative Contract v1*
  (`57802765`), *BaZi Method Profile v1* (`63012866`, version 1.0.0), *Rebaseline v1*
  (`62128133`). Acceptance list: Jira ETBZ-30, sections "ETBZ-30 Reconcile &
  Refinement — 2026-09-18", "DRS — ETBZ-30A InterpretiveClaimGraph" and
  "ETBZ-30A PO clarification — 2026-09-19" (PD-5 modifier rule, duplicate
  semantics, no statement-format rule, supplementary themes, themes outside
  semantic identity).

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
| Themes | A `themeRef` must be a theme of the bound brief (primary or candidate). Themes are supplementary structure: a theme never grounds a claim (the claim validator demands direct `factRefs`), it changes no claim's epistemic class or lineage, it need not share a cited fact, and it is not part of the semantic `claimId` — it stays on the accepted claim and inside the structural hashes (PO 2026-09-19). | `CLAIM_GRAPH_UNKNOWN_THEME` (theme-only claim: `CLAIM_UNGROUNDED`) |
| Relations | A target must resolve to an ACCEPTED claim of the same graph; a claim may not relate to itself. Cycles between claims are allowed — the contract names no acyclicity rule, and mutual contrast is one. | `CLAIM_GRAPH_DANGLING_RELATION`, `CLAIM_GRAPH_SELF_RELATION` |
| Duplication | Refused, never merged and never counted: two claims under one handle; two claims with the same accepted semantic identity (see below), whatever handle, ref order, `themeRefs` or relations they carry; a repeated `factRef` / `themeRef` / relation. (`methodRefs`: already `CLAIM_DUPLICATE_METHOD_REF`. A repeated *provisional* `factRef` is refused one step earlier by the claim validator, as `CLAIM_PROVISIONAL_LINEAGE_MISMATCH`.) The statement text alone decides nothing: the same sentence over other grounding, methods or epistemic class is another claim (PO 2026-09-19). | `CLAIM_GRAPH_DUPLICATE_CLAIM_ID`, `CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT`, `CLAIM_GRAPH_DUPLICATE_REF` |
| Statement | No rule of the graph's own. The claim validator's statement rule (a blank statement is `CLAIM_UNGROUNDED`) is the only one; the graph adds no Unicode or typography policy (no NFC, white-space or invisible-character refusal) and stores the statement exactly as written, never normalised or rewritten (PO 2026-09-19). | the claim validator's |
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
                        methodRefs, epistemicClass, provisionalFactRefs })>
```

with every list sorted. Handles, `themeRefs`, relations, provider or run
identifiers and input order therefore never enter identity; the same meaning has
the same id whoever drafted it. The **value** of every cited fact is part of the
identity (hashed, never published): two charts "share a fact" only when the
value is the same, so the same words about a fact that changed are a different
claim. That is what lets a counterfactual be observed on the graph rather than
argued about.

Relations are outside the claim *identity* (an identity containing its own
targets cannot be computed for a cycle) and inside each claim's I6 hash
(`interpretiveClaimStructuralHash`), which the graph stores per claim and which
is inside the graph hash.

This derived id is the claim's full semantic identity, and it alone decides
duplicate *content*: two drafts that resolve to the same id are one
interpretation submitted twice and are refused
(`CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT`); two drafts with the same statement text
and a different id are two claims. (A repeated handle and a repeated ref are
refused on their own, see the table.)

`themeRefs` are supplementary structural annotation (PO 2026-09-19). They do not
participate in the semantic `claimId`: two drafts with the same statement, cited
fact ids and values, Method Profile reference, `methodRefs`, epistemic class and
provisional lineage but different `themeRefs` are the same interpretation,
resolve to the same id, and are refused as `CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT`
when submitted into one graph — a theme alone does not multiply a claim, and so
cannot by itself produce a second central claim or narrative salience. They remain in
accepted structural hashing: the accepted claim keeps its `themeRefs` (sorted),
they are inside its I6 hash (`interpretiveClaimStructuralHash`) and therefore
inside the graph hash, so the same claim filed under another theme is the same
`claimId` in a different, equally intact graph, and a theme edited on an
accepted graph is `CLAIM_GRAPH_NOT_INTACT`.

```
semantic claimId                                        excludes themeRefs
accepted claim representation / I6 hash / graph hash    includes themeRefs
```

Normalisation is ordering only: claims by `claimId`, refs lexicographically,
relations by `type -> target`. Nothing is repaired, deduplicated or defaulted,
and a statement is never rewritten — so a statement that differs only in
presentation (a no-break space, another normalisation form) is another string
and therefore another identity.

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

PD-5 (Method Profile `63012866`, section 3; PO 2026-09-19): >= 2 distinct fact
kinds **and** >= 2 approved, enabled, claim-bearing **non-modifier** method
contributions. A method with `modifier=true` — `positional_context` — may
qualify a central claim but does not count: two fact kinds read by one method
plus `positional_context` are refused (`CLAIM_INSUFFICIENT_SIGNALS`).
`assertCentralClaimSignals` validates the claim first (so every counted ref is
already approved, enabled and claim-bearing) and then counts only the refs
whose definition has `modifier === false`. This is the one change this slice
makes to ETBZ-34 code (`interpretive-claim.ts`).

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
| PD-5 stays fail-closed, modifiers do not count (AC 11) | unit G5; claim unit M4 (`tests/unit/interpretive-claim.test.ts`) |
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

## PO clarification 2026-09-19 (applied)

The first candidate of this slice counted the modifier towards PD-5 (ETBZ-34
code, then unchanged) and added three rules of its own. The Product Owner
reconciled all four (Jira ETBZ-30, "ETBZ-30A PO clarification — 2026-09-19"):

- PD-5 counts non-modifier contributions only — implemented in
  `assertCentralClaimSignals`, see above.
- Statement-text duplicate equality — withdrawn; semantic identity decides.
- Canonical statement form (`CLAIM_GRAPH_STATEMENT_NOT_CANONICAL`) — withdrawn;
  no Unicode or typography policy in ETBZ-30A.
- A themeRef must share a cited fact (`CLAIM_GRAPH_THEME_NOT_GROUNDED`) —
  withdrawn; themes are supplementary structure.

Item 8 of the same clarification closed the question the second candidate left
open: `themeRefs` were part of the derived `claimId`, so a draft differing only
in a supplementary theme was accepted as a second claim. They are now excluded
from the semantic `claimId` and retained in the accepted claim, its I6 hash and
the graph hash (see "Identity and normalisation").

## Consequences

- ETBZ-30B binds its plan to `graph.structuralHash` and refers to claims by the
  derived `claimId`.
- Rollback is a revert of PR #7 / merge commit
  `b29279c20a4f19a36ba2a73b6bff7e26554d881e`, together with any later commit
  that edits the files it introduced (such as this ADR's post-merge status
  update); no data migration or runtime mutation is involved.
