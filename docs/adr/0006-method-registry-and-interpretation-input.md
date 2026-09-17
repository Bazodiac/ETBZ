# ADR 0006 — Method Registry v1.0.0, addressable facts and the interpretation hand-off

- **Status:** Proposed (PR open; merge requires explicit PO authorisation)
- **Date:** 2026-09-17
- **Slice:** ETBZ-34 (amended scope), prerequisite for ETBZ-30
- **Canonical product text:** Confluence ETBZ — *ETBZ — BaZi Method Profile v1* (version 1.0.0)

## Context

The Skill-driven concierge MVP hands a validated chart to a language model. Two
things must never happen there: the model uses a BaZi method ETBZ has no facts
for ("general BaZi knowledge"), and an uncertainty about the birth quietly
becomes a confident sentence.

## Decisions (Product Owner, 2026-09-17)

| Id | Decision |
|---|---|
| PD-3 | Recurrence of grounded occurrences may be described. No strength / salience / personality score. |
| PD-4 | Positional context may qualify a reading. No literal father / mother / spouse / child claims. |
| PD-5 | A report thesis or primary motif needs >= 2 distinct fact kinds AND >= 2 approved method contributions. MVP v1 has **no exception** and no caller-controlled option. |
| PD-6 | `InterpretiveClaim.methodRefs`, validated fail-closed. |
| PD-7 | FuFirE Ten-God labels are evidence; customer wording belongs to the Terminology & Wording Lexicon v1. |
| PD-9 | Canonical day boundary is `midnight`, sent explicitly — never the producer default. |
| PD-10 | With `birth_time_known=false`, assumed-time-derived hour facts are excluded from interpretation. |
| F-1 → A | ETBZ-34 carries the narrowly scoped Wu-Xing provisionality guard. |

## What this change does

- `method-registry.ts` — the versioned registry (42 methods; 14 approved). A
  deferred or forbidden method has no operation, is not claim-bearing and names
  its missing dependency. `validateMethodRegistry` fails closed, and refuses
  drift against the ETBZ-25 `method-scope.ts`.
- `feature-set.ts` — five new addressable fact kinds (`pillar_stem_polarity`,
  `ten_god_element_relation`, `hidden_stem_qi_role`,
  `hidden_stem_ten_god_element_relation`, `month_command_element`). No raw
  payload path may act as a `factRef`. Feature-set version is now
  `etbz-34.feature-set.v2`.
- Wu-Xing guard: with `birth_time_known=false` every `wu_xing_*` fact is
  provisional, because the producer's vector sums all four pillars.
- Hour exclusion: with `birth_time_known=false` every hour-pillar fact is
  `interpretable: false` (`ASSUMED_TIME_DERIVED`). It stays in the fact set as
  evidence, gets no theme, and citing it is refused
  (`REPORT_EXCLUDED_FACT_CITED`, `CLAIM_EXCLUDED_FACT_CITED`).
- `interpretive-claim.ts` — the claim contract with `methodRefs` and invariants
  I1–I6; `assertCentralClaimSignals` implements PD-5. This is **not** the
  ETBZ-30 claim graph or plan.
- `interpretation-input.ts` — `BazodiacInterpretationInput v1`, PII-minimised,
  bound to the registry hash, with a fail-closed production gate.
- FuFirE adapter sends `boundary: "midnight"`.

## Repairs after independent review (2026-09-18)

| Finding | Repair |
|---|---|
| A — raw producer evidence | The gateway snapshots now carry the wire body they were mapped from (`raw`). `BazodiacInterpretationInput v1` requires all three (`fufire.baziRaw` / `wuxingRaw` / `natalRaw`), refuses to build without one (`INTERPRETATION_INPUT_RAW_EVIDENCE_MISSING`) and refuses evidence of another chart (`INTERPRETATION_INPUT_EVIDENCE_NOT_SAME_CHART`). The block is `claimBearing: false`; the only semantic source remains `validatedChart.facts`, and a raw or model path is never a `factRef`. The raw bodies never enter the HoroscopeModel or its hash. Only the producer's ECHO of ETBZ's own request coordinates (`input.lat` / `input.lon` of `/bazi/wuxing`) is redacted, listed in `redactions`; each body's `payloadStructuralHash` is taken before redaction. |
| B — PD-5 escape hatch | `declaredDistinctiveSingleConfiguration` is removed. `assertCentralClaimSignals(claim, context)` takes nothing else. |
| C — season operations | `MARK_SEASON` and `CONTEXTUALIZE_SEASON` are removed: they need a branch→season mapping FuFirE does not deliver and nobody approved. The registry now carries `approvedDeterministicMappings` (empty in v1.0.0) and refuses any operation that names a season without the mapping (`REGISTRY_OPERATION_NEEDS_UNAPPROVED_MAPPING`). |
| D — honest enablement | `fact_relations` (`ANY_TWO_FACTS`) is enabled only if an identity pair exists; `positional_context` (`ANY_FACT_WITH_PILLAR`) only if an interpretable pillar fact is readable by an enabled non-modifier method. One rule, `isIdentityPair`, serves enablement and claim validation. Trivial identities (day master = day stem, month command = month branch, Hanzi/Pinyin spellings, Qi role, Wu-Xing tally) are not pairs. |
| E — generic provisionality | Pillar lineage already carried any producer-named pillar; the Wu-Xing trigger no longer assumes "hour" and fires for an unknown time OR any provisional pillar. Tests feed `["hour","month"]` and `["hour","year"]` and follow them into facts, themes, sections and claims. ETBZ never decides which day is a transition day. |

Known limit, not closed here: the `/bazi/wuxing` response carries its own
`precision.provisional_fields`, which the port does not map yet (it arrives
with the source-pillar work, ETBZ-34 AC 1). Until then the Wu-Xing facts follow
the accepted BaZi/Natal precision statements.

## What this change deliberately does NOT do

- **No ETBZ-owned time sentinel.** For an unknown birth time ETBZ keeps sending
  the date only. The noon normalisation is FuFirE's (Confluence BG 62259202;
  FUF-163 → FUF-164 → FUF-165). ETBZ does not duplicate it.
- **No production-support claim.** `assertProductionEligible` currently throws
  for every input: `WUXING_SOURCE_PILLARS_NOT_VERIFIED` (the rest of ETBZ-34) and,
  for unknown time, `UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED`.
- No astrology is calculated. Every check compares values FuFirE delivered. The
  only cross-fact checks are identity comparisons of accepted values
  (`month hiddenStem[0].stem === monthCommand.principalQiStem`, `isIdentityPair`).
- No season is named. FuFirE emits none, and no branch→season table exists here.
- Sheng/Ke stays in state A: only `ten_god.element_relation` from the source.

## Consequences

- Eight ETBZ-25 tests encoded the superseded policy ("hour facts are
  provisional but narratable", "Wu-Xing is never provisional") and were
  re-expressed, not deleted; each carries a comment naming the decision.
- The ETBZ-25 provisional-note guard is now proven on `primary.elemental_profile`
  instead of `primary.positional_context`.
- Once FUF-163/164/165 are delivered: map and validate the producer's assumption
  metadata, re-pin the OpenAPI hash, extend the real-boundary smoke, then lift
  the unknown-time blocker. Re-evaluate the Wu-Xing guard against the delivered
  precision contract.
