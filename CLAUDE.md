# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository location

On the primary development machine the git repository is `~/ETBZ/ETBZ`, remote
`https://github.com/DYAI2025/ETBZ.git` (GitHub now names it `Bazodiac/ETBZ`; the old URL redirects).
The parent `~/ETBZ` there is a separate, commit-less git directory that merely contains the clone —
never run git commands or write project files in it.

That checkout is often parked on an old feature branch while slices are developed in linked worktrees
under `~/Projects/etbz-wt-*`. Before any work: `git fetch origin && git worktree list`, then work in a
clean worktree of the branch you actually need (create one from `origin/main` for a new slice). The
README on `main` still describes ETBZ-9; the code and `docs/adr/` are authoritative.

## Commands

```bash
npm ci                      # deterministic install (lockfile drift fails here)
npm run typecheck           # tsc --noEmit, strict
npm run lint                # eslint, zero warnings: recommended rule sets + four type-aware defect rules, no formatting rules
npm test                    # all five suites (1851 tests with ETBZ-53; the architecture leaf tests import dependency-direction.test.ts, so its 19 tests are also registered inside each of them)
npm run build               # tsc -p tsconfig.build.json -> dist/
ETBZ_ENV=local LOG_LEVEL=info npm start     # http://localhost:8120 — serves /health and /ready only
```

Per suite: `npm run test:unit | test:integration | test:negative | test:contract | test:architecture`.

```bash
npx vitest run tests/unit/method-registry.test.ts            # one file
npx vitest run tests/unit/method-registry.test.ts -t 'name'  # one test by name fragment
npx vitest                                                   # watch mode
```

Gates (`scripts/`, each also reachable as an npm script):

```bash
bash scripts/ci-verify.sh                    # THE full gate — exactly what CI runs
bash scripts/ci-verify.sh --skip-docker      # without BUILD_DRY_RUN
bash scripts/ci-verify.sh --skip-mutations   # without guard mutation proofs
bash scripts/verify-guards.sh                # foundation guard mutation proofs (npm run guards)
bash scripts/secret-scan.sh                  # gitleaks tree + history + scanner mutation proof
bash scripts/build-dry-run.sh                # container build / provenance / smoke / reproducibility
npm run guards:etbz34 | guards:etbz30a | guards:etbz30b | guards:etbz68   # slice source-mutation proofs (NOT part of ci-verify)
npm run guards:etbz49 | guards:etbz51 | guards:etbz52 | guards:etbz55 | guards:etbz56 | guards:etbz57 | guards:etbz58 | guards:etbz53 | guards:etbz59 | guards:etbz60   # slice mutation proofs that ARE steps of ci-verify
npm run build && npm run etbz51:bundle                   # print the portable Skill Contract Bundle (canonical JSON)
npm run build && npm run etbz52:package                  # regenerate skill/bazodiac-interpretation-skill-v1/{contract-bundle,reading-schema,MANIFEST}.json
npm run build && npm run etbz57:package                  # the same for skill/bazodiac-interpretation-skill-v1.1/ (bundle 1.1.0)
npm run etbz57:evidence                                  # regenerate docs/evidence/etbz-57/{fixture/accepted-reading,fixture/customer-reading,fixture/manifest,evals}.json
npm run etbz55:projection                                # regenerate docs/evidence/etbz-55/presentation-projection.json (runs vite-node, which is not a declared dependency: it resolves transitively through vitest 3.2.x)
npm run etbz55:metrics                                   # regenerate src/application/presentation/font-metrics.ts from the Inter binaries
npm run etbz56:projection                                # regenerate docs/evidence/etbz-56/presentation-projection.json (the accepted 1.1.0 Skill reading)
npm run etbz58:live                                      # ETBZ-58 live stage against a real FuFirE runtime (operator only; env in docs/evidence/etbz-58/README.md)
npm run etbz58:assemble -- check-realise|check-edit|assemble|seal   # ETBZ-58 offline stages from the committed live stage
npm run etbz53:freeze -- freeze|record|verify                    # ETBZ-53 Golden freeze (operator only; the case data stays in /Users/Shared/ETBZ-golden, docs/evidence/etbz-53/README.md)
npm run etbz59:variants                                  # ETBZ-59 synthetic variants N and D through the ETBZ-58 live stage (operator only)
npm run etbz59 -- emit|cones|accept <label>|packets|record   # ETBZ-59 offline stages (docs/evidence/etbz-59/README.md; record reproduces only at e5ccc94c)
npm run etbz60 -- emit|cones|accept <round-1|round-2> <source|near>|packet <round>|record   # ETBZ-60 re-readings (docs/evidence/etbz-60/README.md)
```

`scripts/ci-verify.sh` is the single definition of "verified". `.github/workflows/ci.yml` runs that same
script, and `tests/architecture/ci-contract.test.ts` fails if the workflow stops invoking it or starts
passing skip flags — change the gate in the script, never in the workflow. CI runs on `push` to `main`,
`pull_request` against `main` and a manual `workflow_dispatch`: a plain push to a feature branch runs
nothing, so open the PR (a draft is fine) or dispatch the workflow to get a CI result for a head.

Environment for the gates: `GITLEAKS_BIN` (scanner path when not on `PATH`), `ETBZ_REVISION` (40-char SHA
for the image build; placeholders are refused). Node 24 is the authoritative runtime (container + CI);
local Node 22 is accepted by `engines`. CI pins gitleaks 8.24.3 by checksum.

`scripts/verify-guards.sh` mutations C/C2/E write files through `python3 -` heredocs. If a local hook
blocks `python3`, those steps go red on this machine while CI is green — measure the unmodified base
before blaming your diff.

FuFirE runtime attestation (read-only probe, after `npm run build`; see
`docs/runbooks/fufire-runtime-attestation.md`):

```bash
ETBZ_FUFIRE_BASE_URL=https://<origin> ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256=<64 hex> \
ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION=<40-hex sha> npm run attest:fufire
# exit 0 PASS · 2 BLOCKED · 3 CAPABILITY_MISSING · 64 unusable configuration
```

## What this repository is

A **service foundation** (ETBZ-9) plus the **deterministic product path of a BaZi reading**, built slice
by slice (ETBZ-24/29/25/34/30A/30B) as pure application code. The public HTTP surface is still exactly
`GET /health` and `GET /ready`; nothing in `src/application`, `src/domain` or `src/adapters/fufire` is
reachable over HTTP. The two runtime entrypoints are `src/main.ts` (server) and `src/attest-fufire.ts`
(CLI). Everything else is exercised by tests: the FuFirE adapter and the attestation probe run through
fake transports, so no test reaches FuFirE or any external host — the only real sockets are the server
tests binding 127.0.0.1. The repository holds no real birth data (the fixture chart Geng/Wu · Ren/Wu ·
Xin/Hai · Yi/Wei is synthetic, derived from FuFirE's released tables).

The governing principle: **everything claimed is checked by a gate in this repository; nothing that is
not checked is claimed.** Every domain, application and adapter module header states what the module
does NOT do (the `src/app` barrel files carry no header) — read it before changing the module, and keep
it true.

## Architecture

```
src/http  (inbound adapter)        src/adapters  (outbound: FuFirE HTTP client, attestation probe)
              \                          /
               ->  src/application  <-        use cases, ports, interpretation/
                       |
                       v
                   src/domain                 BirthInput, Sizhu table, canonicalJson, structuralHash

src/app = composition root (configuration, logging, readiness, buildInfo, server)
```

- Dependencies point **inward only**, enforced by `tests/architecture/dependency-direction.test.ts`,
  which parses imports with the TypeScript AST (not regex) and uses an **allowlist** per layer:
  `domain` may import nothing, `application` only `zod`. `src/app` (composition root) and
  `src/application` (layer) are distinct despite the shared prefix; the guard matches whole path segments.
- `src/app/server.ts` is the only place environment, clock, randomness and the HTTP driver are wired.
  Bootstrap is tolerant, readiness is strict: an invalid configuration still yields a listening server
  answering `/health` 200 and `/ready` 503, never an exited container.
- `structuralHash` (`sha256:` + SHA-256 of `canonicalJson`) is implemented in plain TypeScript inside
  `src/domain` because that layer cannot import `node:crypto`; `tests/unit/structural-hash.test.ts`
  measures it against `node:crypto`. `canonicalJson` sorts keys by UTF-16 code unit and never
  normalises Unicode. There is no snapshot testing anywhere — artefacts are frozen by content hash.

### The product path

Every derivation stage from the HoroscopeModel onward is a pure function; the use case and its adapter
are the one I/O boundary. Every artefact from the InterpretationFeatureSet onward carries a structural
hash and a version marker (`FEATURE_SET_VERSION`, `INTERPRETIVE_CLAIM_GRAPH_VERSION`,
`META_NARRATIVE_PLAN_VERSION`, …); the HoroscopeModel carries its canonical JSON text instead.

```
raw input -> validateBirthInput (domain)                BIRTH_INPUT_INVALID => zero FuFirE calls
  -> HoroscopeUseCase -> FufireBaziGateway port
       adapter: POST /v1/calculate/bazi, /v1/calculate/bazi/wuxing, /v1/calculate/bazi/natal
                — fail-closed contract validation, keeps the raw wire body
  -> HoroscopeModel                                     every value traceable to a FuFirE field or the Sizhu table
  -> InterpretationFeatureSet (addressable facts)
  -> ThemeGraph (exhaustive candidates) -> PrimaryThemeProjection (four families) -> NarrativeBrief
  -> NarrativeProvider port  (only implementation: deterministic-narrative-provider.ts, no model, no network)
  -> ReportModel                                        re-derives the chain from the model; accepts or refuses
```

Beside it, ETBZ-34/30 add the semantic hand-off: `MethodRegistry` v1.0.0 → `InterpretiveClaim`
(`methodRefs`, invariants I1–I6) → `InterpretiveClaimGraph` → `MetaNarrativePlan`, plus
`BazodiacInterpretationInput v1`, built from the use case's `source` snapshots with the raw evidence
re-mapped and proven. Each of these is an **acceptance boundary**: untrusted draft in, validation,
normalisation, hash-bound artefact out — or a typed refusal (`ClaimError`, `ClaimGraphError`,
`MetaNarrativePlanError`, `MethodRegistryError`, `InterpretationInputError`, `ReportError`,
`HoroscopeError`). Later boundaries **compose** the earlier gates (`assertInterpretiveClaimGraphIntact`,
`assertCentralGraphClaim`) and never re-implement them.

ETBZ-51 adds `src/application/skill/`: the Skill Contract Bundle
(`bazodiac-skill-contract-bundle@1.0.0`, ADR 0010) binds the five released contract pages by id and
page version, carries the Lens / Lexicon / Anti-Boilerplate vocabularies as values, pins the
repository's own version markers and is frozen by `RELEASED_BUNDLE_HASHES` like the registry. Its only
consumer is the ETBZ-55 presentation module, through the index (`tests/architecture/etbz51-skill-boundary.test.ts`); a portable copy is
accepted only if it equals the repository bundle in canonical content, and a run's recorded contract set is
checked against it by `assertRunEvidenceBound`.

ETBZ-52 adds the Skill run boundary to the same module (`skill-package.ts`, `skill-reading.ts`,
`skill-run-errors.ts`, ADR 0011): `buildSkillInputPackage` is what a runtime is handed (interpretable facts,
accepted graph and plan, warnings verbatim, contract set, allowed slot ids — never a raw producer body),
`acceptSkillReading` is the boundary every returned reading passes or fails (plan order, planned claims,
cited facts, symbol/number citation, wording gates, semantic delta, callbacks, word budget, visual bindings),
`projectCustomerReading` the text-only projection. The Skill package itself (instructions, wrappers, portable
bundle, schema, manifest) lives under `skill/bazodiac-interpretation-skill-v1/` and the fixture run evidence
under `docs/evidence/etbz-52/` — both regenerated byte-identically by
`tests/contract/etbz52-skill-fixture-run.contract.test.ts`. The fixture reading is German: the ETBZ-25 symbol
rule treats the branch name `You` as a chart symbol, so English second-person prose cannot pass it.

ETBZ-57 adds the customer-voice revision beside 1.0.0 (ADR 0013), never in place: bundle `1.1.0` binds the
Lens, Lexicon and Anti-Boilerplate revisions (Confluence 77561858 v6 / 77529091 v4 / 77266967 v3, released
2026-10-01 after the Human Editorial Gate, Jira ETBZ-57 comment 16969) and Skill `1.1.0` runs only under it
(`skillRefForBundle`); bundle `1.0.0` stays byte-identical so ETBZ-52/55 evidence re-derives. Both are frozen in
`RELEASED_BUNDLE_HASHES`; `CANDIDATE_BUNDLE_HASHES` is empty, and a future candidate is refused at every boundary
without `{ candidateEvaluation: true }` (`acceptPortableSkillContractBundle`, `buildSkillInputPackage`,
`acceptSkillReading`). New runs (ETBZ-56, ETBZ-54) bind bundle 1.1.0; the default of
`buildSkillContractBundle()` is still 1.0.0, so pass the version. `acceptSkillReading` holds a 1.1.0 reading to six more refusals
(`READING_SUPPORTED_UNDERSTATED`, `_SUPPORTED_TEMPLATE_HEDGE`, `_TENTATIVE_NOT_VISIBLE`, `_META_NARRATION`,
`_TENSION_UNGROUNDED` - both poles of one CONTRASTS_WITH pair cited - and `_LIFE_DOMAIN_INVENTED`) and refuses count
words ("zweimal", "an zwei Stellen") as `READING_UNCITED_NUMERAL`; a paragraph all of whose claims are in an
ALTERNATIVE_READING relation keeps tentative and L3.4 bounded wording (never "Innerhalb dieses BaZi-Rahmens"), and a cited producer label ("Indirekte Quelle") is not meta-narration. All of these are
closed phrase lists: unlisted inflections pass, the Human Editorial Gate is the check. The method note is not
narrative (prohibited phrases, life-domain and count words only).
`acceptEditorialRevision` is the EDIT pass (version-neutral): text-only changes of an accepted reading, method
note kept, anything else `READING_EDITORIAL_EXPANSION`. A plan
binds the Lexicon/Lens pair of its bundle through `MetaNarrativePlanContext.contractBindings` (absent = 1.0.0).
Package `skill/bazodiac-interpretation-skill-v1.1/`, evidence `docs/evidence/etbz-57/`, both re-derived by
`tests/contract/etbz57-skill-voice.contract.test.ts`.

ETBZ-55 adds `src/application/presentation/` (ADR 0012): `buildPresentationProjection({ model, content })`
turns the validated `HoroscopeModel` and a text-only payload into the complete page model of the one
template `bazodiac-final-template@1.0.0` (the ETBZ-49 visual system in German, frozen by
`RELEASED_TEMPLATE_HASHES`) — every value a second source defines cross-checked against it (glyph contract, Sizhu table), every Ten-God relation
bound to the Lexicon, every long-form line break computed by `long-form.ts`, a port of the canonical ETBZ-49
paginator proven line for line against its recorded layouts and against
`tests/support/etbz55-paginator-oracle.json` (built by the canonical Python paginator). It is the only
consumer of `visual/` and `skill/` (both leaf tests name it), and it is itself a leaf. The PDF is drawn by the
local renderer `tools/pdf-renderer/` (Python + Chromium, never in CI, no npm dependency), which decides nothing,
verifies the projection and template hashes, binds every printed string, drawn glyph, presence mark and phase colour
to its projection path (the QA requires each to be the value at its path, inside its entry's slots on the page too, in
list order, painted as its value, present and inked in the page image down to each character, and every required path to
appear - against a mistaken builder or stylesheet edit, for the mechanisms ADR 0012 section 6 lists), then reads the merged
PDF itself back (`pdf_layer.py`: every glyph of its text layer bound to one printed string of its page, each string spelling
its value in visual order, every glyph upright; every clip one convex shape or a frame around one; every painted shape a
canonical glyph or wordmark outline at its box's size and position, wholly in its box and clips, upright, drawn once, the
wordmark with its dot, or a single convex contour; limitation 14 names what this leaves out) and writes the ArtifactManifest
only when all of it passes; `tools/pdf-renderer/qa/run_canaries.py` makes every
gate in its table fail at least once and records it (six codes that need a doctored font or PDF writer aside, ADR
0012 limitation 8). Under `docs/evidence/etbz-55/` the projection is regenerated and the PDF, manifest, QA report and
canary record are checked against their digests and each other by `tests/contract/etbz55-presentation-evidence.contract.test.ts`. Any change to
`tools/pdf-renderer/*.py|*.css` changes the renderer digest, and any change to `tools/pdf-renderer/qa/run_canaries.py`
the canary digest: re-render and re-run the canaries. The evidence declares the head it was rendered on top of and
the contract suite requires that head to be in the tested history, so PR #17 merges with a merge commit (never a
squash or rebase).

ETBZ-56 presents an accepted Skill reading on the same projection and renderer (ADR 0014):
`buildSkillReadingProjection({ model, reading, bundle, inputPackage })` refuses a bundle other than the released 1.1.0
(`PRESENTED_SKILL_BUNDLE_VERSIONS`), requires the input package, its claim graph and its plan to hash to their own
hashes, accepts the recorded reading again through `acceptSkillReading` and holds it to its own structural hash, requires
every input-package fact to equal the chart value at its path and the package's source warnings to be the chart's (so the
PDF shows the facts the reading was written about), and records each visualization spec against the pages that draw its
slot through the slot-to-fact vocabulary `SKILL_FACT_KIND_TO_PAGE_KIND` (cited facts split by kind; nothing is drawn because of a spec).
`sources.skill` carries the Skill, bundle, package, plan, graph, reading and contract identities into the manifest, and
`sources.lexicon` is the bundle's Lexicon (1.1.0) - the fixture path `buildPresentationProjection` still records 1.0.0.
Both call `projectPresentation`, which has no third caller (`tests/architecture/etbz56-skill-presentation-boundary.test.ts`).
Every structured display of an Earthly Branch prints its Hanzi and canonical pinyin (the chart's, checked against the glyph contract; the twelve of the five-phases page come from the glyph contract itself) and its animal from the hash-frozen table
`bazodiac-branch-animal-labels@1.0.0` (German = the Sizhu `tierDe` column; Rebaseline section 20); an unmapped branch or language is refused, and prose stays as the Skill wrote it.
The every-word check compares `placedBlockText` with the placed lines and strips nothing (it used to strip U+201C/D from
the placed lines only, which refused any German `„…“` quotation). Evidence `docs/evidence/etbz-56/` (PDF, manifest, QA,
fifteen page renders, the visual verdict), checked by `tests/contract/etbz56-skill-presentation-evidence.contract.test.ts`;
the ETBZ-55 evidence was re-rendered on the same renderer digest.

ETBZ-58 (ADR 0015) ran the whole machine once against the live producer: `tests/support/etbz58Rehearsal.ts` composes
the chain without re-implementing it. The live stage (`npm run etbz58:live`, an operator command, never a test)
attests the FuFirE runtime and probes health and readiness before any calculation, records the three response
bodies as the client read them (after content decoding) and then requires a call without credentials to be refused; everything after it is offline and replays
the recorded bytes through the same client and use case. The reviewed graph and plan drafts of Musterkundin A are
used on the live chart only where the 11 facts they cite hold their reviewed values (`assertDraftFactsHold`,
`REHEARSAL_DRAFT_FACTS_DRIFTED`) - the builders validate grounding and kinds, not that a claim's prose still fits a
value. Evidence `docs/evidence/etbz-58/` (readback, responses, package, the refused first REALISE attempt, both
accepted readings, projection, PDF, manifest, verdict, run record), checked by
`tests/contract/etbz58-rehearsal-evidence.contract.test.ts`. The live hour branch answers its hidden stems Ji, Ding,
Yi; the hand-written fixture chart (ETBZ-52/55/56/57) has Yi and Ding swapped - its evidence keeps the fixture order.

ETBZ-53 froze the Golden case `GOLDEN-KT-01` with the same live stage (`tests/support/etbz53GoldenFreeze.ts`). The
case data - the Product Owner's input file, the response bodies, the InterpretationInput, the oracle facts - stays in
`/Users/Shared/ETBZ-golden/` outside every repository (files mode 600); the repository holds only
`docs/evidence/etbz-53/freeze-record.json` (identities, the validation and the oracle outcome, and HMAC-SHA256 digests
under a key that exists only in the archive - a plain digest of a chart-determined body is searchable back to the birth
data; no birth data, chart value, length or count), checked by
`tests/contract/etbz53-freeze-record.contract.test.ts`. An independent oracle (`lunar-python==1.4.8`, its own uv
project in that folder, not a product dependency) must agree with every fact before the record exists. Never put a
Golden value into a commit, a test, Jira or Confluence; `npm run etbz53:freeze -- verify` re-derives the record from
the archive.

ETBZ-59 (ADR 0016) ran the section-8 minimum of the Anti-Boilerplate contract (77266967 v3) once on Musterkundin A,
before the Golden case. N (16:30, the hour pillar) and D (1974-09-24) were computed live by FuFirE. The removal case
S⁻ uses `withdrawFactsForEvaluation`: a withdrawn fact stays as evidence, is excluded from interpretation
(`WITHDRAWN_FOR_EVALUATION`), and makes the input never production-eligible (`EVALUATION_WITHDRAWAL_PRESENT`); the
day master and the month command cannot be withdrawn. The deterministic checks (`tests/support/etbz59Individuality.ts`:
swap, comparison under a named difference, removal, IND-8 direction, candidate finders) are the tool ETBZ-54 reuses
unchanged. A refusal of `acceptSkillReading` carries every violation of one full pass on `SkillRunError.diagnostics`
(D-59-4); each diagnostic keeps its code, the first is the refusal. The judges' packets and the judgements are re-derived,
the run record is pinned as merged at e5ccc94c (ETBZ-60 changed the boundary), by
`tests/contract/etbz59-individuality-evidence.contract.test.ts`. The rehearsal raised one BLOCKING
`STOCK_PARAGRAPH_REUSE`, recorded with its smallest repair, which is not applied (docs/evidence/etbz-59/README.md).

ETBZ-60 (ADR 0017) repaired it in two layers, with Skill 1.1.0 and bundle 1.1.0 unchanged.

- **The boundary (D-59-6).** A sentence that states something of the chart's positions as a whole ("auf keiner Säule",
  "nicht an der Oberfläche einer Säule", "ohne an die Oberfläche", "nur im Monatszweig") is refused with
  `READING_POSITION_UNGROUNDED` unless the paragraph cites a fact of every pillar, directly or through its claims. A
  defining clause about stems as a class and "nicht nur ..." are exempt. On its own this layer did not close the class:
  round 1's judge found the same reuse in a paraphrase the patterns miss.
- **The drafting rule (D-60-1), binding the ETBZ-54 Golden drafts.** When a thesis or primary motif rests on a
  surface/interior contrast, the claim graph carries a distribution claim. It describes what each of the four pillars
  shows on its surface and cites every pillar's visible Ten-God fact with its relation to the day master, plus the day
  master (`tests/support/etbz60Cases.ts`, `SURFACE_FACT_IDS`). The independent draft review checks it. With it, round
  2's judge raised no BLOCKING code.

The ETBZ-59 run record was made under the earlier boundary and is pinned as merged at e5ccc94c, not re-derived.

ETBZ-61 (ADR 0018) repaired the PDF-QA block that stopped the ETBZ-54 Golden run (PO decision D-54-2). FuFirE
serialises a Wu Xing weight that is a floating-point sum with its binary noise, and the projection printed it with
`String(value)`. `wuXingValueText` (`src/application/presentation/projection.ts`) now prints the shortest decimal
within `2^-48 * |value|` of the delivered number. A real decimal of up to 14 significant digits prints unchanged (measured).
`assertWuXingValueText` refuses, with `PRESENTATION_FACT_MISMATCH`, a text outside the bound or not the canonical text
of its number. `value`, `ratio`, the template (1.0.0) and the renderer are unchanged.

Design rules that hold across the whole chain — the first six each pinned by negative tests and a source
mutant in `scripts/verify-etbz{34,30a,30b}-mutations.mjs`; the last item records what no gate proves:

- **Fail closed, never repair — in the acceptance boundaries.** In `InterpretiveClaim`,
  `InterpretiveClaimGraph`, `MetaNarrativePlan`, `BazodiacInterpretationInput` and `acceptSkillReading` nothing substitutes,
  defaults, trims, deduplicates, normalises text or downgrades a fact; the first violation throws and
  no partial artefact exists. `report-model.ts` is the one place that normalises provider output (it
  sorts and de-duplicates a section's cited fact ids) before re-checking it against the model.
- **Configuration, birth-input and Zod schema refusals name path and code, never the received value.**
  Zod's own messages are discarded because they embed the value. Claim-, registry- and plan-level
  messages name ids and hashes; do not add received values to any message.
- **Nothing is a number.** Themes, claims, graphs and plans publish no salience, rank, weight, count,
  confidence or score; a draft carrying one is refused (`z.strictObject` throughout). Order is never
  meaning except `chapterPlan`: within the claim graph and the plan every other list is sorted and every
  id is a content hash. Two things stay in source order on purpose because they are evidence —
  FuFirE's warning codes (carried verbatim, duplicates included) and hidden stems in Qi order.
- **Source-owned only.** Labels, warnings, Ten-God names and Wu Xing values are FuFirE's verbatim; ETBZ
  coins no astrological term and computes no astrology. Reuse from Sizhu is unit-by-unit with recorded
  origin (ADR 0003); `src/domain/sizhu.ts` is a lookup table, not a calculator.
- **Provisionality is lineage.** A fact inherits `provisional` from FuFirE's `precision.provisional_fields`;
  a claim citing one is `TENTATIVE_INTERPRETATION`. With `birthTimeKnown=false` ETBZ sends the date only
  (no time sentinel), hour facts are `ASSUMED_TIME_DERIVED` and not interpretable (PD-10), and the input
  is not production-eligible until FuFirE's producer contract ships.
- **Canonical product text lives in Confluence; the code is its executable representation.** Method
  Profile v1 (`63012866`), Long-Form Meta-Narrative Contract v1 (`57802765`), Rebaseline v1 (`62128133`),
  Terminology & Wording Lexicon v1 (`67600385`), Interpretation Lens v1 (`67371029`).
  `RELEASED_REGISTRY_HASHES` freezes the registry content per released version and
  `assertReleasedRegistry` blocks any other content, so a registry change is a new released version with
  a new hash and a Confluence change — never an in-place edit. Product decisions are the PD-n rows in
  ADR 0006.
- **What the gates do not prove** (documented, not implied): a cited symbol used in the wrong linguistic
  role, and prose whose tone overclaims beside a structurally correct uncertainty note. Both need a
  semantic Narrative-QA gate that does not exist here.

## Invariants (breaking one turns a gate red — that is intended)

**Scope fence.** `tests/architecture/no-business-surface.test.ts` pins served routes and the registry to
exactly `/health` + `/ready`, holds `FORBIDDEN_ROUTE_PATHS` (`/orders`, `/webhook`, `/render`, `/bazi`,
`/etsy`, `/fufire`, …) and `FORBIDDEN_RUNTIME_DEPENDENCIES` (`pg`, `redis`, `puppeteer`, `pdfkit`,
`stripe`, …), requires production dependencies to be exactly `express` + `zod`, and requires
`contracts/` to contain only `README.md`. Widening any of these is a **slice decision**: widen the guard
deliberately in the slice that brings the capability and record it in `docs/adr/`. New modules of the
product path belong in `src/application/` (or `src/domain/` when import-free).

**The public surface has three synchronised representations.** A route change means all of:
`PUBLIC_ROUTES` in `src/http/routes/index.ts`, the handler plus its `case` in the exhaustive `switch`,
and `openapi/etbz.openapi.yaml`. `tests/contract/openapi.contract.test.ts` compares registry ↔ live
Express router ↔ OpenAPI in both directions and sees surfaces mounted via `app.use(path, …)`.

**Configuration is a pure function.** `loadEtbzConfig` reads only a supplied record — no file, no
dotenv, never `/root/.env`. `process.env` is read once in `src/main.ts` (and once in
`src/attest-fufire.ts`). `loadEtbzConfig` reads only the names in `CONFIG_VARIABLES` (exact-set
assertion in `tests/unit/configuration.test.ts`), so adding a configuration variable means adding it
there; build metadata is read separately through `BUILD_INFO_VARIABLES` in `src/app/buildInfo.ts`.

**Readiness capabilities are a closed literal union** (`ETBZ9_READINESS_CAPABILITIES`). Widen it only
together with the dependency itself.

**Provenance never degrades.** A missing or placeholder revision is `null` and fails `assertProvenance`,
the image build and the container gate. Do not add a fallback string.

**`/health` stays dependency-free.** Dependencies belong in readiness.

**Logging.** Single-line JSON, injected sink and clock; credential-shaped keys and values are both
redacted; payload fields cannot overwrite `ts`/`level`/`msg`; the logger must never be able to crash the
request path.

**Keep the explicit `createServer(...)` + `listen` in `src/app/server.ts`.** `app.listen(cb)` registers
the callback as an error handler too, so a failed bind resolves as success.

**FuFirE boundary.** The base URL and API key are server-owned and injected at composition;
`validateBirthInput` refuses transport-override keys (`url`, `headers`, `apikey`, `token`, …); there is
no fallback calculator; every response is validated against the pinned contract before it leaves the
adapter; the adapter sends `boundary: "midnight"` explicitly (PD-9).

**Tests never mutate `process.env`.** Build apps through `tests/support/testRuntime.ts`
(`createTestApp(environment)`). Fixtures live in `tests/support/*Fixture.ts` in both wire and snapshot
shape, with a test pinning that mapping one produces the other.

**The test-count floor.** `ci-verify.sh` asserts at least 160 executed tests plus one executed file per
suite; `ETBZ_MINIMUM_TEST_COUNT` can only raise it. Adding a suite directory means adding it to
`vitest.config.ts` `include`, the suite list in `ci-verify.sh`, and `REQUIRED_TEST_SUITES` in
`tests/architecture/boundaries.test.ts`.

**Every guard needs a mutation proof.** `scripts/verify-guards.sh` injects real violations and requires
each foundation guard to turn red, then restores and re-proves the baseline. The slice scripts
`scripts/verify-etbz{34,30a,30b}-mutations.mjs` do the same at source level: a `MUTANTS` row is
`[name, file, find, replace, tests]`, `find` must occur exactly once, files are restored byte for byte,
and the tree must be clean at the end. They are not equally strict: `verify-etbz34` kills on vitest's
exit status and has no baseline step; `verify-etbz30a` refuses to run on a red baseline;
`verify-etbz30b` is the standard for new mutants — it refuses a red baseline, accepts an optional sixth
column `killer` (a fragment of the name of the test that must fail) and counts a kill only when that
test failed an **assertion** (a timeout, a load error or a thrown test body is an error, not a kill).
When you add a guard, add its mutant with the 30b semantics: a guard that has never been observed red
is decoration.

**Lint is defect detection only** (`no-floating-promises`, `no-misused-promises`, `await-thenable`,
`no-unnecessary-type-assertion` on top of the recommended sets). Formatting lives in `.editorconfig`;
add no style rules.

**Secrets.** `scripts/secret-scan.sh` runs gitleaks over the working tree with `--no-git` (so an
untracked local `.env` with real values fails it locally while CI is clean) and over the full history.
`.gitleaksignore` holds reviewed `commit:path:rule:line` fingerprints for synthetic fixtures that were
already rewritten, and lives on `main` — a fingerprint added only on a branch leaves every other PR red.
Assemble credential-shaped test strings at runtime from fragments, never as one literal.

## Working notes

- TypeScript is ESM + `NodeNext`: relative imports carry a `.js` extension, `verbatimModuleSyntax`
  requires `import type`, and `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` are on (hence
  conditional spreads for optional overrides and checked array reads).
- Decisions live in `docs/adr/0001`–`0018`. An ADR records its merge commit in the status line through a
  separate `docs/…` closeout PR after the merge; the GOLDEN_RUN_READY reconciliation of 2026-10-02 did so for 0008-0012
  and 0014-0017 (0013 recorded its own release). `docs/evidence/` records executed gates; transient output goes to the
  git-ignored `.etbz-verify/`. Durable evidence is a green CI run for a specific SHA.
- Delivery: branch → pull request → CI → **Product Owner authorisation** → merge. Green CI never
  authorises a merge; the PR body states whether merge is requested and carries the evidence. Branches
  are `feature/ETBZ-<n>-<slug>`, `fix/…`, `docs/…`; commits are
  `feat|fix|test|docs(ETBZ-<n>): imperative summary`; PR titles start with `[ETBZ-<n>]`. Jira project
  and Confluence space are both `ETBZ`.
