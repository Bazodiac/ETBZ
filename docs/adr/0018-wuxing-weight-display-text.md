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
weight with `String(value)`, and seventeen significant digits do not fit the label slot. The same text was on the
glance page, the distribution page's legend and the summary.

None of the committed evidence carried such a weight. The development fixture and the live rehearsal charts have
weights such as 1.8, 2.5 and 2.

## Decision

1. **Noise only (D-54-2).** `wuXingValueText` prints the shortest decimal that is the delivered number up to binary
   representation noise: `|printed - value| <= 2^-40 * max(1, |value|)`. A weight without noise prints exactly
   `String(value)`.
2. **No rounding.** A real decimal such as 2.675 or 1.005 is never rounded. `assertWuXingValueText` refuses a printed
   text further from the delivered value than the noise, with `PRESENTATION_FACT_MISMATCH`. The template's caption
   "Werte wie geliefert" therefore stays true.
3. **Nothing else moves.** `value` and `ratio` stay the delivered numbers, and the fact layer keeps the producer's value.
   The template stays at 1.0.0 with hash `d595ab7c…`, and the renderer is unchanged.
4. **Rejected: fixed decimals with a changed footnote.** A new or changed label is part of the released template hash.
   That would have meant template 1.1.0, a new renderer pin, a re-run of the canary record, and pinning every
   committed projection made under 1.0.0. The Product Owner chose the noise-only rule (D-54-2).

## Consequences

- The committed ETBZ-55, ETBZ-56 and ETBZ-58 projections re-derive byte for byte; their contract suites prove it.
- The ETBZ-54 Golden reading, which was already accepted, can be re-rendered without a new reading. The Product Owner
  authorised that re-render in D-54-2.
- `npm run guards:etbz61` holds five source mutants, and each is killed by an assertion in the test named for it.
  Removing the guard call alone is an equivalent mutant: the formatter never produces a text beyond the noise, so the
  call is its postcondition. The ROUND mutant shows that the guard refuses a formatter that rounds.

## Limits

- The rule removes noise. It does not bound the length of a real decimal. A producer weight with many real digits
  would still be printed in full, and the renderer's `PAGE_QA` would block it as before.
- The noise bound is relative (2^-40, about 9e-13). A real difference below it, at the twelfth significant digit,
  would be treated as noise. No producer weight is that precise.
