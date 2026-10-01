# ETBZ-58 — Pre-Golden rehearsal: evidence

One non-Golden known-time case from a fresh call at the live FuFirE boundary to the final PDF, its ArtifactManifest and the visual proof, without manual content editing between the stages (declared - see "What it does not show"; Rebaseline 62128133 section 18; Jira ETBZ-58). Decision record: ADR 0015.

- **Case:** Musterkundin A, through the canonical fixture input `KNOWN_BIRTH` only. It is referenced from `tests/support/narrativeFixture.ts`, not copied (Product Owner, Jira ETBZ-58 comment 16976). The case is synthetic and is not the Golden case: `GOLDEN-KT-01` stays reserved for ETBZ-53.
- **Graph and plan drafts:** the reviewed ETBZ-30A/30B drafts of that chart (PO decision D-58-1, comment 17021). They are used on the live chart only where the 11 facts they cite hold their reviewed values.

## Files

| File | What it is | Produced by |
| --- | --- | --- |
| `run/runtime-readback.json` | the runtime readback of the live stage. It holds the attestation verdict (expectation and observation), the probes (health, readiness, a call without credentials), the case input reference and its canonical digest, and one record per calculation call (request and response digest, status, length) | `npm run etbz58:live`, on `96601c7`, 2026-10-01 |
| `run/fufire/*.response.json` | the three response bodies (BaZi, Wu Xing, Natal) as the client read them - after HTTP content decoding; the wire encoding is not recorded | the same command |
| `run/skill-input.json` | the `bazodiac-skill-input.v1` package, derived from the recorded bytes | the same command; re-derived by the suites |
| `run/realise-attempt-1.refused.json` | the runtime's first REALISE reading, refused by the acceptance boundary | the Claude runtime (see Generation) |
| `run/semantic-reading.json` | its one repair (wrapper step 5), accepted | the same runtime |
| `run/skill-reading.json` | the EDIT revision (wrapper step 5a), accepted | the same runtime |
| `run/accepted-reading.json` | the revision as `acceptEditorialRevision` accepts it, with its `structuralHash` | `npm run etbz58:assemble -- assemble` |
| `presentation-projection.json` | the projection `buildSkillReadingProjection` builds from it | the same command |
| `bazodiac-reading.pdf`, `artifact-manifest.json`, `qa-report.json`, `contact-sheet.png`, `pages/` | the renderer's output. The 15 page renders are the ones Rebaseline section 18 and Jira step 4 name | `tools/pdf-renderer/render_pdf.py` on `39719a1`, 2026-10-02; the manifest's DETERMINISM check compares in-process renders; a second render process produced the same PDF digest (measured, not committed) |
| `visual-verdict.json` | the visual evidence verdict | the Delivery Runner, by inspection |
| `rehearsal-record.json` | every identity of the run, from the case input to the ArtifactManifest and the verdict | `npm run etbz58:assemble -- seal` |

`tests/contract/etbz58-rehearsal-evidence.contract.test.ts` re-derives the Skill input package, the accepted reading, the projection and the run record byte for byte from the committed run, and binds the response bodies, the readback, the PDF, the QA report, the renders and the verdict by their digests; the live answers and the renders themselves are not re-derivable in CI. `tests/negative/etbz58-rehearsal.negative.test.ts` holds the orchestrator's negative paths, and `npm run guards:etbz58` proves its checks by source mutation.

## What the run shows

- **The runtime is the accepted build (AC 5).**
    - The expected OpenAPI document was reproduced from the FuFirE source at `8ad7dce6` before the run: 258,095 bytes, `24cd80c5…`. The live attestation observed the same digest and the same `source_revision`. Run with the parent revision `c914d567` instead, the attestation was BLOCKED (exit 2, `SOURCE_REVISION_MISMATCH`; measured before the run and recorded in Jira ETBZ-58 comment 17021, not committed here).
    - `/v1/health` and `/v1/ready` answered 200, and a calculation call without credentials was refused with 401.
    - The live stage sends no calculation to a runtime whose attestation fails or that is not ready (negative suite). The call without credentials is probed after the three calculations: a runtime that answers it is refused, the run fails, but it has already answered the authorised calls.
- **The end-to-end path (AC 1, AC 2).**
    - The three known-time calls were answered and recorded.
    - The InterpretationInput is production-eligible: the attestation re-derives to PASS for the OpenAPI document the chart is pinned to, and the birth time is known.
    - The claim graph and the plan were accepted against the live chart, and the Skill input package was built under bundle 1.1.0.
    - REALISE, its repair and EDIT were accepted by the boundary.
    - The projection, renderer, QA and manifest followed without a manual step.
    - The suites replay the recorded bytes through the same client and use case.
- **No reading was reused.**
    - The accepted reading (`sha256:19e131cd…`) is not the ETBZ-57 reading (`a0911b08…`).
    - The ETBZ-57 reading is refused against this package (`READING_PACKAGE_MISMATCH`).
- **Final PDF QA (AC 3).** `ARTIFACT_READY`, `QA_PASSED`, every check PASS, including the final-artifact readback (`PDF_TEXT_LAYER`, `PDF_VECTOR_LAYER`). The renderer sources are those of ETBZ-55/56, `sha256:f971a44b…`, whose canary record holds 167/167 canaries and 4/4 controls.
- **Visual verdict (AC 4).** `VISUALLY_FIT_FOR_GOLDEN`, no defect, four observations (`visual-verdict.json`).
- **Provenance (AC 5).** The case input digest, runtime and contract references, response digests, every chain hash (input, graph, plan, package, both readings, projection), the template and renderer identities, the PDF digest, the QA state and the ArtifactManifest digest are all in `rehearsal-record.json`.

## Negative paths (AC 6)

| Path | Where it is proven |
| --- | --- |
| attestation not passed, runtime not ready | `etbz58-rehearsal.negative.test.ts` (no calculation is sent) |
| a runtime that answers a call without credentials | `etbz58-rehearsal.negative.test.ts` (the run is refused; the probe follows the calculations) |
| recorded evidence tampered, another request, an unrecorded call, a recorded call left unanswered | `etbz58-rehearsal.negative.test.ts` (a call answered twice is refused by the same check; the use case makes each call once, so that branch is not reached) |
| an attestation that is typed as PASS or does not pass | `etbz58-rehearsal.negative.test.ts` (`INTERPRETATION_INPUT_ATTESTATION_FOREIGN`, `REHEARSAL_NOT_PRODUCTION_ELIGIBLE`) |
| a live chart that answers a fact the reviewed drafts cite differently | `etbz58-rehearsal.negative.test.ts` (`REHEARSAL_DRAFT_FACTS_DRIFTED`) |
| an existing reading presented as this run's | `etbz58-rehearsal.negative.test.ts` (`READING_PACKAGE_MISMATCH`) |
| invalid BirthInput (zero FuFirE calls) | `tests/unit/fufire-http-client.test.ts` (`BIRTH_INPUT_INVALID`) |
| FuFirE unavailable, contract drift, response validation | `tests/unit/fufire-http-client.test.ts`, `fufire-natal-client.test.ts`, `wuxing-consumer-boundary.test.ts` (`FUFIRE_SERVER_ERROR`, `FUFIRE_TIMEOUT`, `FUFIRE_NETWORK_ERROR` in the natal client, `FUFIRE_CONTRACT_ERROR`); `tests/unit/raw-evidence-binding.test.ts`, `interpretation-input.test.ts` (`INTERPRETATION_INPUT_RAW_EVIDENCE_*`); `tests/unit/runtime-attestation.test.ts` (OpenAPI and revision mismatch) |
| unknown fact or method reference, schema failure | `tests/negative/etbz52-skill-reading.negative.test.ts` (`READING_FACT_UNKNOWN`, `READING_SCHEMA_INVALID`); `tests/unit/interpretive-claim.test.ts`, `method-registry.test.ts` (claim and method grounding) |
| provisionality laundering | `etbz52-skill-reading.negative.test.ts`, `etbz57-voice.negative.test.ts` (`READING_PROVISIONALITY_LAUNDERED`) |
| invalid visualization reference | `etbz52-skill-reading.negative.test.ts`, `etbz56-skill-presentation.negative.test.ts` |
| animal mapping failure | `tests/unit/etbz56-branch-animals.test.ts` (`PRESENTATION_BRANCH_ANIMAL_UNMAPPED`) |
| PDF QA failure | the renderer canary record (`docs/evidence/etbz-55/renderer-canaries.json`, 167/167 on these renderer sources) |
| manifest or hash mismatch | `etbz56-skill-presentation.negative.test.ts` (`PRESENTATION_SKILL_BINDING_MISMATCH`); this folder's contract suite |

## Findings of this run

1. **The fixture chart is not FuFirE's answer in the hour branch.**
    - FuFirE answers the hidden stems of 未 (Wei) as Ji, Ding, Yi (principal, central, residual), the classical order. The hand-written fixture chart of ETBZ-52/55/56/57 has Yi and Ding swapped, which affects 8 of 101 facts.
    - No claim cites them.
    - The fixture-based evidence keeps the fixture order (for example the "Verborgene Stämme" page of ETBZ-56); correcting it would break the released ETBZ-57 hashes. Recorded for the Product Owner.
2. **The method-language gate matched the conjunction "ehe"** ("noch ehe ein Ergebnis vorliegt", i.e. "before") as marriage vocabulary and refused the first REALISE attempt. The repair replaced one word. The gate is unchanged here; it is a candidate for the word list's maintenance.
3. **The builders do not pin a claim's facts to the values it was reviewed against.** A consistent change of a cited Ten God was refused only by an incidental method check. The orchestrator adds the pin (`assertDraftFactsHold`).
4. **Drafting for a new chart is not contracted.** Who drafts graph and plan for `GOLDEN-KT-01` (ETBZ-54) is not decided (ADR 0008: "a person; one day the Skill"). This is open for GOLDEN_RUN_READY.

## What it does not show

- Whether any sentence of the reading is true of a person, specific enough or sellable; that is ETBZ-54's Human SELLABLE gate.
- No independent content review was run as a gate. The ETBZ-57 experience is that a direct voice drifts into overreach which the mechanical gates do not see.
- Which model wrote the text: the generation record is a declaration.
- That no person edited the reading between the stages: declared (`ETBZ58_GENERATION.noHumanEdit`). What is measured (contract suite): the repair changed exactly one leaf; the EDIT revision changed exactly 36 leaves - 3 chapter titles and 33 texts - and the boundary (`acceptEditorialRevision`) refuses any change outside customer text.
- That the instance read nothing but its input: this is its own report, not measured.
- That the drafting step works for a chart without reviewed drafts (finding 4).
- The prose-level anti-boilerplate checks that need a second reading.

## Re-run

1. Live stage: `npm run etbz58:live`. It needs `ETBZ_FUFIRE_BASE_URL`, `ETBZ_FUFIRE_API_KEY`, `ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256`, `ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION`, `ETBZ58_EXECUTED_AT` and `ETBZ58_REPOSITORY_HEAD`, each exported alone into a clean environment.
2. Generation: by the Skill wrapper. The operator runs `npm run etbz58:assemble -- check-realise <file>` and `-- check-edit <realise> <edit>`.
3. Assemble: `npm run etbz58:assemble -- assemble`.
4. Render: the renderer on `presentation-projection.json`.
5. Visual verdict.
6. Seal: `npm run etbz58:assemble -- seal`.
