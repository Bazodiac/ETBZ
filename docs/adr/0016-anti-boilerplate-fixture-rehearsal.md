# ADR 0016 — The Anti-Boilerplate fixture rehearsal and the evaluation withdrawal (ETBZ-59)

- **Status:** Proposed — PR open. Merge is governed by the Product Owner's delivery program of 2026-09-30 (Jira
  ETBZ-2 comment 16866: routine in-slice merges after the gates), subject to the merge gate on the exact head.
- **Date:** 2026-10-02
- **Slice:** ETBZ-59 [PRE-GOLDEN] — the minimum of section 8 of `cross-reading-individuality-contract@1.1.0`
  (Confluence 77266967 v3) executed once on the synthetic case Musterkundin A, before `GOLDEN_RUN_READY`.
- **Base:** `main@d0cc88b81589db3519144867007c292380c3d7a5` (ETBZ-53 closed out).
- **Canonical product text:** Jira ETBZ-59 and its comments 17034 (slice start, D-59-1, D-59-2), 17037 (D-59-3) and
  17038 (D-59-4); Jira ETBZ-53 comment 17031 (D-53-6, D-53-7); Jira ETBZ-54 comments 17032 and 17035 (bindings);
  Rebaseline `62128133` section 18 (v18).

## Context

Section 8 binds the Golden run (ETBZ-33 / ETBZ-54) to a near-neighbour case with a distant foil (6.1), a fact-mutation
case and a fact-removal case (6.3, 6.4), an anchor ablation (6.5), the swap re-validation against both foils (6.2) and
a cross-reading reuse scan (6.7). A BLOCKING code ends a Golden run with no reroll (section 11). On `main` the checks
were only declared (`src/application/skill/individuality-contract.ts`); ETBZ-52 had deferred them to ETBZ-54
(comment 16744). The Product Owner placed one full execution on a synthetic case before the Golden run (D-53-7).

The slice start measured three gaps (comment 17034): no admissible path to a removal case; the ETBZ-58 drafts cite no
fact of the hour pillar, which is the named difference of the planned near neighbour; and the builders compare cited
values only through claim ids. The rehearsal then found two more, in the acceptance boundary itself (comments 17037,
17038).

## Decision

### 1. The evaluation withdrawal (`src/`, PO decision D-59-1)

`withdrawFactsForEvaluation(model, factIds, reference)` (`src/application/interpretation/feature-set.ts`) records a
withdrawal on the model (`evaluationWithdrawal`, part of the canonical text, so a variant is a different chart
identity). The feature set keeps each withdrawn fact as evidence but excludes it from interpretation with the new
reason `WITHDRAWN_FOR_EVALUATION`; the ordinary builders then refuse every claim that cites it
(`CLAIM_EXCLUDED_FACT_CITED`, with a message naming the withdrawal). An input built from such a model carries the
blocker `EVALUATION_WITHDRAWAL_PRESENT` and is never production-eligible. Refusals, each with its own code: an empty
list, an unknown or duplicate id, no decision reference, an unknown-time chart (the two exclusion reasons never mix),
a second withdrawal, and the two facts the theme graph anchors on (`NARRATIVE_ANCHOR_FACT_IDS`: day master, month
command) - a withdrawal of either had crashed the theme graph with a `RangeError` before. A model without a
withdrawal is byte-identical to before; every frozen hash of the suite still holds.

Jira's bounded goal says "ein Faktentyp" for the removal case; D-59-1 and contract section 6.4 allow withdrawing named
facts, and the rehearsal withdraws one Ten-God relation (the hour branch's Seven Killing and its element relation),
the contract's own example.

### 2. The variants (live FuFirE, PO decisions D-53-6, D-53-7)

Computed through the ETBZ-58 live stage (`npm run etbz59:variants`), attested against FuFirE `8ad7dce6`, recorded under
`docs/evidence/etbz-59/variants/`: N = `KNOWN_BIRTH` at 16:30 (FuFirE reads civil time: Wei -> Shen block; the named
difference is the hour pillar and the Wu Xing tally it feeds), D = `KNOWN_BIRTH` dated 1974-09-24 (shares only the hour
branch). The two readbacks carry the public OpenAPI digest under `openapiSha256` and are exempted under
`.gitleaksignore` bar C, pinned byte for byte by `tests/contract/etbz59-individuality-evidence.contract.test.ts`.

### 3. The drafts (PO decision D-59-2)

`tests/support/etbz59Cases.ts`. The ETBZ-30A/30B claims of Musterkundin A, with the distribution claim citing the five
Wu Xing weights it describes, plus one local claim on the hour pillar: in S the hour branch's hidden stems repeat the
month branch's controlling Ten-God voice; in N they repeat the month pillar's expressive one; N's tally ties (Feuer 3,
Metall 3), so N has its own tie claim, no tally/day-master tension and no QUALIFY chapter over them. Each case pins the
values of the facts its claims cite. An independent instance reviewed the drafts in three rounds: FAIL (the
distribution claim was false on N's tie), FAIL (the ETBZ-30A wording counted mentions, not weight; N's QUALIFY chapter
had nothing licensed to say), PASS WITH MINOR (term lists). The plans are asserted role for role against the ETBZ-30B
baseline.

### 4. The deterministic checks (`tests/support/etbz59Individuality.ts`)

Evidence orchestration, composed of exported builders only (ADR 0015's rule). The swap re-validation (6.2) re-builds
the source's accepted graph and plan against the foil's chart, rebinding the run bindings only (the brief hash in the
graph draft; the brief and graph hashes in the plan draft) and keeping the accepted claim ids, which hash the cited
values. The comparison under a named difference (6.1, 6.3) works on statements ("the same claim" is the same
statement, contract 6.1 step 2) and on the plan's thesis, motif cores and tensions; the removal check (6.4) requires
each dependent claim to be refused on the reduced chart and absent from its reading. Candidate finders for the prose
side of 6.4 (a withdrawn subject together with its position, whole words) and of 6.7 (verbatim interpretive sentences)
locate passages; they decide nothing. The provisionality direction (IND-8, section 8.2) compares each source claim
with the variant's claim of the same statement on its epistemic class and its provisional facts. Findings use the
closed vocabulary of section 7, never a score.

### 5. The cones before the readings

`docs/evidence/etbz-59/pre-run-cones.json` (contract 6.3 step 1, section 8.2) was committed before any reading of the
three cases existed: the named difference, its cone on S, the removal set and its cone, the candidate terms, and the
graph and plan hashes the readings are bound to.

### 6. The acceptance boundary (PO decisions D-59-3, D-59-4)

The readings exposed that `acceptSkillReading` stopped at the first violation of any check, so the one repair the Skill
wrapper allows (step 5) could not see the rest: R(S) and R(N) ended after two length refusals, R(S⁻) after a length
refusal had hidden a template hedge. Now a chapter-length refusal names every chapter outside the budget (D-59-3), and
from the chapters on the boundary records each violation and goes on, so that a refusal carries the full list of one
pass on `SkillRunError.diagnostics` (D-59-4). The refusal is still the FIRST violation, the error it was refused with
before: what is accepted and which code a refusal carries are unchanged (every existing ETBZ-52 and ETBZ-57 negative
test passes without a change to it, and both guards still kill every mutant: 60/60 and 55/55). Two bookkeeping guards keep the list free of follow-on entries (claims credited before a
paragraph's checks; the chapter checks in `try`/`finally`). Lines the ETBZ-52 and ETBZ-57 mutation guards match byte
for byte are unchanged.

### 7. The readings

One fresh Claude Code subagent instance per case (`claude-opus-5-5` as reported), under `wrappers/claude.md`, reading
only the Skill files and its own package, writing outside the worktree; REALISE, at most one repair, then EDIT, each
accepted by the boundary. Run 1 of each case ended (two refusals each; archived under `run-1/`). Run 2 added a length
target to the invocation (600-900 words, aim 700-750), which the Golden run uses too. Each run-2 reading needed one
repair of one leaf (an understated SUPPORTED paragraph, a meta word, a clinical word), then passed REALISE and EDIT.

### 8. The judgements

Two fresh instances, independent of the drafter, of the Skill instances and of each other (Jira ETBZ-59 AC4). Each
read only its packet with the Read tool (recorded in `judges/<A|B>/tool-calls.txt`, checked by the contract suite).
Judge A attributed two unlabelled readings to three mixed charts (6.1 step 4). Judge B judged ablation (6.5), reuse
(6.7) and the prose side of the removal (6.4), and N's tie. The packets are a function of the committed evidence
(`tests/support/etbz59Judges.ts`, `npm run etbz59 -- packets`); the suite re-derives all 15 files byte for byte.
`judgements.json` records each verdict and its reason code, and quotes the passages it rests on with their paths. The
suite finds every quote verbatim in the accepted reading at that path. An LLM judge is never the sole oracle for a
reason code (contract section 10): the runner measured the chart facts and claim citations behind the BLOCKING
verdict, and the suite re-derives them.

### 9. The outcome (`docs/evidence/etbz-59/individuality-record.json`, re-derived byte for byte)

| Section 8 item | Outcome |
| --- | --- |
| 8.1 near neighbour (6.1) | the hour claim and the tally claim are recomposed, no dependent claim survives; `LEGITIMATE_SHARED_CLAIM` for the rest; blind attribution PASS for both readings against both foils |
| 8.2 mutation and removal (6.3, 6.4) | the cones were committed before the readings; no in-cone claim survives the mutation and the thesis is outside its cone; the withdrawn claim is blocked (`CLAIM_EXCLUDED_FACT_CITED`) and absent; no rescue in R(S⁻); provisionality direction (IND-8): only EQUAL and REMOVED |
| 8.3 ablation (6.5) | the thesis passages of R(S) and R(N) pass; one illustrative passage of each leaves `BARNUM_RESIDUE` (ADVISORY) |
| 8.4 swap (6.2) | refused on N (`CLAIM_METHOD_WITHOUT_EVIDENCE`) and on D (`CLAIM_UNKNOWN_FACT`) |
| 8.5 reuse (6.7) | no verbatim sentence; four `FIXED_METAPHOR_REUSE` (ADVISORY); one `STOCK_PARAGRAPH_REUSE` (BLOCKING) |
| 8.6 codes | all recorded with passages; the BLOCKING code carries its smallest repair, not applied |

The BLOCKING code: R(S) and R(N) both state that the controlling Ten-God family shows on no pillar's surface. No
claim of either reading cites a visible Ten God other than the month's. The statement holds for S. It is false for N,
whose hour stem DirectOfficer controls the day master, a fact in N's package. The paragraph was produced from the
shared primitive family and did not respond to the named difference. Judge B notes that the verdict rests on this one
proposition. Outside the contract's codes, judge B also records the sentence as an ungrounded generalisation for N
(OVERREACH belongs to the Lens and Lexicon gates). Smallest repair: on fixtures, confine the statement to the cited
positions. For the Golden run, which has no reroll, add one hard law to the Skill: no statement about positions the
paragraph's cited facts do not name. That needs a new Skill identity, which is a Product Owner decision outside this
slice.

## Consequences

- The rehearsal raised one BLOCKING code (`STOCK_PARAGRAPH_REUSE`). In a Golden run that code ends the run with no
  reroll (contract section 11). Whether the Skill gets the hard law named as the smallest repair before ETBZ-54 is a
  Product Owner decision; the ADVISORY codes (`BARNUM_RESIDUE` x2, `FIXED_METAPHOR_REUSE` x4) go to the Product Owner
  with it.
- The illustrative scenes ("Erkennbar ... etwa in Momenten, in denen ...") carry no anchor in most interpretive
  paragraphs (judge B); they are where the residue of 6.5 lives.
- ETBZ-54 reuses, unchanged: the withdrawal, the deterministic checks, the cones-first order, the boundary's
  diagnostics, the per-case instances, and the length target in the invocation.
- The Golden drafts must cite at least one fact of the hour pillar (D-59-2), or the swap against N re-validates
  (`READING_VALIDATES_AGAINST_FOIL`, BLOCKING).
- A Golden distribution claim must name all tied maxima when the tally ties (Method Profile 6.2) - the rehearsal's N
  shows that a reused single-leader claim is false on a tie and that a pin on `chart.wuxing.dominant` alone cannot see it.

## Accepted limitations

1. The qualitative steps (blind attribution, ablation, reuse judgement, the paraphrase side of rescue) are judged by
   independent LLM instances, not mechanised; their verdicts are recorded with the passages they cite, and are never
   the sole oracle for a code (contract section 10).
2. Which model wrote a reading is declared, not measured (as in ETBZ-52/57/58).
3. The diagnostics list the first violation per paragraph, chapter, reflection question and visual spec, not every
   violation inside one paragraph.
4. 6.6 (charts sharing exactly one primitive) is not part of the section-8 minimum and was not run.
5. The rescue finder's pre-registered terms missed a paraphrased subject in its positive control (R(S) [5.2]); the run
   record adds a position-only triage, and the 6.4 verdict rests on judge B's reading of the whole of R(S⁻).
