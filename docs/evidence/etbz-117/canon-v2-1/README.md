# ETBZ-117 — Canon v2 forward fix: Lens and Lexicon 2.1.0 on C1/C5 page version 2 beside the A1 2.0.0 pair

Evidence for Jira ETBZ-117 (Canon v2, R0 pre-A2 canonical reconcile) and ADR 0020. Every file here is either
re-derived by a test or is the verbatim output of a command named below, with the commit it ran on.

- **Base:** `main@9362f4e21504bc5e01e8ef7ab29507778a8582cc` (the merge of ETBZ-77, PR #31).
- **Implementation candidate measured here:** `2cf40b757c60be69b704ed96a7496af435bc5815`. The commit that adds `README.md`,
  `mutation-proof.txt` and `local-gate.txt` changes only files under `docs/evidence/etbz-117/`
  (check: `git diff --stat 2cf40b75 <that commit>`).
- **CI on the final head** cannot be recorded inside the commit it measures. The exact-head CI run, the independent
  review, the pull request and the merge commit are recorded in Jira ETBZ-117.

## Released identities

| Contract | Identity | Confluence page | Content hash (frozen in `RELEASED_CANON_V2_1_CONTRACT_HASHES`) |
| --- | --- | --- | --- |
| Interpretation Lens | `grounded-reflective-synthesis-lens@2.1.0` | C1 `85229569` v2 | `sha256:b931ae4e2e0f5c8c64f9b4cc143a189247e74d62a99a79952b8822da74d8f983` |
| Terminology & Wording Lexicon | `terminology-wording-lexicon@2.1.0` | C5 `85164034` v2 | `sha256:11a03b11099d77b0c55f4f30317793a2952af58120522bef92bf42cbc34115c4` |

- **Current context.** `CURRENT_CANON_V2_VERSION` = `2.1.0`; pair `PLAN_CONTRACT_BINDINGS_V2_1`; entry points in
  `src/application/skill/current-canon-contracts.ts`.
- **C5 text.** The code block of C5 version 2 (ADF as the Atlassian connector returned it) is 3,949 UTF-8 bytes,
  44 lines, SHA-256 `19d30903c654c13574731e5865c71176e0ef4310384ee05ec5ee5a1fe4c114b8`, without a final line feed.
  `styleGuideV3Text(STYLE_GUIDE_V3_BLOCKS_V2_1)` renders the 2.1.0 lines under the 2.0.0 rule (one closing line
  feed): 3,950 UTF-8 bytes, SHA-256 `8d40f0053678a47a87b7563097da7e92f65b6a45d37b053e5457f372b798eabf`, identical to
  the page block plus that line feed, and differs from the 2.0.0 rendering in exactly the two lines of the Confluence
  version diff (REFLEXIONSFRAGE, ZIEL). `canon-v2-1.json` records both (`styleGuideV3TextV2_1`).
- **A1 stays as released.**
  - `grounded-reflective-synthesis-lens@2.0.0` `sha256:638eef2dcb822ed94f70002947c642fcf112f8d23f58390825a5c5fdd59178ea`
    (C1 v1) and `terminology-wording-lexicon@2.0.0`
    `sha256:f6c40f7a2383690225b684c89cda4bd3d146c97383c59c78531e33b7a05b67d6` (C5 v1) rebuild to their released hashes
    and resolve in the 2.0 context.
  - The 18 A1 files (2.0.0 value modules, freeze helper, ETBZ-77 evidence, suites, support files and guard script)
    are byte-identical to the base; the ETBZ-77 suites run unchanged and `contracts-v2.json` re-derives byte for byte.

## Files

| File | What it is | How it is checked or re-made |
| --- | --- | --- |
| `canon-v2-1.json` | identities, page bindings, hashes, the page-version delta, the current context's answer to 25 cases, the historical 2.0 context's answer to 5 cases, the A1 byte baseline and hashes, the method scope | re-derived byte for byte by `tests/contract/etbz117-canon-v2-1.contract.test.ts`; regenerate with `npm run etbz117:evidence` |
| `mutation-proof.txt` | `npm run guards:etbz117` at the candidate: 24 mutants, each killed by a named test failing an assertion | re-run the command (it mutates source files and restores them from bytes) |
| `local-gate.txt` | `bash scripts/ci-verify.sh` at the candidate: every step and the summary of the green run, and the first attempt on the same commit, which failed on five test timeouts under machine load | re-run the command (see the PATH note in the file) |

## Acceptance (Jira ETBZ-117), repository side

| Criterion | Where it is shown |
| --- | --- |
| AC2 A1 immutable | contract suite "AC2: A1 2.0.0 is immutable"; `canon-v2-1.json` `a1`; mutants A1 CONTENT, A1 EVIDENCE, A1 HASH |
| AC3 new forward identity | unit suite "load as released identities", "content is C1 and C5 at page version 2"; `canon-v2-1.json` `contracts`, `pageVersionDelta` |
| AC4 fail closed | negative suite "AC4: the current Canon context accepts only the 2.1.0 pair …"; `canon-v2-1.json` `currentContextAnswers`, `historicalContextAnswers`; mutants DRIFT/SOURCE/CONTEXT GUARD, OWN HASH TABLE, MALFORMED, UNKNOWN VERSION, EXPLICIT UNDEFINED, EXTRA ARGUMENTS, CURRENT/PAIR/PAGE/VOICE |
| AC5 reflection contract | unit suite "AC5: the reflection question stays a non-interactive text impulse" |
| AC6 ADR closeout | contract suite "AC6"; `docs/adr/0019-canon-v2-contracts.md` status Accepted; `docs/adr/0020-canon-v2-forward-fix-lens-lexicon-2-1.md`; mutants ADR PROPOSED, ADR OPEN QUESTION, ADR PARAPHRASE, ADR ROW; ADR 0019 = base text plus exactly the six declared closeout edits |
| AC7 no method expansion | contract suite "AC7 scope gate"; negative suite "scope gate"; mutants SCOPE (key, registry, new module beside the registry, new product module) |
| AC8 verification | `mutation-proof.txt`, `local-gate.txt` |
| AC1, AC9–AC15 | cross-system, exact-head CI, review, merge and closeout: Jira ETBZ-117. The stale-base / head-drift path is enforced at merge (`gh pr merge --match-head-commit`) and by exact-head CI (ADR 0020, section 5) |

No Golden value, birth data or chart of a real person appears in this directory or in the slice. The C5 calibration
paragraphs are about the synthetic fixture chart 庚午 · 壬午 · 辛亥 · 乙未.
