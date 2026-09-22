#!/usr/bin/env python3
"""Single source of truth for tokens → tokens.json (Design System artifact list shape),
tokens.css (authoring vars) and the integer-centipoint geometry block used by the renderer."""
import json, pathlib, hashlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PT_PER_MM = 72 / 25.4

def mm_cp(mm): return int(round(mm * PT_PER_MM * 100))
def pt_cp(pt): return int(round(pt * 100))

COLOR = [
 ("paper-000", "#FBF9F4", "#1A1917", "Page ground. Full-bleed page background."),
 ("paper-100", "#F4F1EA", "#232220", "Neutral panel: pillar containers, quiet cards. Carries no phase meaning."),
 ("paper-200", "#EBE7DD", "#2C2A27", "Recessed field: dividers, education ground, Day Master stage."),
 ("ink-900", "#16181A", "#F3EFE6", "Selective black: display glyphs, headings, body text, the one dark panel per page."),
 ("ink-600", "#4A4F52", "#C8C2B6", "Secondary text, standfirsts, pinyin. 7.8:1 on paper-000."),
 ("ink-400", "#6F7477", "#A09A90", "Captions, small-caps labels. 4.6:1 on paper-000 — the floor; never lighten."),
 ("rule-200", "#DCD7CB", "#38352F", "Hairline rules and panel borders. Structure is rules, never shadows."),
 ("gold-500", "#B2913F", "#D8B45F", "Gold RULE and the static wordmark point, the Day Master selection edge. Punctuation, never body colour."),
 ("gold-700", "#7D6425", "#E0C684", "Text-safe gold. 5.4:1. Every gold WORD (kickers, chapter labels) uses this."),
 ("phase-wood-field", "#E7ECE3", "#22271F", "Wood field. Background of exactly one fact-bearing region."),
 ("phase-fire-field", "#F6E9E6", "#2A2220", "Fire field. Background of exactly one fact-bearing region."),
 ("phase-earth-field", "#F4ECDD", "#282420", "Earth field. Background of exactly one fact-bearing region."),
 ("phase-metal-field", "#EDEDEC", "#252526", "Metal field. Grey — never gold."),
 ("phase-water-field", "#E8EDF1", "#1F2428", "Water field. Background of exactly one fact-bearing region."),
 ("phase-wood-mark", "#5F7D55", "#9CBD90", "Wood mark: dot, bar, halo. States the phase."),
 ("phase-fire-mark", "#A8574A", "#E0968A", "Fire mark."),
 ("phase-earth-mark", "#96702A", "#D5AB58", "Earth mark."),
 ("phase-metal-mark", "#6B7376", "#ADB3B5", "Metal mark. Neutral grey by design — never gold."),
 ("phase-water-mark", "#45637A", "#8FB0C6", "Water mark."),
 ("atmos-wood", "#C3CFBC", "#2E3A2A", "Atmospheric pastel form (cover/openers) — Wood family. Decorative only, never binds a fact."),
 ("atmos-fire", "#E4C4BC", "#4A2E2A", "Atmospheric pastel form — Fire family. Decorative only."),
 ("atmos-earth", "#E3D2A9", "#4A3B20", "Atmospheric pastel form — Earth family. Decorative only."),
 ("atmos-metal", "#D9D8D2", "#3A3B3C", "Atmospheric pastel form — Metal family. Decorative only."),
 ("atmos-water", "#C4D1D9", "#26323A", "Atmospheric pastel form — Water family. Decorative only."),
]

TYPE_STYLES = [  # name, family, size pt, leading pt, weight, tracking em, transform
 ("display-title", "sans-display", 30, 33, 300, -0.02, None),
 ("h1", "sans-display", 22, 25, 300, -0.015, None),
 ("h2", "sans", 13, 17, 500, -0.005, None),
 ("standfirst", "sans", 12.5, 17, 300, 0, None),
 ("body", "sans", 10.5, 14.17, 400, 0, None),
 ("body-small", "sans", 9, 12.5, 400, 0, None),
 ("caption", "sans", 9, 12, 400, 0, None),
 ("kicker", "sans", 9, 12, 500, 0.16, "uppercase"),
 ("micro-label", "sans", 9, 11, 500, 0.12, "uppercase"),
 ("pull-quote", "sans-display", 15, 20, 300, -0.01, None),
 ("panel-body", "sans", 9.5, 13.5, 400, 0, None),
 ("cjk-informational", "cjk-text", 10.5, 14.17, 400, 0.02, None),
 ("cjk-term", "cjk-text", 12, 16, 500, 0.04, None),
 ("pinyin", "sans", 9, 12, 500, 0.02, None),
]

GEOMETRY_MM = {"pageW": 210, "pageH": 297, "marginTop": 22, "marginSide": 20, "marginBottom": 20,
               "contentW": 170, "contentH": 255, "baseline": 5, "gutter": 6}

def build():
    tokens = {
      "name": "Bazodiac Final", "version": 1,
      "meta": {"source": "V1–V6 convergence (ETBZ-43)", "textFloorPt": 9, "scaleLock": 1.0,
               "orphanMinLines": 2, "widowMinLines": 2, "regionPolicy": "CN_SIMPLIFIED"},
      "color": {"themes": [{"id": "light", "name": "Paper"}, {"id": "dark", "name": "Night (screen only)"}],
                "tokens": [{"name": n, "value": {"light": l, "dark": d}, "usage": u} for n, l, d, u in COLOR]},
      "type": {
        "fonts": [
          {"family": "Inter", "file": "fonts/Inter-Regular.ttf", "weight": "400"},
          {"family": "Inter", "file": "fonts/Inter-Medium.ttf", "weight": "500"},
          {"family": "Inter", "file": "fonts/Inter-SemiBold.ttf", "weight": "600"},
          {"family": "Inter Display", "file": "fonts/InterDisplay-Light.ttf", "weight": "300"},
          {"family": "Inter Display", "file": "fonts/InterDisplay-Regular.ttf", "weight": "400"},
        ],
        "families": {
          "sans": "\"Inter\", system-ui, sans-serif",
          "sans-display": "\"Inter Display\", \"Inter\", system-ui, sans-serif",
          "cjk-text": "\"Noto Sans CJK SC\", \"Noto Sans SC\", sans-serif",
          "cjk-display": "BazodiacDisplayGlyphSet (vector assets, not a font — see glyphs/manifest.json)"
        },
        "groups": [{"name": "Editorial", "family": "sans", "styles": [
          {"name": n, "fontSize": f"{s}pt", "lineHeight": f"{l}pt", "fontWeight": w,
           "letterSpacing": f"{t}em", "fontFamily": fam, **({"textTransform": tr} if tr else {})}
          for n, fam, s, l, w, t, tr in TYPE_STYLES]}]
      },
      "spacing": {"tokens": [
        {"name": "space-1", "value": "2.5mm", "usage": "Half baseline. Chip padding, label gaps."},
        {"name": "space-2", "value": "5mm", "usage": "One baseline. Paragraph gap, panel padding."},
        {"name": "space-3", "value": "10mm", "usage": "Two baselines. Module separation."},
        {"name": "space-4", "value": "15mm", "usage": "Three baselines. Section separation."},
        {"name": "space-5", "value": "25mm", "usage": "Five baselines. Title-to-body on openers."},
        {"name": "gutter", "value": "6mm", "usage": "Column gutter in two-column long-form."},
      ]},
      "radius": {"tokens": [
        {"name": "radius-panel", "value": "1.5mm", "usage": "Panels, pillar containers, chips."},
        {"name": "radius-halo", "value": "50%", "usage": "Phase halos and atmospheric forms."},
      ]},
      "geometry": {"tokens": [
        {"name": "page-width", "value": "210mm", "usage": "A4 portrait."},
        {"name": "page-height", "value": "297mm", "usage": "A4 portrait."},
        {"name": "margin-top", "value": "22mm", "usage": "Top margin."},
        {"name": "margin-side", "value": "20mm", "usage": "Left and right margin."},
        {"name": "margin-bottom", "value": "20mm", "usage": "Bottom margin."},
        {"name": "content-width", "value": "170mm", "usage": "Content box width."},
        {"name": "content-height", "value": "255mm", "usage": "Content box height."},
        {"name": "baseline", "value": "5mm", "usage": "Baseline grid = body leading 14.17pt."},
      ]},
    }
    cp = {k: mm_cp(v) for k, v in GEOMETRY_MM.items()}
    cp.update({"bodySizeCp": pt_cp(10.5), "bodyLeadingCp": pt_cp(14.17), "textFloorCp": pt_cp(9),
               "linesPerPage": cp["contentH"] // pt_cp(14.17)})
    tokens["geometryCentipoints"] = cp
    (ROOT / "tokens.json").write_text(json.dumps(tokens, ensure_ascii=False, indent=2), encoding="utf-8")

    css = [":root{"]
    for n, l, d, u in COLOR: css.append(f"  --{n}:{l};")
    for k, v in GEOMETRY_MM.items(): css.append(f"  --geo-{k}:{v}mm;")
    for n, fam, s, l, w, t, tr in TYPE_STYLES:
        css.append(f"  --type-{n}-size:{s}pt; --type-{n}-leading:{l}pt; --type-{n}-weight:{w}; --type-{n}-tracking:{t}em;")
    css.append("  --font-sans:\"Inter\",system-ui,sans-serif; --font-display:\"Inter Display\",\"Inter\",system-ui,sans-serif; --font-cjk:\"Noto Sans CJK SC\",\"Noto Sans SC\",sans-serif;")
    css.append("  --radius-panel:1.5mm; --gutter:6mm;")
    css.append("}")
    css.append("@media (prefers-color-scheme: dark){:root:not([data-theme=light]){" + "".join(f"--{n}:{d};" for n, l, d, u in COLOR) + "}}")
    css.append(":root[data-theme=dark]{" + "".join(f"--{n}:{d};" for n, l, d, u in COLOR) + "}")
    for n, fam, s, l, w, t, tr in TYPE_STYLES:
        famvar = {"sans": "var(--font-sans)", "sans-display": "var(--font-display)", "cjk-text": "var(--font-cjk)"}[fam]
        css.append(f".t-{n}{{font-family:{famvar};font-size:{s}pt;line-height:{l}pt;font-weight:{w};letter-spacing:{t}em;{'text-transform:'+tr+';' if tr else ''}}}")
    (ROOT / "tokens.css").write_text("\n".join(css) + "\n", encoding="utf-8")
    print("tokens.json sha256:", hashlib.sha256((ROOT / "tokens.json").read_bytes()).hexdigest())
    print("cp geometry:", cp)
    return tokens

if __name__ == "__main__":
    build()
