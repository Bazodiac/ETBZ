"""Long-form pages: V2 editorial rhythm rendered from the deterministic cp layout (V6 pagination, V5 budgets).
Every line is placed absolutely from integer centipoints; the browser never decides a break."""
from __future__ import annotations
import json, pathlib
import shell as S
from shell import glyph, py, esc, head, foot, wrap_page, component, begin, FIX, PHASE_INFO, POL
import paginate as PG

ROOT = pathlib.Path(__file__).resolve().parent.parent
PT_PER_MM = 72 / 25.4
def mm(cp: int) -> str: return f"{cp / 100 / PT_PER_MM:.3f}mm"

STYLE_CSS = {
    "kicker": "font-family:var(--font-sans);font-size:9pt;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-700)",
    "sectionTitle": "font-family:var(--font-display);font-size:26pt;font-weight:300;letter-spacing:-.015em;color:var(--ink-900)",
    "standfirst": "font-family:var(--font-sans);font-size:12.5pt;font-weight:400;color:var(--ink-600)",
    "subhead": "font-family:var(--font-sans);font-size:13pt;font-weight:500;letter-spacing:-.005em;color:var(--ink-900)",
    "body": "font-family:var(--font-sans);font-size:10.5pt;font-weight:400;color:var(--ink-600)",
    "pullQuote": "font-family:var(--font-display);font-size:15pt;font-weight:300;letter-spacing:-.01em;color:var(--ink-900)",
    "panelTitle": "font-family:var(--font-sans);font-size:9pt;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-500)",
    "panelBody": "font-family:var(--font-sans);font-size:9.5pt;font-weight:400;color:var(--paper-100)",
}

def header_height(fx) -> int:
    h = 0
    for b in fx["header"]:
        st = {"kicker": "kicker", "sectionTitle": "sectionTitle", "standfirst": "standfirst"}[b["kind"]]
        meas = {"kicker": PG.CONTENT_W, "sectionTitle": int(PG.CONTENT_W * 0.72), "standfirst": int(PG.CONTENT_W * 0.78)}[st]
        n = len(PG.wrap(b["text"], st, meas)); lead = PG.STYLES[st][2]
        h += PG.ceil_bl(n * lead) + (PG.BL if st != "standfirst" else 0)
    return h + 3 * PG.BL

def line_html(text, style_id, x_cp, baseline_cp):
    # a line is positioned by its baseline: top = baseline - ascent(size)
    fname, size, lead, _ = PG.STYLES[style_id]
    f, upem, _, _, asc, desc = PG.face(fname)
    top = baseline_cp - round(asc * size / upem)
    return f'<div class="longline" style="left:{mm(x_cp)};top:{mm(top)};line-height:1;{STYLE_CSS[style_id]}">{esc(text)}</div>'

def render(fx: dict, first_page_number: int, surface: str, tag: str, chapter_ref: dict | None):
    """Returns list of (page_id, number, html, struct) and the layout with structural hash."""
    hh = header_height(fx)
    layout = PG.paginate(fx["blocks"], hh)
    pages_out = []
    for pl in layout["pages"]:
        n = first_page_number + pl["pageNumber"] - 1
        st = begin(f"longform-{fx['fixtureId'].split('/')[-1]}-p{pl['pageNumber']}", surface, n, "long-form",
                   {"primary": "V2 agent_x_ETBZ-6.png (editorial rhythm)", "secondary": ["V6 deterministic pagination", "V5 page budgets / text floor", "V4 palette"]},
                   [{"slotId": "chapter.longForm", "visualType": "longFormBlocks", "consumedFactKinds": ["approved_interpretation:chapter"] if surface == "customer" else [], "fixture": fx["fixtureId"], "derivedNothing": True}])
        st["layout"] = {"pageNumber": pl["pageNumber"], "template": pl["template"], "fragments": [{k: v for k, v in f.items() if k != "lines"} | {"lineCount": len(f["lines"])} for f in pl["fragments"]], "usedBottomCp": pl["usedBottomCp"]}
        st["paginationSha256"] = layout["structuralSha256"]
        parts = []
        # --- header (opener only): flowed within the reserved header band, never into the columns
        if pl["template"] == "opener":
            y = PG.CONTENT_Y
            for b in fx["header"]:
                stl = {"kicker": "kicker", "sectionTitle": "sectionTitle", "standfirst": "standfirst"}[b["kind"]]
                meas = {"kicker": PG.CONTENT_W, "sectionTitle": int(PG.CONTENT_W * 0.72), "standfirst": int(PG.CONTENT_W * 0.78)}[stl]
                lines = PG.wrap(b["text"], stl, meas); lead = PG.STYLES[stl][2]; fb = PG.first_baseline(stl)
                for i, t in enumerate(lines):
                    parts.append(line_html(t, stl, PG.CONTENT_X, y + fb + i * lead))
                y += PG.ceil_bl(len(lines) * lead) + (PG.BL if stl != "standfirst" else 0)
            component("longform.header", kind="openerHeader", heightCp=hh)
        fill = (pl["usedBottomCp"] - PG.CONTENT_Y) / PG.CONTENT_H
        short_final = pl["pageNumber"] == len(layout["pages"]) and fill < 0.6 and chapter_ref is not None
        if pl["template"] != "opener":
            parts.append(f'<div class="kicker" style="position:absolute;left:{mm(PG.CONTENT_X)};top:{mm(PG.CONTENT_Y)}">{esc(fx["header"][0]["text"])} · continued</div>')
            if pl.get("sidebar") and chapter_ref and not short_final:
                sb = pl["sidebar"]
                parts.append(sidebar_html(sb, chapter_ref, pl["pageNumber"]))
        # --- flowed fragments
        for f in pl["fragments"]:
            if f["kind"] == "pullQuote":
                bx = f["boxCp"]
                parts.append(f'<div style="position:absolute;left:{mm(bx["xCp"])};top:{mm(bx["yCp"])};width:{mm(bx["widthCp"])};height:0.25mm;background:var(--gold-500)"></div>')
                parts.append(f'<div style="position:absolute;left:{mm(bx["xCp"])};top:{mm(bx["yCp"] + bx["heightCp"] - 25)};width:{mm(bx["widthCp"])};height:0.25mm;background:var(--gold-500)"></div>')
                for l in f["lines"]: parts.append(line_html(l["text"], l["styleId"], l["xCp"], l["baselineCp"]))
            elif f["kind"] == "keyInsight":
                bx = f["boxCp"]
                parts.append(f'<div style="position:absolute;left:{mm(bx["xCp"])};top:{mm(bx["yCp"])};width:{mm(bx["widthCp"])};height:{mm(bx["heightCp"])};background:var(--ink-900);border-radius:var(--radius-panel)"></div>')
                for l in f["lines"]: parts.append(line_html(l["text"], l["styleId"], l["xCp"], l["baselineCp"]))
            else:
                for l in f["lines"]: parts.append(line_html(l["text"], f["styleId"], l["xCp"], l["baselineCp"]))
            component(f"{f['blockId']}#{f['fragmentIndex']}", kind=f["kind"], lines=len(f["lines"]), topCp=f["topCp"], xCp=f["xCp"])
        # --- short final page rule (V4 inherited): a page filled < 60 % receives the chapter reference panel, never a stretch or a shrink
        if short_final:
            top = PG.ceil_bl(pl["usedBottomCp"] - PG.CONTENT_Y) + PG.CONTENT_Y + 2 * PG.BL
            parts.append(reference_panel_html(top, chapter_ref))
            component("longform.referencePanel", kind="chapterReference", topCp=top, reason="final page fill < 60%")
        inner = head(n, tag) + "".join(parts) + foot(n)
        pages_out.append((f"{'dev-v6-' if surface != 'customer' else ''}{n:02d}-longform-p{pl['pageNumber']}", n, wrap_page(fx["header"][1]["text"], inner), st))
    return pages_out, layout

def sidebar_html(sb, ref, pageno):
    x, y, w = mm(sb["xCp"]), mm(sb["yCp"]), mm(sb["widthCp"])
    dm = FIX["dayMaster"]
    terms = "".join(f'<div style="padding:2.2mm 0;border-top:0.25mm solid var(--rule-200)"><div class="pinyin" style="color:var(--ink-900)">{esc(t)} <span class="cjk muted" style="font-weight:400">{c}</span></div><div class="caption">{esc(d)}</div></div>' for t, c, d in ref["terms"])
    return (f'<div style="position:absolute;left:{x};top:{y};width:{w}">'
            f'<div class="panel" style="display:flex;gap:3mm;align-items:center;padding:3.5mm"><div style="width:14mm;height:14mm;border-radius:50%;background:var(--phase-{dm["phase"]}-field);display:flex;align-items:center;justify-content:center;flex:none">{glyph(dm["ch"], 9.5)}</div>'
            f'<div><div class="label">Chapter reference</div><div class="body-small" style="color:var(--ink-900);margin-top:1mm">Day Master <span class="cjk">{dm["ch"]}</span> {py(dm["ch"])} · {POL[dm["polarity"]]} {PHASE_INFO[dm["phase"]]["en"]}</div></div></div>'
            f'<div class="label" style="margin:7mm 0 2mm">Terms in this chapter</div>{terms}<div class="rule"></div></div>')

def reference_panel_html(top_cp, ref):
    rows = "".join(f'<div><div class="pinyin" style="color:var(--ink-900)">{esc(t)} <span class="cjk muted" style="font-weight:400">{c}</span></div><div class="caption">{esc(d)}</div></div>' for t, c, d in ref["terms"])
    dm = FIX["dayMaster"]
    return (f'<div class="panel recessed" style="position:absolute;left:{mm(PG.CONTENT_X)};top:{mm(top_cp)};width:{mm(PG.CONTENT_W)};padding:6mm">'
            f'<div style="display:flex;align-items:center;gap:4mm;margin-bottom:5mm"><div style="width:16mm;height:16mm;border-radius:50%;background:var(--phase-{dm["phase"]}-field);display:flex;align-items:center;justify-content:center;flex:none">{glyph(dm["ch"], 11)}</div>'
            f'<div><div class="label gold">Chapter reference</div><div class="body" style="color:var(--ink-900);margin-top:1mm">This chapter was read against your Day Master <span class="cjk">{dm["ch"]}</span> {py(dm["ch"])} · {POL[dm["polarity"]]} {PHASE_INFO[dm["phase"]]["en"]}</div></div></div>'
            f'<div class="label" style="margin-bottom:3mm">Terms used above</div>'
            f'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm 8mm">{rows}</div></div>')

CHAPTER_REF = {"terms": [
    ("Heavenly Stem", "天干", "The upper character of a pillar. Ten exist; each carries a phase and a polarity."),
    ("Earthly Branch", "地支", "The lower character of a pillar. Twelve exist; each travels with an animal label."),
    ("Hidden Stem", "藏干", "A Stem held inside a Branch, listed in Qi order: principal, central, residual."),
    ("Day Master", "日主", "The Stem of the Day pillar; every other Stem is named by its relation to it."),
    ("Ten Gods", "十神", "The ten relation names between a Stem and the Day Master."),
    ("Wu Xing", "五行", "The Five Phases: Wood, Fire, Earth, Metal, Water."),
]}
