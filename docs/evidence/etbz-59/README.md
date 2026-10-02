# ETBZ-59 — Anti-Boilerplate section-8 fixture rehearsal

This is one complete execution of the section-8 minimum of `cross-reading-individuality-contract@1.1.0` (Confluence
77266967 v3) on the synthetic case Musterkundin A, run before `GOLDEN_RUN_READY` (PO decisions D-53-6 and D-53-7, Jira
ETBZ-53 comment 17031). The decisions are recorded in ADR 0016. Everything here is synthetic. No Golden value was used
or viewed.

## What is here

| Path | What it is | Written by |
| --- | --- | --- |
| `variants/{near,distant}/` | N (`KNOWN_BIRTH` at 16:30) and D (`KNOWN_BIRTH` dated 1974-09-24), computed live by the attested FuFirE runtime: readback and response bodies | `npm run etbz59:variants` (operator only; the ETBZ-58 live stage) |
| `pre-run-cones.json` | the named difference, the dependency cones, the removal set and the candidate terms, all committed before any reading existed (commit e9db90a) | `npm run etbz59 -- cones` |
| `cases/<source\|near\|removal>/skill-input.json` | each case's Skill input package | `npm run etbz59 -- emit` |
| `cases/<label>/run-1/`, `run-2/` | each refused REALISE attempt, kept unchanged | the Skill instances |
| `cases/<label>/semantic-reading.json`, `skill-reading.json`, `accepted-reading.json` | the accepted REALISE reading, its accepted EDIT revision, and the accepted result | the Skill instances; `npm run etbz59 -- accept <label>` |
| `judges/A/`, `judges/B/` | what each independent judge read (its packet), the brief, the verbatim report and the tool calls; `KEY-operator-only.json` resolves judge A's blind labels | `npm run etbz59 -- packets` for the packets; the judge instances for the rest |
| `judgements.json` | every verdict with its reason code, quoting the passages by path; for the BLOCKING code, the runner's corroboration and the smallest repair | the Delivery Runner, from the two reports |
| `individuality-record.json` | the run record: identities, runs, accepted hashes, the deterministic outcomes, the IND-8 direction and the section-8 items | `npm run etbz59 -- record` |

`tests/contract/etbz59-individuality-evidence.contract.test.ts` re-derives the 14 packet files with the operator key and
the BLOCKING facts from the committed files. It pins the run record as merged at e5ccc94c and checks every file the
record names at its hash, because ETBZ-60's boundary refuses these readings (ADR 0017 section 3). It finds every quote
of `judgements.json` verbatim at its path, and checks that each judge read only its own packet. `npm run guards:etbz59`
holds 47 source mutants. Each one must be killed by
an assertion of the test named for it.

## The outcome

| Section 8 | Result |
| --- | --- |
| 8.1 near neighbour (6.1) | no dependent claim unchanged; blind attribution PASS for R(S) and R(N) against both foils |
| 8.2 mutation and removal (6.3, 6.4) | cones listed before the run; the mutation case is N itself (D-53-6), whose cone does not reach the thesis; no finding; the withdrawn claim blocked and absent; no rescue in R(S⁻); IND-8: EQUAL or REMOVED only |
| 8.3 ablation (6.5) | two thesis passages pass; two others leave `BARNUM_RESIDUE` (ADVISORY): R(S) [2.5], R(N) [2.5] |
| 8.4 swap (6.2) | refused on N and on D |
| 8.5 reuse (6.7) | `FIXED_METAPHOR_REUSE` x4 (ADVISORY); **`STOCK_PARAGRAPH_REUSE` x1 (BLOCKING)** |

The BLOCKING code concerns one statement that both readings make: the controlling family appears on no pillar's
surface. No claim cites it. It holds for S. For N it is false on the family reading N's own chapter 2 defines (its
hour stem DirectOfficer controls the day master); read narrowly as the Seven Killing alone it is true but uncited.
Judge B notes that the verdict rests on this one proposition. Its smallest repair is recorded and not applied:
the repair is a separate Product Owner decision (Jira ETBZ-59). In a Golden run this code ends the run with no reroll
(contract section 11).

## Limits

- The judges are LLM instances, never the sole oracle for a code (contract section 10). The BLOCKING verdict is
  corroborated by measured facts; the ADVISORY codes are candidates until the Product Owner judges the quoted passages.
- The judges' briefs, reports and tool calls were extracted by the runner from transcripts that are not in the
  repository.
- Which model wrote a reading or judged it is declared, not measured.
- The candidate finders only locate passages. Judge B read every reading in full.
