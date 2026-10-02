# ADR 0017 — Position statements are grounded: in the boundary and in the claim graph (ETBZ-60)

- **Status:** Proposed — PR open. Merge is governed by the Product Owner's delivery program of 2026-09-30 (Jira
  ETBZ-2 comment 16866: routine in-slice merges after the gates), subject to the merge gate on the exact head.
- **Date:** 2026-10-02
- **Slice:** ETBZ-60 [PRE-GOLDEN] — the repair of the BLOCKING `STOCK_PARAGRAPH_REUSE` the ETBZ-59 fixture rehearsal
  raised, before `GOLDEN_RUN_READY`.
- **Base:** `main@e5ccc94c52abef01c7e1d537f4bb4575095d0be3` (ETBZ-59 merged).
- **Canonical product text:** Jira ETBZ-60 and its comments 17046 (slice start, D-59-6) and 17047 (measurement, AC1
  corrected) and 17050 (D-60-1); Jira ETBZ-59 comments 17044 (closeout) and 17045 (D-59-5); Rebaseline `62128133`
  sections 17 and 18 (v19).

## Context

ETBZ-59 ran the section-8 minimum of `cross-reading-individuality-contract@1.1.0` on Musterkundin A. An independent
judge raised one BLOCKING code, `STOCK_PARAGRAPH_REUSE` (6.7). R(S) and R(N) both said that the controlling Ten-God
family shows on no pillar's surface. No claim of either reading cited this. It held for S. For N it was false on the
family reading N's own chapter defines: N's hour stem DirectOfficer controls the day master. In a Golden run that
code ends the run with no reroll (contract section 11), and Rebaseline section 18 records `GOLDEN_RUN_READY` only
when no Golden-blocking review blocker remains.

The Product Owner placed the repair before `GOLDEN_RUN_READY`, limited to the BLOCKING code (D-59-5). At the slice
start the runner measured two facts:

- SKILL.md 1.1.0 already forbids the statement. Law 3 says "no chart fact beyond the input"; section 3 step 2 says a
  paragraph names "only facts" its claims are grounded in. What was missing was the machine check.
- The boundary codes appear in neither `contract-bundle.json`, `reading-schema.json` nor `MANIFEST.json`.

Rebaseline section 17 binds a canonical Golden run to the exact identities accepted in ETBZ-57. The Product Owner
therefore decided to repair the boundary only (D-59-6). Skill 1.1.0 and bundle 1.1.0 stay unchanged, so that binding
holds: no rebinding of ETBZ-33 or ETBZ-54, and no new Editorial Gate.

## Decision

### 1. `READING_POSITION_UNGROUNDED` (`src/application/skill/skill-reading.ts`)

A sentence that states something of the chart's positions as a whole is grounded only when the paragraph cites a
fact of every pillar, directly or through a claim. The rule counts the four pillars by `ChartFact.pillar`. The forms
it recognises are:

| Form | Example |
| --- | --- |
| no position | "auf keiner Säule", "in keinem Zweig" |
| not on any position | "nicht offen oben auf einer Säule", "nicht an der Oberfläche einer Säule", "nicht offen in einem Himmelsstamm" |
| never at the surface | "ohne an die Oberfläche zu treten", "nie an der Oberfläche" |
| only one position | "nur im Monatszweig" |

Three kinds of sentence are not position statements:

- a defining relative clause about stems as a class ("Himmelsstämme, die nicht auf der Oberfläche einer Säule
  stehen …"; ETBZ-57's Editorial-Gate reading carries one);
- "nicht nur im …" and "nicht nur an einer …";
- sentences in which "nirgends" or "überall" says nothing about a position ("eine Erwartung, die nirgends formuliert
  ist").

The check runs last in the paragraph pass. Every other refusal therefore keeps its code, and the result joins the
D-59-4 diagnostics like any other check.

### 2. What was measured before it was built

- **Earlier slices.** Of the 19 committed reading files of ETBZ-52/57/58/59, the check refuses only the ETBZ-59
  readings:
  - R(S) at [2.2], [5.1] and [5.2];
  - R(N) at [2.1], [2.4] and [3.2];
  - R(S⁻) at [2.1] and [3.0].
- **R(S) [2.6].** Judge B grouped it into the BLOCKING cluster, but it is grounded (the month pillar's surface and
  branch), and the check does not refuse it. Jira comment 17047 corrects AC1 to this measurement.
- **Counter-proof.** R(S), with only its position statements confined to cited positions, is accepted again. The
  check is the only change in what is accepted.

### 3. The ETBZ-59 evidence

The ETBZ-59 run record was made under the boundary of e5ccc94c, and the new boundary refuses the readings it records.
It therefore stays as merged:

- the record is pinned byte for byte;
- every file it names is checked at its recorded hash;
- every accepted structural hash is recomputed from the reading itself.

Its re-derivation test is replaced, and the guard's RECORD mutant is replaced by mutants on the pin and on a named
file.

### 4. Round 1: the re-reading under the boundary alone (D-59-5)

One fresh Skill instance per case re-read R(S) and R(N). Each used Skill 1.1.0, bundle 1.1.0, `wrappers/claude.md`
and the ETBZ-59 run-2 invocation, with only the paths changed and no hint of the new check. The packages, graphs and
plans are ETBZ-59's. The repair message relays the code, the path, the matched phrase and the law, as in ETBZ-59.

Both readings were accepted after one repair each (`docs/evidence/etbz-60/round-1/`). R(N)'s first attempt was refused
for a position statement, and R(S)'s for a clinical word. Neither accepted reading carries a statement in the forms the
check catches. An independent 6.7 judge nevertheless raised `STOCK_PARAGRAPH_REUSE` again (S [6.3], N [2.7]). The
statements were "Die Anforderung erscheint in diesem Chart also nicht an der Oberfläche" and "Was nach außen erscheint,
ist der Ausdruck; was darunter wirkt, ist der Druck": the same class in a paraphrase the patterns do not cover. This is
the limitation named below.

### 5. Root cause and round 2: the graph grounds the surface (D-60-1)

The thesis of both cases rests on a surface/interior contrast: the expressive voice on the month stem against the
controlling voice in the branches. Its claims cite the surface of the month pillar only. A reading that summarised the
contrast over the whole chart therefore said something no claim carried:

- its control half held for S and failed for N, whose hour stem (DirectOfficer) controls the day master;
- its expression half held for neither, because the year and hour stems show other voices.

The near neighbour's named difference lies on the hour pillar's surface. No claim of N cited it, so the reading could
not respond to it. More phrase patterns cannot close a semantic class (review-convergence: change the strategy, not the
gate).

The Product Owner therefore decided D-60-1, a drafting rule: when a thesis or primary motif rests on a surface/interior
contrast, the claim graph carries a distribution claim. That claim describes what each of the four pillars shows on its
surface and cites every pillar's visible Ten-God fact with its relation to the day master, plus the day master for the
day pillar (Lens section 14: visible-vs-hidden distribution).

- **The round-2 drafts** (`tests/support/etbz60Cases.ts`) add the claim to ETBZ-59's drafts and place it in the
  CONTRAST chapter that renders both thesis claims and in the INTEGRATE chapter. The new facts are pinned.
- **Draft review.** An independent instance reviewed the drafts in two rounds. Round 1 returned PASS WITH MINOR; its
  F1 (a statement over the controlling voice alone) and F4 (placement by position) were fixed. Round 2 returned PASS
  WITH MINOR, with both closed.
- **Packages and cones.** These were committed before any round-2 reading. The swap is refused on N and D. Neither 6.1
  nor 6.3 finds a dependent claim unchanged. The cone of the named difference holds the surface claim.

Round 2 (`docs/evidence/etbz-60/round-2/`). Fresh Skill instances read the reviewed packages with an unchanged
invocation.

- **R(S)** was accepted at the first attempt, then its EDIT.
- **R(N)** was refused once, with two entries in one diagnostics list:
  - `READING_POSITION_UNGROUNDED` for a surface statement about the day pillar its paragraph does not cite;
  - `READING_META_NARRATION` for "der Indirekten Quelle", an inflected form of the cited label. This is the same
    false reading of the ETBZ-57 meta check that ETBZ-59 hit; it is outside this slice and recorded for the Product
    Owner.

  The one repair fixed both, and EDIT was accepted.
- **Grounded statements.** R(S) now makes five statements of every pillar's surface ("Kein sichtbarer Himmelsstamm
  wirkt fordernd auf Xin ein"). The boundary accepts them because each paragraph cites every pillar through the
  surface claim.
- **The 6.7 judgement.** An independent judge raised no `STOCK_PARAGRAPH_REUSE` and no `TEMPLATE_SENTENCE_REUSE`.
  The surface statements stand in the same place in both readings with opposite hour content, each true of its own
  chart. One `FIXED_METAPHOR_REUSE` (ADVISORY) remains: terrain imagery for the Wu Xing tally.
- **Observations for the Product Owner** (from the draft review's risks):
  - both readings give the hour position a "late, after it was finished" colouring that no claim carries;
  - N compares the visible regulated voice with the hidden one ("schärfer als die Regel");
  - S [2.4] uses "Oberfläche" in an everyday sense.

  There is no conflation of DirectOfficer with SevenKilling, no "reversal" relation, and no life-stage meaning.

## Consequences

- **Drafting rule for ETBZ-54 (D-60-1).** The Golden drafts (D-53-4) carry the distribution claim whenever a thesis or
  primary motif rests on a surface/interior contrast. The independent draft review checks that it describes every
  pillar's surface and is true from its cited facts.
- The Golden run (ETBZ-54) runs under this boundary. The same statement now refuses at acceptance and goes into the
  one repair, instead of surfacing at 6.7 after acceptance.
- The check is fail-closed on an ambiguous form. "Nicht an einer Position, sondern in verschiedenen Säulen" reads
  "einer" as "one single", yet it is refused, because the same contrast also fits the defect ("nicht auf einer Säule,
  sondern in verschiedenen Zweigen") and no lexical rule separates the two. The cost is a refusal that the one repair
  rephrases (R(N) attempt 1).
- SKILL.md's list of refusal codes (section 6) does not name `READING_POSITION_UNGROUNDED`. This is a known gap under
  D-59-6: the Skill's law 3 already carries the rule, and the refusal message names the law.

## Accepted limitations

1. The coverage counts pillars, not layers. A paragraph that cites a hidden-stem fact of every pillar could still
   state something of every pillar's surface. Every case measured cites far fewer pillars.
2. The forms are German phrase patterns. A paraphrase outside them ("an keiner Stelle sichtbar", "Was nach außen
   erscheint, ist ...") is not refused; round 1 measured this. The drafting rule of D-60-1 grounds the surface the
   paraphrase speaks of, and the independent 6.7 judgement remains the backstop.
3. Titles, reflection questions and the method note are not checked; the defect class surfaced in paragraphs.
4. The drafting rule covers surface/interior contrasts. Other chart-wide summaries a thesis might invite are not
   covered by a claim; the 6.7 judgement remains the backstop for them.
