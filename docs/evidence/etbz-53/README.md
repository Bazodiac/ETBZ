# ETBZ-53 — Golden case freeze (GOLDEN-KT-01): evidence

The approved known-time Golden case `GOLDEN-KT-01` was frozen at the FuFirE / InterpretationInput boundary (Rebaseline 62128133 section 19; Jira ETBZ-53). This folder holds the only committed part of the freeze: `freeze-record.json`.

## Where the case data is

The case data stays outside every git repository (Product Owner decisions D-53-1..3, Jira ETBZ-53 comments 17026 and 17029).

- **Input file:** `/Users/Shared/ETBZ-golden/GOLDEN-KT-01.input.json`, mode 600.
- **Archive:** `/Users/Shared/ETBZ-golden/GOLDEN-KT-01/`, directory mode 700, files mode 600. It holds:
    - the three FuFirE response bodies, as the client read them;
    - the runtime readback;
    - the InterpretationInput;
    - the facts the oracle compared;
    - `record.hmac.key`.

The freeze refuses to run if group or other may access the archive directory, the input file or the key file. `verify` writes nothing into the archive; its temporary copy of the facts sits in a private sibling directory inside the same folder and is removed afterwards.

## Why every digest in the record is keyed

A plain digest of something determined by the chart can be searched back to the birth data. The independent privacy review of the first record (local commit, never pushed) showed this concretely:

- **Natal response.** It carries no echo of the input and only a whole-second timestamp. Its SHA-256 can be searched over every chart × every second of the freeze day.
- **Readback.** Every field of the readback is public or a digest of the input itself, so its SHA-256 is searchable too.
- **InterpretationInput structural hash.** It covers the input and the facts without any timestamp.
- **Byte lengths** reveal how many hidden stems the chart carries.

So the record carries none of these, unlike the plain SHA-256 digests and per-category counts that comments 17026 and 17029 announced (corrected in comment 17030). Every digest in it is an HMAC-SHA256 under a 32-byte key that exists only in the archive. Without the key it cannot be searched; with it, `npm run etbz53:freeze -- verify` re-derives every digest. The key itself is named in the record only by a keyed fingerprint.

## What the record states

| Field | Content |
| --- | --- |
| `birthInput` | `GOLDEN-KT-01`: validated, known time, only the six BirthInput fields. A field beyond them would be a hint the generator must not receive (AC 5) and is refused before any call. |
| `runtime` | Attestation PASS against FuFirE `8ad7dce6` (OpenAPI document `24cd80c5…`, public, reproduced from source for ETBZ-58); health and readiness 200; a call without credentials refused with 401; the three calls answered 200. The labels and statuses are listed, with no lengths. |
| `interpretationInput` | Production-eligible, no blockers (validated fail-closed, AC 3, AC 4). |
| `oracle` | The independent second oracle, `lunar-python==1.4.8` (6tail, pinned in its own uv project outside the product's dependencies, day boundary at midnight as FuFirE's). It ran clean (exit 0), compared every fact ETBZ derived (none absent) and agreed on all of them, across 11 categories: four pillars, Hanzi, pinyin, stem elements, polarity, animals, Day Master, hidden stems (order, Qi role, element, Ten God, element relation), the pillars' Ten Gods, the Month Command and the Wu Xing weights and dominant phase. The counts depend on the chart and are withheld. |
| `digests` | Keyed digests of the three response bodies, the readback, the InterpretationInput file and its structural hash, plus the key's fingerprint. |
| `liveStageRepositoryHead` | The ETBZ commit the live stage ran on (`51dca9d`). |

## Oracle independence and coverage (Jira ETBZ-53 comment 17028)

Independence: `lunar-python` is not a FuFirE dependency. FuFirE `8ad7dce6` declares `pyswisseph`, FastAPI and related runtime packages in `pyproject.toml`, and its source never imports `lunar_python` (the only textual hit is the phrase "from lunar day" in a docstring). The oracle runs from its own uv project with the version pinned in `uv.lock`.

Coverage: where each compared category comes from. The oracle prints this with every run.

| Category | Derived by |
| --- | --- |
| Four pillars, Hanzi | lunar-python (`EightChar`, day boundary at midnight) |
| Stem elements, Day Master element | lunar-python `LunarUtil.WU_XING_GAN`, translated to the German labels |
| Polarity | lunar-python stem order (`LunarUtil.GAN` parity) |
| Animals | lunar-python `LunarUtil.SHENGXIAO` by branch, translated |
| Hidden stems (stem, order, element, Ten God) | lunar-python `EightChar` hidden stems and their Ten Gods; the Qi role by position |
| Ten Gods of the pillars; element relations | lunar-python `EightChar` Ten Gods; each element relation by the classical definition of its Ten God |
| Month Command | lunar-python month branch and its first hidden stem |
| Wu Xing weights and dominant phase | **shared convention, not independent:** FuFirE's weighting (stem 1; hidden principal 1, central 0.5, residual 0.3) applied to lunar-python's stems and hidden stems. The equality shows that FuFirE applied its convention to the same stems; it does not validate the convention. |
| Pinyin | **romanisation table, not lunar-python** (the library has none): the standard Hanyu Pinyin of the 22 characters, written in the oracle script. |

Re-checked after the library derivation replaced the oracle's own element, polarity and animal tables: positive control 101 of 101, negative control 93 of 101 (the 8 swapped facts, exit 1), Golden case all facts equal, record re-derived byte for byte.

## How it was produced and checked

1. **Oracle controls**, run before the freeze on the synthetic rehearsal case (values printed because the case is synthetic):
    - **Positive:** Musterkundin A against the live ETBZ-58 facts gave 101 of 101 facts equal, exit 0. This includes the hour branch's hidden stems Ji, Ding, Yi, where the oracle agrees with FuFirE and not with the hand-written fixture.
    - **Negative:** against the fixture chart, the oracle named exactly the 8 swapped hour-branch facts, exit 1.
2. **Live stage** (`npm run etbz53:freeze -- freeze`, on `51dca9d`, 2026-10-02): only the two FuFirE variables were passed to the child environment. The input was validated locally first; then the live stage of ETBZ-58 ran with this case and was archived.
3. **Record, first build.** The value guard refused the first record: the display name the Product Owner gave is the pseudonym `GOLDEN-KT-01` itself, which the record carries by design. Values contained in the case reference are public.
4. **Record, rebuilt.** After the privacy review, the record was rebuilt from the archive with keyed digests, no lengths and no counts (`-- record`, no second FuFirE call). The review also found that the oracle's coverage was not bound; the freeze now requires exit 0, no absent fact and as many compared facts as it handed over.
5. **Verify** (`-- verify`): re-derives the record from the archive, oracle included, writing nothing into the archive. The committed record is equal byte for byte.

## Tests

`tests/contract/etbz53-freeze-record.contract.test.ts` checks in CI that:
- the record names the runtime ETBZ-58 attested;
- every gate passed;
- every digest is keyed, and the only plain hex value is the public OpenAPI digest;
- the live stage ran on a head of this history;
- the record carries no date but its own, no time of day, no coordinate, no CJK character, no length, no count and no BirthInput key.

`tests/negative/etbz53-golden-freeze.negative.test.ts` (13 tests) runs the freeze on the synthetic case against a fake runtime with a stub oracle. It covers:
- invalid, unknown-time or extended input refused with no call;
- a readable input file or archive directory refused with no call, and no key created in a readable archive;
- archive files with mode 600;
- an oracle that disagrees, under-covers, reports absent facts or exits non-zero, each refused;
- an archived readback without readiness, a drifted archived InterpretationInput or oracle-facts file, and a missing key, each refused offline;
- `verify` leaving the archive byte for byte unchanged and no temporary copy behind;
- digests and the key fingerprint that change with the key, and no key bytes in the record;
- the value guard naming field and path, never the value.

`npm run guards:etbz53` (a `ci-verify` step) proves 17 of these checks by mutation.

## What it does not show

- **The live answers, to CI.** The archive is local by decision; the re-derivation is the `verify` run on the machine that holds it. If the key is lost, the committed digests can no longer be re-derived. If it leaks, they become searchable.
- **A claim graph or plan for this case.** The freeze stops at the InterpretationInput (comment 17028). In ETBZ-54 the delivery runner drafts both from the frozen chart facts alone, as the drafter ADR 0008 names, and an independent review checks them against the Method Profile and the long-form contract before the Skill reading starts. The rehearsal's fixture drafts are not reused. This is Product Owner decision D-53-4 (comment 17030), which answers the question left open in Jira ETBZ-58 comment 17024.
- **A real name.** The display name stays the pseudonym `GOLDEN-KT-01` (Product Owner decision D-53-5, comment 17030), so ETBZ-54's PDF prints "Erstellt für GOLDEN-KT-01".
