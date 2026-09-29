#!/usr/bin/env python3
"""Bazodiac PDF renderer — ETBZ-55 (`bazodiac-pdf-renderer@1.0.0`).

Renders a PresentationProjection (`bazodiac-presentation-projection.v1`, produced
and hash-bound by `src/application/presentation`) into one `application/pdf`,
QA-checks it, and writes an ArtifactManifest. The renderer decides nothing: every
page, value, label and long-form line position comes from the projection; it
places, draws and checks.

    PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
    $PY tools/pdf-renderer/render_pdf.py --projection docs/evidence/etbz-55/presentation-projection.json \
        --out .etbz-verify/pdf-render --executed-at 2026-09-28 --repository-head <sha>

Steps: (0) the projection hashes to its own `structuralHash`, and its template
to its own hash and to the released template identity pinned below; (1)
environment and pins — the five Inter faces and the four template assets the
pages are drawn from (tokens, glyph sprite, wordmark, glyph manifest) equal the
committed asset digests, the informational CJK face equals the pinned Noto Sans
CJK TTC, and no other file in the font directories provides that family; (2)
glyph and CJK checks — every display glyph is one of the 27, every CJK character
is covered by the pinned SC face and is one em wide (the advance the long-form
layout measured); (3) render every page through Chromium in deterministic mode,
`--runs` times; (4) QA per page — the printed text equals the page's projection
strings exactly (nothing added, nothing missing), no generated content, no
invisible text, every display glyph is a projection glyph, nothing outside the
sheet or clipped, no line wider than its measure, no overlap, the Wu Xing
medallion clear, every web font loaded, and every face that set text is one of
the six pinned PostScript faces; (5) merge deterministically, read the PDF back —
MIME magic, page count, A4 media boxes, only the pinned faces embedded; (6) the
last two runs must be byte-identical; (7) only then write the PDF, the contact
sheet, the QA report and the manifest. A failed check writes the QA report with
`BLOCKED` and no PDF — there is no partial artefact. `qa/run_canaries.py` makes
every gate fail once on purpose and records that it did, except six codes that need a
doctored font or PDF writer (ADR 0012 limitation 8).

Local only: Python 3 with playwright (Chromium), pikepdf, fontTools, Pillow.
Nothing here runs in CI; CI verifies the projection and the committed evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import platform
import re
import shutil
import sys
import tempfile
from importlib.metadata import version as pkg_version

import pikepdf
from fontTools.ttLib import TTCollection, TTFont
from PIL import Image, ImageChops, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

# The renderer writes nothing into the repository - not even a bytecode cache beside its sources.
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pages as P  # noqa: E402

RENDERER_REF = "bazodiac-pdf-renderer@1.0.0"
MANIFEST_VERSION = "bazodiac-artifact-manifest.v1"
QA_REPORT_VERSION = "bazodiac-pdf-qa-report.v1"
PROJECTION_VERSION = "bazodiac-presentation-projection.v1"
# RELEASED_TEMPLATE_HASHES['1.0.0'] of src/application/presentation/template.ts; the contract suite requires equality.
TEMPLATE_STRUCTURAL_HASH = "sha256:d595ab7cccdf9f99fe23d03fa7789366a2d3951f130aa6eabee626489c2562d6"

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ASSETS = ROOT / "assets" / "visual-system-v1"
CHROMIUM_ARGS = ["--deterministic-mode", "--disable-gpu", "--force-color-profile=srgb", "--font-render-hinting=none"]
A4_PX = (794, 1123)
A4_PT = (595.2756, 841.8898)
SEPARATORS = {"·"}

INTER_FILES = ["Inter-Regular.ttf", "Inter-Medium.ttf", "Inter-SemiBold.ttf", "InterDisplay-Light.ttf", "InterDisplay-Regular.ttf"]
# The template assets the pages are drawn from, each pinned in ASSET-INTEGRITY.json.
TEMPLATE_ASSETS = ["tokens.css", "glyphs/sprite.svg", "brand/wordmark.svg", "glyphs/manifest.json"]
CJK_FACE = {
    "family": "Noto Sans CJK SC",
    "file": "NotoSansCJK-Regular.ttc",
    "sha256": "b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a",
    "upstream": "https://github.com/notofonts/noto-cjk/raw/main/Sans/OTC/NotoSansCJK-Regular.ttc",
    "licence": "SIL Open Font License 1.1",
    "licenceFile": "assets/visual-system-v1/glyphs/OFL.txt",
}
CJK_DIRS = [pathlib.Path.home() / "Library" / "Fonts", pathlib.Path("/Library/Fonts"), pathlib.Path("/usr/share/fonts/opentype/noto"),
            pathlib.Path("/usr/share/fonts/noto-cjk"), pathlib.Path("/usr/local/share/fonts"), pathlib.Path.home() / ".fonts",
            pathlib.Path.home() / ".local" / "share" / "fonts"]
INTER_POSTSCRIPT_NAMES = {"Inter-Regular", "Inter-Medium", "Inter-SemiBold", "InterDisplay-Light", "InterDisplay-Regular"}
CJK_POSTSCRIPT_NAME = "NotoSansCJKsc-Regular"
# The faces Chromium may use to set text, by exact PostScript name: the committed Inter faces (web fonts) and the pinned SC face.
ALLOWED_POSTSCRIPT_NAMES = INTER_POSTSCRIPT_NAMES | {CJK_POSTSCRIPT_NAME}
FONT_SUFFIXES = (".ttf", ".otf", ".ttc", ".otc")
# The share of a box's pixels (each line box on its own) that carry the item's colour must lie within a band.
# Calibrated on the evidence document (2026-09-29, 1470 text items, 116 glyphs, 44 marks, 92 phase paints; the QA
# report records the band and the contract suite pins it). Floor: a hidden item, or one covered in another colour,
# leaves (close to) no pixels of its colour. The lowest shares observed were text 0.083, glyph 0.192, mark 0.162,
# phase 0.474; each floor sits at 30 to 45 % of that. Ceiling: a box (almost) solid in the item's colour is a cover
# in that colour. The highest shares observed were text 0.190, glyph 0.448, mark 0.691; each ceiling sits above 1.3
# times that and below a solid box (about 1.0). Phase paints are solid fields by design and have no ceiling. The
# phase fields are pale tints close to the paper colours, so their colour tolerance is 4 (grey-scaled difference): a
# field covered by paper-200 (difference about 6) no longer counts. Every printed character is also checked in its
# own box (33,256 characters): the lowest share observed was 0.0151 (a hyphen), the highest 0.263; a character under
# a cover in another colour leaves (close to) nothing, one under a cover in its own colour about 1.0.
# The one @page rule base.css states: A4, no margin, no margin box (the DOM QA compares it without whitespace).
PAGE_RULE = "@page { size: 210mm 297mm; margin: 0px; }"
INK_TEXT_MIN, INK_TEXT_MAX = 0.03, 0.5
INK_GLYPH_MIN, INK_GLYPH_MAX = 0.06, 0.75
INK_MARK_MIN, INK_MARK_MAX = 0.05, 0.92
INK_PHASE_MIN = 0.2
INK_CHARACTER_MIN, INK_CHARACTER_MAX = 0.005, 0.6


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: pathlib.Path) -> str:
    return sha256_bytes(path.read_bytes())


class Blocked(Exception):
    def __init__(self, check: str, detail: object):
        super().__init__(f"{check}: {detail}")
        self.check = check
        self.detail = detail


# ------------------------------------------------------------------ structural hash (mirror of src/domain/canonical-json.ts)

def js_number(value: float) -> str:
    """ECMAScript Number::toString for a finite double - what JSON.stringify prints."""
    if value != value or value in (float("inf"), float("-inf")):
        raise ValueError("canonical JSON has no NaN or Infinity")
    if value == 0:
        return "0"
    sign = "-" if value < 0 else ""
    text = repr(abs(value))
    mantissa, _, exponent = text.partition("e")
    whole, _, fraction = mantissa.partition(".")
    shift = int(exponent) if exponent else 0
    if whole.strip("0"):
        point = len(whole.lstrip("0")) + shift
    else:
        point = shift - (len(fraction) - len(fraction.lstrip("0")))
    digits = (whole + fraction).strip("0") or "0"
    k, n = len(digits), point
    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    e = n - 1
    return sign + digits[0] + ("." + digits[1:] if k > 1 else "") + "e" + ("+" if e >= 0 else "-") + str(abs(e))


def canonical_json(value) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return js_number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(entry) for entry in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value, key=lambda key: key.encode("utf-16-be"))
        return "{" + ",".join(json.dumps(key, ensure_ascii=False) + ":" + canonical_json(value[key]) for key in keys) + "}"
    raise TypeError(f"not JSON-representable: {type(value).__name__}")


def structural_hash(value) -> str:
    try:
        return "sha256:" + sha256_bytes(canonical_json(value).encode("utf-8"))
    except UnicodeEncodeError as error:
        # A lone surrogate: the projection is not well-formed text, so it has no identity to verify.
        raise Blocked("PROJECTION_HASH", {"error": f"not well-formed text: {error}"}) from error


def check_projection_identity(projection: dict) -> dict:
    stated = projection.get("structuralHash")
    actual = structural_hash({k: v for k, v in projection.items() if k != "structuralHash"})
    if actual != stated:
        raise Blocked("PROJECTION_HASH", {"stated": stated, "actual": actual})
    template = projection["template"]
    template_actual = structural_hash({k: v for k, v in template.items() if k != "structuralHash"})
    if template_actual != template.get("structuralHash") or template_actual != TEMPLATE_STRUCTURAL_HASH:
        raise Blocked("TEMPLATE_HASH", {"stated": template.get("structuralHash"), "actual": template_actual, "released": TEMPLATE_STRUCTURAL_HASH})
    return {"projection": actual, "template": template_actual}


# ------------------------------------------------------------------ DOM QA (runs in the page)

DOM_QA = r"""
(q) => {
  const W = 793.7, H = 1122.5, CP = 96 / 7200, MIN_FONT_PX = 11, VISIBLE = 0.5, findings = [];
  const values = q.values, glyphSet = new Set(q.displayGlyphs), separators = new Set(q.separators), requiredSet = new Set(q.required);
  const sheet = document.querySelector('.sheet');
  // What the rendered page image must show: each printed string, glyph, mark and phase paint leaves pixels of its
  // colour inside its own box. Python checks these against the screenshot (the ink check), whatever hides them.
  const ink = [];
  const box = (r) => ({x: r.left, y: r.top, w: r.width, h: r.height});
  const rgb = (c) => ({r: c.r, g: c.g, b: c.b});
  // (0) Nothing outside the sheet: the body holds the glyph sprite and the one sheet, and no text of its own.
  for (const child of document.body.childNodes) {
    if (child === sheet) continue;
    if (child.nodeType === 3) { if (child.textContent.trim().length > 0) findings.push({code: 'SHEET_ESCAPED', text: child.textContent.trim().slice(0, 60)}); continue; }
    if (child.nodeType === 1 && !(child.tagName.toLowerCase() === 'svg' && child === document.body.querySelector('svg'))) findings.push({code: 'SHEET_ESCAPED', element: child.tagName});
  }
  const has = (p) => Object.prototype.hasOwnProperty.call(values, p);
  // The colours a phase may paint: its field and mark tokens, resolved on the page (the pinned light scheme).
  const PHASES = ['wood', 'fire', 'earth', 'metal', 'water'], rootStyle = getComputedStyle(document.documentElement);
  const hex = (v) => { const m = /^#([0-9a-f]{6})$/i.exec(String(v).trim()); return m ? {r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16)} : null; };
  const phaseTokens = Object.fromEntries(PHASES.map((p) => [p, ['field', 'mark'].map((k) => hex(rootStyle.getPropertyValue(`--phase-${p}-${k}`))).filter(Boolean)]));
  for (const p of PHASES) if (phaseTokens[p].length !== 2) findings.push({code: 'PHASE_TOKENS_UNRESOLVED', phase: p});
  const sameColour = (a, b) => Math.abs(a.r - b.r) <= 1 && Math.abs(a.g - b.g) <= 1 && Math.abs(a.b - b.b) <= 1;
  const phasesOfColour = (c) => PHASES.filter((p) => phaseTokens[p].some((token) => sameColour(token, c)));
  const parse = (color) => { const m = /rgba?\(([^)]*)\)/.exec(color || ''); if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (top, under, a) => ({r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1});
  const opacityOf = (el) => { let o = 1; for (let a = el; a && a !== document.documentElement; a = a.parentElement) o *= parseFloat(getComputedStyle(a).opacity); return o; };
  const name = (el) => String(el.className && el.className.baseVal === undefined ? el.className : el.tagName).slice(0, 40);
  const effectsOf = (el) => { for (let a = el; a && a !== sheet.parentElement; a = a.parentElement) { const s = getComputedStyle(a);
    if (s.clipPath !== 'none' || s.maskImage !== 'none' || (s.webkitMaskImage && s.webkitMaskImage !== 'none') || s.filter !== 'none' || (s.clip && s.clip !== 'auto')) return name(a); } return null; };
  // A unicode-bidi override or embedding on the element or an ancestor reorders what it prints.
  const bidiOf = (el) => { for (let a = el; a && a !== sheet.parentElement; a = a.parentElement) { const b = getComputedStyle(a).unicodeBidi;
    if (b !== 'normal' && b !== 'isolate') return `unicode-bidi ${b} on ${name(a)}`; } return null; };
  // A transform with a negative determinant, on the element or an ancestor, mirrors what it draws.
  const mirrored = (el) => { let sign = 1; for (let a = el; a && a !== sheet.parentElement; a = a.parentElement) { const s = getComputedStyle(a);
    if (s.transform && s.transform !== 'none') { const m = new DOMMatrix(s.transform); if (m.a * m.d - m.b * m.c < 0) sign = -sign; }
    if (s.scale && s.scale !== 'none') { const [x, y = x] = s.scale.split(/\s+/).map(Number); if (x * y < 0) sign = -sign; } } return sign < 0; };
  const shown = (el) => typeof el.checkVisibility !== 'function' ||
    el.checkVisibility({opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true, checkOpacity: true, checkVisibilityCSS: true});
  // How much an element covers what lies under it: its composite opacity times its background alpha - or, for an SVG
  // shape, its fill or stroke alpha times that paint's opacity (a gradient counts as opaque).
  const isShape = (el) => typeof SVGGeometryElement !== 'undefined' && el instanceof SVGGeometryElement;
  const paint = (el) => { const s = getComputedStyle(el);
    if (isShape(el)) { // hit-testing already limits a shape to where it paints, its fill or its stroke
      const alphaOf = (v, o) => { if (!v || v === 'none') return 0; const f = parse(v); return (f === null ? 1 : f.a) * parseFloat(o || '1'); };
      return Math.max(alphaOf(s.fill, s.fillOpacity), alphaOf(s.stroke, s.strokeOpacity)) * opacityOf(el); }
    const c = parse(s.backgroundColor);
    const cover = s.backgroundImage !== 'none' ? 1 : (c === null ? 0 : c.a); return cover * opacityOf(el); };
  const surfaceColour = (el) => parse(isShape(el) ? getComputedStyle(el).fill : getComputedStyle(el).backgroundColor);
  // The first painted surface under (x, y) for el: its own background counts (a tag), its descendants do not.
  const backdrop = (el, x, y) => { for (const hit of document.elementsFromPoint(x, y)) { if (hit !== el && el.contains(hit)) continue;
    if (paint(hit) >= VISIBLE) { const c = surfaceColour(hit); if (c && c.a > 0) return c; } } return {r: 255, g: 255, b: 255, a: 1}; };
  // Whether (x, y) falls on a visible border of el (its border box outside its padding box).
  const onBorder = (el, x, y) => { if (isShape(el)) return false; const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const side = (w, c) => { const width = parseFloat(w) || 0, colour = parse(c); return width > 0 && colour !== null && colour.a * opacityOf(el) >= VISIBLE ? width : 0; };
    const t = side(s.borderTopWidth, s.borderTopColor), b = side(s.borderBottomWidth, s.borderBottomColor);
    const l = side(s.borderLeftWidth, s.borderLeftColor), rt = side(s.borderRightWidth, s.borderRightColor);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    return (t > 0 && y < r.top + t) || (b > 0 && y > r.bottom - b) || (l > 0 && x < r.left + l) || (rt > 0 && x > r.right - rt); };
  // A painted element above el at (x, y) - pointer-events are forced on for the QA, so overlays with none are seen.
  const occluderAt = (el, x, y) => { for (const hit of document.elementsFromPoint(x, y)) {
    if (hit === el || el.contains(hit) || hit.contains(el)) return null; if (paint(hit) >= VISIBLE || onBorder(hit, x, y)) return hit; } return null; };
  // Binding: every enclosing slot is a prefix of the path, every entry of the path has a slot around it; inside a
  // page label only a page-level value may sit.
  const PAGE_LEVEL = /^(content|chrome)\.[A-Za-z]+$/;
  const entriesOf = (p) => { const parts = p.split('.'), out = []; for (let i = 1; i < parts.length; i++) if (/^\d+$/.test(parts[i])) out.push(parts.slice(0, i + 1).join('.')); return out; };
  const slotElementsOf = (el) => { const out = []; for (let a = el; a && a !== sheet.parentElement; a = a.parentElement) if (a.dataset && a.dataset.slot !== undefined) out.push(a); return out; };
  // A slot that draws a box (not display:contents, not empty) must hold, on the page too, the centre of what is bound
  // inside it, so a CSS offset cannot move a value into another entry's place. The centre, not the whole box: a
  // font's content area may overhang its line box by a few pixels, which is typography, not placement.
  const SLOT_TOLERANCE = 1;
  const boxOfSlot = (s) => { if (getComputedStyle(s).display === 'contents') return null; const r = s.getBoundingClientRect(); return r.width > 0.5 && r.height > 0.5 ? r : null; };
  const placement = (el, path) => {
    if (el.closest('[data-page-label]')) return PAGE_LEVEL.test(path) ? null : 'an entry value in a page label';
    const slotEls = slotElementsOf(el), slots = slotEls.map((s) => s.dataset.slot);
    for (const s of slots) if (!(path === s || path.startsWith(s + '.'))) return `outside slot ${s}`;
    for (const entry of entriesOf(path)) if (!slots.includes(entry)) return `entry ${entry} has no slot around it`;
    const own = el.getBoundingClientRect();
    if (own.width > 0.5 && own.height > 0.5) for (const s of slotEls) { if (s === el) continue; const r = boxOfSlot(s); if (r === null) continue;
      const cx = (own.left + own.right) / 2, cy = (own.top + own.bottom) / 2;
      const out = Math.max(r.left - cx, cx - r.right, r.top - cy, cy - r.bottom);
      if (out > SLOT_TOLERANCE) return `centre outside the box of slot ${s.dataset.slot} by ${out.toFixed(1)} px`; }
    return null; };

  // (1) Text: the value at its path, in its slots, visible, readable; every required path printed.
  const printed = new Set(); let textCount = 0;
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT); let n;
  while ((n = walker.nextNode())) {
    const s = n.textContent.trim(); if (s.length === 0) continue;
    const el = n.parentElement; if (!el || el.closest('title')) continue;
    textCount += 1;
    if (separators.has(s) && el.classList.contains('sep')) continue;
    const host = el.closest('[data-p]'); const path = host && sheet.contains(host) ? host.dataset.p : null;
    if (path === null) { findings.push({code: 'TEXT_NOT_IN_PROJECTION', reason: 'unbound', text: s.slice(0, 60)}); continue; }
    if (!has(path)) { findings.push({code: 'TEXT_NOT_IN_PROJECTION', reason: 'unknown path', path, text: s.slice(0, 60)}); continue; }
    if (values[path] !== s) { findings.push({code: 'TEXT_NOT_IN_PROJECTION', reason: 'not the value at its path', path, text: s.slice(0, 60)}); continue; }
    if (!requiredSet.has(path)) { findings.push({code: 'TEXT_NOT_IN_PROJECTION', reason: 'not a printed field (an identifier or classification)', path, text: s.slice(0, 60)}); continue; }
    const why = placement(host, path);
    if (why !== null) { findings.push({code: 'TEXT_OUT_OF_SLOT', path, reason: why, text: s.slice(0, 60)}); continue; }
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
    const cs = getComputedStyle(el), fontPx = parseFloat(cs.fontSize);
    const color = parse(cs.color) || {r: 0, g: 0, b: 0, a: 1}, fill = parse(cs.webkitTextFillColor) || color;
    const alpha = fill.a * opacityOf(el), effect = effectsOf(el);
    let invisible = null;
    if (rects.length === 0) invisible = 'no box';
    else if (!shown(el) || cs.visibility !== 'visible') invisible = 'hidden';
    else if (alpha < VISIBLE) invisible = `faint (alpha ${alpha.toFixed(2)})`;
    else if (effect !== null) invisible = `clipped, masked or filtered by ${effect}`;
    else if (Math.max(...rects.map((r) => r.height)) < 0.5 * fontPx) invisible = 'scaled down';
    if (invisible !== null) { findings.push({code: 'TEXT_INVISIBLE', reason: invisible, path, text: s.slice(0, 60)}); continue; }
    // The characters print in the order the value has them: no bidi override or right-to-left run, no mirroring.
    const reordered = cs.direction !== 'ltr' || bidiOf(el);
    if (reordered) { findings.push({code: 'TEXT_REORDERED', path, reason: reordered === true ? 'right-to-left' : reordered, text: s.slice(0, 40)}); continue; }
    if (mirrored(el)) { findings.push({code: 'MIRRORED', kind: 'text', path, text: s.slice(0, 40)}); continue; }
    // The size the reader sees: the computed font size times the scale any transform applies (rendered / layout height).
    const own = el.getBoundingClientRect();
    const scale = Math.min(el.offsetHeight > 0 ? own.height / el.offsetHeight : 1, el.offsetWidth > 0 ? own.width / el.offsetWidth : 1), renderedPx = fontPx * scale;
    if (fontPx < MIN_FONT_PX || renderedPx < MIN_FONT_PX - 0.25) findings.push({code: 'TEXT_TOO_SMALL', path, fontPx, renderedPx: +renderedPx.toFixed(2), text: s.slice(0, 40)});
    // Every character on its own: its box for the ink check, its centre for the occlusion test, so a cover over a few
    // words of a long line can neither average out nor fall between sample points.
    const chars = [], whole = n.textContent, one = document.createRange();
    for (let i = 0; i < whole.length;) { const cp = whole.codePointAt(i), len = cp > 0xffff ? 2 : 1, ch = String.fromCodePoint(cp);
      if (!/\s/u.test(ch)) { one.setStart(n, i); one.setEnd(n, i + len);
        const cr = Array.from(one.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5); if (cr.length > 0) chars.push({...box(cr[0]), ch}); }
      i += len; }
    let occluder = null;
    for (const c of chars) { occluder = occluderAt(el, c.x + c.w / 2, c.y + c.h / 2); if (occluder !== null) break; }
    if (occluder !== null) findings.push({code: 'TEXT_OCCLUDED', path, by: name(occluder), text: s.slice(0, 40)});
    const r0 = rects[0], under = backdrop(el, r0.left + r0.width / 2, r0.top + r0.height / 2);
    const ratio = contrast(mix(fill, under, alpha), under);
    if (ratio < 1.5) findings.push({code: 'TEXT_LOW_CONTRAST', path, ratio: +ratio.toFixed(2), text: s.slice(0, 40)});
    // The colour the pixels carry: the fill composited over its backdrop (text at opacity 0.7 is lighter on the page).
    ink.push({kind: 'text', path, color: rgb(mix(fill, under, alpha)), rects: rects.map(box), chars, text: s.slice(0, 40)});
    printed.add(path);
  }
  for (const p of q.required) if (!printed.has(p)) findings.push({code: 'TEXT_MISSING_FROM_PAGE', path: p, text: String(values[p]).slice(0, 60)});

  // (2) Glyphs: a projection glyph, the value at its path, in its slots, visible, unoccluded, readable; every
  //     character the page must draw is drawn.
  const drawn = new Set(); const glyphEls = Array.from(sheet.querySelectorAll('svg.disp'));
  for (const g of glyphEls) {
    const ch = String.fromCodePoint(parseInt(g.dataset.glyph.slice(2), 16));
    if (!glyphSet.has(ch)) findings.push({code: 'GLYPH_NOT_IN_PROJECTION', glyph: ch});
    const path = g.dataset.p || null;
    if (path === null || !has(path) || values[path] !== ch) { findings.push({code: 'GLYPH_NOT_ITS_VALUE', glyph: ch, path}); continue; }
    // What draws the glyph is its one sprite <use>, and it must be the value's own glyph, not only the attribute.
    const uses = Array.from(g.children);
    if (uses.length !== 1 || uses[0].tagName.toLowerCase() !== 'use' || uses[0].getAttribute('href') !== '#g-' + q.glyphSlugs[ch]) {
      findings.push({code: 'GLYPH_NOT_ITS_VALUE', glyph: ch, path, reason: 'drawn by another glyph or shape'}); continue; }
    const why = placement(g, path);
    if (why !== null) { findings.push({code: 'GLYPH_OUT_OF_SLOT', path, reason: why, glyph: ch}); continue; }
    const r = g.getBoundingClientRect(), gc = parse(getComputedStyle(g).color) || {r: 0, g: 0, b: 0, a: 1}, ga = gc.a * opacityOf(g);
    if (!(r.width > 1 && r.height > 1) || !shown(g) || ga < VISIBLE || effectsOf(g) !== null) { findings.push({code: 'GLYPH_INVISIBLE', path, glyph: ch}); continue; }
    if (mirrored(g)) { findings.push({code: 'MIRRORED', kind: 'glyph', path, glyph: ch}); continue; }
    let occluder = null;
    for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) occluder = occluder || occluderAt(g, r.left + r.width * fx, r.top + r.height * fy);
    if (occluder !== null) findings.push({code: 'GLYPH_OCCLUDED', path, by: name(occluder), glyph: ch});
    const under = backdrop(g, r.left + r.width / 2, r.top + r.height / 2), ratio = contrast(mix(gc, under, ga), under);
    if (ratio < 1.5) findings.push({code: 'GLYPH_LOW_CONTRAST', path, ratio: +ratio.toFixed(2), glyph: ch});
    if (g.dataset.phase !== undefined) { const shows = phasesOfColour(gc);
      if (!(shows.length === 1 && shows[0] === g.dataset.phase)) findings.push({code: 'PHASE_NOT_ITS_COLOUR', path: g.dataset.phaseP, declared: g.dataset.phase, painted: shows.join('|') || 'no phase token', on: 'glyph'}); }
    ink.push({kind: 'glyph', path, color: rgb(mix(gc, under, ga)), rects: [box(r)], text: ch, ...(g.dataset.phase !== undefined ? {phase: g.dataset.phase, token: 1} : {})});
    drawn.add(path);
  }
  for (const p of q.glyphs) if (!drawn.has(p)) findings.push({code: 'GLYPH_MISSING_FROM_PAGE', path: p, glyph: values[p]});

  // (3) Drawn classifications: every presence mark is the value at its path; every phase colour is the phase of the
  //     entry it paints; the entries of a list appear in list order (the Wu Xing ring keeps its template order).
  const marked = new Set();
  for (const el of sheet.querySelectorAll('.mark')) {
    const path = el.dataset.p || null;
    if (path === null || !has(path)) { findings.push({code: 'MARK_NOT_ITS_VALUE', reason: 'unbound', path}); continue; }
    const expected = values[path] === null ? 'none' : values[path];
    const drawnClass = ['stem', 'hidden', 'both', 'none'].filter((c) => el.classList.contains(c));
    if (el.dataset.mark !== expected || drawnClass.length !== 1 || drawnClass[0] !== expected) { findings.push({code: 'MARK_NOT_ITS_VALUE', path, drawn: drawnClass.join('|'), value: expected}); continue; }
    const why = placement(el, path);
    if (why !== null) { findings.push({code: 'MARK_OUT_OF_SLOT', path, reason: why}); continue; }
    const mr = el.getBoundingClientRect(), ms = getComputedStyle(el), mbg = parse(ms.backgroundColor), mborder = parse(ms.borderTopColor);
    const paintColor = mbg !== null && mbg.a >= VISIBLE ? mbg : (parseFloat(ms.borderTopWidth) > 0 && mborder !== null ? mborder : null);
    if (!(mr.width > 0.5 && mr.height > 0.5) || !shown(el) || opacityOf(el) < VISIBLE || effectsOf(el) !== null || paintColor === null || paintColor.a < VISIBLE) {
      findings.push({code: 'MARK_INVISIBLE', path}); continue; }
    // The look of its value, as painted: stem filled, hidden a ring, both filled with a halo, none a bar.
    // No template mark paints a background image, so one is refused whatever it draws (a ring inside a dot, a fill in a ring).
    const filled = mbg !== null && mbg.a >= VISIBLE, ring = parseFloat(ms.borderTopWidth) > 0, imaged = ms.backgroundImage !== 'none';
    const halo = ms.boxShadow !== 'none' || (ms.outlineStyle !== 'none' && parseFloat(ms.outlineWidth) > 0);
    const look = !imaged && (expected === 'stem' ? filled && !ring && !halo : expected === 'hidden' ? !filled && ring && !halo : expected === 'both' ? filled && halo
      : filled && !ring && !halo && mr.height < 2 && mr.width > 2 * mr.height);
    if (!look) { findings.push({code: 'MARK_NOT_ITS_LOOK', path, value: expected}); continue; }
    // A table mark (a path ending in marks.<j>) names its own column <j> and stands under that column's header.
    const tableIndex = /\.marks\.(\d+)$/.exec(path);
    if (tableIndex !== null || el.dataset.col !== undefined) {
      const columnIndex = el.dataset.col === undefined ? null : /\.(\d+)$/.exec(el.dataset.col);
      if (tableIndex === null || columnIndex === null || columnIndex[1] !== tableIndex[1]) {
        findings.push({code: 'MARK_OFF_COLUMN', path, column: el.dataset.col ?? null, reason: 'not bound to its own column'}); continue; }
      const header = Array.from(sheet.querySelectorAll('[data-slot]')).find((h) => h.dataset.slot === el.dataset.col);
      const hr = header ? header.getBoundingClientRect() : null, cx = mr.left + mr.width / 2;
      if (hr === null || cx < hr.left || cx > hr.right) { findings.push({code: 'MARK_OFF_COLUMN', path, column: el.dataset.col}); continue; }
    }
    ink.push({kind: 'mark', path, color: rgb(paintColor), rects: [box(mr)], text: expected});
    marked.add(path);
  }
  for (const p of q.marks) if (!marked.has(p)) findings.push({code: 'MARK_MISSING_FROM_PAGE', path: p});
  for (const el of sheet.querySelectorAll('*')) {
    if (el.classList.contains('blob')) continue;
    const painted = new Set();
    for (const c of el.classList) { const m = /^[fm]-(wood|fire|earth|metal|water)$/.exec(c); if (m) painted.add(m[1]); }
    for (const m of (el.getAttribute('style') || '').matchAll(/--phase-(wood|fire|earth|metal|water)-/g)) painted.add(m[1]);
    const declared = el.dataset.phase, path = el.dataset.phaseP;
    if (painted.size === 0 && declared === undefined) continue;
    if (path === undefined) { findings.push({code: 'PHASE_UNBOUND', on: name(el), painted: Array.from(painted).join('|')}); continue; }
    if (!has(path) || values[path] !== declared) { findings.push({code: 'PHASE_NOT_ITS_VALUE', path, declared, value: has(path) ? values[path] : null}); continue; }
    const wrong = Array.from(painted).filter((p) => p !== declared);
    if (wrong.length > 0) { findings.push({code: 'PHASE_NOT_ITS_VALUE', path, declared, painted: wrong.join('|')}); continue; }
    const why = placement(el, path); if (why !== null) { findings.push({code: 'PHASE_OUT_OF_SLOT', path, reason: why}); continue; }
    // A phase paint (a field, a mark colour) must be visible and leave its colour on the page. Glyph colours are
    // checked with the glyphs; an element that declares a phase but paints none (a ring track, a block) is bound only.
    if (painted.size > 0 && el.tagName.toLowerCase() !== 'svg') {
      const pr = el.getBoundingClientRect(), pbg = parse(getComputedStyle(el).backgroundColor);
      if (!(pr.width > 0.5 && pr.height > 0.5) || !shown(el) || pbg === null || pbg.a * opacityOf(el) < VISIBLE || effectsOf(el) !== null) {
        findings.push({code: 'PHASE_INVISIBLE', path, on: name(el)}); continue; }
      const shows = phasesOfColour(pbg);
      if (!(shows.length === 1 && shows[0] === declared)) { findings.push({code: 'PHASE_NOT_ITS_COLOUR', path, declared, painted: shows.join('|') || 'no phase token', on: name(el)}); continue; }
      if (getComputedStyle(el).backgroundImage !== 'none') { findings.push({code: 'PHASE_NOT_ITS_COLOUR', path, declared, painted: 'a background image', on: name(el)}); continue; }
      const token = sameColour(phaseTokens[declared][0], pbg) ? 0 : 1;
      ink.push({kind: 'phase', path, color: rgb(pbg), rects: [box(pr)], text: declared, phase: declared, token});
    }
    // A phase paint holds only its own entry's values (a page label aside): the Day-Master field paints the Day
    // Master's phase, not another pillar's.
    const entry = path.replace(/\.[^.]+$/, '');
    for (const inner of el.querySelectorAll('[data-p]')) { if (inner.closest('[data-page-label]')) continue; const ip = inner.dataset.p;
      if (!(ip === entry || ip.startsWith(entry + '.'))) { findings.push({code: 'PHASE_NOT_ITS_ENTRY', path, holds: ip}); break; } }
  }
  // List order in the DOM and on the page: an entry never sits wholly above the one before it, nor wholly left of
  // it on the same row.
  const lastIndex = new Map(), lastBox = new Map();
  for (const el of sheet.querySelectorAll('[data-slot]')) {
    if (el.closest('[data-slot-order="template"]')) continue;
    const m = /^(.*)\.(\d+)$/.exec(el.dataset.slot); if (!m) continue;
    const list = m[1], index = Number(m[2]), last = lastIndex.get(list);
    if (last !== undefined && index < last) findings.push({code: 'SLOT_OUT_OF_ORDER', list, index, after: last});
    lastIndex.set(list, index);
    const r = boxOfSlot(el), prev = lastBox.get(list); if (r === null) continue;
    if (prev !== undefined) { const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, px = (prev.left + prev.right) / 2, py = (prev.top + prev.bottom) / 2;
      const sameRow = (cy > prev.top && cy < prev.bottom) || (py > r.top && py < r.bottom);
      if ((!sameRow && cy < prev.top) || (sameRow && cx < prev.left)) findings.push({code: 'SLOT_OUT_OF_ORDER', list, index, reason: 'before the previous entry on the page'}); }
    lastBox.set(list, r);
  }

  // (4) No generated content, no element that can carry text of its own, no broken pair.
  for (const el of [document.documentElement, document.body, sheet, ...sheet.querySelectorAll('*')]) for (const pseudo of ['::before', '::after', '::marker']) {
    const content = getComputedStyle(el, pseudo).content;
    if (content && content !== 'none' && content !== 'normal') findings.push({code: 'PSEUDO_CONTENT', pseudo, content: content.slice(0, 60), on: name(el)}); }
  for (const el of sheet.querySelectorAll('img,picture,input,textarea,select,button,canvas,video,iframe,object,embed,ol,ul,li'))
    findings.push({code: 'FORBIDDEN_ELEMENT', element: el.tagName});
  // SVG on the sheet is an allowlist: a display glyph is one sprite <use>, the wordmark is the pinned shape; anything
  // else (a path, text, an image, a filter, a pattern) could draw words of its own.
  for (const svg of sheet.querySelectorAll('svg')) {
    const kids = Array.from(svg.children), tags = Array.from(svg.querySelectorAll('*')).map((e) => e.tagName.toLowerCase());
    const glyph = svg.classList.contains('disp') && kids.length === 1 && kids[0].tagName.toLowerCase() === 'use' && /^#g-[a-z0-9-]+$/.test(kids[0].getAttribute('href') || '');
    const count = (tag) => tags.filter((t) => t === tag).length;
    const wordmark = svg.dataset.wordmark !== undefined && tags.every((t) => t in q.wordmark) && Object.keys(q.wordmark).every((t) => count(t) === q.wordmark[t]);
    if (!glyph && !wordmark) findings.push({code: 'FORBIDDEN_ELEMENT', element: 'svg', holds: [...new Set(tags)].join('|').slice(0, 60)}); }
  // An image can carry text of its own however it is painted: as a background, a border, mask or marker image, or
  // replaced content - on an element or on any of its pseudo-elements.
  const IMAGE_PROPERTIES = ['backgroundImage', 'borderImageSource', 'maskImage', 'webkitMaskImage', 'webkitMaskBoxImageSource', 'listStyleImage', 'maskBorderSource'];
  for (const el of [document.documentElement, document.body, sheet, ...sheet.querySelectorAll('*')]) {
    for (const pseudo of [null, '::before', '::after', '::first-letter', '::first-line', '::marker']) { const s = getComputedStyle(el, pseudo);
      const painted = IMAGE_PROPERTIES.find((p) => /url\(/.test(s[p] || ''));
      if (painted !== undefined) findings.push({code: 'FORBIDDEN_ELEMENT', element: 'an image painted by CSS', property: painted, pseudo, on: name(el)}); }
    const s = getComputedStyle(el);
    if (s.content && s.content !== 'normal' && s.content !== 'none') findings.push({code: 'FORBIDDEN_ELEMENT', element: 'replaced content', on: name(el)}); }
  // The printed page box is the template's: one @page rule, exactly as base.css states it, and no margin box.
  const pageRules = [];
  const walkRules = (rules) => { for (const rule of rules) { if (rule.type === 6) pageRules.push(rule); if (rule.cssRules) walkRules(rule.cssRules); } };
  for (const sheetOf of document.styleSheets) { try { walkRules(sheetOf.cssRules); } catch (e) { findings.push({code: 'PAGE_RULE_FORBIDDEN', reason: 'unreadable stylesheet'}); } }
  const normalise = (text) => text.replace(/\s+/g, '');
  if (pageRules.length !== 1 || normalise(pageRules[0].cssText) !== normalise(q.pageRule)) findings.push({code: 'PAGE_RULE_FORBIDDEN', rules: pageRules.map((r) => r.cssText.slice(0, 80))});
  for (const el of sheet.querySelectorAll('.nw')) { const range = document.createRange(); range.selectNodeContents(el);
    const tops = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5).map((r) => r.top);
    const fontPx = parseFloat(getComputedStyle(el).fontSize);
    if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 0.5 * fontPx) findings.push({code: 'GROUP_WRAPPED', text: el.textContent.trim().slice(0, 40)}); }

  // The running head and foot keep at least 3 mm between their two parts (a long name must not run into the tag
  // or the page number).
  for (const bar of sheet.querySelectorAll('.head, .foot')) { const parts = Array.from(bar.children); if (parts.length !== 2) continue;
    const gap = parts[1].getBoundingClientRect().left - parts[0].getBoundingClientRect().right;
    if (gap < 3 * 96 / 25.4) findings.push({code: 'CHROME_CROWDED', bar: bar.className, gapPx: +gap.toFixed(2)}); }

  // (5) Geometry: long-form lines at the projection's positions; inside the sheet, not clipped, inside the painted
  //     container, within the measure, no overlap.
  const sheetBox = sheet.getBoundingClientRect();
  for (const el of sheet.querySelectorAll('.longline')) {
    const path = el.dataset.p; if (!path) continue;
    const line = path.replace(/\.text$/, ''), fragment = line.replace(/\.lines\.\d+$/, '');
    const x = values[line + '.xCp'], base = values[line + '.baselineCp'];
    const style = has(line + '.styleId') ? values[line + '.styleId'] : values[fragment + '.styleId'], ascent = q.ascent[style];
    if (typeof x !== 'number' || typeof base !== 'number' || typeof ascent !== 'number') { findings.push({code: 'LINE_UNPLACEABLE', path}); continue; }
    const r = el.getBoundingClientRect();
    const dx = Math.abs(r.left - sheetBox.left - x * CP), dy = Math.abs(r.top - sheetBox.top - (base - ascent) * CP);
    if (dx > 0.75 || dy > 0.75) findings.push({code: 'LINE_MISPLACED', path, dxPx: +dx.toFixed(2), dyPx: +dy.toFixed(2)});
  }
  const els = []; const walk = (node) => { for (const c of node.children) walk(c);
    const own = Array.from(node.childNodes).some(x => x.nodeType === 3 && x.textContent.trim().length);
    if (own || (node.tagName === 'svg' && node.classList.contains('disp'))) els.push(node); };
  walk(sheet);
  const boxes = els.map(e => ({e, r: e.getBoundingClientRect()})).filter(b => b.r.width > 0 && b.r.height > 0 && !b.e.closest('title'));
  for (const b of boxes) {
    if (b.r.left < -0.5 || b.r.top < -0.5 || b.r.right > W + 0.5 || b.r.bottom > H + 0.5) findings.push({code: 'OUTSIDE_SHEET', text: b.e.textContent.trim().slice(0, 40)});
    if (b.e.scrollWidth > b.e.clientWidth + 1 && getComputedStyle(b.e).overflow !== 'visible') findings.push({code: 'CLIPPED', text: b.e.textContent.trim().slice(0, 40)});
    for (let a = b.e.parentElement; a && a !== sheet; a = a.parentElement) { const s = getComputedStyle(a); const c = parse(s.backgroundColor);
      if ((c === null || c.a === 0) && s.backgroundImage === 'none') continue; const q2 = a.getBoundingClientRect();
      if (b.r.left < q2.left - 0.5 || b.r.top < q2.top - 0.5 || b.r.right > q2.right + 0.5 || b.r.bottom > q2.bottom + 0.5)
        findings.push({code: 'OVERFLOWS_CONTAINER', text: b.e.textContent.trim().slice(0, 40), container: name(a)});
      break; }
    for (let a = b.e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue; const q2 = a.getBoundingClientRect();
      if (b.r.left < q2.left - 0.5 || b.r.top < q2.top - 0.5 || b.r.right > q2.right + 0.5 || b.r.bottom > q2.bottom + 0.5) {
        findings.push({code: 'CLIPPED_BY_ANCESTOR', text: b.e.textContent.trim().slice(0, 40)}); break; } }
    if (b.e.classList.contains('longline')) { const measure = parseInt(b.e.dataset.measureCp, 10) * CP;
      if (b.r.width > measure + 0.5) findings.push({code: 'LINE_EXCEEDS_MEASURE', text: b.e.textContent.slice(0, 40), widthPx: +b.r.width.toFixed(2), measurePx: +measure.toFixed(2)}); }
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 1.5 && y > 1.5) findings.push({code: 'OVERLAP', a: a.e.textContent.trim().slice(0, 30), b: b.e.textContent.trim().slice(0, 30)});
  }
  return {findings, textCount, glyphCount: glyphEls.length, ink, tokens: phaseTokens};
}
"""

WX_QA = """
() => {
  const MM = 96 / 25.4, MARGIN = 2 * MM, findings = [];
  const m = document.querySelector('#wx-medallion'); if (!m) return [{code: 'WX_MEDALLION_MISSING'}];
  const mr = m.getBoundingClientRect(), cx = mr.left + mr.width / 2, cy = mr.top + mr.height / 2, r = mr.width / 2;
  const clear = (q) => Math.hypot(Math.max(q.left, Math.min(cx, q.right)) - cx, Math.max(q.top, Math.min(cy, q.bottom)) - cy) - r;
  const blocks = Array.from(document.querySelectorAll('[data-wx="phase-block"]'));
  if (blocks.length !== 5) findings.push({code: 'WX_PHASE_BLOCK_COUNT', n: blocks.length});
  for (const b of blocks) { const c = clear(b.getBoundingClientRect()); if (c < MARGIN) findings.push({code: 'WX_PHASE_BLOCK_INTRUDES', phase: b.dataset.phase, mm: +(c / MM).toFixed(2)}); }
  for (const d of document.querySelectorAll('[data-wx="disc"], [data-wx="track"]')) { const q = d.getBoundingClientRect();
    const c = Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy) - q.width / 2 - r;
    if (c < MARGIN) findings.push({code: 'WX_DISC_INTRUDES', phase: d.dataset.phase, mm: +(c / MM).toFixed(2)}); }
  const label = m.querySelector('#wx-centre-label'); if (label) { const q = label.getBoundingClientRect();
    const far = Math.max(...[[q.left, q.top], [q.right, q.top], [q.left, q.bottom], [q.right, q.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    if (far > r - MARGIN / 2) findings.push({code: 'WX_LABEL_OUTSIDE_CIRCLE', mm: +((r - far) / MM).toFixed(2)}); }
  return findings;
}
"""

FONT_STATUS = """async () => { await document.fonts.ready; return Array.from(document.fonts).map(f => ({family: f.family.replace(/"/g, ''), weight: f.weight, status: f.status})); }"""


# ------------------------------------------------------------------ environment

def asset_digests() -> dict:
    index = json.loads((ASSETS / "ASSET-INTEGRITY.json").read_text())
    return {entry["path"]: entry["sha256"].removeprefix("sha256:") for entry in index["files"]}


def check_environment() -> dict:
    digests = asset_digests()
    fonts = []
    for name in INTER_FILES:
        path = ASSETS / "fonts" / name
        actual = sha256_file(path)
        if digests.get(f"fonts/{name}") != actual:
            raise Blocked("FONT_PIN", {"file": name, "expected": digests.get(f"fonts/{name}"), "actual": actual})
        fonts.append({"role": "text", "family": "Inter Display" if name.startswith("InterDisplay") else "Inter", "file": f"assets/visual-system-v1/fonts/{name}",
                      "sha256": f"sha256:{actual}", "licence": "SIL Open Font License 1.1", "licenceFile": "assets/visual-system-v1/fonts/OFL.txt"})
    assets = []
    for name in TEMPLATE_ASSETS:
        actual = sha256_file(ASSETS / name)
        if digests.get(name) != actual:
            raise Blocked("TEMPLATE_ASSET_PIN", {"file": name, "expected": digests.get(name), "actual": actual})
        assets.append({"path": f"assets/visual-system-v1/{name}", "sha256": f"sha256:{actual}"})
    cjk_path = next((d / CJK_FACE["file"] for d in CJK_DIRS if (d / CJK_FACE["file"]).is_file()), None)
    if cjk_path is None:
        raise Blocked("CJK_FACE_MISSING", {"file": CJK_FACE["file"], "searched": [str(d) for d in CJK_DIRS]})
    cjk_sha = sha256_file(cjk_path)
    if cjk_sha != CJK_FACE["sha256"]:
        raise Blocked("CJK_FACE_PIN", {"file": str(cjk_path), "expected": CJK_FACE["sha256"], "actual": cjk_sha})
    rivals = rival_cjk_faces(cjk_path)
    if rivals:
        raise Blocked("CJK_FACE_AMBIGUOUS", {"pinned": str(cjk_path), "alsoProvidingTheFamily": rivals})
    fonts.append({"role": "informational-cjk", "family": CJK_FACE["family"], "file": CJK_FACE["file"], "sha256": f"sha256:{cjk_sha}",
                  "upstream": CJK_FACE["upstream"], "licence": CJK_FACE["licence"], "licenceFile": CJK_FACE["licenceFile"], "installedAt": "host font directory"})
    return {"fonts": fonts, "assets": assets, "cjkPath": cjk_path}


def rival_cjk_faces(pinned: pathlib.Path) -> list:
    """Every other font file in the font directories that provides the pinned family or PostScript name.

    The platform-font scan proves a face by PostScript name; a second file carrying the same name (another
    version, a subset, a renamed face) would pass it, so its mere presence blocks. A byte-identical copy of the
    pinned file is the same face and does not. An unreadable font file blocks too - it cannot be ruled out.
    """
    rivals = []
    for directory in CJK_DIRS:
        if not directory.is_dir():
            continue
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in FONT_SUFFIXES or path.resolve() == pinned.resolve():
                continue
            try:
                faces = TTCollection(str(path), lazy=True).fonts if path.suffix.lower() in (".ttc", ".otc") else [TTFont(str(path), lazy=True)]
                names = {(f["name"].getDebugName(1), f["name"].getDebugName(16), f["name"].getDebugName(6)) for f in faces}
            except Exception as error:  # noqa: BLE001 - any unreadable font is a face we cannot rule out
                rivals.append({"file": str(path), "unreadable": f"{type(error).__name__}: {error}"})
                continue
            if any(CJK_FACE["family"] in (family, typographic) or (ps or "").startswith("NotoSansCJKsc") for family, typographic, ps in names):
                if sha256_file(path) != CJK_FACE["sha256"]:
                    rivals.append({"file": str(path), "names": sorted({n for triple in names for n in triple if n})})
    return rivals


def check_glyphs_and_cjk(projection: dict, cjk_path: pathlib.Path, glyph_manifest: dict) -> dict:
    contract = {g["character"] for g in glyph_manifest["glyphs"]}
    outside = [g for g in projection["displayGlyphs"] if g not in contract]
    if outside:
        raise Blocked("GLYPH_OUT_OF_CONTRACT", outside)
    collection = TTCollection(str(cjk_path))
    face = next((f for f in collection.fonts if f["name"].getDebugName(1) == CJK_FACE["family"]), None)
    if face is None:
        raise Blocked("CJK_FACE_MISSING", "no Noto Sans CJK SC face in the collection")
    cmap = face.getBestCmap()
    upem = face["head"].unitsPerEm
    hmtx = face["hmtx"]
    uncovered = [c for c in projection["cjkText"] if ord(c) not in cmap]
    if uncovered:
        raise Blocked("CJK_GLYPH_UNCOVERED", uncovered)
    wide = [c for c in projection["cjkText"] if hmtx[cmap[ord(c)]][0] != upem]
    if wide:
        raise Blocked("CJK_ADVANCE_NOT_ONE_EM", wide)
    return {"displayGlyphs": len(projection["displayGlyphs"]), "cjkCharacters": len(projection["cjkText"]), "unitsPerEm": upem}


# ------------------------------------------------------------------ render

def build_page(ctx: P.Context, entry: dict) -> str:
    """A page the builders cannot build (unknown kind, a missing field, a glyph outside the contract) blocks the render."""
    try:
        return P.page_html(ctx, entry)
    except (ValueError, KeyError, TypeError) as error:
        raise Blocked("PAGE_BUILD", {"page": entry.get("pageId"), "error": f"{type(error).__name__}: {error}"}) from error


# The ink check: every printed string, glyph, presence mark and phase paint must leave pixels close to its own
# colour inside its own box in the page screenshot, within a band. Too few is a hidden item or one covered in another
# colour (an SVG, a border, a shadow, a blend); too many is a cover in its own colour.
# kind: (colour tolerance, floor, ceiling, finding below the floor, finding above the ceiling)
INK_RULES = {"text": (40, INK_TEXT_MIN, INK_TEXT_MAX, "TEXT_NOT_INKED", "TEXT_OVER_INKED"),
             "glyph": (40, INK_GLYPH_MIN, INK_GLYPH_MAX, "GLYPH_NOT_INKED", "GLYPH_OVER_INKED"),
             "mark": (24, INK_MARK_MIN, INK_MARK_MAX, "MARK_NOT_INKED", "MARK_OVER_INKED"),
             "phase": (4, INK_PHASE_MIN, None, "PHASE_NOT_INKED", None)}


def crop_of(image, scale: float, rect: dict):
    """The screenshot pixels inside a CSS-pixel rect, or None when the rect holds no pixel."""
    left, top = max(0, int(rect["x"] * scale)), max(0, int(rect["y"] * scale))
    right = min(image.width, int(math.ceil((rect["x"] + rect["w"]) * scale)))
    bottom = min(image.height, int(math.ceil((rect["y"] + rect["h"]) * scale)))
    return None if right <= left or bottom <= top else image.crop((left, top, right, bottom))


def ink_share(image, scale: float, rect: dict, colour: tuple, threshold: int) -> float:
    """The share of the rect's pixels within `threshold` (grey-scaled difference) of `colour`."""
    crop = crop_of(image, scale, rect)
    if crop is None:
        return 0.0
    difference = ImageChops.difference(crop, Image.new("RGB", crop.size, colour)).convert("L")
    return sum(difference.histogram()[:threshold]) / (crop.width * crop.height)


def phase_pixels(image, scale: float, rects: list, tokens: dict) -> dict:
    """How many pixels of each phase's token (exact, within one level per channel) lie in the rects."""
    counts = {phase: 0 for phase in tokens}
    for rect in rects:
        crop = crop_of(image, scale, rect)
        if crop is None:
            continue
        for count, pixel in crop.getcolors(crop.width * crop.height):
            for phase, token in tokens.items():
                if all(abs(pixel[i] - token[i]) <= 1 for i in range(3)):
                    counts[phase] += count
    return counts


def ink_check(png: pathlib.Path, items: list, stats: list, tokens: dict | None = None) -> list:
    image = Image.open(png).convert("RGB")
    scale = image.width / A4_PX[0]
    findings = []
    for item in items:
        # A phase paint or phase-coloured glyph: of the five phases' tokens (the kind it paints: field 0, mark 1), its
        # own must be the one the page image shows most - whatever CSS channel painted it (a <use>, a gradient).
        if "phase" in item and tokens:
            kind = item["token"]
            counts = phase_pixels(image, scale, item["rects"], {p: tuple(int(v[kind][k]) for k in ("r", "g", "b")) for p, v in tokens.items() if len(v) == 2})
            own = counts.get(item["phase"], 0)
            if own == 0 or any(n >= own for p, n in counts.items() if p != item["phase"]):
                findings.append({"code": "PHASE_INK_NOT_ITS_COLOUR", "path": item["path"], "declared": item["phase"], "pixels": counts, "text": item["text"]})
        threshold, minimum, maximum, too_little, too_much = INK_RULES[item["kind"]]
        colour = tuple(int(round(item["color"][k])) for k in ("r", "g", "b"))
        # Every box on its own (each line of a wrapped text): hiding part of a paragraph must not average out.
        shares = [ink_share(image, scale, rect, colour, threshold) for rect in item["rects"]]
        lowest, highest = (min(shares), max(shares)) if shares else (0.0, 0.0)
        # And every printed character on its own, so a cover over a few words of one line cannot average out either.
        characters = [ink_share(image, scale, rect, colour, threshold) for rect in item.get("chars", [])]
        if characters:
            low_char, high_char = min(characters), max(characters)
            if low_char < INK_CHARACTER_MIN:
                at = characters.index(low_char)
                findings.append({"code": "CHARACTER_NOT_INKED", "path": item["path"], "share": round(low_char, 4), "character": item["chars"][at]["ch"],
                                 "at": at, "text": item["text"]})
            if high_char > INK_CHARACTER_MAX:
                at = characters.index(high_char)
                findings.append({"code": "CHARACTER_OVER_INKED", "path": item["path"], "share": round(high_char, 4), "character": item["chars"][at]["ch"],
                                 "at": at, "text": item["text"]})
        stats.append({"kind": item["kind"], "path": item["path"], "share": round(lowest, 4), "highest": round(highest, 4), "boxes": len(shares),
                      **({"charLow": round(min(characters), 4), "charHigh": round(max(characters), 4), "chars": len(characters),
                          "charLowAt": item["chars"][characters.index(min(characters))]["ch"],
                          "charHighAt": item["chars"][characters.index(max(characters))]["ch"]} if characters else {})})
        if lowest < minimum:
            findings.append({"code": too_little, "path": item["path"], "share": round(lowest, 4),
                             "box": shares.index(lowest), "boxes": len(shares), "text": item["text"]})
        if maximum is not None and highest > maximum:
            findings.append({"code": too_much, "path": item["path"], "share": round(highest, 4),
                             "box": shares.index(highest), "boxes": len(shares), "text": item["text"]})
    return findings


def page_bindings(projection: dict) -> list:
    """What each page must show, by path - and the proof that it is exactly the page's `strings`."""
    bindings = []
    for entry in projection["pages"]:
        binding = P.page_binding(entry)
        derived = sorted({binding["values"][path] for path in binding["required"]})
        if derived != sorted(set(entry["strings"])):
            raise Blocked("PAGE_STRINGS", {"page": entry["pageId"], "onlyDerived": sorted(set(derived) - set(entry["strings"]))[:10],
                                           "onlyInProjection": sorted(set(entry["strings"]) - set(derived))[:10]})
        bindings.append(binding)
    return bindings


def render_run(projection: dict, bindings: list, ctx: P.Context, work: pathlib.Path) -> dict:
    pages_dir = work / "pages"
    pages_dir.mkdir(parents=True)
    entries = []
    ascent = {style_id: style["ascentCp"] for style_id, style in projection["longFormStyles"].items()}
    ink_stats: list = []
    # What the QA allows to draw on the sheet: each display glyph through one sprite <use>, and the pinned wordmark.
    glyph_slugs = {character: g["slug"] for character, g in ctx.glyphs.items()}
    wordmark_shape = {tag: len(re.findall(rf"<{tag}[\s>/]", ctx.wordmark_svg)) for tag in ("title", "path", "circle")}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=CHROMIUM_ARGS)
        chromium_version = browser.version
        # The tokens redefine every colour under prefers-color-scheme: dark; the document is always the light one.
        context = browser.new_context(device_scale_factor=2, color_scheme="light")
        page = context.new_page()
        page.set_viewport_size({"width": A4_PX[0], "height": A4_PX[1]})
        for entry, binding in zip(projection["pages"], bindings):
            html_path = pages_dir / f"{entry['pageLabel']}-{entry['pageId']}.html"
            html_path.write_text(build_page(ctx, entry), encoding="utf-8")
            page.goto(html_path.as_uri())
            page.wait_for_load_state("networkidle")
            fonts = page.evaluate(FONT_STATUS)
            page.evaluate("Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => null)))")
            page.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
            page.wait_for_timeout(250)
            png = pages_dir / f"{entry['pageLabel']}-{entry['pageId']}.png"
            pdf = pages_dir / f"{entry['pageLabel']}-{entry['pageId']}.pdf"
            # The QA must see the rendering the PDF prints: print media for the screenshot and for the DOM checks, set
            # before each (page.pdf() resets the emulation), so a print-only rule cannot change the PDF behind the QA.
            page.emulate_media(media="print", color_scheme="light")
            page.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": A4_PX[0], "height": A4_PX[1]})
            page.pdf(path=str(pdf), width="210mm", height="297mm", print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                     prefer_css_page_size=True)
            page.emulate_media(media="print", color_scheme="light")
            # After the screenshot and the PDF: every element becomes hit-testable for the QA, so an overlay with
            # pointer-events:none (the atmosphere blobs use it, inline !important included) still counts when it covers text.
            page.evaluate("for (const e of document.querySelectorAll('.sheet, .sheet *')) e.style.setProperty('pointer-events', 'auto', 'important')")
            dom = page.evaluate(DOM_QA, {"values": binding["values"], "required": binding["required"], "glyphs": binding["glyphs"],
                                         "marks": binding["marks"], "displayGlyphs": projection["displayGlyphs"], "glyphSlugs": glyph_slugs,
                                         "wordmark": wordmark_shape, "pageRule": PAGE_RULE,
                                         "separators": sorted(SEPARATORS), "ascent": ascent})
            used_fonts, latin_faces = platform_fonts(context, page)
            wx = page.evaluate(WX_QA) if entry["content"]["kind"] == "wuXing" else []
            # "unloaded" is a declared face the page never asked for; "error" is a face that failed and fell back.
            failed = [f for f in fonts if f["status"] == "error"]
            findings = dom["findings"] + wx + ([{"code": "FONT_LOAD_FAILED", "fonts": failed}] if failed else [])
            findings += ink_check(png, dom["ink"], ink_stats, dom["tokens"])
            foreign = sorted(f"{family}|{ps}" for family, ps in used_fonts if ps not in ALLOWED_POSTSCRIPT_NAMES)
            if foreign:
                findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign})
            # Latin text (an element whose own text carries no CJK character) is set in Inter, never in the CJK face.
            latin_foreign = sorted(f"{family}|{ps}" for family, ps in latin_faces if ps not in INTER_POSTSCRIPT_NAMES)
            if latin_foreign:
                findings.append({"code": "LATIN_SET_IN_CJK_FACE", "families": latin_foreign})
            entries.append({"pageId": entry["pageId"], "pageLabel": entry["pageLabel"], "png": png, "pdf": pdf, "pngSha256": sha256_file(png),
                            "textNodes": dom["textCount"], "glyphs": dom["glyphCount"], "platformFonts": sorted(f"{a}|{b}" for a, b in used_fonts), "findings": findings})
        browser.close()
    merged = work / "bazodiac-reading.pdf"
    sources = [pikepdf.open(e["pdf"]) for e in entries]
    out = pikepdf.Pdf.new()
    for source in sources:
        out.pages.extend(source.pages)
    out.docinfo["/Title"] = projection_title(projection)
    out.save(merged, deterministic_id=True, fix_metadata_version=True)
    for source in sources:
        source.close()
    return {"entries": entries, "pdf": merged, "pdfSha256": sha256_file(merged), "chromium": chromium_version, "inkStats": ink_stats}


def ink_band(stats: list) -> dict:
    """The lowest and highest share each kind left on the page, beside its floor and ceiling (recorded in the QA report)."""
    band = {}
    for kind, (_, floor, ceiling, _, _) in INK_RULES.items():
        shares = [s for s in stats if s["kind"] == kind]
        band[kind] = {"items": len(shares), "lowest": min((s["share"] for s in shares), default=None),
                      "highest": max((s["highest"] for s in shares), default=None), "floor": floor, "ceiling": ceiling}
    characters = [s for s in stats if "charLow" in s]
    band["character"] = {"items": sum(s["chars"] for s in characters), "lowest": min((s["charLow"] for s in characters), default=None),
                         "highest": max((s["charHigh"] for s in characters), default=None), "floor": INK_CHARACTER_MIN, "ceiling": INK_CHARACTER_MAX}
    return band


def projection_title(projection: dict) -> str:
    cover = next(p for p in projection["pages"] if p["content"]["kind"] == "cover")
    return cover["content"]["title"]


def pdf_qa(pdf_path: pathlib.Path, projection: dict) -> list:
    findings = []
    data = pdf_path.read_bytes()
    if not data.startswith(b"%PDF-"):
        findings.append({"code": "PDF_MAGIC", "head": data[:8].decode("latin-1")})
    with pikepdf.open(pdf_path) as pdf:
        if len(pdf.pages) != projection["pageCount"]:
            findings.append({"code": "PDF_PAGE_COUNT", "pdf": len(pdf.pages), "projection": projection["pageCount"]})
        fonts = set()
        for index, page in enumerate(pdf.pages):
            box = [float(v) for v in page.mediabox]
            if abs(box[2] - box[0] - A4_PT[0]) > 0.6 or abs(box[3] - box[1] - A4_PT[1]) > 0.6:
                findings.append({"code": "PDF_MEDIA_BOX", "page": index + 1, "box": box})
            collect_fonts(page.obj, fonts, findings, index + 1, set())
        for name in sorted(fonts):
            base = name.split("+", 1)[-1]
            # Inter embeds as a named TrueType subset; the CFF CJK face as Type3, proven by the platform-font scan.
            if name != "Type3" and base not in INTER_POSTSCRIPT_NAMES:
                findings.append({"code": "PDF_FONT_NOT_PINNED", "font": name})
    return findings, sorted(fonts)


def collect_fonts(obj, fonts: set, findings: list, page: int, seen: set) -> None:
    resources = obj.get("/Resources")
    if resources is None:
        return
    font_dict = resources.get("/Font")
    if font_dict is not None:
        for _, font in font_dict.items():
            base = str(font.get("/BaseFont", ""))
            subtype = str(font.get("/Subtype", ""))
            if subtype == "/Type3":
                # Chromium sets the CFF-based Noto CJK face as Type3 glyph procedures. Which face drew them is proven by
                # the platform-font scan of the page; here the text must stay extractable.
                if "/ToUnicode" not in font:
                    findings.append({"code": "PDF_TYPE3_WITHOUT_TOUNICODE", "page": page})
                fonts.add("Type3")
                continue
            descriptor = None
            if subtype == "/Type0":
                descendant = font.get("/DescendantFonts")[0]
                descriptor = descendant.get("/FontDescriptor")
            else:
                descriptor = font.get("/FontDescriptor")
            if descriptor is None or not any(k in descriptor for k in ("/FontFile", "/FontFile2", "/FontFile3")):
                findings.append({"code": "PDF_FONT_NOT_EMBEDDED", "page": page, "font": base})
            fonts.add(base.lstrip("/"))
    xobjects = resources.get("/XObject")
    if xobjects is not None:
        for _, xobject in xobjects.items():
            key = xobject.objgen
            if key in seen:
                continue
            seen.add(key)
            collect_fonts(xobject, fonts, findings, page, seen)


MARK_LATIN = r"""
() => {
  const cjk = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]|[\u{20000}-\u{3FFFF}]/u; let marked = 0;
  for (const el of document.querySelectorAll('.sheet *')) {
    if (el.closest('svg')) continue;
    const own = Array.from(el.childNodes).filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim();
    if (own.length > 0 && !cjk.test(own)) { el.setAttribute('data-qa-latin', ''); marked += 1; }
  }
  return marked;
}
"""


def platform_fonts(context, page) -> tuple:
    """The platform fonts Chromium used to set the page's text (DevTools CSS domain), as (family, postScriptName):
    for the whole sheet, and for the elements whose own text is Latin only. Runs after the screenshot and the PDF,
    because it marks those elements."""
    page.evaluate(MARK_LATIN)
    cdp = context.new_cdp_session(page)
    try:
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root = cdp.send("DOM.getDocument", {"depth": 0})["root"]["nodeId"]

        def fonts_of(selector: str) -> set:
            found = set()
            for node_id in cdp.send("DOM.querySelectorAll", {"nodeId": root, "selector": selector})["nodeIds"]:
                for font in cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node_id})["fonts"]:
                    found.add((font["familyName"], font.get("postScriptName", "")))
            return found

        return fonts_of(".sheet, .sheet *"), fonts_of(".sheet [data-qa-latin]")
    finally:
        cdp.detach()


def contact_sheet(entries: list, target: pathlib.Path) -> None:
    cols, w, h, pad, label_h = 6, 300, 424, 24, 26
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * pad, rows * (h + label_h) + (rows + 1) * pad), "#EBE7DD")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(ASSETS / "fonts" / "Inter-Medium.ttf"), 14)
    for i, e in enumerate(entries):
        im = Image.open(e["png"]).convert("RGB").resize((w, h), Image.LANCZOS)
        x = pad + (i % cols) * (w + pad)
        y = pad + (i // cols) * (h + label_h + pad)
        sheet.paste(im, (x, y))
        draw.rectangle([x - 1, y - 1, x + w, y + h], outline="#DCD7CB")
        draw.text((x, y + h + 6), f"{e['pageLabel']}  {e['pageId']}", fill="#4A4F52", font=font)
    sheet.save(target, optimize=True)


def renderer_source_digest() -> str:
    h = hashlib.sha256()
    for path in sorted(HERE.glob("*")):
        if path.suffix in (".py", ".css") and path.is_file():
            h.update(path.name.encode() + b"\0" + path.read_bytes() + b"\0")
    return "sha256:" + h.hexdigest()


# ------------------------------------------------------------------ main

def partial_dir(out_dir: pathlib.Path) -> pathlib.Path:
    return out_dir.parent / f".{out_dir.name}.partial"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--projection", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--runs", type=int, default=3, help="renders; the last two must be byte-identical (the first warms the font caches)")
    parser.add_argument("--executed-at", required=True)
    parser.add_argument("--repository-head", required=True)
    args = parser.parse_args()
    if args.runs < 2:
        print("--runs must be at least 2: determinism is a comparison", file=sys.stderr)
        return 2

    out_dir = pathlib.Path(args.out).resolve()
    if out_dir.exists() or partial_dir(out_dir).exists():
        print(f"refusing to write into an existing directory: {out_dir} (or its {partial_dir(out_dir).name})", file=sys.stderr)
        return 2
    projection_path = pathlib.Path(args.projection).resolve()
    projection_bytes = projection_path.read_bytes()
    projection = json.loads(projection_bytes)
    checks = []
    staging = pathlib.Path(tempfile.mkdtemp(prefix="bazodiac-pdf-"))
    try:
        return render(args, out_dir, projection, projection_bytes, checks, staging)
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def render(args, out_dir: pathlib.Path, projection: dict, projection_bytes: bytes, checks: list, staging: pathlib.Path) -> int:
    status = "BLOCKED"
    manifest = None
    runs = []
    try:
        if projection.get("projectionVersion") != PROJECTION_VERSION:
            raise Blocked("PROJECTION_VERSION", projection.get("projectionVersion"))
        checks.append({"id": "PROJECTION_VERSION", "result": "PASS", "detail": PROJECTION_VERSION})
        checks.append({"id": "PROJECTION_IDENTITY", "result": "PASS", "detail": check_projection_identity(projection)})
        env = check_environment()
        checks.append({"id": "FONT_PINS", "result": "PASS", "detail": [f["file"] for f in env["fonts"]]})
        checks.append({"id": "TEMPLATE_ASSET_PINS", "result": "PASS", "detail": [a["path"] for a in env["assets"]]})
        glyph_manifest = json.loads((ASSETS / "glyphs" / "manifest.json").read_text())
        checks.append({"id": "GLYPHS_AND_CJK", "result": "PASS", "detail": check_glyphs_and_cjk(projection, env["cjkPath"], glyph_manifest)})
        bindings = page_bindings(projection)
        checks.append({"id": "PAGE_STRINGS", "result": "PASS", "detail": {"pages": len(bindings), "printedPaths": sum(len(b["required"]) for b in bindings),
                                                                         "glyphPaths": sum(len(b["glyphs"]) for b in bindings)}})

        base_css = (HERE / "base.css").read_text().replace("{{FONTS}}", (ASSETS / "fonts").as_uri())
        ctx = P.Context((ASSETS / "tokens.css").read_text(), base_css, (ASSETS / "glyphs" / "sprite.svg").read_text(),
                        (ASSETS / "brand" / "wordmark.svg").read_text(), glyph_manifest, projection["longFormStyles"],
                        projection["template"]["geometry"]["contentW"])
        for run in range(args.runs):
            runs.append(render_run(projection, bindings, ctx, staging / f"run-{run + 1}"))
        last, previous = runs[-1], runs[-2]
        page_findings = [{"page": e["pageLabel"], "pageId": e["pageId"], **f} for e in last["entries"] for f in e["findings"]]
        if page_findings:
            raise Blocked("PAGE_QA", page_findings)
        checks.append({"id": "PAGE_QA", "result": "PASS", "detail": {"pages": len(last["entries"]), "textNodes": sum(e["textNodes"] for e in last["entries"]),
                                                                     "displayGlyphs": sum(e["glyphs"] for e in last["entries"])}})
        findings, fonts = pdf_qa(last["pdf"], projection)
        if findings:
            raise Blocked("PDF_READBACK", findings)
        checks.append({"id": "PDF_READBACK", "result": "PASS", "detail": {"pages": projection["pageCount"], "embeddedFonts": fonts, "mime": "application/pdf"}})
        png_diff = [e["pageId"] for e, f in zip(last["entries"], previous["entries"]) if e["pngSha256"] != f["pngSha256"]]
        if last["pdfSha256"] != previous["pdfSha256"] or png_diff:
            raise Blocked("DETERMINISM", {"pdf": [previous["pdfSha256"], last["pdfSha256"]], "pngDiffers": png_diff})
        checks.append({"id": "DETERMINISM", "result": "PASS", "detail": {"comparedRuns": [len(runs) - 1, len(runs)], "pdfSha256": f"sha256:{last['pdfSha256']}", "pages": len(last["entries"])}})

        status = "PASSED"
        pdf_bytes = last["pdf"].read_bytes()
        contact = staging / "contact-sheet.png"
        contact_sheet(last["entries"], contact)
        manifest = {
            "manifestVersion": MANIFEST_VERSION,
            "artifactId": f"bazodiac-reading-{last['pdfSha256'][:16]}",
            "state": "ARTIFACT_READY",
            "mimeType": "application/pdf",
            "sha256": f"sha256:{last['pdfSha256']}",
            "byteLength": len(pdf_bytes),
            "pageCount": projection["pageCount"],
            "input": {**projection["sources"]},
            "presentation": {"projectionVersion": projection["projectionVersion"], "structuralHash": projection["structuralHash"],
                             "fileSha256": f"sha256:{sha256_bytes(projection_bytes)}"},
            "template": {"ref": projection["template"]["ref"], "structuralHash": projection["template"]["structuralHash"],
                         "designSystem": projection["template"]["designSystem"], "decisionSource": projection["template"]["decisionSource"],
                         "glyphManifestSha256": projection["template"]["glyphManifestSha256"], "wordmarkSha256": projection["template"]["wordmarkSha256"],
                         "assets": env["assets"]},
            "renderer": {"ref": RENDERER_REF, "sourceSha256": renderer_source_digest(),
                         "engine": {"browser": "chromium", "version": last["chromium"], "flags": CHROMIUM_ARGS, "playwright": pkg_version("playwright"),
                                    "python": platform.python_version(), "pikepdf": pkg_version("pikepdf"), "fonttools": pkg_version("fonttools"),
                                    "pillow": pkg_version("pillow")}},
            "fonts": env["fonts"],
            "qa": {"status": "PASSED", "state": "QA_PASSED", "checks": checks},
            "contactSheetSha256": f"sha256:{sha256_file(contact)}",
            "generation": {"declared": True, "executedAt": args.executed_at, "host": f"{platform.system()} {platform.machine()}",
                           "repositoryHead": args.repository_head},
        }
    except Blocked as blocked:
        checks.append({"id": blocked.check, "result": "BLOCKED", "detail": blocked.detail})
    except Exception as error:  # noqa: BLE001 - an unexpected failure is a blocked render with a report, never a trace only
        # Even after every check passed (a failure while assembling the manifest): the run is BLOCKED, nothing is written.
        status, manifest = "BLOCKED", None
        checks.append({"id": "RENDERER_ERROR", "result": "BLOCKED", "detail": f"{type(error).__name__}: {error}"})

    report = {"reportVersion": QA_REPORT_VERSION, "status": status, "state": "QA_PASSED" if status == "PASSED" else "BLOCKED",
              "projectionStructuralHash": projection.get("structuralHash"), "checks": checks,
              "ink": ink_band(runs[-1]["inkStats"]) if runs else None,
              "pages": [{"pageLabel": e["pageLabel"], "pageId": e["pageId"], "pngSha256": f"sha256:{e['pngSha256']}", "textNodes": e["textNodes"],
                         "displayGlyphs": e["glyphs"], "platformFonts": e["platformFonts"], "findings": e["findings"]} for e in (runs[-1]["entries"] if runs else [])]}
    # Everything is written into a hidden sibling first and renamed into place last (one rename on one file
    # system), so a crash half-way leaves no --out directory that looks like a result.
    partial = partial_dir(out_dir)
    partial.mkdir(parents=True)
    (partial / "qa-report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    if status == "PASSED" and manifest is not None:
        shutil.copy2(runs[-1]["pdf"], partial / "bazodiac-reading.pdf")
        shutil.copy2(staging / "contact-sheet.png", partial / "contact-sheet.png")
        pages_out = partial / "pages"
        pages_out.mkdir()
        for e in runs[-1]["entries"]:
            shutil.copy2(e["png"], pages_out / e["png"].name)
        (partial / "artifact-manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    elif runs:
        # Diagnostics only: the page images of the blocked run, never a PDF.
        diagnostics = partial / "diagnostics"
        diagnostics.mkdir()
        for e in runs[-1]["entries"]:
            shutil.copy2(e["png"], diagnostics / e["png"].name)
    partial.rename(out_dir)
    print(json.dumps({"status": status, "out": str(out_dir), "checks": [(c["id"], c["result"]) for c in checks]}, ensure_ascii=False))
    if status != "PASSED":
        print(json.dumps(checks[-1], ensure_ascii=False, indent=1)[:4000], file=sys.stderr)
    return 0 if status == "PASSED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
