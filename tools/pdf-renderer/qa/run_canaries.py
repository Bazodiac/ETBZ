#!/usr/bin/env python3
"""Executed negative evidence for the gates of the Bazodiac PDF renderer (ETBZ-55).

A gate that has never failed is not proven. Each canary below breaks exactly one
thing - the projection, a pin, the host fonts, or one page builder - and runs the
real renderer (`render_pdf.main`) in a child process against it. The canary holds
only if the run ends BLOCKED at the expected check (with the expected finding
code where the check reports findings), exits 1, and leaves no PDF and no
ArtifactManifest behind. The results are written to
docs/evidence/etbz-55/renderer-canaries.json, bound to the renderer source
digest; the contract suite requires every canary to hold and the digest to equal
the one the committed ArtifactManifest states.

    PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
    "$PY" tools/pdf-renderer/qa/run_canaries.py --executed-at 2026-09-28

Local only, like the renderer. A doctored projection is rehashed where the canary
targets a later gate, so that the identity check lets it through; the renderer
trusts a projection only as far as its hash, which is exactly what the hash
canaries prove.
"""
from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import argparse  # noqa: E402
import copy  # noqa: E402
import hashlib  # noqa: E402
import json  # noqa: E402
import pathlib  # noqa: E402
import platform  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
RENDERER = HERE.parent
ROOT = RENDERER.parent.parent
sys.path.insert(0, str(RENDERER))
import pages as P  # noqa: E402
import render_pdf as R  # noqa: E402

PROJECTION = ROOT / "docs" / "evidence" / "etbz-55" / "presentation-projection.json"
OUT = ROOT / "docs" / "evidence" / "etbz-55" / "renderer-canaries.json"
CANARY_VERSION = "bazodiac-renderer-canaries.v1"


# ------------------------------------------------------------------ helpers (child side)

def u16(text: str) -> bytes:
    return text.encode("utf-16-be")


def load() -> dict:
    return json.loads(PROJECTION.read_text(encoding="utf-8"))


def rehash(projection: dict) -> dict:
    projection["structuralHash"] = R.structural_hash({k: v for k, v in projection.items() if k != "structuralHash"})
    return projection


def page_of(projection: dict, kind: str) -> dict:
    return next(page for page in projection["pages"] if page["content"]["kind"] == kind)


def restring(projection: dict, page: dict, old: str, new: str) -> None:
    """Replace one printed string and keep the page strings and the inventory exact."""
    page["strings"] = sorted({new if s == old else s for s in page["strings"]}, key=u16)
    projection["customerStrings"] = sorted(set().union(*(set(p["strings"]) for p in projection["pages"])), key=u16)


def wrap_builder(kind: str, transform) -> None:
    original = P.BUILDERS[kind]
    P.BUILDERS[kind] = lambda ctx, page, c: transform(original(ctx, page, c), ctx, page, c)


def wrap_page_html(transform) -> None:
    original = P.page_html
    P.page_html = lambda ctx, page: transform(original(ctx, page), page)


def patch_digest(path: str) -> None:
    original = R.asset_digests
    R.asset_digests = lambda: {**original(), path: "0" * 64}


def edit_builder(kind: str, change) -> None:
    """Give one builder a changed copy of its bound content - the paths travel with the values."""
    original = P.BUILDERS[kind]

    def build(ctx, page, c):
        changed = copy.deepcopy(c)
        change(changed)
        return original(ctx, page, changed)

    P.BUILDERS[kind] = build


def inject_css(css: str) -> None:
    wrap_page_html(lambda html, page: html.replace("</head>", f"<style>{css}</style></head>", 1))


def fake_latin_face(directory: pathlib.Path) -> pathlib.Path:
    """A face that covers ASCII and names itself Inter-Fake: a PostScript name with an allowed prefix, not an allowed name."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    directory.mkdir(parents=True, exist_ok=True)
    names = [".notdef"] + [f"g{code}" for code in range(0x20, 0x7F)]
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(names)
    builder.setupCharacterMap({code: f"g{code}" for code in range(0x20, 0x7F)})
    glyphs = {}
    for glyph_name in names:
        pen = TTGlyphPen(None)
        pen.moveTo((50, 0))
        pen.lineTo((50, 600))
        pen.lineTo((450, 600))
        pen.closePath()
        glyphs[glyph_name] = pen.glyph()
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({glyph_name: (500, 50) for glyph_name in names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": "InterFake", "styleName": "Regular", "psName": "Inter-Fake"})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    path = directory / "InterFake.ttf"
    builder.save(str(path))
    return path


def fake_cjk_face(directory: pathlib.Path) -> None:
    """A second, different font file that names itself Noto Sans CJK SC / NotoSansCJKsc-Regular."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    directory.mkdir(parents=True, exist_ok=True)
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder([".notdef"])
    builder.setupCharacterMap({})
    pen = TTGlyphPen(None)
    pen.moveTo((0, 0))
    pen.lineTo((0, 500))
    pen.lineTo((500, 500))
    pen.closePath()
    builder.setupGlyf({".notdef": pen.glyph()})
    builder.setupHorizontalMetrics({".notdef": (500, 0)})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": "Noto Sans CJK SC", "styleName": "Regular", "psName": "NotoSansCJKsc-Regular"})
    builder.setupOS2()
    builder.setupPost()
    builder.save(str(directory / "FakeNotoSansCJKsc.ttf"))


# ------------------------------------------------------------------ the canaries
# Each apply(work) patches the renderer in this child process and returns a doctored projection, or None for
# the committed one.

def c_projection_version(work):
    p = load()
    p["projectionVersion"] = "bazodiac-presentation-projection.v0"
    return rehash(p)


def c_projection_hash(work):
    p = load()
    page_of(p, "cover")["content"]["title"] = "Ein anderer Titel"
    return p


def c_template_hash(work):
    p = load()
    p["template"]["labels"]["brand"]["text"] = "Bazodiak"
    return rehash(p)


def c_font_pin(work):
    patch_digest("fonts/Inter-Regular.ttf")


def c_template_asset_pin(work):
    patch_digest("glyphs/sprite.svg")


def c_cjk_face_pin(work):
    R.CJK_FACE["sha256"] = "0" * 64


def c_cjk_face_ambiguous(work):
    fake_cjk_face(work / "fonts")
    R.CJK_DIRS = [*R.CJK_DIRS, work / "fonts"]


def c_glyph_out_of_contract(work):
    p = load()
    p["displayGlyphs"] = sorted([*p["displayGlyphs"], "天"], key=u16)
    return rehash(p)


def c_cjk_uncovered(work):
    p = load()
    p["cjkText"] = sorted([*p["cjkText"], "\ue000"], key=u16)
    return rehash(p)


def c_page_strings(work):
    # The projection claims a printed string no field of the page carries (rehashed, so the identity check passes).
    p = load()
    page = page_of(p, "summary")
    page["strings"] = sorted([*page["strings"], "Ein Satz ohne Feld"], key=u16)
    p["customerStrings"] = sorted(set().union(*(set(x["strings"]) for x in p["pages"])), key=u16)
    return rehash(p)


def c_page_build(work):
    p = load()
    page_of(p, "methodNote")["content"]["kind"] = "unknownKind"
    return rehash(p)


def c_text_injected(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html + '<div class="body" style="position:absolute;left:20mm;top:240mm">Ein Satz, den die Projektion nicht kennt.</div>')


def c_text_dropped(work):
    original = P.BUILDERS["summary"]
    P.BUILDERS["summary"] = lambda ctx, page, c: original(ctx, page, {**c, "rows": c["rows"][:-1]})


def c_glyph_not_in_projection(work):
    p = load()
    p["displayGlyphs"] = [g for g in p["displayGlyphs"] if g != "庚"]
    return rehash(p)


def c_generated_content(work):
    wrap_page_html(lambda html, page: html.replace("</head>", '<style>.kicker::after{content:" neu"}</style></head>', 1))


def c_invisible_text(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:10mm;max-width:130mm;color:transparent"', 1))


def c_clipped_by_ancestor(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:10mm;max-width:130mm;height:6mm;overflow:hidden"', 1))


def c_overflows_container(work):
    # The real defect of the first round-2 render: separators without a break opportunity let the sidebar's
    # Day-Master line run out of its panel.
    P.SEP_BREAK = P.SEP


def c_outside_sheet(work):
    p = load()
    page = page_of(p, "methodNote")
    old = page["content"]["paragraphs"][0]
    words = old.split(" ")
    new = " ".join(words[i % len(words)] for i in range(900))[:5900].rsplit(" ", 1)[0]
    page["content"]["paragraphs"][0] = new
    restring(p, page, old, new)
    return rehash(p)


def c_line_exceeds_measure(work):
    P.LONG_STYLE_CSS["body"] = P.LONG_STYLE_CSS["body"].replace("font-size:10.5pt", "font-size:11.5pt")


def c_overlap(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:-14mm;max-width:130mm"', 1))


def c_wu_xing_medallion(work):
    P.WX_GEOMETRY["medallion"]["d"] = 100


def c_unpinned_face(work):
    wrap_page_html(lambda html, page: html.replace("</head>", '<style>.sheet,.sheet *{font-family:"Helvetica" !important}</style></head>', 1))


def c_font_load_failed(work):
    original = P.Context.__init__

    def init(self, tokens_css, base_css, *rest):
        original(self, tokens_css, base_css.replace((R.ASSETS / "fonts").as_uri(), "file:///nonexistent-etbz55-fonts"), *rest)

    P.Context.__init__ = init


def c_wrong_key(work):
    # The year branch cell shows its stem's phase label (Metall instead of Feuer) - a value that is printed elsewhere.
    def change(c):
        c["pillars"][0]["branch"]["phaseLabel"] = c["pillars"][0]["stem"]["phaseLabel"]
    edit_builder("fourPillars", change)


def c_drop_copy(work):
    # The month branch's phase label is left out; the same word is printed elsewhere on the page.
    def change(c):
        label = c["pillars"][1]["branch"]["phaseLabel"]
        c["pillars"][1]["branch"]["phaseLabel"] = P.PStr("", label.path)
    edit_builder("fourPillars", change)


def c_wu_xing_swap(work):
    # Two phases' values swap places (1.8 and 2.5): each value is shown, but in the other phase's block and cell.
    def change(c):
        phases = c["wuXing"]["phases"]
        phases[0]["valueText"], phases[1]["valueText"] = phases[1]["valueText"], phases[0]["valueText"]
    edit_builder("wuXing", change)


def c_glyph_wrong_slot(work):
    # The year stem disc draws the branch character.
    def change(c):
        c["pillars"][0]["stem"]["character"] = c["pillars"][0]["branch"]["character"]
    edit_builder("fourPillars", change)


def c_hidden_display_none(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace("<p data-slot=", '<p style="display:none" data-slot=', 1))


def c_hidden_clip_path(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace("<p data-slot=", '<p style="clip-path:inset(50%)" data-slot=', 1))


def c_prefix_face(work):
    face = fake_latin_face(work / "fonts")
    inject_css(f'@font-face{{font-family:"InterFake";src:url("{face.as_uri()}")}} .sheet .body span{{font-family:"InterFake" !important}}')


def c_latin_in_cjk_face(work):
    inject_css('.sheet .body span{font-family:"Noto Sans CJK SC" !important}')


def c_group_wrapped(work):
    inject_css(".nw{white-space:normal !important;display:inline-block;width:1px}")


def c_occluded_text(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html + '<div style="position:absolute;left:20mm;top:70mm;width:150mm;height:40mm;background:var(--paper-000)"></div>')


def c_low_contrast(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:10mm;max-width:130mm;color:var(--paper-000)"', 1))


def c_forbidden_element(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html + '<ul style="position:absolute;left:20mm;top:250mm"><li></li></ul>')


def c_text_too_small(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:10mm;max-width:130mm;font-size:6pt;line-height:8pt"', 1))


def style_method_note(extra: str) -> None:
    """Add CSS to the method note's body block (the paragraph and its data)."""
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', f'margin-top:10mm;max-width:130mm;{extra}"', 1))


def c_cross_entry_branch(work):
    # The year column draws the hour pillar's branch (and vice versa): 庚未 instead of 庚午, each value in its own
    # cell slot, but inside another pillar's slot.
    def change(c):
        c["pillars"][0]["branch"], c["pillars"][3]["branch"] = c["pillars"][3]["branch"], c["pillars"][0]["branch"]
    edit_builder("fourPillars", change)


def c_column_swap(work):
    # Two whole pillars trade columns: every value stays in its own pillar, but the hour pillar stands first.
    def change(c):
        c["pillars"][0], c["pillars"][3] = c["pillars"][3], c["pillars"][0]
    edit_builder("fourPillars", change)


def c_wrong_phase_colour(work):
    wrap_builder("wuXing", lambda html, ctx, page, c: html.replace("background:var(--phase-fire-field)", "background:var(--phase-wood-field)", 1))


def c_ring_phase(work):
    # The fire position of the ring shows the wood entry.
    def change(html, ctx, page, c):
        fire = next(i for i, w in enumerate(c["wuXing"]["phases"]) if w["phase"] == "fire")
        wood = next(i for i, w in enumerate(c["wuXing"]["phases"]) if w["phase"] == "wood")
        return html.replace(f'data-phase="fire" data-phase-p="content.wuXing.phases.{fire}.phase"', f'data-phase="fire" data-phase-p="content.wuXing.phases.{wood}.phase"', 1)
    wrap_builder("wuXing", change)


def c_marks_shift(work):
    def change(c):
        marks = c["rows"][1]["marks"]  # Jie Cai: visible in the year pillar only
        marks[:] = list(reversed(marks))
    edit_builder("tenGods", change)


def c_line_swap(work):
    def change(c):
        lines = c["fragments"][0]["lines"]
        lines[0]["text"], lines[1]["text"] = lines[1]["text"], lines[0]["text"]
    edit_builder("longForm", change)


def c_pointer_events_overlay(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html + '<div style="position:absolute;left:20mm;top:70mm;width:150mm;height:40mm;background:var(--paper-000);pointer-events:none"></div>')


def c_faint_text(work):
    style_method_note("opacity:.3")


def c_scaled_text(work):
    style_method_note("transform:scale(.6);transform-origin:0 0")


def c_filtered_text(work):
    style_method_note("filter:blur(1px)")


def c_masked_text(work):
    style_method_note("-webkit-mask-image:linear-gradient(transparent,transparent);mask-image:linear-gradient(transparent,transparent)")


def c_visibility_hidden(work):
    style_method_note("visibility:hidden")


def c_legacy_clip(work):
    style_method_note("position:absolute;clip:rect(0 0 0 0)")


def c_unknown_path(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('data-p="content.paragraphs.0"', 'data-p="content.paragraphz.0"', 1))


def c_not_its_value(work):
    wrap_builder("summary", lambda html, ctx, page, c: html.replace('data-p="content.kicker"', 'data-p="content.title"', 1))


def c_glyph_not_its_value(work):
    wrap_builder("summary", lambda html, ctx, page, c: html.replace('data-p="content.dayMaster.character"', 'data-p="content.dayMaster.pinyin"', 1))


def c_glyph_invisible(work):
    inject_css('svg.disp[data-p="content.dayMaster.character"]{opacity:0}')


def c_glyph_faint(work):
    inject_css('svg.disp[data-p="content.dayMaster.character"]{color:rgba(0,0,0,.2) !important}')


def c_glyph_occluded(work):
    overlay = '<div style="position:absolute;left:0;top:0;right:0;bottom:0;background:var(--paper-200);z-index:1"></div>'
    wrap_builder("summary", lambda html, ctx, page, c: html.replace('style="width:40mm;height:40mm">', f'style="width:40mm;height:40mm;position:relative">{overlay}', 1))


def c_glyph_missing(work):
    import re
    wrap_builder("summary", lambda html, ctx, page, c: re.sub(r'<svg class="disp" data-p="content\.dayMaster\.character".*?</svg>', "", html, count=1))


def c_phase_unbound(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html + '<span class="dot m-fire" style="position:absolute;left:20mm;top:250mm"></span>')


def c_unknown_mark(work):
    def change(c):
        mark = c["rows"][0]["marks"]
        mark[0] = P.PStr("neither", f"{mark.path}.0")
    edit_builder("tenGods", change)


def c_day_master_inconsistent(work):
    def change(c):
        c["pillars"][0]["tenGod"] = None
    edit_builder("fourPillars", change)


def c_unbound_text(work):
    def change(c):
        c["kicker"] = str(c["kicker"])
    edit_builder("methodNote", change)


def c_unknown_tag_kind(work):
    p = load()
    page_of(p, "glance")["chrome"]["tagKind"] = "other"
    return rehash(p)


def c_lone_surrogate(work):
    # Written with JSON escapes (the text is not valid UTF-8 otherwise) and not rehashable: it has no identity.
    p = load()
    page_of(p, "cover")["content"]["title"] += chr(0xD800)
    path = work / "projection.json"
    path.write_text(json.dumps(p, ensure_ascii=True), encoding="ascii")
    return path


def c_partial_write(work):
    # The render passes, then the copy into the output fails: no --out directory may appear.
    original = R.shutil.copy2

    def copy2(source, target, *rest, **kw):
        if str(target).endswith("bazodiac-reading.pdf"):
            raise OSError("canary: disk full while writing the PDF")
        return original(source, target, *rest, **kw)

    R.shutil.copy2 = copy2


def append_to(kind: str, fragment: str) -> None:
    wrap_builder(kind, lambda html, ctx, page, c: html + fragment)


def c_identifier_printed(work):
    # The relation code of the year pillar (a non-printed identifier the page carries) printed as text.
    append_to("fourPillars", '<span data-p="content.pillars.0.tenGod.code" style="position:absolute;left:20mm;top:262mm">RobWealth</span>')


def c_svg_overlay(work):
    append_to("methodNote", '<svg style="position:absolute;left:18mm;top:60mm;width:160mm;height:60mm" viewBox="0 0 10 10" preserveAspectRatio="none">'
                            '<rect width="10" height="10" style="fill:var(--paper-000)"/></svg>')


def c_shadow_overlay(work):
    append_to("methodNote", '<div style="position:absolute;left:100mm;top:90mm;width:1mm;height:1mm;box-shadow:0 0 0 60mm var(--paper-000)"></div>')


def c_border_overlay(work):
    append_to("methodNote", '<div style="position:absolute;left:18mm;top:60mm;width:160mm;height:60mm;box-sizing:border-box;border:30mm solid var(--paper-000)"></div>')


def c_scalex_text(work):
    style_method_note("transform:scaleX(.3);transform-origin:0 0")


def c_important_overlay(work):
    append_to("methodNote", '<div style="position:absolute;left:20mm;top:70mm;width:150mm;height:40mm;background:var(--paper-000);pointer-events:none !important"></div>')


def c_sheet_escape(work):
    wrap_page_html(lambda html, page: html.replace("</body>", "Ein Satz neben dem Blatt</body>", 1))


def c_mark_invisible(work):
    inject_css(".mark{opacity:0}")


def c_mark_off_column(work):
    wrap_builder("tenGods", lambda html, ctx, page, c: html.replace('<td style="text-align:center;width:13mm">', '<td style="width:13mm"></td><td style="text-align:center;width:13mm">', 1))


def c_mark_out_of_slot(work):
    wrap_builder("tenGods", lambda html, ctx, page, c: html.replace('data-slot="content.rows.1.marks.0"', 'data-slot="content.rows.2.marks.0"', 1))


def c_phase_invisible(work):
    inject_css(".disc{background:transparent !important}")


def c_renderer_error(work):
    def fail(entries, target):
        raise RuntimeError("canary: the contact sheet cannot be written")
    R.contact_sheet = fail


def c_cjk_face_missing(work):
    R.CJK_DIRS = []


def c_glyph_low_contrast(work):
    inject_css('svg.disp[data-p="content.dayMaster.character"]{color:var(--phase-metal-field) !important}')


def c_line_unplaceable(work):
    wrap_builder("longForm", lambda html, ctx, page, c: html.replace('data-p="content.fragments.0.lines.0.text"', 'data-p="content.fragments.0.lines.999.text"', 1))


def c_wx_medallion_missing(work):
    wrap_builder("wuXing", lambda html, ctx, page, c: html.replace('id="wx-medallion"', 'id="wx-medallion-gone"', 1))


def c_wx_phase_block_count(work):
    wrap_builder("wuXing", lambda html, ctx, page, c: html.replace('data-wx="phase-block"', 'data-wx="phase-blok"', 1))


def c_wx_label_outside_circle(work):
    wrap_builder("wuXing", lambda html, ctx, page, c: html.replace("font-size:8.5pt;max-width:34mm", "font-size:22pt;max-width:90mm", 1))


def c_page_label_entry(work):
    def change(c):
        c["dayMasterLabel"] = c["pillars"][0]["positionLabel"]
    edit_builder("fourPillars", change)


def c_second_copy_outside(work):
    def extra(html, ctx, page, c):
        pinyin = c["pillars"][0]["stem"]["pinyin"]
        return html + f'<span data-p="{pinyin.path}" style="position:absolute;left:20mm;top:262mm">{pinyin}</span>'
    wrap_builder("fourPillars", extra)


def c_glyph_not_inked(work):
    cover = ('<svg style="position:absolute;left:0;top:0;width:40mm;height:40mm;z-index:1" viewBox="0 0 10 10">'
             '<rect width="10" height="10" style="fill:var(--phase-metal-field)"/></svg>')
    wrap_builder("summary", lambda html, ctx, page, c: html.replace('style="width:40mm;height:40mm">', f'style="width:40mm;height:40mm;position:relative">{cover}', 1))


def c_mark_not_inked(work):
    # An SVG shape (no background, so no occluder by paint) in the paper colour covers the presence-mark columns.
    append_to("tenGods", '<svg style="position:absolute;left:150mm;top:60mm;width:45mm;height:170mm" viewBox="0 0 10 10" preserveAspectRatio="none">'
                         '<rect width="10" height="10" style="fill:var(--paper-000)"/></svg>')


def c_phase_not_inked(work):
    # The disc keeps its colour in the DOM, but an SVG shape in the paper colour covers it on the page.
    cover = ('<svg style="position:absolute;left:0;top:0;width:40mm;height:40mm;z-index:1" viewBox="0 0 10 10">'
             '<rect width="10" height="10" style="fill:var(--paper-200)"/></svg>')
    wrap_builder("summary", lambda html, ctx, page, c: html.replace('style="width:40mm;height:40mm">', f'style="width:40mm;height:40mm;position:relative">{cover}', 1))


def c_self_clipped(work):
    inject_css(".sheet .h1 span{display:inline-block;width:10mm;overflow:hidden;white-space:nowrap}")


def c_squashed_text(work):
    style_method_note("transform:scaleY(.3);transform-origin:0 0")


def c_text_over_inked(work):
    # An SVG shape in the text's own colour (currentColor inside the method note's body block) covers the block.
    cover = ('<svg style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:1" viewBox="0 0 10 10" preserveAspectRatio="none">'
             '<rect width="10" height="10" style="fill:currentColor"/></svg>')
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm">', f'margin-top:10mm;max-width:130mm;position:relative">{cover}', 1))


def c_glyph_over_inked(work):
    # The first display glyph on the summary page is covered, inside its own SVG, by a shape in its own colour that
    # fills exactly the glyph's view box.
    def cover(html, ctx, page, c):
        x, y, w, h = ctx.view_box.split()
        return html.replace('<use href="#g-', f'<rect x="{x}" y="{y}" width="{w}" height="{h}" style="fill:currentColor"/><use href="#g-', 1)
    wrap_builder("summary", cover)


def c_mark_over_inked(work):
    # An SVG shape in the stem marks' own colour (ink-900) covers the presence-mark columns on the page.
    append_to("tenGods", '<svg style="position:absolute;left:150mm;top:60mm;width:45mm;height:170mm" viewBox="0 0 10 10" preserveAspectRatio="none">'
                         '<rect width="10" height="10" style="fill:var(--ink-900)"/></svg>')


def c_pdf_page_count(work):
    p = load()
    p["pageCount"] = p["pageCount"] + 1
    return rehash(p)


def c_determinism(work):
    calls = {"n": 0}
    pages = len(load()["pages"])

    def vary(html, page):
        run = calls["n"] // pages
        calls["n"] += 1
        marker = f'<div style="position:absolute;left:{run * 3}px;top:0;width:2px;height:2px;background:#000"></div>'
        return html.replace("</div></body></html>", marker + "</div></body></html>", 1)

    wrap_page_html(vary)


# id -> (gate, what the canary breaks, expected check, expected finding code or None, apply)
CANARIES = {
    "projection-version": ("projection identity", "the projection declares another projection version (rehashed)", "PROJECTION_VERSION", None, c_projection_version),
    "projection-hash": ("projection identity", "a cover string is edited without rehashing the projection", "PROJECTION_HASH", None, c_projection_hash),
    "template-hash": ("template identity", "a template label is edited; the projection is rehashed, the template is not", "TEMPLATE_HASH", None, c_template_hash),
    "font-pin": ("font pins", "the committed Inter-Regular digest no longer matches", "FONT_PIN", None, c_font_pin),
    "template-asset-pin": ("template asset pins", "the committed glyph sprite digest no longer matches", "TEMPLATE_ASSET_PIN", None, c_template_asset_pin),
    "cjk-face-pin": ("font pins", "the pinned Noto Sans CJK digest no longer matches the host file", "CJK_FACE_PIN", None, c_cjk_face_pin),
    "cjk-face-ambiguous": ("font pins", "a second font file naming itself Noto Sans CJK SC sits in a font directory", "CJK_FACE_AMBIGUOUS", None, c_cjk_face_ambiguous),
    "glyph-out-of-contract": ("glyphs", "the projection lists a display glyph outside the 27 (rehashed)", "GLYPH_OUT_OF_CONTRACT", None, c_glyph_out_of_contract),
    "cjk-uncovered": ("CJK coverage", "the projection lists a character the pinned SC face does not cover (rehashed)", "CJK_GLYPH_UNCOVERED", None, c_cjk_uncovered),
    "page-strings": ("page strings", "a page's strings list a string no field of the page carries (rehashed)", "PAGE_STRINGS", None, c_page_strings),
    "page-build": ("page build", "a page of a kind no builder knows (rehashed)", "PAGE_BUILD", None, c_page_build),
    "text-injected": ("renderer adds no text", "the method-note builder prints a sentence the projection does not carry", "PAGE_QA", "TEXT_NOT_IN_PROJECTION", c_text_injected),
    "text-dropped": ("renderer drops no text", "the summary builder leaves out its last fact row", "PAGE_QA", "TEXT_MISSING_FROM_PAGE", c_text_dropped),
    "glyph-not-in-projection": ("glyphs", "a page draws a display glyph the projection does not list (rehashed)", "PAGE_QA", "GLYPH_NOT_IN_PROJECTION", c_glyph_not_in_projection),
    "generated-content": ("renderer adds no text", "the stylesheet adds text through ::after", "PAGE_QA", "PSEUDO_CONTENT", c_generated_content),
    "invisible-text": ("no hidden text", "the method note is set in a transparent colour", "PAGE_QA", "TEXT_INVISIBLE", c_invisible_text),
    "clipped-by-ancestor": ("no content cut", "the method note is cut to 6 mm by its container", "PAGE_QA", "CLIPPED_BY_ANCESTOR", c_clipped_by_ancestor),
    "overflows-container": ("no content cut", "separators lose their break opportunity; the sidebar line runs out of its panel", "PAGE_QA", "OVERFLOWS_CONTAINER", c_overflows_container),
    "outside-sheet": ("no content cut", "the method note is 5,900 characters long (rehashed)", "PAGE_QA", "OUTSIDE_SHEET", c_outside_sheet),
    "line-exceeds-measure": ("long-form measure", "long-form body text is set one point larger than it was measured", "PAGE_QA", "LINE_EXCEEDS_MEASURE", c_line_exceeds_measure),
    "overlap": ("no overlap", "the method note is pulled up over the page title", "PAGE_QA", "OVERLAP", c_overlap),
    "wu-xing-medallion": ("Wu Xing medallion", "the medallion is drawn 100 mm wide", "PAGE_QA", "WX_DISC_INTRUDES", c_wu_xing_medallion),
    "unpinned-face": ("font pins", "every page is set in a host face", "PAGE_QA", "TEXT_SET_IN_UNPINNED_FACE", c_unpinned_face),
    "font-load-failed": ("font pins", "the Inter web fonts point at a missing directory", "PAGE_QA", "FONT_LOAD_FAILED", c_font_load_failed),
    "wrong-key": ("fact in its slot", "the year branch cell shows its stem's phase label, a value printed elsewhere on the page", "PAGE_QA", "TEXT_OUT_OF_SLOT", c_wrong_key),
    "drop-copy": ("renderer drops no text", "the month branch's phase label is left out; the same word is printed elsewhere", "PAGE_QA", "TEXT_MISSING_FROM_PAGE", c_drop_copy),
    "wu-xing-swap": ("fact in its slot", "two phases' Wu Xing values swap places", "PAGE_QA", "TEXT_OUT_OF_SLOT", c_wu_xing_swap),
    "glyph-wrong-slot": ("fact in its slot", "the year stem disc draws the branch character", "PAGE_QA", "GLYPH_OUT_OF_SLOT", c_glyph_wrong_slot),
    "hidden-display-none": ("no hidden text", "the method note is display:none", "PAGE_QA", "TEXT_INVISIBLE", c_hidden_display_none),
    "hidden-clip-path": ("no hidden text", "the method note is clipped away by clip-path", "PAGE_QA", "TEXT_INVISIBLE", c_hidden_clip_path),
    "prefix-face": ("font pins", "the method note is set in a face named Inter-Fake (allowed prefix, not an allowed name)", "PAGE_QA", "TEXT_SET_IN_UNPINNED_FACE", c_prefix_face),
    "latin-in-cjk-face": ("font pins", "German text is set in the CJK face", "PAGE_QA", "LATIN_SET_IN_CJK_FACE", c_latin_in_cjk_face),
    "group-wrapped": ("no split pair", "the non-breaking groups are allowed to wrap", "PAGE_QA", "GROUP_WRAPPED", c_group_wrapped),
    "occluded-text": ("no hidden text", "an opaque panel is painted over the method note", "PAGE_QA", "TEXT_OCCLUDED", c_occluded_text),
    "low-contrast": ("no hidden text", "the method note is set in the paper colour", "PAGE_QA", "TEXT_LOW_CONTRAST", c_low_contrast),
    "forbidden-element": ("renderer adds no text", "a list element appears on the page", "PAGE_QA", "FORBIDDEN_ELEMENT", c_forbidden_element),
    "text-too-small": ("no hidden text", "the method note is set at 6 pt, below the template minimum", "PAGE_QA", "TEXT_TOO_SMALL", c_text_too_small),
    "cross-entry-branch": ("fact in its slot", "the year and hour columns trade branches (the year pillar would read 庚未)", "PAGE_QA", "TEXT_OUT_OF_SLOT", c_cross_entry_branch),
    "column-swap": ("fact in its slot", "the year and hour pillars trade columns", "PAGE_QA", "SLOT_OUT_OF_ORDER", c_column_swap),
    "wrong-phase-colour": ("fact in its slot", "a Wu Xing disc is painted in another phase's colour", "PAGE_QA", "PHASE_NOT_ITS_VALUE", c_wrong_phase_colour),
    "ring-phase": ("fact in its slot", "the fire position of the Wu Xing ring shows the wood entry", "PAGE_QA", "PHASE_NOT_ITS_VALUE", c_ring_phase),
    "marks-shift": ("fact in its slot", "one Ten-God row's presence marks are drawn in reverse column order", "PAGE_QA", "MARK_NOT_ITS_VALUE", c_marks_shift),
    "line-swap": ("fact in its slot", "two long-form lines trade their text", "PAGE_QA", "LINE_MISPLACED", c_line_swap),
    "pointer-events-overlay": ("no hidden text", "an opaque panel with pointer-events:none covers the method note", "PAGE_QA", "TEXT_OCCLUDED", c_pointer_events_overlay),
    "faint-text": ("no hidden text", "the method note is set at opacity .3", "PAGE_QA", "TEXT_INVISIBLE", c_faint_text),
    "scaled-text": ("no hidden text", "the method note is scaled to 60 %", "PAGE_QA", "TEXT_TOO_SMALL", c_scaled_text),
    "filtered-text": ("no hidden text", "the method note is blurred by a filter", "PAGE_QA", "TEXT_INVISIBLE", c_filtered_text),
    "masked-text": ("no hidden text", "the method note is masked out", "PAGE_QA", "TEXT_INVISIBLE", c_masked_text),
    "visibility-hidden": ("no hidden text", "the method note is visibility:hidden", "PAGE_QA", "TEXT_INVISIBLE", c_visibility_hidden),
    "legacy-clip": ("no hidden text", "the method note is clipped away by clip:rect", "PAGE_QA", "TEXT_INVISIBLE", c_legacy_clip),
    "unknown-path": ("renderer adds no text", "a paragraph claims a path the page does not have", "PAGE_QA", "TEXT_NOT_IN_PROJECTION", c_unknown_path),
    "not-its-value": ("renderer adds no text", "a kicker claims the title's path", "PAGE_QA", "TEXT_NOT_IN_PROJECTION", c_not_its_value),
    "glyph-not-its-value": ("glyphs", "the Day-Master glyph claims the pinyin's path", "PAGE_QA", "GLYPH_NOT_ITS_VALUE", c_glyph_not_its_value),
    "glyph-invisible": ("glyphs", "the Day-Master glyph is drawn at opacity 0", "PAGE_QA", "GLYPH_INVISIBLE", c_glyph_invisible),
    "glyph-faint": ("glyphs", "the Day-Master glyph is drawn at 20 % alpha", "PAGE_QA", "GLYPH_INVISIBLE", c_glyph_faint),
    "glyph-occluded": ("glyphs", "an opaque panel covers the summary's Day-Master glyph", "PAGE_QA", "GLYPH_OCCLUDED", c_glyph_occluded),
    "glyph-missing": ("glyphs", "the summary leaves out its Day-Master glyph", "PAGE_QA", "GLYPH_MISSING_FROM_PAGE", c_glyph_missing),
    "phase-unbound": ("fact in its slot", "a phase-coloured dot appears that no entry paints", "PAGE_QA", "PHASE_UNBOUND", c_phase_unbound),
    "unknown-mark": ("page build", "a presence mark no map knows", "PAGE_BUILD", None, c_unknown_mark),
    "day-master-inconsistent": ("page build", "a pillar that is not the Day Master carries no relation", "PAGE_BUILD", None, c_day_master_inconsistent),
    "unbound-text": ("page build", "a builder is handed a plain string instead of a projection value", "PAGE_BUILD", None, c_unbound_text),
    "unknown-tag-kind": ("page build", "a page's running head declares a tag kind no map knows (rehashed)", "PAGE_BUILD", None, c_unknown_tag_kind),
    "lone-surrogate": ("projection identity", "the projection carries a lone surrogate: it is not well-formed text", "PROJECTION_HASH", None, c_lone_surrogate),
    "partial-write": ("no partial artefact", "the PDF copy into the output fails after a passing render", "NO_RESULT_DIRECTORY", None, c_partial_write),
    "identifier-printed": ("renderer adds no text", "the year pillar's relation code (an identifier) is printed", "PAGE_QA", "TEXT_NOT_IN_PROJECTION", c_identifier_printed),
    "svg-overlay": ("no hidden text", "an SVG rectangle in the paper colour covers the method note", "PAGE_QA", "TEXT_NOT_INKED", c_svg_overlay),
    "shadow-overlay": ("no hidden text", "a box shadow in the paper colour covers the method note", "PAGE_QA", "TEXT_NOT_INKED", c_shadow_overlay),
    "border-overlay": ("no hidden text", "a thick border in the paper colour covers the method note", "PAGE_QA", "TEXT_NOT_INKED", c_border_overlay),
    "scalex-text": ("no hidden text", "the method note is squeezed to 30 % of its width", "PAGE_QA", "TEXT_TOO_SMALL", c_scalex_text),
    "important-overlay": ("no hidden text", "an opaque panel with inline pointer-events:none !important covers the method note", "PAGE_QA", "TEXT_OCCLUDED", c_important_overlay),
    "sheet-escape": ("renderer adds no text", "a sentence is printed beside the sheet", "PAGE_QA", "SHEET_ESCAPED", c_sheet_escape),
    "mark-invisible": ("fact in its slot", "every presence mark is drawn at opacity 0", "PAGE_QA", "MARK_INVISIBLE", c_mark_invisible),
    "mark-off-column": ("fact in its slot", "one row's presence marks shift one column to the right", "PAGE_QA", "MARK_OFF_COLUMN", c_mark_off_column),
    "mark-out-of-slot": ("fact in its slot", "a presence mark sits in another row's mark slot", "PAGE_QA", "MARK_OUT_OF_SLOT", c_mark_out_of_slot),
    "phase-invisible": ("fact in its slot", "every phase disc loses its colour", "PAGE_QA", "PHASE_INVISIBLE", c_phase_invisible),
    "renderer-error": ("no partial artefact", "an unexpected error after the QA passed (the contact sheet)", "RENDERER_ERROR", None, c_renderer_error),
    "cjk-face-missing": ("font pins", "the pinned Noto Sans CJK face is not installed", "CJK_FACE_MISSING", None, c_cjk_face_missing),
    "glyph-low-contrast": ("glyphs", "the Day-Master glyph is drawn in its disc's own colour", "PAGE_QA", "GLYPH_LOW_CONTRAST", c_glyph_low_contrast),
    "line-unplaceable": ("fact in its slot", "a long-form line claims a line the fragment does not have", "PAGE_QA", "LINE_UNPLACEABLE", c_line_unplaceable),
    "wx-medallion-missing": ("Wu Xing medallion", "the Wu Xing medallion is missing", "PAGE_QA", "WX_MEDALLION_MISSING", c_wx_medallion_missing),
    "wx-phase-block-count": ("Wu Xing medallion", "one Wu Xing phase block is not marked as such", "PAGE_QA", "WX_PHASE_BLOCK_COUNT", c_wx_phase_block_count),
    "wx-label-outside-circle": ("Wu Xing medallion", "the medallion label is set too large for the circle", "PAGE_QA", "WX_LABEL_OUTSIDE_CIRCLE", c_wx_label_outside_circle),
    "page-label-entry": ("fact in its slot", "the day pillar's page label shows the year position label", "PAGE_QA", "TEXT_OUT_OF_SLOT", c_page_label_entry),
    "second-copy-outside": ("fact in its slot", "a second copy of the year stem's pinyin is printed outside every slot", "PAGE_QA", "TEXT_OUT_OF_SLOT", c_second_copy_outside),
    "glyph-not-inked": ("glyphs", "an SVG shape covers the summary's Day-Master glyph", "PAGE_QA", "GLYPH_NOT_INKED", c_glyph_not_inked),
    "mark-not-inked": ("fact in its slot", "an SVG shape covers the presence-mark columns on the page", "PAGE_QA", "MARK_NOT_INKED", c_mark_not_inked),
    "phase-not-inked": ("fact in its slot", "an SVG shape covers the summary's Day-Master disc on the page", "PAGE_QA", "PHASE_NOT_INKED", c_phase_not_inked),
    "self-clipped": ("no content cut", "the page titles are cut to 10 mm by their own box", "PAGE_QA", "CLIPPED", c_self_clipped),
    "squashed-text": ("no hidden text", "the method note is squashed to 30 % of its height", "PAGE_QA", "TEXT_INVISIBLE", c_squashed_text),
    "text-over-inked": ("no hidden text", "an SVG shape in the text's own colour covers the method note", "PAGE_QA", "TEXT_OVER_INKED", c_text_over_inked),
    "glyph-over-inked": ("glyphs", "a shape in the glyph's own colour covers the summary's first display glyph", "PAGE_QA", "GLYPH_OVER_INKED", c_glyph_over_inked),
    "mark-over-inked": ("fact in its slot", "an SVG shape in the stem marks' colour covers the presence-mark columns", "PAGE_QA", "MARK_OVER_INKED", c_mark_over_inked),
    "pdf-page-count": ("PDF readback", "the projection states one page more than it has (rehashed)", "PDF_READBACK", "PDF_PAGE_COUNT", c_pdf_page_count),
    "determinism": ("determinism", "every run draws one marker pixel at a different place", "DETERMINISM", None, c_determinism),
}


def child(canary_id: str, work: pathlib.Path) -> int:
    projection = CANARIES[canary_id][4](work)
    path = PROJECTION
    if isinstance(projection, pathlib.Path):
        path = projection
    elif projection is not None:
        path = work / "projection.json"
        path.write_text(json.dumps(projection, ensure_ascii=False), encoding="utf-8")
    sys.argv = ["render_pdf.py", "--projection", str(path), "--out", str(work / "out"), "--runs", "2",
                "--executed-at", "canary", "--repository-head", "canary"]
    return R.main()


# ------------------------------------------------------------------ parent

def run_one(canary_id: str) -> dict:
    gate, mutation, expected_check, expected_code, _ = CANARIES[canary_id]
    with tempfile.TemporaryDirectory(prefix=f"etbz55-canary-{canary_id}-") as tmp:
        work = pathlib.Path(tmp)
        proc = subprocess.run([sys.executable, "-B", str(pathlib.Path(__file__).resolve()), "--child", canary_id, "--work", str(work)],
                              capture_output=True, text=True, timeout=1800)
        out = work / "out"
        report_path = out / "qa-report.json"
        report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else None
        pdfs = sorted(str(p.relative_to(out)) for p in out.rglob("*.pdf")) if out.exists() else []
        manifest = (out / "artifact-manifest.json").is_file()
        out_exists = out.exists()
    last = report["checks"][-1] if report else None
    detail = last["detail"] if last else None
    codes = sorted({f["code"] for f in detail if isinstance(f, dict) and "code" in f}) if isinstance(detail, list) else []
    if expected_check == "NO_RESULT_DIRECTORY":
        # A crash after a passing render: the run fails and no --out directory appears (only its hidden .partial).
        observed_check = "NO_RESULT_DIRECTORY" if not out_exists else "RESULT_DIRECTORY_WRITTEN"
        holds = proc.returncode != 0 and not out_exists
    else:
        observed_check = last["id"] if last else None
        holds = (proc.returncode == 1 and report is not None and report["status"] == "BLOCKED" and last["result"] == "BLOCKED"
                 and last["id"] == expected_check and (expected_code is None or expected_code in codes) and not pdfs and not manifest)
    result = {
        "id": canary_id, "gate": gate, "mutation": mutation, "expectedCheck": expected_check, "expectedCode": expected_code,
        "observed": {"exitCode": proc.returncode, "status": report["status"] if report else None, "check": observed_check, "codes": codes},
        "pdfWritten": bool(pdfs), "manifestWritten": manifest,
        "verdict": "BLOCKED_AS_EXPECTED" if holds else "NOT_AS_EXPECTED",
    }
    if not holds:
        result["stderrTail"] = proc.stderr[-2000:]
    return result


MIRROR_PROBE = """
import { readFileSync } from 'node:fs';
import { canonicalJson } from '%s';
process.stdout.write(canonicalJson(JSON.parse(readFileSync(process.argv[2], 'utf8'))));
"""


def canonical_json_mirror() -> dict:
    """The renderer's Python canonical_json against the repository's TypeScript canonicalJson, on a fixed value set:
    numbers across every magnitude JSON.stringify switches notation at, and keys and strings with non-ASCII, astral,
    quote, backslash and line-separator characters."""
    import random

    rng = random.Random(55)
    numbers = [0, 1, -1, 0.72, 1.8, 2.5, 0.05, 0.00005, 1e-7, 123.0, 1e20, 1e21, 1e22, 1.5e300, 5e-324, 0.1 + 0.2, 0.000001, 0.0000012, -3.25]
    numbers += [rng.uniform(-1e6, 1e6) for _ in range(300)] + [rng.random() * 10 ** rng.randint(-14, 25) for _ in range(400)]
    strings = ["", "a\"b", "back\\slash", "line\u2028sep", "tab\tx", "Fünf Wandlungsphasen", "辛亥", "\U0001F469\u200d", "ctl\u0001x"]
    keys = {"b": 1, "a": 2, "ä": 3, "Z": 4, "辛": 5, "\U0001F469": 6, "\uffff": 7}
    value = {"numbers": numbers, "strings": strings, "keys": keys}
    with tempfile.TemporaryDirectory(prefix="etbz55-mirror-") as tmp:
        data = pathlib.Path(tmp) / "value.json"
        data.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        probe = pathlib.Path(tmp) / "probe.ts"
        probe.write_text(MIRROR_PROBE % (ROOT / "src" / "domain" / "canonical-json.ts").as_posix(), encoding="utf-8")
        node = subprocess.run(["npx", "vite-node", str(probe), str(data)], cwd=ROOT, capture_output=True, text=True, timeout=300)
    python_text = R.canonical_json(value)
    return {"numbers": len(numbers), "strings": len(strings), "keys": len(keys), "nodeExitCode": node.returncode,
            "equal": node.returncode == 0 and node.stdout == python_text,
            "sha256": "sha256:" + hashlib.sha256(python_text.encode("utf-8")).hexdigest()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--child")
    parser.add_argument("--work")
    parser.add_argument("--executed-at")
    parser.add_argument("--only", nargs="*")
    args = parser.parse_args()
    if args.child:
        return child(args.child, pathlib.Path(args.work))
    if not args.executed_at:
        parser.error("--executed-at is required")
    ids = args.only or list(CANARIES)
    results = []
    for canary_id in ids:
        result = run_one(canary_id)
        results.append(result)
        print(f"{canary_id:26s} {result['verdict']:20s} {result['observed']['check']} {result['observed']['codes'][:4]}", flush=True)
    held = sum(1 for r in results if r["verdict"] == "BLOCKED_AS_EXPECTED")
    projection = load()
    mirror = canonical_json_mirror()
    print(f"canonical-json mirror: equal={mirror['equal']} over {mirror['numbers']} numbers", flush=True)
    record = {
        "canaryVersion": CANARY_VERSION,
        "canarySourceSha256": "sha256:" + hashlib.sha256(pathlib.Path(__file__).resolve().read_bytes()).hexdigest(),
        "canonicalJsonMirror": mirror,
        "renderer": {"ref": R.RENDERER_REF, "sourceSha256": R.renderer_source_digest()},
        "projectionStructuralHash": projection["structuralHash"],
        "executedAt": args.executed_at,
        "host": f"{platform.system()} {platform.machine()}",
        "summary": {"canaries": len(results), "blockedAsExpected": held},
        "canaries": results,
    }
    if args.only:
        print(json.dumps(record["summary"]))
        return 0 if held == len(results) else 1
    OUT.write_text(json.dumps(record, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {held}/{len(results)} canaries blocked as expected")
    return 0 if held == len(results) and mirror["equal"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
