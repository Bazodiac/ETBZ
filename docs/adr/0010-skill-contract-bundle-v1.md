# ADR 0010 — Skill Contract Bundle v1 (ETBZ-51)

- **Status:** Proposed — PR open. Merge is governed by the Product Owner's standing
  authorisation D1 of 2026-09-28 (Jira ETBZ-2 comment 16690), subject to the merge
  gate on the exact head.
- **Date:** 2026-09-28
- **Slice:** ETBZ-51 [RUN-04] — bind the Method Profile, the Interpretation Lens, the
  Terminology & Wording Lexicon, the Long-Form Contract and the Cross-Reading
  Individuality Contract as one portable, versioned Skill contract set. Does not
  implement a Skill, a prompt or a renderer.
- **Base:** `main@3476ee616a076ad90fd1966f0e46fabc16a7835a`
- **Canonical product text:** Confluence ETBZ — the five pages the bundle binds
  (section 2 below) under the Rebaseline `62128133` section 4. Those pages are the
  decisions; this ADR records how the repository carries them.

## Context

The Bazodiac Interpretation Skill (ETBZ-38 / ETBZ-52) must interpret only through
the contracts the Product Owner released — never from model memory and never from
a stale copy of a page. Until this slice the repository bound those contracts in
three separate places: the Method Profile as the hash-frozen registry
(`method-registry.ts`), the Lexicon and the Lens as two bindings inside the
MetaNarrativePlan module, and the ETBZ-30 artefacts by their version markers. The
Long-Form Contract was a documentation reference only, and the Cross-Reading
Individuality Contract released on 2026-09-28 (Confluence `72056833`) was bound
nowhere. No single artefact said "this is the contract set a Skill run is held
to", so nothing could refuse a run that named an unknown, stale or draft contract.

ETBZ-51 asks for a machine-readable bundle with a deterministic identity and
structural hash, the released identities with page and version provenance, the
Lens and Lexicon as consumable contracts, precedence and fail-closed rules, and a
drift test against unknown or unreleased versions — without duplicating the
source of truth as an unversioned text dump and without any new BaZi rule.

## Decision

### 1. One bundle, frozen like the registry

`src/application/skill/` carries `bazodiac-skill-contract-bundle@1.0.0` as values.
`buildSkillContractBundle()` assembles it, validates every invariant and publishes
`structuralHash` (`sha256:` over the canonical JSON of everything else).
`RELEASED_BUNDLE_HASHES` freezes the content per released version:

```
1.0.0   sha256:1c8f80c38b57748e65035a6bd2d671604fb19574cdf3355326352fbe0e19564e
```

`assertReleasedSkillContractBundle` refuses any other content (`BUNDLE_NOT_RELEASED`).
Changing a page version, widening a vocabulary or editing a wording table is a new
bundle version with a new hash and a Confluence re-binding — never an in-place edit.
The pattern is exactly the Method Registry's (ADR 0006).

### 2. The five sources, by page and released version

| Key | Identity | Page | Version | Owns |
| --- | --- | --- | --- | --- |
| `METHOD_PROFILE` | `bazi-method-profile@1.0.0` | 63012866 | 5 | SYMBOLIC_OPERATIONS |
| `LONG_FORM` | — (page released no identity) | 57802765 | 2 | NARRATIVE_STRUCTURE |
| `INTERPRETATION_LENS` | `grounded-reflective-synthesis-lens@1.0.0` | 67371029 | 1 | SEMANTIC_ENVELOPE |
| `TERMINOLOGY_LEXICON` | `terminology-wording-lexicon@1.0.0` | 67600385 | 1 | CUSTOMER_WORDING |
| `ANTI_BOILERPLATE` | `cross-reading-individuality-contract@1.0.0` | 72056833 | 1 | CROSS_READING_INDIVIDUALITY |

Every page id and version was read back from Confluence on 2026-09-28 before it
was written here. Each entry also carries the page's own **Decision date** line as
`releasedOn` (2026-09-17, 2026-09-13, 2026-09-21, 2026-09-21, 2026-09-28 — never a
page-version timestamp) and the page's **Normative dependencies** list as
`dependsOn` (a page that lists another only as "Related" depends on nothing here).
A run's evidence references a contract by its released identity, or — for the
Long-Form Contract, which released none — by the repository address
`confluence:57802765@2`. That address is a pin, not a claim that the page released
an identity, and it is the wrong reference form for any page that did release one.

The bundle also pins what the repository already binds and refuses to disagree
with it (`BUNDLE_BINDING_MISMATCH`): `METHOD_PROFILE_REF`, the released registry
hash, `INTERPRETATION_INPUT_SCHEMA_VERSION`, `FEATURE_SET_VERSION`,
`INTERPRETIVE_CLAIM_GRAPH_VERSION`, `META_NARRATIVE_PLAN_VERSION`, and the plan
module's `TERMINOLOGY_LEXICON_BINDING` / `INTERPRETATION_LENS_BINDING`. The registry
release gate is composed, not re-implemented: building against an unreleased
registry fails with the registry's own `REGISTRY_NOT_RELEASED`.

### 3. Precedence is domain-scoped

The pages define precedence in four clauses that a single total order would
misstate. The Lens: "If this page conflicts with the current Rebaseline, Method
Profile, Long-Form Contract, FuFirE facts, or a released terminology contract, the
higher-authority contract wins." The Lexicon: "Where this page conflicts with FuFirE
validated facts, the Method Profile, the Interpretation Lens, the Long-Form Contract,
or the current Rebaseline, the higher-authority contract wins." The Anti-Boilerplate
contract: "Where this page conflicts with FuFirE validated facts, the Method
Profile, the Long-Form Contract, the Interpretation Lens, the Lexicon or the current
Rebaseline, the higher-authority contract wins." Each of the three names the other
two as higher authority; what resolves that is **ownership**, which the pages also
state — the Lens "defines semantic permission, not final copy" and names ETBZ-37 as
owning "cross-reading uniqueness/evaluation policy" (Lens section 20), the Lexicon
"owns customer terminology and wording boundaries only", the Anti-Boilerplate
contract "owns cross-reading individuality … and nothing else". The bundle
therefore records **tiers** and **owned domains**:

```
tier 1  METHOD_PROFILE                                   decides everything below
tier 2  LONG_FORM                                        decides everything below
tier 3  INTERPRETATION_LENS · TERMINOLOGY_LEXICON · ANTI_BOILERPLATE
        each decides only inside the domain it owns
```

FuFirE's validated facts stand above tier 1 and are not a contract entry. A
contract in no tier or two tiers, a domain with two owners or with none is
`PRECEDENCE_CONFLICT`.

### 4. The Lens, the Lexicon and the Anti-Boilerplate contract as values

`semantic-envelope.ts`, `wording-boundaries.ts` and `individuality-contract.ts`
carry the closed vocabularies of the three pages — epistemic levels, Ten-God
families and variants, depth operators, claim types, Barnum patterns and
near-neighbour features; the terminology matrix, Ten-God wording in both
languages, uncertainty language, unknown-time and source-warning wording, metaphor
conditions, the six prohibited wording classes, the anti-phrase-bank rule; the
individuality rules, dimensions, checks, fifteen reason codes with their class,
the Golden-Run minimum and the stop conditions. Every block names the section it
represents. This is the executable representation the Method Profile already
established for itself: Confluence owns the text, the code carries the closed sets
a machine can hold a run to, and the hash freezes them together.

The modules carry **no customer sentence beyond the Lexicon's own preferred
patterns** (67600385 sections 7 and 8, which the page itself marks "Preferred") —
the Lexicon is a semantic constraint, not a phrase bank (section 14) — and **no
number**: the bundle refuses a numeric value anywhere in its contract data
(`BUNDLE_SCHEMA_INVALID`), so no threshold, weight or score can enter through a
contract file. Where a page names no method, none is bound: the terminology matrix
binds a `methodRef` only on the five rows whose MethodRef column names one, and
carries that column verbatim on the other nine. The Lens's near-neighbour features
and the two policy-method references (`provisionality_unknown_time`,
`source_warnings`) are repository-derived readings of the registry's own operation
descriptions, not page-stated mappings; every such reference must still be an
approved registry method (section 5).

### 5. A contract file holds no symbolic authority

Every `methodRefs` entry in the bundle must be an approved method of the released
registry (`METHOD_REF_OUT_OF_PROFILE`), and the bundle names the whole minimum
sellable core. Contract data that carries `methods`, `facts`, `factKinds`,
`operations`, `enabledSets` or a deterministic mapping under any key is refused
outright (`SYMBOLIC_AUTHORITY_REFUSED`). That key list is a denylist and defence in
depth only; the gate that cannot be talked around is the content equality with the
repository bundle plus the frozen hash. The registry stays the only place a method
or a fact kind exists.

### 6. The portable copy is a carrier, never an authority

`renderPortableSkillContractBundle` emits the canonical JSON a Skill package ships
beside its prompt; `npm run etbz51:bundle` prints it from the compiled module.
`acceptPortableSkillContractBundle` takes such a copy back and returns **the
repository's bundle**, never the copy: a copy with a prototype key at any depth or
an extra top-level key (`BUNDLE_SCHEMA_INVALID`), a `DRAFT` status
(`DRAFT_CONTRACT_REFUSED`), an extra or missing key inside a vocabulary block, a
changed page version or a widened list even with a recomputed hash
(`CONTRACT_OVERRIDE_REFUSED`), or a different published hash
(`BUNDLE_NOT_RELEASED`) is refused with the path that differs and never the value.
Equality is canonical-content equality: a copy whose keys are merely reordered is
the same content.

### 7. Drift test for a run

`assertRunEvidenceBound` checks a run's recorded contract set against the bundle:
another bundle version or a known contract at another version is
`CONTRACT_DRIFT`; the right identity on the wrong page or version is
`CONTRACT_SOURCE_MISMATCH`; a reference nothing released is
`UNKNOWN_CONTRACT_IDENTITY`; a bound contract the evidence omits is
`REQUIRED_CONTRACT_MISSING`. Re-binding is explicit, never silent.

### 8. It is a leaf, and it is proven

`tests/architecture/etbz51-skill-boundary.test.ts` pins the module list, allows
imports only from `zod`, the interpretation modules it binds and the domain
hashing primitives, forbids clock, randomness, process, filesystem, network, model
calls and prose generation, forbids a data file beside the modules, and requires
that no served layer imports the bundle (since ETBZ-55, ADR 0012, the presentation
projection is its one application consumer, through the index).
`scripts/verify-etbz51-skill-contract-bundle.mjs` (`npm run guards:etbz51`, part of
`ci-verify.sh`) weakens each guard in turn with the ETBZ-30B kill semantics — a
named killer test must fail an assertion — and requires the suites to turn red.
Every `throw` site of the bundle module has a mutant and a test that names it.

## Consequences

- ETBZ-52 has one thing to bind: the bundle reference and hash go into the Skill
  package and into every run's evidence, and `assertRunEvidenceBound` is the drift
  gate for that evidence.
- A new release of any of the five pages is visible: it cannot be consumed until
  `RELEASED_CONTRACT_SOURCES`, the plan bindings where applicable and
  `RELEASED_BUNDLE_HASHES` change together in one reviewed slice.
- The Long-Form Contract remains without a released identity. The bundle pins it
  by page and version; a future release of a `@version` identity for that page is
  a bundle change, not an edit of the page address.
- `contracts/` still contains only `README.md`; the bundle ships as values, so the
  scope fence of `no-business-surface.test.ts` is unchanged.

## What this ADR does not decide

- The Skill package, its prompt, wrappers and output schema (ETBZ-52).
- Any check the Anti-Boilerplate contract defines; the bundle carries the
  vocabulary, the run executes the checks (ETBZ-52 / ETBZ-54).
- Any BaZi method, mapping or fact kind — none is added, none is enabled.
- A released identity for the Long-Form Contract.

## Evidence

Recorded in the pull request for this slice: exact head, `npm run guards:etbz51`
output (mutants killed / total, baseline after restore GREEN), the full gate, and
the independent review.
