# ETBZ-60 — repairing the ETBZ-59 BLOCKING code

ETBZ-59's fixture rehearsal raised one BLOCKING `STOCK_PARAGRAPH_REUSE`. Both R(S) and R(N) said that the
controlling Ten-God family shows on no pillar's surface. No claim carried that statement; it held for S and was false
for N. ADR 0017 records the decisions. Skill 1.1.0 and bundle 1.1.0 are unchanged, and nothing under `skill/` differs
from e5ccc94c. Everything here is synthetic: no Golden value was used or viewed.

Two rounds:

| Round | Decision | What changed | Outcome |
| --- | --- | --- | --- |
| `round-1/` | D-59-6: repair the boundary only | `acceptSkillReading` refuses `READING_POSITION_UNGROUNDED` for a sentence that states something of the chart's positions as a whole without a cited fact of every pillar | both re-readings accepted; the independent judge still found `STOCK_PARAGRAPH_REUSE`, in a paraphrase the patterns miss |
| `round-2/` | D-60-1: the graph grounds the surface | a distribution claim describes every pillar's surface and cites each pillar's visible Ten-God fact (drafts: `tests/support/etbz60Cases.ts`) | R(S) accepted at the first attempt. R(N) needed one repair (a surface statement, plus a false meta reading of an inflected label). The judge raised **no BLOCKING code**: the surface statements recur in place with opposite hour content, each true of its chart. One `FIXED_METAPHOR_REUSE` (ADVISORY) remains. |

## What is here

| Path | What it is | Written by |
| --- | --- | --- |
| `round-2/cases/<label>/skill-input.json`, `round-2/pre-run-cones.json` | round 2's packages and cones, committed before any round-2 reading | `npm run etbz60 -- emit`, `cones` |
| `<round>/cases/<label>/run-1/…refused.json` | each refused first REALISE attempt, kept unchanged | the Skill instances |
| `<round>/cases/<label>/semantic-reading.json`, `skill-reading.json`, `accepted-reading.json` | the repaired REALISE reading, its EDIT revision, the accepted result | the Skill instances; `npm run etbz60 -- accept <round> <label>` |
| `<round>/judge/` | what the independent judge read (its packet), its brief, its verbatim report and its tool calls | `npm run etbz60 -- packet <round>`; the judge instance |
| `<round>/judgements.json` | the 6.7 verdicts with their reason codes, quoting passages by path | the Delivery Runner, from the report |
| `rereading-record.json` | identities, runs, accepted hashes, cones and judgement files of both rounds | `npm run etbz60 -- record` |

Round 1 used ETBZ-59's packages (`docs/evidence/etbz-59/cases/<label>/skill-input.json`).

`tests/contract/etbz60-rereading-evidence.contract.test.ts` checks, for each round:

- every reading passes this boundary to its committed accepted bytes and carries no position statement;
- the record and each packet are re-derived byte for byte;
- the judge read only its packet;
- every quote stands at its path;
- round 1 keeps its BLOCKING code and round 2 raises none;
- nothing under `skill/` changed.

`tests/negative/etbz60-position-statements.negative.test.ts` covers the check itself. `npm run guards:etbz60` holds
its mutants.

## Limits

- The judges are LLM instances, never the sole oracle for a code (contract section 10). The ADVISORY codes stay
  candidates until the Product Owner has judged the quoted passages.
- Which model wrote or judged a reading is declared, not measured.
- The boundary check matches German phrase patterns. A paraphrase outside them is caught only by the claim graph's
  grounding (round 2) and the 6.7 judgement.
- The ETBZ-59 run record was made under the boundary at e5ccc94c and is pinned as merged there; it is not re-derived.
