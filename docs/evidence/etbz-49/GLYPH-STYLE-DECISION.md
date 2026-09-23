# ETBZ-49 — glyph style decision sheet

**`HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED` — OPEN.**

This sheet exists so the decision can be made by looking, not by reading a hash.
Nothing in the repository closes this gate; the implementation does not wait for
it. It is a merge gate for a human.

## What is being decided

The V4 donor set the visual target for the display glyphs: a heavy, geometric,
ink-like silhouette. The typeface in the V4 reference image (`金土木`) was never
identified — `FONT_IDENTITY_MISSING`, inherited from V4 and V5.

Rather than guess at the reference face or generate Hanzi as images (both
forbidden by Confluence 66650114 v2 section 3), the 27 assets were extracted
from a licensed face that is close to the target and then given a documented,
deterministic ink pass:

| | |
| --- | --- |
| Source face | Noto Sans CJK SC · `NotoSansCJKsc-Black` · weight 900 |
| Source version | Version 2.004;hotconv 1.0.118;makeotfexe 2.5.65603 |
| Source licence | SIL Open Font License 1.1 (`glyphs/OFL.txt`) |
| Source file digest | `sha256:3cffb10242b4b7e6edd439ebf3bd7e392345525e093ea08149e0a0158a1b5151` |
| Upstream | https://github.com/notofonts/noto-cjk |
| Ink pass | svg-stroke-under-fill, stroke 14 units, round joins, paint order `stroke fill` |
| Region policy | CN_SIMPLIFIED |

The fill path is the **unmodified licensed outline**. The ink pass is a
presentation expansion toward the V4 weight; it adds no new shape.

**This is an approximation of the V4 look. It is not a claim of identity with
the reference.** That is precisely why the decision is yours.

## What to look at

| Artefact | Shows |
| --- | --- |
| [`developer/D02-glyph-style.png`](developer/D02-glyph-style.png) | the ink pass beside the plain outline, at reading size — **the decision image** |
| [`developer/D01-glyph-proof.png`](developer/D01-glyph-proof.png) | all 27 assets with their digests and licence basis |
| [`customer/01-cover.png`](customer/01-cover.png) | a display glyph at hero size on the customer cover |
| [`customer/07-day-master.png`](customer/07-day-master.png) | the Day Master hero, the largest glyph the customer sees |
| [`customer/05-four-pillars.png`](customer/05-four-pillars.png) | the glyphs at pillar size, against their phase fields |
| [`customer/08-wu-xing.png`](customer/08-wu-xing.png) | the five Wu Xing characters on the data stage |
| [`final-contact-sheet.png`](final-contact-sheet.png) | every page at a glance |

## The three answers

1. **Accept** the ink-pass asset set as shipped. The gate closes, the assets do
   not change, and no hash moves.
2. **Supply the reference face.** The extraction is re-run against it; every
   per-glyph digest and the manifest digest change, and the 29-page proof is
   rebuilt and re-measured.
3. **Ship plain outlines.** The ink pass is dropped (`strokeUnits: 0`); the
   silhouette becomes lighter than the V4 target. Digests change.

Options 2 and 3 are asset rebases: they move the contract, so they need their
own verification run, not an edit.

## The twenty-seven assets

10 Heavenly Stems · 12 Earthly Branches · 5 Wu Xing characters. The set is
closed — any other codepoint is `DISPLAY_GLYPH_OUT_OF_CONTRACT` and belongs to
`InformationalCjkText`.

| # | Glyph | Codepoint | Pinyin | Role | Phase | Animal | Digest |
| ---: | :---: | --- | --- | --- | --- | --- | --- |
|  0 | 甲 | `U+7532` | jiǎ | heavenly stem | wood · yang | — | `9d118e3b4fb3a2de…` |
|  1 | 乙 | `U+4E59` | yǐ | heavenly stem | wood · yin | — | `d25afb4ee855aff9…` |
|  2 | 丙 | `U+4E19` | bǐng | heavenly stem | fire · yang | — | `406341f243cce7b2…` |
|  3 | 丁 | `U+4E01` | dīng | heavenly stem | fire · yin | — | `24cccc2672e9ee72…` |
|  4 | 戊 | `U+620A` | wù | heavenly stem | earth · yang | — | `4aacd7982042e15f…` |
|  5 | 己 | `U+5DF1` | jǐ | heavenly stem | earth · yin | — | `58f9dedf49d75d8f…` |
|  6 | 庚 | `U+5E9A` | gēng | heavenly stem | metal · yang | — | `080c23dd91cdec84…` |
|  7 | 辛 | `U+8F9B` | xīn | heavenly stem | metal · yin | — | `46d14e22373f228e…` |
|  8 | 壬 | `U+58EC` | rén | heavenly stem | water · yang | — | `dada5e5110375a51…` |
|  9 | 癸 | `U+7678` | guǐ | heavenly stem | water · yin | — | `b4492eae97356ff3…` |
| 10 | 子 | `U+5B50` | zǐ | earthly branch | water · yang | Rat | `9a6ca4349492ae27…` |
| 11 | 丑 | `U+4E11` | chǒu | earthly branch | earth · yin | Ox | `e7b286c03dcf33bf…` |
| 12 | 寅 | `U+5BC5` | yín | earthly branch | wood · yang | Tiger | `a67b83d861661c51…` |
| 13 | 卯 | `U+536F` | mǎo | earthly branch | wood · yin | Rabbit | `120a6c4675b4bc6a…` |
| 14 | 辰 | `U+8FB0` | chén | earthly branch | earth · yang | Dragon | `c2c8248a42ced3b9…` |
| 15 | 巳 | `U+5DF3` | sì | earthly branch | fire · yin | Snake | `cb225e56175f18fc…` |
| 16 | 午 | `U+5348` | wǔ | earthly branch | fire · yang | Horse | `65b89a5671886182…` |
| 17 | 未 | `U+672A` | wèi | earthly branch | earth · yin | Goat | `462310ae6d593810…` |
| 18 | 申 | `U+7533` | shēn | earthly branch | metal · yang | Monkey | `174b3311209ffbd2…` |
| 19 | 酉 | `U+9149` | yǒu | earthly branch | metal · yin | Rooster | `5d5bf92501dbc4ca…` |
| 20 | 戌 | `U+620C` | xū | earthly branch | earth · yang | Dog | `1c328f53c8fafc75…` |
| 21 | 亥 | `U+4EA5` | hài | earthly branch | water · yin | Pig | `738105f443e5b05e…` |
| 22 | 木 | `U+6728` | mù | wu xing | wood | — | `0f5f3325ad1f9088…` |
| 23 | 火 | `U+706B` | huǒ | wu xing | fire | — | `db8b4804bffefdbb…` |
| 24 | 土 | `U+571F` | tǔ | wu xing | earth | — | `3bcf2f8468cd7781…` |
| 25 | 金 | `U+91D1` | jīn | wu xing | metal | — | `af5788f1b3fa8224…` |
| 26 | 水 | `U+6C34` | shuǐ | wu xing | water | — | `333a92d44c63a9c6…` |

Manifest digest over all 27: `sha256:54f0ed0d5d3eebf65817c13cb54ea814049c2e79c05d9d040889c69bd08005d9`
(`bazodiac-final-glyph-manifest@2.0.0`, asset format `2.0.0`)

Every digest above is **recomputed** from the outline in
`tests/contract/etbz49-visual-assets.contract.test.ts`, and each SVG asset is
rebuilt from that outline and compared byte for byte. The numbers here are
therefore reproducible, not transcribed.
