# ETBZ-54 — Golden E2E run of GOLDEN-KT-01: evidence

This is the canonical Golden chain run on the frozen case `GOLDEN-KT-01` (Jira ETBZ-54). The Product Owner
authorised it in D-54-1 (comment 17073) and decided the repair and the re-render in D-54-2 (comment 17123).

The verdict is the Product Owner's. This folder records the evidence for it and assigns no `SELLABLE`.

## Where things are

The case is private (D-53-1..3, D-53-6). These files stay in the local archive
`/Users/Shared/ETBZ-golden/GOLDEN-KT-01/etbz54/` (folders 700, files 600), outside every repository:

- the drafts and their review;
- the variant N and its live record;
- the Skill input packages and every reading attempt;
- the judges' packets, briefs and reports;
- the projections, the renders, the PDF and the visual verdicts.

The repository receives only two files:

| File | What it is | Written by |
| --- | --- | --- |
| `pre-registration.json` | Keyed digests of the drafts, the draft review, the three packages, the pre-run cones and N's readback. Committed and pushed before any reading existed (`ac29e457`, 2026-10-02 20:16 UTC). | `npm run etbz54 -- preregister` |
| `golden-run-record.json` | The run record: identities, gate outcomes, reason codes with passage paths, and every archive file as an HMAC-SHA256 digest under the ETBZ-53 archive key (same key fingerprint as `docs/evidence/etbz-53/freeze-record.json`). | `npm run etbz54 -- record`; `-- verify` re-derives it byte for byte from the archive (local only) |

`assertGoldenRecordPrivate` refuses a record that would carry any of the following:

- a value of the input file;
- a plain SHA-256 that is not a public identity;
- a chart value;
- a claim statement;
- a reading sentence.

The tooling is generic and holds no case value: `tests/support/etbz54*.ts` and `run-etbz54*.ts`. Its refusals are
tested on the synthetic case in `tests/negative/etbz54-golden-run.negative.test.ts`. That suite also proves the
drafts-as-data path rebuilds the ETBZ-59/60 packages byte for byte.

## The run

1. **Frozen input.** It is unchanged: the ETBZ-53 record re-derives byte for byte and the oracle agrees on every fact.
2. **Variant N** (D-53-6) is the frozen input with the birth time moved to the neighbouring two-hour block, computed live
   by FuFirE:
   - attestation PASS;
   - health and readiness 200;
   - a call without credentials refused with 401;
   - its named difference is the hour pillar.

   D is Musterkundin A. S⁻ withdraws one Ten-God relation of S (D-59-1).
3. **Drafts** (D-53-4, D-59-2, D-60-1). The runner drafted them from the frozen chart facts alone, and an independent
   instance reviewed them:
   - round 1 FAIL: 2 MAJOR, a strength/rooting framing and an INTEGRATE chapter without integration, both fixed;
   - round 2 PASS WITH MINOR.
4. **Readings.**
   - Each was written by a fresh Claude Code instance per case, under the wrapper with the ETBZ-59 invocation. Skill
     1.1.0 and bundle 1.1.0 were passed explicitly; the Skill package is unchanged since `ce7af572`.
   - The first dispatch stopped at wrapper step 2: the one-line package of about 50,000 characters is cut off by the
     instance's Read tool. The instances were resumed with a pretty-printed copy of the identical value. No reading
     existed, so this was not a reroll.
   - R(S) and R(N) were each refused once and repaired once, and only the named paragraphs changed. R(S⁻) was accepted
     at the first attempt. Every EDIT pass was accepted and changed customer text only.
5. **Deterministic section-6 checks.**
   - The swap is refused against N and against D.
   - 6.1 raised only `LEGITIMATE_SHARED_CLAIM`.
   - 6.3 raised nothing.
   - In 6.4 the dependent claim is blocked and absent.
   - IND-8 shows EQUAL or REMOVED only.
6. **First render, 2026-10-02.** `PAGE_QA` BLOCKED on the Wu Xing distribution page: a weight with floating-point noise
   overflowed its label. The run stopped. The Product Owner judged it NOT_SELLABLE (`LAYOUT_FAILURE`) and opened
   ETBZ-61 (D-54-2).
7. **Judges** (independent, read-only, over the accepted readings):
   - A, blind attribution: PASS.
   - B, 6.4, 6.5 and 6.7: no BLOCKING code; ADVISORY `BARNUM_RESIDUE` ×4 and `FIXED_METAPHOR_REUSE` ×6.
   - C, overreach and safety: no SAFETY and no OVERREACH finding, two METHOD candidates, ten ADVISORY.
   - Outside the contract's codes, two whole-chart surface statements of R(S) are false. The runner corroborated both
     against the chart.
8. **Re-render, 2026-10-03.** The same accepted reading was re-rendered on the ETBZ-61 head (`01a85187`, which merges
   `e0798f84`):
   - `ARTIFACT_READY`, `QA_PASSED`, 11 of 11 checks;
   - renderer `f971a44b…` and template `d595ab7c…`, unchanged;
   - visual verdict `VISUALLY_FIT_FOR_GOLDEN`, no defect.

## Limits

- LLM judges are never the sole oracle for a code (contract section 10). The ADVISORY, METHOD and outside-contract items
  are candidates for the Product Owner's verdict.
- Which model wrote or judged a text is declared, not measured.
- `verify` needs the private archive and the archive key, so CI cannot re-derive the record. CI runs the generic
  tooling's suite.
