# ETBZ-77 — Canon v2 contracts: Interpretation Lens v2 and Terminology & Wording Lexicon v2

Evidence for Jira ETBZ-77 (Canon v2, A1) and ADR 0019. Every file here is either re-derived by a test or is the
verbatim output of a command named below, with the commit it ran on.

- **Base:** `main@cb7605e58bee57cfff68c2a3b0a6a889ca1634c6`.
- **Implementation candidate measured here:** `3b88c7004f0e9fddef8c7c9e36a021b96edcaa7b`. The commit that adds
  this directory changes only files under `docs/evidence/etbz-77/` (check: `git diff --stat 3b88c700 <that commit>`).
- **CI on the final head** cannot be recorded inside the commit it measures. The exact-head CI run, the pull request
  and the merge commit are recorded in Jira ETBZ-77.

## Released identities

| Contract | Identity | Confluence page | Content hash (frozen in `RELEASED_CANON_V2_CONTRACT_HASHES`) |
| --- | --- | --- | --- |
| Interpretation Lens v2 | `grounded-reflective-synthesis-lens@2.0.0` | C1 `85229569` v1 | `sha256:638eef2dcb822ed94f70002947c642fcf112f8d23f58390825a5c5fdd59178ea` |
| Terminology & Wording Lexicon v2 | `terminology-wording-lexicon@2.0.0` | C5 `85164034` v1 | `sha256:f6c40f7a2383690225b684c89cda4bd3d146c97383c59c78531e33b7a05b67d6` |

- **C5 text.** `styleGuideV3Text()`: 3,846 UTF-8 bytes, 44 lines, SHA-256
  `75527bf7d4f68d9de1b8fad84c78f49997e222898050b9b511e9dfad31a09196`. It is byte-identical to the code block of C5
  version 1, compared with the page's ADF as the Atlassian connector returned it.
- **1.x stays as released.**
  - Bundles `1.0.0` (`sha256:1c8f80c3…`) and `1.1.0` (`sha256:9e6762f3…`) build to their released hashes.
  - The Lens and Lexicon `1.0.0`/`1.1.0` identities resolve under their own bundles.
  - The 19 1.x contract value modules and Skill-package files are byte-identical to the base.

## Files

| File | What it is | How it is checked or re-made |
| --- | --- | --- |
| `contracts-v2.json` | identities, page bindings, hashes, the 2.0 context's answer to 14 binding cases, the historical 1.x resolution, the 1.x byte baseline | re-derived byte for byte by `tests/contract/etbz77-contracts-v2.contract.test.ts`; regenerate with `npm run etbz77:evidence` |
| `mutation-proof.txt` | `npm run guards:etbz77` at the candidate: nine mutants, each killed by a named test failing an assertion, among them the three "v2 ref -> 1.1 ref" mutants of the Jira DoD | re-run the command (it mutates source files and restores them from bytes) |
| `throw-sweep.txt` | one-time sweep: every `throw` of `canon-v2-contracts.ts` disabled in turn, with the reason for each survivor | `sweeps/throw-sweep.mjs` |
| `clause-sweep.txt` | one-time sweep: 97 clause mutants across the four v2 modules (conditions, guard calls, schema refinements, list entries, freezes, the wrapper), with the reason for each survivor | `sweeps/clause-sweep.mjs` |
| `local-gate.txt` | `bash scripts/ci-verify.sh` at the candidate: every step and the summary | re-run the command (see the PATH note in the file) |

The sweeps cover the mutants they list, not every possible one. They are one-time proofs, not CI steps: the CI job
runs close to its 30-minute limit (ADR 0019, Consequences).

## Acceptance (Jira ETBZ-77)

| Criterion | Where it is shown |
| --- | --- |
| AC1: Lens v2 and Lexicon v2 carry the C1 rules (Zone A/B/C, Vorstoß, Licht/Schatten, Tier, Erlebensfelder, Säulenräume, Zählwörter/Zahlen); C5 is the voice authority; the 1.x files are byte-unchanged | unit suite "AC1" describes; contract suite "AC1: version beside version"; `contracts-v2.json` `v1Baseline` |
| AC2: a 1.1 reference in the 2.0 context is refused (negative test), the 2.0.0 pair accepted (positive) | negative suite "AC2" (`CONTRACT_DRIFT`); `contracts-v2.json` `identitySeparation` |
| AC3: the ADR documents precedence, what is replaced, what stays in force, the integrity rules and its identifier | `docs/adr/0019-canon-v2-contracts.md` (0019, not the planned 0018: `main` holds 0018 for ETBZ-61) |
| DoD: mutant v2 ref -> 1.1 ref, killer named | `mutation-proof.txt` (LENS REF, LEXICON REF, SOURCE REF <- "binds the Lens v2 and the Lexicon v2 at their 2.0.0 identities in the 2.0 context, never a 1.x one") |
| DoD: `bash scripts/ci-verify.sh` green locally | `local-gate.txt` |

No Golden value, birth data or chart of a real person appears in this directory or in the slice. The C5 calibration
paragraphs are about the synthetic fixture chart 庚午 · 壬午 · 辛亥 · 乙未.
