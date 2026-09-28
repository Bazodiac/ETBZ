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
npm test                    # all five suites (~980 tests on main)
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
npm run guards:etbz34 | guards:etbz30a | guards:etbz30b   # slice source-mutation proofs (NOT part of ci-verify)
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

Design rules that hold across the whole chain — the first six each pinned by negative tests and a source
mutant in `scripts/verify-etbz{34,30a,30b}-mutations.mjs`; the last item records what no gate proves:

- **Fail closed, never repair — in the acceptance boundaries.** In `InterpretiveClaim`,
  `InterpretiveClaimGraph`, `MetaNarrativePlan` and `BazodiacInterpretationInput` nothing substitutes,
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
- Decisions live in `docs/adr/0001`–`0008`. ADRs 0006 and 0007 record their merge commit in the status
  line through a separate `docs/…` closeout PR after the merge; ADR 0008 has not received that closeout
  yet and still reads "Proposed". `docs/evidence/` records executed gates; transient output goes to the
  git-ignored `.etbz-verify/`. Durable evidence is a green CI run for a specific SHA.
- Delivery: branch → pull request → CI → **Product Owner authorisation** → merge. Green CI never
  authorises a merge; the PR body states whether merge is requested and carries the evidence. Branches
  are `feature/ETBZ-<n>-<slug>`, `fix/…`, `docs/…`; commits are
  `feat|fix|test|docs(ETBZ-<n>): imperative summary`; PR titles start with `[ETBZ-<n>]`. Jira project
  and Confluence space are both `ETBZ`.
