# ADR 0015 — The Pre-Golden rehearsal: one live known-time case to the PDF (ETBZ-58)

- **Status:** Accepted — merged to `main` as `949fb7b3` (PR #22, 2026-10-02). Merged under the Product Owner's delivery program of 2026-09-30 (Jira ETBZ-2 comment 16866: routine in-slice merges after the gates) after the merge gate on the exact head.
- **Date:** 2026-10-02
- **Slice:** ETBZ-58 [PRE-GOLDEN] — one non-Golden known-time case from a fresh live FuFirE call to the final PDF,
  manifest and visual proof, without manual content editing between the stages. Adds no interpretation, no
  template, no renderer and no production surface.
- **Base:** `main@383aba8a27aae93c49220a8fdc4d27c28da14144` (ETBZ-56 closed out).
- **Canonical product text:** Jira ETBZ-58 (AC 1-6) and its comments 16976 (the case), 17021 (PO decision D-58-1
  and the runtime readback) and 17023 (live stage, findings, the correction of 17021); Rebaseline `62128133`
  section 18 (v16).

## Context

Every earlier slice proved its stage on the hand-written fixture chart. The Golden run (ETBZ-54) must not be the
first time the whole machine runs against the live producer. ETBZ-58 runs it once with a non-Golden case: the
canonical fixture input `KNOWN_BIRTH` (Musterkundin A), freshly through the live FuFirE runtime, then through
every stage up to the PDF. Two boundaries were not settled by an existing contract:

1. **Who drafts the claim graph and the plan.** The Skill (1.1) renders an accepted graph and plan; ADR 0008 names
   the drafter "a person; one day the Skill". For Musterkundin A, reviewed drafts exist (ETBZ-30A/30B). The
   Product Owner decided (D-58-1) that the rehearsal uses them on the live chart.
2. **Where a live call may happen.** No test reaches FuFirE and `src/` exposes no such entrypoint beyond the server
   and the attestation CLI.

## Decision

`tests/support/etbz58Rehearsal.ts` composes the existing product chain in three stages; it re-implements none of
it, and nothing in `src/` changes.

| Stage | What it does | Refusal |
|---|---|---|
| live (`npm run etbz58:live`, an operator command under `vite-node`, not a test) | attestation first (`runFufireAttestation`): no calculation unless PASS; then `/v1/health` and `/v1/ready` 200; then the three calls through `createFufireClient` and the ETBZ-24 use case over a transport that records each response body as the client read it (after HTTP content decoding); then the BaZi call without credentials, which must be refused (401/403) - it follows the calculations, so it refuses the run, not the calls | `REHEARSAL_RUNTIME_NOT_ATTESTED`, `_NOT_READY`, `_AUTH_NOT_ENFORCED`, `REHEARSAL_PRODUCER_FAILED` |
| derive (offline) | replays the recorded bytes through the same client and use case: an unrecorded call, another request body, tampered bytes or a recorded call left unanswered are refused (the same check refuses a call answered twice, a branch the use case does not reach) with the rehearsal's own code; builds the InterpretationInput with the recorded attestation and requires it production-eligible; pins the facts the reviewed drafts cite (below); accepts the drafts; builds the 1.1.0 Skill input package | `REHEARSAL_REPLAY_*`, `REHEARSAL_EVIDENCE_TAMPERED`, `REHEARSAL_NOT_PRODUCTION_ELIGIBLE`, `REHEARSAL_DRAFT_FACTS_DRIFTED`, and every refusal of the chain unchanged |
| assemble (offline) | `acceptSkillReading` on the runtime's REALISE reading, `acceptEditorialRevision` on its EDIT revision, `buildSkillReadingProjection` | the `SkillRunError` and presentation codes unchanged |

**The draft-fact pin.** The graph and plan builders check a claim's grounding, fact kinds and methods; they cannot
compare its prose with a value. Measured: a consistent change of a Ten God the drafts cite was refused only by an
incidental method check. `assertDraftFactsHold` therefore pins the 11 facts the reviewed drafts cite to the values
they were reviewed against (the fixture chart) and refuses a live chart that answers any of them differently. The
hour branch's hidden stems, which the live runtime answers differently from the fixture, are not cited.

**The generation boundary** follows the Skill wrapper (`wrappers/claude.md`): a fresh Claude runtime instance
reads only the wrapper, `SKILL.md`, the bundle, the reading schema, the MANIFEST and the input package; the
operator runs the boundary; one refusal may be handed back once, a second ends the run; EDIT is a separate pass. The
generation is recorded as a declaration (`ETBZ58_GENERATION`): no repository gate can prove which model wrote a text.

**Evidence** (`docs/evidence/etbz-58/`): the readback and the response bodies, the package, the refused first
attempt, both accepted readings, the projection, the renderer output, the visual verdict and a run record
(`rehearsal-record.json`) that binds every identity from the case input to the ArtifactManifest. The contract
suite re-derives the package, the accepted reading, the projection and the record offline and binds the rest by
digest; `npm run guards:etbz58` (a `ci-verify` step) proves the orchestrator's checks by
source mutation (11 mutants).

## Consequences

- The machine ran once end to end against the live producer: attestation PASS on FuFirE `8ad7dce6` (OpenAPI
  `24cd80c5…`, reproduced from source), production-eligible input, accepted readings (REALISE after one repair,
  EDIT at the first attempt), `ARTIFACT_READY` / `QA_PASSED`, `VISUALLY_FIT_FOR_GOLDEN`.
- Findings for the Product Owner: the fixture chart swaps the central and residual hidden stems of the hour branch
  (FuFirE answers Ji, Ding, Yi); the method-language word list matches the conjunction "ehe"; drafting graph and
  plan for a chart without reviewed drafts (GOLDEN-KT-01) has no contract yet.
- The secret gate reads the attested OpenAPI digest (`openapiSha256`) in the readback and the record as a
  `generic-api-key` finding. The Product Owner added `.gitleaksignore` bar C (2026-10-02): a public content digest in
  evidence whose file bytes a contract test pins as literals, with the digest the only credential-shaped pair.
- The orchestrator lives in `tests/support/` like the other evidence emitters; promoting it to a production surface
  is not part of this decision.

## Accepted limitations

1. The pin covers the facts the drafts cite, not every fact a statement's meaning could depend on.
2. The live answers are re-derivable only through the readback: CI replays them, it does not call FuFirE.
3. The instance's input boundary is its own report; the evidence cannot measure what it read.
4. No content review gates this slice: whether the reading is specific, true or sellable is ETBZ-54's Human gate.
