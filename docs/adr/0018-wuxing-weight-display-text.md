# ADR 0018 — A Wu Xing weight is printed without floating-point noise (ETBZ-61)

- **Status:** Proposed — not merged.
- **Date:** 2026-10-03
- **Slice:** ETBZ-61 [GOLDEN-REPAIR]. It repairs the PDF-QA block that stopped the ETBZ-54 Golden run.
- **Base:** `main@f920639e40988e02f196e88ad117523545a59e3b`.
- **Canonical product text:** Jira ETBZ-61; Jira ETBZ-54 comments 17082 (the stop) and 17123 (Product Owner decision
  D-54-2).

## Context

The ETBZ-54 Golden run of 2026-10-02 stopped at PDF QA. The renderer's `PAGE_QA` blocked the Wu Xing distribution page
with `OUTSIDE_SHEET` and `CLIPPED_BY_ANCESTOR`, so no PDF exists for that run.

The cause sits in the projection. FuFirE serialises a Wu Xing weight that is a floating-point sum together with its
binary representation noise: a sum such as 0.1 + 0.2 arrives as `0.30000000000000004`. The projection printed every
weight with `String(value)`, and seventeen significant digits do not fit the label slot. The renderer prints that same
text on the glance page, on the distribution page (circle label and legend) and on the summary.

None of the committed evidence carried such a weight. The development fixture and the live rehearsal charts have
weights such as 1.8, 2.5 and 2.

## Decision

1. **Noise only (D-54-2).** `wuXingValueText` prints the shortest decimal within the noise bound of the delivered
   number: `|printed - value| <= 2^-48 * |value|`.
   - The bound is purely relative. Binary64 noise is one unit in the last place, 2^-52 of the value, and the bound
     allows sixteen of them.
   - A weight without noise prints exactly `String(value)`. Zero prints `0`.
2. **The guard.** `assertWuXingValueText` refuses, with `PRESENTATION_FACT_MISMATCH`, a printed text that is outside
   the bound or is not the canonical text of its number (for example `" 2 "`, `"2e0"` or `""`). It is the formatter's
   postcondition. For the finite, non-negative weights the vector schema admits (`visualSystem.ts`), the formatter never
   produces a text the guard refuses.
3. **Nothing else moves.** `value` and `ratio` stay the delivered numbers, and the fact layer keeps the producer's value
   (`feature-set.ts`, `JSON.stringify`). Template 1.0.0 (`d595ab7c…`), its caption "Werte wie geliefert" and the
   renderer are unchanged. `projectionVersion` stays `bazodiac-presentation-projection.v1`, because the output for every
   weight without noise is unchanged.
4. **Rejected: fixed decimals with a changed footnote.** A new or changed label is part of the released template hash.
   That would have meant template 1.1.0, a new renderer pin, a re-run of the canary record, and pinning every committed
   projection made under 1.0.0. The Product Owner chose the noise-only rule (D-54-2).

## Measured behaviour (review round 1 of PR #27 and the runner's probes)

- **Sums.** 300,000 synthetic sums of 2 to 15 short decimals (tenths and hundredths); about 110,000 of them carry
  noise. Every one prints as its exact decimal. The suite runs a deterministic sweep of 20,000 such sums.
- **Real decimals.** 20,000 random decimals per length:
  - up to 14 significant digits, across exponents -3 to +3: none is changed;
  - 15 significant digits: about 30 % are shortened, each within 2^-48 of the value;
  - small values such as `3.7e-13` print unchanged, because the bound is relative.
- **Committed evidence.** The ETBZ-55, ETBZ-56 and ETBZ-58 projections re-derive byte for byte (their contract suites).

## Consequences

- The ETBZ-54 Golden reading, which was already accepted, can be re-rendered without a new reading. The Product Owner
  authorised that re-render in D-54-2.
- For a weight with noise, the page prints the short text while the chart fact keeps the producer's text. A reading
  that quotes the fact therefore quotes the noisy text. The Skill boundary governs that, not the projection.
- `npm run guards:etbz61` holds nine source mutants, and each is killed by an assertion in the test named for it.
  Removing the guard call alone is an equivalent mutant for every finite value. ROUND and LOOSE show the guard
  refusing a formatter that rounds.

## Limits

- A real decimal with 15 or more significant digits may be shortened, by at most 2^-48 of its value. Producer weights
  are sums of short ledger weights, so none has that many digits.
- The rule bounds no length. A real weight with 14 significant digits prints all of them, and the renderer's `PAGE_QA`
  would block it as before.
- Noise is judged relative to the value itself. A value that is pure noise around zero (a difference of sums, never a
  sum of non-negative weights) is printed as its own shortest text, not as `0`.
