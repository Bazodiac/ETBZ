"""Shared page shell, glyph access and structural recording for the FINAL Bazodiac page family."""
from __future__ import annotations
import json, pathlib, hashlib, html as H

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKENS_CSS = (ROOT / "tokens.css").read_text()
BASE_CSS = (ROOT / "src" / "base.css").read_text()
MANIFEST = json.loads((ROOT / "glyphs" / "manifest.json").read_text())
GLYPHS = {g["character"]: g for g in MANIFEST["glyphs"]}
SPRITE = (ROOT / "glyphs" / "sprite.svg").read_text()
WORDMARK = (ROOT / "assets" / "wordmark.svg").read_text()
FIX = json.loads((ROOT / "fixtures" / "chart-fixture.json").read_text())
VB = " ".join(map(str, MANIFEST["viewBox"]))

PHASES = ["wood", "fire", "earth", "metal", "water"]
PHASE_INFO = {
    "wood": {"ch": "木", "py": "mù", "en": "Wood", "stems": "甲 乙", "branches": "寅 卯"},
    "fire": {"ch": "火", "py": "huǒ", "en": "Fire", "stems": "丙 丁", "branches": "巳 午"},
    "earth": {"ch": "土", "py": "tǔ", "en": "Earth", "stems": "戊 己", "branches": "辰 戌 丑 未"},
    "metal": {"ch": "金", "py": "jīn", "en": "Metal", "stems": "庚 辛", "branches": "申 酉"},
    "water": {"ch": "水", "py": "shuǐ", "en": "Water", "stems": "壬 癸", "branches": "亥 子"},
}
POL = {"yang": "Yang", "yin": "Yin"}

class GlyphContractError(Exception): pass

def glyph(ch: str, size_mm: float, cls: str = "", color: str | None = None, extra: str = "") -> str:
    """Display glyph via the 27-asset contract. Anything outside the set is refused, never faked."""
    if ch not in GLYPHS:
        raise GlyphContractError(f"DISPLAY_GLYPH_OUT_OF_CONTRACT U+{ord(ch):04X} {ch!r}")
    g = GLYPHS[ch]
    STRUCT["glyphRefs"].append({"ch": ch, "slug": g["slug"], "sha256": g["sha256"]})
    style = f"width:{size_mm}mm;height:{size_mm}mm;" + (f"color:{color};" if color else "")
    return f'<svg class="disp {cls}" viewBox="{VB}" style="{style}" {extra} data-glyph="{g["codepoint"]}"><use href="#g-{g["slug"]}"/></svg>'

def py(ch: str) -> str: return GLYPHS[ch]["pinyin"]
def esc(s: str) -> str: return H.escape(s, quote=False)

STRUCT: dict = {"glyphRefs": []}

def begin(page_id: str, surface: str, number: int | None, family: str, donors: dict, bindings: list):
    global STRUCT
    STRUCT = {"pageId": page_id, "surface": surface, "pageNumber": number, "family": family,
              "donors": donors, "factSlotBindings": bindings, "glyphRefs": [], "components": []}
    return STRUCT

def component(cid: str, **props):
    STRUCT["components"].append({"id": cid, **props})

def head(number: int | None, tag: str | None = None, who: str | None = None, dark=False) -> str:
    who = who or FIX["customer"]["displayName"]
    t = ""
    if tag == "you": t = '<span class="tag you">Your chart</span>'
    elif tag == "gen": t = '<span class="tag gen">General education</span>'
    elif tag == "read": t = '<span class="tag you">Your reading</span>'
    return (f'<div class="head"><div class="brand">{WORDMARK}<span class="sep">·</span><span class="who">{esc(who)}</span></div><div>{t}</div></div>')

def foot(number: int | None, left: str | None = None) -> str:
    left = left or f"Bazodiac · Personalized BaZi Reading · {FIX['customer']['displayName']}"
    pn = f'<span class="pn">{number:02d}</span>' if number else ""
    return f'<div class="foot"><div>{esc(left)}</div>{pn}</div>'

def wrap_page(title: str, inner: str, extra_css: str = "") -> str:
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{esc(title)}</title>'
            f'<style>{TOKENS_CSS}\n{BASE_CSS}\n{extra_css}</style></head><body>{SPRITE}'
            f'<div class="sheet">{inner}</div></body></html>')

def structural_hash(struct: dict) -> str:
    return "sha256:" + hashlib.sha256(json.dumps(struct, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()

def phase_dot(phase: str) -> str: return f'<span class="dot m-{phase}"></span>'
