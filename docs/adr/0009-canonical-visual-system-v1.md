# ADR 0009 — Bazodiac Visual System v1 (ETBZ-49)

- **Status:** Proposed — not merged. Merge requires explicit Product Owner
  authorisation (Jira ETBZ-49) and carries one open human decision,
  `HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED`, which nothing in this repository
  may close.
- **Date:** 2026-09-22
- **Slice:** ETBZ-49 — recover the converged visual system as repository truth.
  Does not implement a renderer.
- **Base:** `main@cd26b1065c7b7908f63e567259020d0474cf06e0`
- **Canonical product text:** Confluence ETBZ — *ETBZ-43 — Bazodiac PDF Visual
  System Final Convergence v1* (`66650114`, page version 2). That page is the
  decision; this ADR records how the repository carries it.

## Context

The visual system was decided by analysis across six donor packages (V1–V6) and
then built once, locally, outside the repository. The product therefore had a
premium template that existed only as a folder on one machine: not rebuildable,
not versioned, not testable, and impossible for a renderer to bind to.

Two things had to be true at once. The system had to become repository truth —
with provenance, hashes and tests — and it had to arrive **without** a renderer,
because the renderer is a separate slice with its own acceptance.

The obvious move, porting the V6 donor implementation wholesale, was rejected by
the Product Owner. V6 is 25 % of the decision, not the decision; it carries a
repository-shaped Python/Chromium build system, and adopting its shape would
have imported a rendering stack under the name of a design contract.

## Decision

### 1. The converged system, not a donor package

The implementation is the converged composite Confluence 66650114 v2 decided:

| Donor | Share | What it contributed |
| --- | --- | --- |
| V4 | 35 % | visual shell, palette atmosphere, Four Pillars, Day Master, display-glyph target |
| V6 | 25 % | deterministic vector glyph pipeline, provenance and hashes, centipoint layout, region-scoped colour guards |
| V3 | 20 % | report information architecture and page-family completeness |
| V2 | 12 % | Wu Xing Distribution visual language, long-form editorial rhythm |
| V5 | 6 % | design tokens, customer/evidence boundary, the two CJK contracts |
| V1 | 2 % | restraint and whitespace heuristic only |

No donor ships as a selectable variant. There is exactly one visual system.

### 2. It is a contract, not a renderer

`src/application/visual/` carries the system as values:

```
tokens.ts       19 canonical colour tokens + 5 decorative, type scale, spacing,
                geometry in mm and in integer centipoints
glyphs.ts       BazodiacDisplayGlyphSet — 27 identities, outlines, provenance
wordmark.ts     the static, chart-independent brand asset
pagination.ts   the long-form rules and the two measured fixture results
pageFamily.ts   18 designed pages, 25 slot bindings, structural hashes
provenance.ts   the decision source, convergence shares, font provenance,
                and the open human gate
visualSystem.ts the resolvers — and the refusals
```

It answers *what does the contract say* and *is this allowed*. It does not
answer *what does the page look like*. There is no HTML, no PDF, no layout
engine and no browser in it.

The renderer that consumes this contract is **ETBZ-55**. This ADR assigns no
renderer work to any other slice; earlier drafts that named ETBZ-26 as the owner
of `PresentationProjection` / `PdfRenderer` are superseded.

### 3. Narrowest boundary: inside the application layer

The module lands in `src/application/visual`, not as a new top-level layer under
`src/`. A sibling layer would need its own hand-written barrier. Inside the
application layer it inherits the existing one: `dependency-direction.test.ts`
already restricts `src/application` to the package `zod` and to relative imports
that stay within application/domain, enforced by parsing the source rather than
matching text, with a mutation proof in `scripts/verify-guards.sh`.

So the visual system is bound by the strictest rule the repository already has,
and `tests/architecture/etbz49-visual-boundary.test.ts` adds the four properties
a package allowlist cannot express: the module is a leaf that nothing imports;
it is pure (no clock, randomness, process, filesystem or network); it emits no
document; and it computes no BaZi fact, Wu Xing derivation or interpretation.

### 4. Values in TypeScript, artefacts on disk, equality proven

The application layer may not read files, so the contract has to travel as
values. The recovered artefacts nevertheless remain in the repository under
`assets/visual-system-v1/`, byte-identical to the converged build, because their
hashes are what the provenance record names.

`scripts/etbz49-generate-visual-contract.mjs` projects the assets into the
TypeScript modules. The contract test regenerates into a temporary directory and
requires a **byte-identical** result, so the two cannot drift in either
direction. The test also recomputes every per-glyph digest and the manifest
digest in Node rather than reading back the values that claim them, and rebuilds
each of the 27 SVG assets from the outline the contract carries.

### 5. Glyphs: 27 assets, preserved, not redesigned

`BazodiacDisplayGlyphSet` is exactly 27 deterministic vector assets — 10
Heavenly Stems, 12 Earthly Branches, 5 Wu Xing characters — extracted from
Noto Sans CJK SC Black (SIL OFL 1.1, source face pinned by SHA-256) with a
documented ink pass. Every asset carries its Unicode identity, its outline, its
bounding box and a canonical digest over all of them.

Arbitrary Chinese text is the *other* contract, `InformationalCjkText`. A
codepoint outside the 27 is `DISPLAY_GLYPH_OUT_OF_CONTRACT` — a refusal, not a
fallback, because a silent fallback would ship a glyph nobody approved.

The 金土木 reference face of the V4 donor was never identified. These assets are
a licensed, deterministic *approximation* of that look and are not a claim of
identity with it. `HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED` stays **OPEN** and is
a merge gate for a human, not an implementation stop condition:
`docs/evidence/etbz-49/` carries the inspectable proof the decision needs.

### 6. Fonts: provenance established, nothing rebaselined

The five recovered Inter binaries are byte-identical to the official
`rsms/inter` **v4.1** release (`Inter-4.1.zip`,
`sha256:9883fdd4…b11e`, inner path `extras/ttf/`), verified by SHA-256 and by
`cmp`. The upstream `LICENSE.txt` (`sha256:262481e8…935a`) is vendored beside
them as `fonts/OFL.txt`. Negative control: the same five filenames in the v4.0
release hash differently, so the match identifies a release rather than a family.

`FONT_LICENSE_PROVENANCE = VERIFIED`. No font was substituted, so no typography
or pagination result was rebaselined.

### 7. What the contract refuses

Fifteen named codes, each with a negative test that asserts the code and not
merely that something threw. The ten ETBZ-49 requires:

| Refusal | Code |
| --- | --- |
| glyph outside the 27 | `DISPLAY_GLYPH_OUT_OF_CONTRACT` |
| malformed or clipped glyph | `DISPLAY_GLYPH_MALFORMED` / `DISPLAY_GLYPH_CLIPPED` |
| whole-column phase tint | `PHASE_SCOPE_OUT_OF_CONTRACT` |
| design-side Wu Xing derivation | `WU_XING_RECOMPUTATION_REFUSED` |
| Sheng/Ke relation graphic | `SHENG_KE_NOT_SUPPORTED` |
| unknown visual type | `UNKNOWN_VISUAL_TYPE` |
| unknown slot | `UNKNOWN_SLOT` |
| semantic truncation | `SEMANTIC_TRUNCATION_REFUSED` |
| uncontrolled shrink-to-fit | `SHRINK_TO_FIT_REFUSED` |
| evidence chrome on the customer surface | `EVIDENCE_CHROME_IN_CUSTOMER_SURFACE` |

Two of them are worth naming precisely.

**Phase scope.** A phase colour classifies exactly one fact-bearing region —
Stem, Branch or one Hidden Stem. The pillar container stays neutral
(`paper-100`, or `paper-200` when selected). The recovered fixture is what makes
this checkable rather than decorative: its year pillar carries a Metal stem over
a Fire branch over Fire and Earth hidden stems, so a column tint is visibly
false on it. Day Master selection is neutral ground plus a 0.35 mm `gold-500`
edge, `isPhase: false` — a state, not a sixth phase.

**Wu Xing.** Supplied counts pass through untouched. A vector carrying a derived
quantity — `dominant`, `strength`, `balance`, `weighted`, `normalized`, … — is
refused under its own code rather than quietly ignored by a permissive parse.
The one permitted computation is the registered presentation transform
`pt.linear-max-v1`, which maps a count to a ratio of the largest count; it is
monotonic, and `presentWuXing` returns the untouched vector beside the ratios so
that is checkable. Zero means zero in this distribution and nothing else.

### 8. The proof harness stays outside the contract

The Python/Chromium build system that produced the 29 proof pages lives under
`tools/visual-proof-harness/`, declared as harness. Nothing in `src/` imports
it, it contributes no npm dependency, and `tsconfig.json` excludes it — all
three asserted, not promised. The production dependency set stays exactly
`express` and `zod`.

## Consequences

**Good.** The visual system is rebuildable repository truth with machine-checked
provenance. ETBZ-55 can implement a renderer against a contract that already
states its refusals, so the renderer inherits the guards instead of
re-litigating them. The font licence question is closed against a first-party
upstream source. `contracts/`, the dependency set and every ETBZ-30/34 guard are
untouched.

**Costs.** The repository grows by roughly 19 MB, most of it the 29 proof PNGs
and two merged PDFs under `docs/evidence/etbz-49/`. That is the price of the
visual oracle: JSON equality alone cannot show a human what the glyph style
looks like, and the glyph decision is a human one.

**Accepted limitations.**

1. The contract is a projection of assets, so an asset edit without
   regeneration fails the contract test rather than silently updating the
   contract. That is deliberate friction.
2. Interpretive chapters 15–26 are IA slots. They consume approved
   content-layer text that does not exist yet; pages 12–14 are the proven
   container.
3. `HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED` is open. The alternatives the PO
   holds are: accept the ink-pass asset set, supply the reference face, or ship
   plain outlines.
4. The harness needs a local `NotoSansCJK-Black.ttc` and Chromium. It never runs
   in CI; what CI verifies is that the committed contract still equals the
   committed assets.

## Alternatives rejected

**Port the V6 donor implementation.** Rejected by the Product Owner: V6 is a
quarter of the decision and its repository shape is a rendering stack. The local
branch that did this is kept as recovery evidence and was never published.

**A new top-level `src/visual` layer.** Rejected: it would need a hand-written
barrier where the application layer already has a proven one.

**Read the assets from disk at runtime.** Rejected: it would put `node:fs` into
the application layer, break the dependency guard, and make the contract
depend on a deployment's file layout.

**Attach a generic OFL to the recovered fonts.** Rejected: it would assert a
provenance nobody had established. The binaries were identified against upstream
first, and the upstream licence file was vendored.

**Redesign the glyphs to close the human gate.** Out of scope and not ours to
decide. The gate stays open with inspectable evidence attached.
