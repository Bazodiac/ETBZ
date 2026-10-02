# ADR 0014 — An accepted Skill reading on the one projection and renderer (ETBZ-56)

- **Status:** Accepted — merged to `main` as `f6a4e99a` (PR #20, 2026-10-01). Merged under the Product Owner's delivery program of 2026-09-30 (Jira ETBZ-2 comment 16866: routine in-slice merges after the gates) after the merge gate on the exact head. The pinyin follow-up merged as PR #21 (`383aba8a`).
- **Date:** 2026-10-01
- **Slice:** ETBZ-56 [RUN-07] — the real accepted Skill output through the same
  PresentationProjection and the same ETBZ-55 renderer into a QA-checked PDF with a complete
  ArtifactManifest, every displayed Earthly Branch with its animal label. Parent delivery
  capability ETBZ-26. Adds no interpretation, no template, no second renderer.
- **Base:** `main@ce7af572c975fb14389962df4e36654d2b6aaa1d` (ETBZ-57 released).
- **Canonical product text:** Jira ETBZ-56 (AC 1-9) and its comments 16900 (AC-V1, AC-V2 and
  the five items carried from ETBZ-55) and 16974 (the released 1.1.0 identities); Rebaseline
  `62128133` section 18 (v13); ADR 0011 (the run boundary), 0012 (projection and renderer),
  0013 (voice 1.1.0).

## Context

ETBZ-55 drew a fixture-first payload: the text of the ETBZ-52 reading under bundle 1.0.0,
handed to `buildPresentationProjection` as plain text, recorded under the released 1.0.0
Lexicon. ETBZ-57 then released bundle and Skill 1.1.0 and accepted, at its Human Editorial
Gate, a 1.1.0 reading of the same synthetic chart. ETBZ-56 must put that accepted reading
onto the same pages - and three things the ETBZ-55 path could not see stood in the way:

1. The projection recorded `terminology-wording-lexicon@1.0.0` whatever text it was given:
   a 1.1.0 reading would have been rendered with a manifest naming the superseded Lexicon,
   and nothing would have noticed.
2. Nothing tied the chart the pages draw to the chart the reading was written about, and
   nothing read the reading's `visualizationSpecs` (ADR 0011 left the slot-to-fact
   vocabulary to this slice).
3. The paginator's every-word check stripped U+201C/U+201D from the placed lines but not
   from the source (ADR 0012 limitation 12). The 1.1.0 reading quotes with German marks,
   whose closing mark is U+201C: its first chapter was refused (`TEXT_MISMATCH`).

## Decision

### 1. One projection, two callers

`projectPresentation(model, content, binding)` is the projection build; `binding` records
the Lexicon release and, for a Skill reading, the reading's identities. It has two callers,
pinned by `tests/architecture/etbz56-skill-presentation-boundary.test.ts` - a text-level
guard that refuses any other reference to the name in the repository's code (a call, an
aliased import, a namespace access), not a caller who builds the name at run time:

- `buildPresentationProjection({ model, content })` - the fixture-first path, unchanged in
  behaviour, recorded under the released 1.0.0 Lexicon;
- `buildSkillReadingProjection({ model, reading, bundle, inputPackage })` - the Skill path.

The pages, the template and the renderer are the same for both. A projection made from an
accepted reading carries `sources.skill`; the manifest copies `sources` verbatim, so the
ArtifactManifest names the Skill, the bundle and its hash, the input package, the claim
graph, the plan, the reading and its contract set (AC 4, AC 7).

### 2. The Skill path refuses before it projects

In this order, each a typed refusal and nothing partial:

1. **Identity** (`PRESENTATION_SKILL_IDENTITY_REFUSED`): the bundle version must be one this
   projection presents - `1.1.0` only (`PRESENTED_SKILL_BUNDLE_VERSIONS`); the superseded
   1.0.0, a candidate and an unknown version are refused - and the bundle must be its
   released identity. The template prints the Ten-God names and chart terms from the
   module's Lexicon tables while the manifest records the bundle's Lexicon, so the bundle
   must carry those same values (`assertBundleCarriesTemplateWording`; both released
   bundles do today).
2. **The package** (`PRESENTATION_SKILL_BINDING_MISMATCH`): the input package, its claim
   graph and its plan each hash to the structural hash they carry, so the identities the
   manifest records are those of the objects used - a package changed after it was built
   whose carried hash was left stale, or a placeholder hash, is refused. This proves each
   object consistent with itself, not where it came from: a package and a reading re-hashed
   together pass it, and are then held to the chart by step 4.
3. **The reading** (`acceptSkillReading` composed, never re-implemented): the recorded
   reading is accepted again against that bundle and package - an unknown fact, claim or
   slot reference, an unknown key (a motif reference has no field in a reading), and a stale
   Skill, bundle or contract binding are refused there as the run boundary's own errors
   (`SkillRunError`, `SkillContractError`; AC 2, AC 7) - and must
   hash to the structural hash it carries (`PRESENTATION_SKILL_BINDING_MISMATCH`: an output
   whose content and hash disagree).
4. **The chart** (`PRESENTATION_SKILL_BINDING_MISMATCH`): every fact of the input package
   equals the chart value at its own path (a fact's value is text: a string verbatim, a
   number as `JSON.stringify` writes it), whether a page shows it or not; the package's
   source warnings are the chart's, verbatim; its subject is the chart's; its slot
   vocabulary is the template's. So the facts and warnings the PDF shows are those the
   reading was written about.
5. **The specs** (`PRESENTATION_VISUAL_SPEC_UNBOUND`): each visualization spec names a slot a
   page draws or one the template leaves empty, and every fact it cites is of a kind the
   slot-to-fact vocabulary knows (`SKILL_FACT_KIND_TO_PAGE_KIND`). The record
   (`sources.skill.visualBindings`) states, per spec, the pages that draw the slot, or
   `NO_APPROVED_CONTENT` for an empty one, and splits the cited facts by kind: those of a
   kind the slot consumes (`consumedKindFactRefs`: the ETBZ-49 page family's declaration,
   plus the animal label wherever a branch is consumed) and the rest (`otherKindFactRefs`).
   This is a classification by kind, not a measurement of which fact a page draws. A spec
   carries references, never text: it fills no empty slot and draws nothing (the accepted
   reading cites `chart.wuxing.dominant` twice; no page shows it - ADR 0012 section 4).

The customer text is the reading's own customer projection (`projectCustomerReading`); the
mapper adds and changes no word (AC "keine neue Interpretation im Mapper").

### 3. Earthly-Branch animal labels

Every structured display of an Earthly Branch - glance, four pillars, foundation, day
master, five phases (all twelve), hidden stems, reflection and summary - shows the branch's
Hanzi, its canonical pinyin and its animal label (AC 8, as the Product Owner clarified it in
Rebaseline 62128133 section 20). The three are separate values of the branch, never of a
stem; in a fact row the animal is the row's `detail` and the pinyin is part of its value.

The labels come from a released, versioned table, `bazodiac-branch-animal-labels@1.0.0`
(`branch-animals.ts`), frozen by content hash and recorded in `sources.branchAnimals`. Its
one language is German, the template's: the `tierDe` column of the Sizhu table (ETBZ-24,
ADR 0003), the vocabulary the HoroscopeModel build holds every FuFirE `tier` value to.
A chart whose animal differs from the table, a branch the table lacks or a language
without a table is refused - no fallback to another language or a romanisation (AC 9).

**Narrative prose stays as written** (Rebaseline section 20). A branch character quoted
inside the reading's own text - the accepted 1.1.0 reading writes "Wu (午)", "Hai (亥)" and
"Wei (未)" in its first two chapters - stays as the Skill wrote it: section 20 permits the
form "Wu (午)" in prose and forbids rewriting the Human-accepted reading to append labels.
The first merge of this slice (PR #20) printed the five-phases and reflection branches
without their pinyin, although the issue's own required form (Hanzi, canonical pinyin,
animal) already named it; its AC 8 test checked the animal only. The follow-up adds the
pinyin, and the test now requires, for every display it finds by the branch's Hanzi, that
branch's canonical pinyin and its animal; that the page prints them is the renderer's page
QA.

The renderer prints each label bound to its path like every other string, so the page QA
and the final PDF text layer hold it: two canaries make the check fail on a wrong label
(`branch-animal-wrong`) and a dropped one (`branch-animal-dropped`).

### 4. The every-word check compares what is placed

Both the paginator's own check and the projection's call of `assertEveryWordPlaced` now
compare the placed lines with `placedBlockText` - a block's words as written, a pull quote
inside the quotation marks the layout wraps it in - and strip nothing. A dropped or added
quotation mark is a mismatch like any other character.

### 5. The renderer, and the items carried from ETBZ-55

Renderer changes: the animal labels on five pages; the pinyin of the five-phases and reflection branches (PR #21); the Ten Gods legend keeps each entry on
one line and gives the "both" mark room for its halo; a stylesheet's own media list (the
`media` attribute of a `<style>` or `<link>`) is held to the media rule
(`MEDIA_RULE_FORBIDDEN`, two canaries). The renderer digest changed, so the ETBZ-55
evidence was re-rendered and the full canary set re-run on the new digest (AC-V1); the
ETBZ-56 PDF is drawn by the same sources, and its contract test requires both manifests to
name the same renderer, template and fonts. ADR 0012 limitations 4 and 9 are reworded and
limitation 12 is resolved (section 4).

## Evidence

`docs/evidence/etbz-56/`: the projection (regenerated byte for byte in CI), the PDF, its
manifest, QA report and contact sheet, fifteen full-size page renders bound to the QA
report's digests, and the Delivery Runner's visual verdict (AC-V2, Rebaseline section 18:
`VISUALLY_FIT_FOR_GOLDEN`, no defect, five observations). Checked by
`tests/contract/etbz56-skill-presentation-evidence.contract.test.ts`; the gates by
`tests/negative/etbz56-skill-presentation.negative.test.ts`,
`tests/unit/etbz56-branch-animals.test.ts` and the mutation proofs of
`scripts/verify-etbz56-presentation.mjs` (34 mutants, a step of `ci-verify`; its header
names the guards no input reaches and why they are not mutated).

## Consequences

- The pre-Golden rehearsal (ETBZ-58) and ETBZ-54 present their readings through
  `buildSkillReadingProjection` with bundle 1.1.0, so their manifests name the run.
- A new bundle version is presented only when it is added to
  `PRESENTED_SKILL_BUNDLE_VERSIONS`; if its Lexicon changes a Ten-God name or a chart term,
  the template's tables change with it (a template decision).
- Another output language needs its own released animal table (a new version) and a
  template in that language.

## Accepted limitations

1. **The Skill path presents the reading, not its editorial chain.** It accepts the
   recorded reading again; that this reading is the EDIT revision of an accepted REALISE
   reading is ETBZ-57's evidence, not re-derived here.
2. **The fact-kind vocabulary is closed.** A new fact kind is refused until it is mapped;
   whether a mapped kind is drawn on a page follows the ETBZ-49 page family's declared
   consumption plus the animal rule of section 3, not a measurement of the page.
3. **The chapter and question limits of the template stay.** A reading with more than 12
   chapters or 12 reflection questions passes the run boundary (40 and 20) and is refused
   by the projection (`PRESENTATION_INPUT_INVALID`).
4. **The visual verdict is the Delivery Runner's.** It records what the runner inspected and
   is not a sellability verdict; the runtime that inspected the pages also wrote the gates.
5. **Branches named in the reading's prose carry no label**, as Rebaseline section 20 allows (section 3).
6. **The manifest names the Skill by reference, not by package hash.** `sources.skill`
   records `skillRef`; the content hash of the Skill package directory is not recorded.
7. **A second render process is a declaration.** The evidence states that a second render
   process produced the same PDF bytes; CI re-derives only what the committed files carry
   (the manifest's DETERMINISM check compares two runs within one process).

## What this ADR does not decide

- Pull-quote, key-insight or motif components for Skill output (a template decision,
  ETBZ-43); unknown-time rendering; another output language.
- Whether the document is sellable (ETBZ-54's human verdict).
