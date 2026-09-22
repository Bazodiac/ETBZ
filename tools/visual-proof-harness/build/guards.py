"""Negative-path guards (donor V6). Each guard is executed for real by the developer proof; nothing is asserted by prose."""
from __future__ import annotations
import json
import shell as S

class GuardError(Exception):
    def __init__(self, code, msg=""): super().__init__(f"{code} {msg}".strip()); self.code = code

DISPLAY_SET = set(S.GLYPHS.keys())

def request_display_glyph(ch: str):
    """Only the canonical 27 may be rendered through BazodiacDisplayGlyphSet."""
    if ch not in DISPLAY_SET: raise GuardError("DISPLAY_GLYPH_OUT_OF_CONTRACT", f"U+{ord(ch):04X}")
    return S.GLYPHS[ch]["asset"]

def informational_cjk(text: str):
    """InformationalCjkText: any CJK text, separate role, never routed through the 27-asset contract."""
    return {"role": "InformationalCjkText", "text": text, "face": "Noto Sans CJK SC 400/500"}

def hidden_stem_cell(cell: dict, branch_phase: str):
    """A Hidden Stem region takes ONLY its own supplied phase. Missing phase → BLOCKED cell, never the Branch phase."""
    if not cell.get("phase"): return {"state": "BLOCKED", "code": "HIDDEN_STEM_PHASE_MISSING", "fill": "paper-100", "inherited": False}
    if cell["phase"] == "inherit": raise GuardError("PHASE_INHERITANCE_FORBIDDEN", "hidden stem may not inherit the branch phase")
    return {"state": "OK", "fill": f"phase-{cell['phase']}-field"}

def paint_region(component_id: str, phase: str):
    """Region-scoped colour semantics: a phase may classify a stem, a branch or a hidden stem region — never a pillar."""
    if component_id.split(".")[-1] in ("pillar", "column", "container"): raise GuardError("WHOLE_COLUMN_TINT_FORBIDDEN", component_id)
    if phase == "gold" or component_id.endswith("selection"): raise GuardError("SELECTION_IS_NOT_A_PHASE", component_id)
    return {"component": component_id, "fill": f"phase-{phase}-field"}

def wordmark(glyph: str | None = None):
    if glyph is not None: raise GuardError("WORDMARK_MUST_BE_STATIC", "customer Day Master can never be the Bazodiac logo")
    return "assets/wordmark.svg"

def relation_graphic(kind: str, surface: str):
    """General Sheng/Ke relation graphics are excluded from the customer MVP. The dev surface reports the state; the customer surface has no slot."""
    if kind in ("sheng", "ke", "generating", "controlling"):
        if surface == "customer": raise GuardError("NO_CUSTOMER_SLOT", "relation edges are structurally absent from customer templates")
        return {"state": "METHOD_SCOPE_BLOCKED", "surface": surface}
    return {"state": "OK"}

def wu_xing_value(v, mx):
    """Presentation transform pt.linear-max-v1: monotonic, value-preserving, no semantic normalisation; 0 → 0."""
    if v < 0: raise GuardError("NEGATIVE_VALUE")
    return {"value": v, "bar": 0.0 if mx == 0 else v / mx, "label": f"{v:.1f} in this distribution"}

def text_size(pt: float):
    if pt < 9: raise GuardError("BELOW_TEXT_FLOOR", f"{pt}pt < 9pt")
    return pt

def run_all():
    results = []
    def t(name, fn, expect_code=None):
        try:
            out = fn(); ok = expect_code is None
            results.append({"test": name, "expected": expect_code or "OK", "observed": json.dumps(out, ensure_ascii=False) if not isinstance(out, str) else out, "pass": ok})
        except GuardError as e:
            results.append({"test": name, "expected": expect_code or "OK", "observed": e.code, "pass": e.code == expect_code})
    t("display glyph inside contract (辛)", lambda: request_display_glyph("辛"))
    t("display glyph outside contract (龍 U+9F8D)", lambda: request_display_glyph("龍"), "DISPLAY_GLYPH_OUT_OF_CONTRACT")
    t("display glyph outside contract (十神)", lambda: request_display_glyph("神"), "DISPLAY_GLYPH_OUT_OF_CONTRACT")
    t("informational CJK 十神 through role B", lambda: informational_cjk("十神 · 偏印"))
    t("hidden stem with supplied phase", lambda: hidden_stem_cell({"ch": "丁", "phase": "fire"}, "fire"))
    t("hidden stem phase missing → BLOCKED cell", lambda: hidden_stem_cell({"ch": "丁"}, "fire"))
    t("hidden stem asks to inherit branch phase", lambda: hidden_stem_cell({"ch": "丁", "phase": "inherit"}, "fire"), "PHASE_INHERITANCE_FORBIDDEN")
    t("paint stem region with stem phase", lambda: paint_region("pillar.day.stem", "metal"))
    t("paint whole day pillar with metal", lambda: paint_region("pillar.day.pillar", "metal"), "WHOLE_COLUMN_TINT_FORBIDDEN")
    t("paint selection as a phase", lambda: paint_region("pillar.day.selection", "gold"), "SELECTION_IS_NOT_A_PHASE")
    t("static wordmark", lambda: wordmark())
    t("wordmark from customer Day Master", lambda: wordmark("辛"), "WORDMARK_MUST_BE_STATIC")
    t("sheng/ke graphic on customer surface", lambda: relation_graphic("sheng", "customer"), "NO_CUSTOMER_SLOT")
    t("sheng/ke graphic on developer surface", lambda: relation_graphic("ke", "developer"))
    t("wu xing zero value", lambda: wu_xing_value(0, 3))
    t("wu xing negative value", lambda: wu_xing_value(-1, 3), "NEGATIVE_VALUE")
    t("text at 9pt floor", lambda: text_size(9))
    t("text below floor (7.5pt)", lambda: text_size(7.5), "BELOW_TEXT_FLOOR")
    return results

if __name__ == "__main__":
    for r in run_all(): print("PASS" if r["pass"] else "FAIL", r["test"], "→", r["observed"])
