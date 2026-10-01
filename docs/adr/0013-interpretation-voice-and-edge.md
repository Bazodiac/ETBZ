# ADR 0013 — Interpretation voice & edge: skill and bundle 1.1.0 beside 1.0.0 (ETBZ-57)

- **Status:** Accepted — released 2026-10-01. Merged to `main` as a frozen candidate on the
  Product Owner's instruction of 2026-10-01 ("merge nach Delta-Review"; PR #18, `bdc9f544`);
  the ETBZ-57 Human Editorial Gate then returned ACCEPTED and the Product Owner confirmed the
  Method Profile reading of reconcile C5 (Jira ETBZ-57 comment 16969). The release step
  re-bound bundle 1.1.0 to the released pages (Lens 77561858 v6, Lexicon 77529091 v4,
  Anti-Boilerplate 77266967 v3) and marked the 1.0.0 pages superseded for new runs.
- **Date:** 2026-10-01
- **Slice:** ETBZ-57 [PRE-GOLDEN] — the customer-voice revision: new versioned revisions
  of the Interpretation Lens and the Terminology & Wording Lexicon, a binding-only
  revision of the Anti-Boilerplate contract, Skill and bundle 1.1.0, customer-voice
  gates in the acceptance boundary, an editorial pass, and a controlled fixture rerun.
  Does not change the Method Profile, the Long-Form Contract, the claim graph, the plan,
  the reading schema or the renderer.
- **Base:** `main@8abe8d7023992926bf3d6100c88cb0458be9757c`
- **Canonical product text:** Rebaseline `62128133` section 17 (PO decision of
  2026-09-30, "Safety below the surface, clarity on the surface"); Jira ETBZ-57; the
  57.1 reconcile report (`docs/evidence/etbz-57/reconcile-report.md`).

## Context

The ETBZ-52 fixture reading is accepted, chart-bound and safe — and reads like a
pipeline explaining itself: every FACT paragraph names "die Quelle", fourteen of the
twenty-five SUPPORTED interpretation paragraphs hedge with a fixed formula, four of
seven reflections open with "Vielleicht" (a fifth carries it later), and grounded tensions end in "welche Form
zutrifft, kann das Chart nicht sagen". The 57.1 reconcile found that no gate in code
demands any of this: the voice came from the 1.0.0 Lens posture column, the Lexicon's
uncertainty table and the Skill's own formulas. Rebaseline section 17 moves safety
below the sentence surface and asks for a direct, concrete, BaZi-authentic voice that
states grounded tensions — without enlarging meaning.

Two constraints shaped the design. Released contracts are immutable history: runs
bound to `grounded-reflective-synthesis-lens@1.0.0` and `terminology-wording-lexicon@1.0.0`
(ETBZ-52's fixture run, ETBZ-55's fixture content) must stay re-derivable under exactly
the identities they were produced with. And the Lexicon (section 16) lets a newer
revision supersede the released one only through an explicit Product Owner decision,
which for this slice is the 57.5 Human Editorial Gate.

## Decision

### 1. Two versions side by side, never an in-place edit

The repository builds bundle `1.0.0` (unchanged, still `sha256:1c8f80c3…`) and bundle
`1.1.0`. A version spec per bundle names its contract set, its plan bindings (Lexicon and
Lens), its semantic envelope and its wording boundaries. The 1.1.0 envelope and
wording are the 1.0.0 values with exactly the blocks the revised pages change replaced
or added (`semantic-envelope-v1-1.ts`, `wording-boundaries-v1-1.ts`). Skill `1.1.0` runs
only under bundle `1.1.0` and Skill `1.0.0` only under `1.0.0` (`skillRefForBundle`); the
reading schema and the input package version are unchanged. A plan binds the Lexicon and
Lens pair of the bundle it runs under (`MetaNarrativePlanContext.contractBindings`); a
plan built without it binds the 1.0.0 pair, which a 1.1.0 package refuses.

### 2. Candidate is a status, not a pretence

The revised pages are copies of the released pages (Lens `77561858`, Lexicon `77529091`,
Anti-Boilerplate `77266967`) carrying status CANDIDATE and no decision date; the released
pages are untouched. In the repository a contract source may be `CANDIDATE` with
`releasedOn: null`; a bundle carrying one is valid only if its version is listed in
`CANDIDATE_BUNDLE_HASHES`, which freezes it by content hash like a released version but
never makes it released. Every boundary accepts a candidate bundle only with
`{ candidateEvaluation: true }` — `acceptPortableSkillContractBundle`,
`buildSkillInputPackage`, `acceptSkillReading` and so `acceptEditorialRevision`; without
it, a released bundle is required. A portable copy of a version the repository does not
build is refused as such (`BUNDLE_SCHEMA_INVALID`) before its contracts are read. Release moves
the version from the candidate table to `RELEASED_BUNDLE_HASHES` with the hash of the
released page versions.

### 3. Customer-voice gates (Skill 1.1.0 only)

`acceptSkillReading` holds a 1.1.0 reading to six additional refusals and to a count-word
check under the existing `READING_UNCITED_NUMERAL`; a 1.0.0 reading is accepted under
exactly its old gates. The editorial pass (section 4) is version-neutral and adds
`READING_EDITORIAL_EXPANSION`.

| Code | What it refuses | Contract |
| --- | --- | --- |
| `READING_SUPPORTED_UNDERSTATED` | an interpretive paragraph over SUPPORTED claims only, no provisional fact, written TENTATIVE; or any paragraph over SUPPORTED claims only (INTERPRETATION, REFLECTION, FRAME) whose text carries a tentative marker | Lens 1.1 §1.1, §2 hard law; plan constraint `epistemicClassesFixed` |
| `READING_SUPPORTED_TEMPLATE_HEDGE` | a paragraph over SUPPORTED claims only (FRAME included) using a retired template ("gelesen werden", "Innerhalb dieses BaZi-Rahmens", "mögliche Ausdrucksform" …) | Lexicon 1.1 §7, L3.4 |
| `READING_TENTATIVE_NOT_VISIBLE` | a TENTATIVE paragraph without a visible marker | Lexicon 1.1 §7, L3.11 |
| `READING_META_NARRATION` | a title, chapter title, paragraph or reflection question naming the source, validation, calculation, chapters or the reading itself | Lexicon 1.1 L3.12; Lens 1.1 §9.2, §21 step 11 |
| `READING_TENSION_UNGROUNDED` | tension, conflict, contradiction or opposition words on a surface that does not cite both poles of one `CONTRASTS_WITH` relation | Lens 1.1 §7.2, AC 17 |
| `READING_LIFE_DOMAIN_INVENTED` | a kinship, partnership, work, money, school or biography word on a narrative surface or in the method note | Lens 1.1 §1.1 CONCRETENESS; Lexicon 1.1 L3.13 |
| `READING_UNCITED_NUMERAL` (count word) | "zweimal", "doppelt", "an zwei Stellen" …: a count is derived, never a chart fact | SKILL.md 1.1 law 13 |

The 1.1 profile also adds determinism and identity-verdict phrases to the prohibited
classes ("Schicksal", "so bist du eben", "du bist jemand"). The method note is not
narrative: it carries the method and data disclosure and is held to the prohibited
phrases, the life-domain words and the count words only. A producer label the surface
cites, directly or through its claims (e.g. "Indirekte Quelle"), is terminology and does
not count as talk about the source. A paragraph all of whose claims the graph links by
`ALTERNATIVE_READING` (as source or target) keeps tentative markers and the bounded
formulations the Lexicon reserves for them (L3.4; Lens 1.1 E3: tentative where a
graph-carried alternative is part of the composite); the per-sentence framework template
("Innerhalb dieses BaZi-Rahmens") stays refused there too (Lens 1.1 E1).

Every wording gate here is a closed, conservative list. Inflections and paraphrases it
does not list pass ("Brüdern", "des Readings", "beide Male", "drei Beziehungen"), and a
listed phrase can match an innocent sentence ("kann sein", "ist nicht sicher"). The
gates catch the listed forms; the editorial reviews and the Human Editorial Gate are the
check on everything else.

### 4. The editorial pass

The Skill has two modes. REALISE renders the plan; EDIT receives an accepted reading and
may revise its customer text only. `acceptEditorialRevision(semantic, revision, context)`
re-accepts the semantic reading first (a forged one is refused), accepts the revision
through the whole boundary, and refuses it with `READING_EDITORIAL_EXPANSION` if anything
but the title, chapter titles, paragraph texts and reflection texts differs. The method
note is disclosure, not voice, and stays as accepted. The pass is version-neutral: it
compares structure, so it holds for any accepted reading; only Skill 1.1.0 defines an
EDIT mode.

### 5. The fixture rerun and the evals

The 1.1.0 fixture reading keeps the 1.0.0 reading's structure paragraph for paragraph —
same kinds, postures, fact and claim references, deltas, callbacks, reflection bindings,
warnings and visual specs — and replaces the text, so the Product Owner can compare old
and new paragraph by paragraph. `docs/evidence/etbz-57/evals.json` is re-derived in CI:
the semantic-binding projection of old and new is equal (AC 5); meta-narration, template
hedges, unlicensed alternatives and softeners fall to zero; a provisional-fact variant
is refused as certain and as tentative without a marker and accepted with one; a
manufactured tension is refused; refusals under a fact mutation and a fact removal stay
inside the dependency cone for both versions; the claim graph is shared across versions
and fails the swap against the unknown-time foil.

## Consequences

- ETBZ-56 must build its packages from bundle 1.1.0 after release; a plan without the
  1.1.0 bindings is refused, so a stale binding fails closed.
- The chapter word floor (600, ETBZ-43) stays. Without meta-commentary, and again after
  the editorial review removed overreaching sentences, the fixture chapters fell below
  600 words (439–595) and were brought back above it with licensed substance only: term
  explanations, the cited family's envelope, positions, situation-framed examples and open
  questions. The floor still pushes toward length (reconcile C10); ETBZ-43 owns it.
- The mechanical gates cannot see semantic overreach in fluent prose. Review round 1
  found illustrations written as facts about the reader, harmony between tension poles
  and uniqueness claims; the Lens and Lexicon candidates now state the rule
  operationally (illustration framed as a situation, never as the reader's behaviour,
  feeling, ability, habit, frequency or other people's view), and the Human Editorial
  Gate remains the check. Round 2 confirmed 8 of 20 flagged sentences, most of them fill
  for the word floor; REALISE v3 removes them. The delta review (round 3) found count
  statements the chart does not carry (the controlling and the resourcing voice stand in
  three branches, not two) and 3 more fill sentences. After three rounds of the same
  class the strategy changed: listed count words are refused mechanically, and REALISE v4
  named positions instead of counting. The fix verification then read the remaining
  position statements as complete: the claims C1 and C2 name the year and the month
  branch, while the chart carries the same relations in the hour branch too. A reading
  may cite only the facts its claims are grounded in, so it cannot name the hour branch
  there. REALISE v5 marks most of those positions as non-exhaustive ("unter anderem",
  "etwa"), and the method note discloses that named positions are the ones an
  interpretation rests on. The final verification (round 5) found three more position
  lists without a marker and new classes: statements about how
  contrasted claims interact (neither "one cancels the other" nor "neither cancels the
  other" is licensed - classically output restrains the controlling relation and the
  controlling relation feeds the resource), a strength verdict, and the Wu-Xing weighting
  read as a count of the eight characters. REALISE v6 removes them; REALISE v7 removes
  the three residues the closure check found. Why the claims omit the hour branch is a claim-graph question
  (ETBZ-30), not a voice question; it is reported to the Product Owner at the gate.
- An accepted reading does not carry the evaluation-only status of its bundle: the
  opt-in is checked at every boundary, but the accepted reading and its customer
  projection have no marker. No consumer exists yet; ETBZ-56 must take its bundle from
  release.
- The pre-existing ADVICE_PREDICTION phrase "du brauchst" also refuses descriptive uses
  ("was du brauchst"); scoping a safety gate is outside this slice (reconcile C13).
- Release is mechanical but not optional: page status lines, decision dates and titles,
  then the contract sources, plan bindings, candidate-to-released hash move, package
  regeneration and evidence regeneration. Done on 2026-10-01; with no candidate version
  left, four mutants of the candidate boundary cannot be observed and were retired (named
  in `scripts/verify-etbz57-voice.mjs`); they are re-armed with the next candidate.

## What this ADR does not decide

The Method Profile reading of reconcile C5 (uncertainty carried, not added) is put to the
Product Owner at the gate. No new method, fact kind, claim, relation or reading-schema
field is introduced. The renderer and the presentation projection are untouched.
