"""Page builders of the Bazodiac PDF renderer (ETBZ-55).

Each builder turns one page of the PresentationProjection into one A4 HTML page
in the ETBZ-49 visual language (the page layouts of the approved customer page
family, ported). A builder reads every value from the projection and prints
every string in its own element: the renderer adds no text, so the QA scan can
require every text node on the page to be a projection string. Display glyphs
are drawn from the 27-asset vector set, never from a font.
"""
from __future__ import annotations

import html
import math

MM_PER_CP = 25.4 / 7200  # 1 cp = 1/100 pt

SEP = '<span class="sep">·</span>'


def esc(text: str) -> str:
    return html.escape(text, quote=False)


def t(text: str, cls: str = "", style: str = "") -> str:
    """One projection string in its own element."""
    attrs = (f' class="{cls}"' if cls else "") + (f' style="{style}"' if style else "")
    return f"<span{attrs}>{esc(text)}</span>"


def mm(cp: int | float) -> str:
    return f"{cp * MM_PER_CP:.3f}mm"


class Context:
    """Assets and the glyph contract, loaded once per render."""

    def __init__(self, tokens_css: str, base_css: str, sprite: str, wordmark: str, glyph_manifest: dict, styles: dict, content_w_cp: int):
        self.tokens_css = tokens_css
        self.base_css = base_css
        self.sprite = sprite
        self.wordmark_svg = wordmark
        self.glyphs = {g["character"]: g for g in glyph_manifest["glyphs"]}
        self.view_box = " ".join(str(v) for v in glyph_manifest["viewBox"])
        self.styles = styles
        self.content_w_cp = content_w_cp

    def glyph(self, character: str, size_mm: float, color: str | None = None) -> str:
        entry = self.glyphs.get(character)
        if entry is None:
            raise ValueError(f"DISPLAY_GLYPH_OUT_OF_CONTRACT {character!r}")
        style = f"width:{size_mm}mm;height:{size_mm}mm;" + (f"color:{color};" if color else "")
        return (f'<svg class="disp" viewBox="{self.view_box}" style="{style}" data-glyph="{entry["codepoint"]}">'
                f'<use href="#g-{entry["slug"]}"/></svg>')

    def wordmark(self, height_mm: float) -> str:
        return self.wordmark_svg.replace("<svg ", f'<svg style="height:{height_mm}mm;width:auto" ', 1)


def phase_dot(phase: str) -> str:
    return f'<span class="dot m-{phase}"></span>'


def disc(ctx: Context, glyph: dict, circle_mm: float, glyph_mm: float) -> str:
    return (f'<div class="disc f-{glyph["phase"]}" style="width:{circle_mm}mm;height:{circle_mm}mm">'
            f'{ctx.glyph(glyph["character"], glyph_mm)}</div>')


# ------------------------------------------------------------------ chrome

def head(ctx: Context, page: dict) -> str:
    chrome = page["chrome"]
    tag = ""
    if chrome["tag"] is not None:
        cls = "tag gen" if chrome["tagKind"] == "general" else "tag you"
        tag = t(chrome["tag"], cls)
    return (f'<div class="head"><div class="brand">{ctx.wordmark(2.6)}{SEP}{t(chrome["displayName"], "who")}</div>'
            f'<div>{tag}</div></div>')


def foot(page: dict) -> str:
    parts = SEP.join(t(part) for part in page["chrome"]["footer"])
    return f'<div class="foot"><div>{parts}</div>{t(page["pageLabel"], "pn")}</div>'


def rows_table(rows: list) -> str:
    out = []
    for row in rows:
        cjk = f' {t(row["cjk"], "cjk")}' if row.get("cjk") else ""
        out.append(f'<tr><td>{t(row["label"])}</td><td>{t(row["value"])}{cjk}</td></tr>')
    return f'<table class="facts">{"".join(out)}</table>'


# ------------------------------------------------------------------ 01 cover

def cover(ctx: Context, page: dict, c: dict) -> str:
    dm = c["dayMaster"]
    blobs = ('<div class="blob b-metal" style="width:138mm;height:138mm;left:76mm;top:38mm;opacity:.55"></div>'
             '<div class="blob b-water" style="width:88mm;height:88mm;left:21mm;top:110mm;opacity:.55"></div>'
             '<div class="blob b-fire" style="width:66mm;height:66mm;left:138mm;top:148mm;opacity:.5"></div>'
             '<div class="blob b-earth" style="width:48mm;height:48mm;left:34mm;top:60mm;opacity:.6"></div>'
             '<div class="blob b-wood" style="width:37mm;height:37mm;left:159mm;top:47mm;opacity:.55"></div>')
    term = c["footerTerm"]
    return f'''{blobs}
    <div style="position:absolute;left:16mm;top:16mm;height:3mm;color:var(--ink-900)">{ctx.wordmark(3)}</div>
    <div style="position:absolute;left:0;right:0;top:56mm;text-align:center">
      <div style="display:flex;justify-content:center">{ctx.glyph(dm["character"], 82)}</div>
      <div class="label" style="margin-top:6mm;letter-spacing:.3em;color:var(--ink-600)">{t(c["dayMasterLabel"])}{SEP}{t(dm["pinyin"], "nocase", "color:var(--ink-900)")}{SEP}{t(dm["polarityLabel"])} {t(dm["phaseLabel"])}</div>
    </div>
    <div style="position:absolute;left:16mm;right:16mm;bottom:34mm;height:0.25mm;background:var(--gold-500)"></div>
    <div style="position:absolute;left:16mm;right:16mm;bottom:44mm">
      <div class="label ink" style="letter-spacing:.42em;margin-bottom:4mm">{t(c["brand"])}</div>
      <div class="label" style="margin-bottom:3mm">{t(c["product"])}</div>
      <div class="h1" style="font-size:26pt;line-height:30pt;margin-bottom:8mm;max-width:168mm">{t(c["title"])}</div>
      <div class="label" style="margin-bottom:1.5mm">{t(c["preparedFor"])}</div>
      <div style="font-size:22pt;font-weight:500;letter-spacing:-.01em">{t(c["displayName"])}</div>
    </div>
    <div style="position:absolute;left:16mm;right:16mm;bottom:16mm" class="label">{t(term["label"])} {t(term["hanzi"], "cjk nocase", "letter-spacing:.1em")}</div>'''


# ------------------------------------------------------------------ 02 identity

def identity(ctx: Context, page: dict, c: dict) -> str:
    legend = "".join(
        f'<div style="margin-bottom:7mm"><div style="margin-bottom:2.5mm">{t(item["tag"], "tag " + ("gen" if i == 1 else "you"))}</div>'
        f'<div class="body">{t(item["text"])}</div></div>' for i, item in enumerate(c["legend"]))
    return f'''{head(ctx, page)}
    <div class="blob b-earth" style="width:70mm;height:70mm;right:-22mm;top:-18mm;opacity:.35"></div>
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1 small" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:16mm">
        <div>{legend}</div>
        <div>{rows_table(c["rows"])}</div>
      </div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 03 contents

def contents(ctx: Context, page: dict, c: dict) -> str:
    cols = []
    for section in c["sections"]:
        rows = "".join(
            f'<div class="toc-row">{t(e["pageLabel"], "label gold toc-n")}{t(e["title"], "body toc-t")}</div>' for e in section["entries"])
        cols.append(f'<div><div class="kicker">{t(section["title"])}</div><div style="margin-top:3mm">{rows}</div></div>')
    return f'''{head(ctx, page)}
    <div class="blob b-water" style="width:60mm;height:60mm;left:-24mm;bottom:20mm;opacity:.3"></div>
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12mm 14mm;margin-top:12mm">{"".join(cols)}</div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 04 glance

def glance(ctx: Context, page: dict, c: dict) -> str:
    dm = c["dayMaster"]
    pil = "".join(
        f'<div style="text-align:center"><div class="label" style="margin-bottom:2mm">{t(p["positionLabel"])}</div>'
        f'<div style="display:flex;flex-direction:column;align-items:center;gap:1mm">{ctx.glyph(p["stem"]["character"], 11)}{ctx.glyph(p["branch"]["character"], 11)}</div>'
        f'<div class="pinyin" style="margin-top:2mm;color:var(--ink-600)">{t(p["stem"]["pinyin"])} {t(p["branch"]["pinyin"])}</div></div>'
        for p in c["pillars"])
    tally = "".join(
        f'<div style="text-align:center"><div style="display:flex;justify-content:center">{ctx.glyph(w["character"], 8, f"var(--phase-{w["phase"]}-mark)")}</div>'
        f'<div class="wx-v">{t(w["valueText"])}</div><div class="label">{t(w["label"])}</div></div>'
        for w in c["wuXing"]["phases"])
    return f'''{head(ctx, page)}
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="display:grid;grid-template-columns:64mm 1fr;gap:10mm;margin-top:14mm;align-items:start">
        <div class="panel recessed" style="height:96mm;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="position:absolute;width:52mm;height:52mm;border-radius:50%;background:var(--phase-{dm["phase"]}-field);top:12mm"></div>
          <div style="position:relative">{ctx.glyph(dm["character"], 44)}</div>
          <div class="pinyin" style="position:relative;margin-top:4mm;font-size:12pt;font-weight:400">{t(dm["pinyin"])}</div>
          <div class="label" style="position:relative;margin-top:1.5mm">{phase_dot(dm["phase"])}{t(dm["polarityLabel"])} {t(dm["phaseLabel"])}{SEP}{t(c["dayMasterLabel"])}</div>
        </div>
        <div>
          <div class="label ink" style="margin-bottom:4mm">{t(c["pillarsLabel"]["label"])} {t(c["pillarsLabel"]["hanzi"], "cjk muted nocase", "letter-spacing:.1em;margin-left:2mm")}</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;background:var(--paper-100);border-radius:var(--radius-panel);padding:5mm 4mm">{pil}</div>
          <div class="label ink" style="margin:8mm 0 3mm">{t(c["wuXingLabel"]["label"])} {t(c["wuXingLabel"]["hanzi"], "cjk muted nocase", "letter-spacing:.1em;margin-left:2mm")}</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2mm">{tally}</div>
        </div>
      </div>
      <div style="width:64mm;margin-top:10mm">{rows_table(c["rows"])}</div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 05 four pillars

def four_pillars(ctx: Context, page: dict, c: dict) -> str:
    cols = []
    for p in c["pillars"]:
        day = p["isDayMaster"]
        stem, branch = p["stem"], p["branch"]
        hs = "".join(
            f'<div class="f-{h["phase"]}" style="flex:1;text-align:center;padding:2.4mm 0 2mm;border-radius:1mm">'
            f'<div style="display:flex;justify-content:center">{ctx.glyph(h["character"], 7.5)}</div>'
            f'<div class="pinyin" style="margin-top:1.2mm;color:var(--ink-600)">{t(h["pinyin"])}</div></div>' for h in p["hidden"])
        if p["tenGod"] is None:
            rel = f'<div class="h2" style="font-size:10.5pt;line-height:13pt;color:var(--gold-700)">{t(c["dayMasterLabel"])}</div>'
        else:
            rel = (f'<div class="cjk term" style="font-size:11pt;line-height:14pt">{t(p["tenGod"]["hanzi"])}</div>'
                   f'<div class="body-small" style="color:var(--ink-400);margin-top:0.5mm">{t(p["tenGod"]["pinyin"])}</div>')
        cols.append(f'''<div class="pillar{' selected' if day else ''}">
          <div class="label ink" style="{'color:var(--gold-700)' if day else ''}">{t(p["positionLabel"])}</div>
          <div class="cell" style="height:25.5mm">{disc(ctx, stem, 13, 10)}
            <div class="body-small" style="line-height:12pt">{t(stem["pinyin"], "pinyin", "display:block")}{t(stem["polarityLabel"])}<br>{t(stem["phaseLabel"])}</div></div>
          <div class="cell" style="height:25.5mm">{disc(ctx, branch, 13, 10)}
            <div class="body-small" style="line-height:12pt">{t(branch["pinyin"], "pinyin", "display:block")}{t(branch["phaseLabel"])}<br>{t(branch["animalLabel"], "muted")}</div></div>
          <div class="cell" style="height:21mm;gap:1.5mm">{hs}</div>
          <div class="cell rel" style="height:20mm">{rel}</div></div>''')
    labels = c["rowLabels"]
    heights = [25.5, 25.5, 21, 20]
    rowlabels = '<div style="height:7.2mm"></div>' + "".join(
        f'<div class="rowlabel" style="height:{heights[i]}mm;margin-top:3mm;padding-top:3mm">{t(l["label"])}'
        + (f'<br>{t(l["hanzi"], "cjk", "font-size:9pt")}' if l["hanzi"] else "") + "</div>" for i, l in enumerate(labels))
    legend = "".join(f'<div class="i">{phase_dot(l["phase"])}{t(l["label"])} {ctx.glyph(l["character"], 3.4, f"var(--phase-{l["phase"]}-mark)")}</div>' for l in c["legend"])
    return f'''{head(ctx, page)}
    <div class="blob b-fire" style="width:95mm;height:95mm;right:-32mm;top:-28mm;opacity:.28"></div>
    <div class="blob b-water" style="width:70mm;height:70mm;left:-30mm;bottom:14mm;opacity:.3"></div>
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="display:grid;grid-template-columns:23mm repeat(4,minmax(0,1fr));gap:0 3mm;margin-top:12mm;align-items:start">
        <div>{rowlabels}</div>{"".join(cols)}
      </div>
      <div class="legend" style="margin-top:9mm">{legend}</div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 06 foundation

def foundation(ctx: Context, page: dict, c: dict) -> str:
    rows = "".join(
        f'<div class="frow">{disc(ctx, e["glyph"], 14, 9.5)}'
        f'<div style="flex:1">{t(e["glyph"]["pinyin"], "pinyin", "display:block;font-size:11pt")}'
        f'<div class="caption">{t(e["positionLabel"])}{SEP}{t(e["roleLabel"])}{SEP}{t(e["glyph"]["phaseLabel"])}{SEP}{t(e["detail"])}</div></div>'
        f'{phase_dot(e["glyph"]["phase"])}</div>' for e in c["characters"])
    return f'''{head(ctx, page)}
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1 small" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="width:120mm;margin-top:12mm">{rows}<div class="rule"></div></div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 07 day master

def day_master(ctx: Context, page: dict, c: dict) -> str:
    dm = c["dayMaster"]
    dp = c["dayPillar"]
    hidden = "".join(
        f'<div class="frow">{disc(ctx, h, 11, 7.5)}<div style="flex:1">{t(h["pinyin"], "pinyin", "display:block")}'
        f'<div class="caption">{t(h["qiLabel"])}{SEP}{t(h["phaseLabel"])}</div></div>{phase_dot(h["phase"])}</div>' for h in dp["hidden"])
    return f'''{head(ctx, page)}
    <div style="position:absolute;left:0;top:22mm;width:96mm;height:243mm;background:var(--paper-200);border-radius:0 3mm 3mm 0">
      <div class="blob b-earth" style="width:30mm;height:30mm;left:10mm;top:26mm;opacity:.7"></div>
      <div class="blob b-water" style="width:40mm;height:40mm;left:62mm;top:18mm;opacity:.7"></div>
      <div style="position:absolute;left:0;right:0;top:36mm;display:flex;justify-content:center">
        <div style="position:relative;width:64mm;height:64mm;border-radius:50%;background:var(--phase-{dm["phase"]}-field);display:flex;align-items:center;justify-content:center">{ctx.glyph(dm["character"], 54)}</div>
      </div>
      <div style="position:absolute;left:0;right:0;top:110mm;text-align:center">
        <div style="font-family:var(--font-display);font-weight:300;font-size:26pt;letter-spacing:.02em">{t(dm["pinyin"])}</div>
        <div class="label" style="margin-top:3mm;letter-spacing:.3em;color:var(--ink-600)">{t(dm["polarityLabel"])} {t(dm["phaseLabel"])}{SEP}{t(c["dayMasterLabel"])}</div>
      </div>
      <div style="position:absolute;left:12mm;right:12mm;top:146mm">{rows_table(c["rows"])}</div>
    </div>
    <div style="position:absolute;left:108mm;right:20mm;top:22mm;bottom:20mm;display:flex;flex-direction:column">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1 small" style="margin-top:3mm">{t(c["title"])}</div>
      <div class="rule gold" style="margin:6mm 0 7mm"></div>
      <div style="display:flex;gap:4mm;align-items:center">
        {disc(ctx, dp["stem"], 24, 16)}{disc(ctx, dp["branch"], 24, 16)}
        <div>{t(dp["stem"]["pinyin"], "pinyin", "display:block;font-size:11pt")}{t(dp["branch"]["pinyin"], "pinyin", "display:block;font-size:11pt")}<div class="caption">{t(dp["positionLabel"])}</div></div>
      </div>
      <div class="label ink" style="margin:10mm 0 3mm">{t(c["hiddenStemsLabel"])}</div>
      <div>{hidden}<div class="rule"></div></div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 08 wu xing distribution

WX_GEOMETRY = {"ringCx": 85, "ringCy": 80, "ringR": 58, "trackR": 21, "medallion": {"cx": 85, "cy": 88, "d": 44},
               "block": {"w": 36, "dy": 22, "h": 17.8}, "labelGap": 1.0}


def wu_xing(ctx: Context, page: dict, c: dict) -> str:
    g = WX_GEOMETRY
    md = g["medallion"]
    bw, bdy, tr = g["block"]["w"], g["block"]["dy"], g["trackR"]
    order = ["fire", "earth", "metal", "water", "wood"]
    pos = {k: (g["ringCx"] + g["ringR"] * math.cos(math.radians(-90 + i * 72)), g["ringCy"] + g["ringR"] * math.sin(math.radians(-90 + i * 72)))
           for i, k in enumerate(order)}
    by_phase = {w["phase"]: w for w in c["wuXing"]["phases"]}
    discs = ""
    for k in order:
        w = by_phase[k]
        x, y = pos[k]
        r = round(11 + 7 * w["ratio"], 2)
        discs += (f'<div data-wx="track" data-phase="{k}" style="position:absolute;left:{x-tr:.2f}mm;top:{y-tr:.2f}mm;width:{2*tr}mm;height:{2*tr}mm;border-radius:50%;border:0.25mm solid var(--rule-200)"></div>'
                  f'<div data-wx="disc" data-phase="{k}" style="position:absolute;left:{x-r:.2f}mm;top:{y-r:.2f}mm;width:{2*r:.2f}mm;height:{2*r:.2f}mm;border-radius:50%;background:var(--phase-{k}-field);display:flex;align-items:center;justify-content:center">{ctx.glyph(w["character"], 13)}</div>'
                  f'<div data-wx="phase-block" data-phase="{k}" style="position:absolute;left:{x-bw/2:.2f}mm;top:{y+bdy:.2f}mm;width:{bw}mm;text-align:center">'
                  f'<div data-wx="value" class="wx-big">{t(w["valueText"])}</div>'
                  f'<div class="pinyin" style="margin-top:0.5mm;line-height:11pt">{t(w["pinyin"])}</div><div class="label">{t(w["label"])}</div>'
                  f'<div data-wx="bar" style="margin:1.8mm auto 0;width:26mm;height:0.7mm;background:var(--rule-200);border-radius:1mm"><div style="width:{w["ratio"]*100:.1f}%;height:100%;background:var(--phase-{k}-mark);border-radius:1mm"></div></div></div>')
    table = "".join(
        f'<div style="border-top:0.25mm solid var(--rule-200);padding-top:2.5mm;display:flex;align-items:center;gap:2mm">{ctx.glyph(w["character"], 4.5, f"var(--phase-{k}-mark)")}'
        f'<div class="body-small" style="color:var(--ink-900)">{t(w["label"])}{SEP}{t(w["valueText"])}</div></div>'
        for k, w in ((w["phase"], w) for w in c["wuXing"]["phases"]))
    captions = "".join(f'<div>{t(text)}</div>' for text in c["captions"])
    med = c["medallion"]
    return f'''{head(ctx, page)}
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="position:relative;height:168mm;margin-top:8mm">
        <div id="wx-medallion" data-wx="medallion" style="position:absolute;left:{md["cx"]-md["d"]/2:.2f}mm;top:{md["cy"]-md["d"]/2:.2f}mm;width:{md["d"]}mm;height:{md["d"]}mm;border-radius:50%;border:0.25mm solid var(--gold-500);display:flex;align-items:center;justify-content:center">
          <div id="wx-centre-label" data-wx="centre-label" style="display:flex;flex-direction:column;align-items:center;text-align:center">
            <div class="cjk term" style="font-size:14pt;line-height:18pt;letter-spacing:.3em;margin-right:-.3em;color:var(--ink-900)">{t(med["hanzi"])}</div>
            <div class="label" style="margin-top:{g["labelGap"]}mm;letter-spacing:.08em;font-size:8.5pt;max-width:34mm">{t(med["label"])}</div>
          </div>
        </div>
        {discs}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4mm;margin-top:2mm">{table}</div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">{captions}</div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 09 five phases

def five_phases(ctx: Context, page: dict, c: dict) -> str:
    cards = ""
    for p in c["phases"]:
        stems = "".join(ctx.glyph(s["character"], 6.5) for s in p["stems"])
        branches = "".join(ctx.glyph(b["character"], 6.5) for b in p["branches"])
        cards += (f'<div style="text-align:center"><div class="disc f-{p["phase"]}" style="width:30mm;height:30mm;margin:0 auto">{ctx.glyph(p["character"], 19)}</div>'
                  f'<div class="pinyin" style="margin-top:3.5mm;font-size:11pt;font-weight:400">{t(p["pinyin"])}</div><div class="label" style="margin-top:1mm">{t(p["label"])}</div>'
                  f'<div style="margin-top:5mm;border-top:0.25mm solid var(--rule-200);padding-top:3mm"><div class="caption" style="margin-bottom:1.5mm">{t(c["stemsLabel"])}</div>'
                  f'<div class="glyphrow">{stems}</div>'
                  f'<div class="caption" style="margin:3mm 0 1.5mm">{t(c["branchesLabel"])}</div><div class="glyphrow">{branches}</div></div></div>')
    return f'''{head(ctx, page)}
    <div class="blob b-wood" style="width:80mm;height:80mm;left:-30mm;top:40mm;opacity:.25"></div>
    <div class="blob b-fire" style="width:60mm;height:60mm;right:-20mm;top:120mm;opacity:.25"></div>
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4mm;margin-top:24mm">{cards}</div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 10 ten gods

def ten_gods(ctx: Context, page: dict, c: dict) -> str:
    def mark(kind):
        if kind == "stem":
            return '<span style="display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;background:var(--ink-900)"></span>'
        if kind == "hidden":
            return '<span style="display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;border:0.3mm solid var(--ink-600)"></span>'
        return '<span style="display:inline-block;width:2.6mm;height:0.25mm;background:var(--rule-200);vertical-align:middle"></span>'
    rows = "".join(
        f'<tr><td style="width:15mm">{t(r["tenGod"]["hanzi"], "cjk term")}</td><td style="width:22mm">{t(r["tenGod"]["pinyin"], "pinyin")}</td>'
        f'<td class="body-small" style="color:var(--ink-900)">{t(r["tenGod"]["customerLabel"])}</td>'
        + "".join(f'<td style="text-align:center;width:13mm">{mark(m)}</td>' for m in r["marks"]) + "</tr>" for r in c["rows"])
    head_cells = "".join(f'<td style="text-align:center">{t(col)}</td>' for col in c["columns"])
    legend = "".join(f'<div class="i">{mark(l["mark"])} {t(l["label"])}</div>' for l in c["legend"])
    return f'''{head(ctx, page)}
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <table class="tg" style="margin-top:12mm">
        <thead><tr class="label"><td></td><td></td><td>{t(c["relationHeader"])}</td>{head_cells}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div class="legend" style="margin-top:7mm">{legend}</div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ 11 hidden stems

def hidden_stems(ctx: Context, page: dict, c: dict) -> str:
    rows = ""
    for r in c["rows"]:
        b = r["branch"]
        hs = "".join(
            f'<div class="hrow">{disc(ctx, h, 11, 8)}'
            f'<div>{t(h["pinyin"], "pinyin", "display:block")}{t(h["qiLabel"], "caption")}</div>'
            f'<div>{t(h["tenGod"]["hanzi"], "cjk", "font-size:10pt;color:var(--ink-900)")} {t(h["tenGod"]["pinyin"], "caption")}</div>'
            f'<div class="caption" style="color:var(--ink-600)">{phase_dot(h["phase"])}{t(h["phaseLabel"])}</div></div>' for h in r["hidden"])
        rows += (f'<div class="brow"><div style="display:flex;align-items:center;gap:3mm">{disc(ctx, b, 20, 14)}'
                 f'<div>{t(r["positionLabel"], "label", "display:block")}{t(c["branchLabel"], "label", "display:block")}'
                 f'{t(b["pinyin"], "pinyin", "display:block;font-size:11pt;margin-top:1mm")}'
                 f'<div class="caption">{t(b["phaseLabel"])}{SEP}{t(b["animalLabel"])}</div></div></div>'
                 f'<div>{hs}</div></div>')
    return f'''{head(ctx, page)}
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="margin-top:12mm">{rows}<div class="rule"></div></div>
    </div>{foot(page)}'''


# ------------------------------------------------------------------ long form

LONG_STYLE_CSS = {
    "kicker": "font-family:var(--font-sans);font-size:9pt;font-weight:500;letter-spacing:.16em;color:var(--gold-700)",
    "sectionTitle": "font-family:var(--font-display);font-size:26pt;font-weight:300;letter-spacing:-.015em;color:var(--ink-900)",
    "standfirst": "font-family:var(--font-sans);font-size:12.5pt;font-weight:400;color:var(--ink-600)",
    "subhead": "font-family:var(--font-sans);font-size:13pt;font-weight:500;letter-spacing:-.005em;color:var(--ink-900)",
    "body": "font-family:var(--font-sans);font-size:10.5pt;font-weight:400;color:var(--ink-600)",
    "pullQuote": "font-family:var(--font-display);font-size:15pt;font-weight:300;letter-spacing:-.01em;color:var(--ink-900)",
    "panelTitle": "font-family:var(--font-sans);font-size:9pt;font-weight:500;letter-spacing:.16em;color:var(--gold-500)",
    "panelBody": "font-family:var(--font-sans);font-size:9.5pt;font-weight:400;color:var(--paper-100)",
}


def line_html(ctx: Context, text: str, style_id: str, x_cp: int, baseline_cp: int, measure_cp: int) -> str:
    top = baseline_cp - ctx.styles[style_id]["ascentCp"]
    return (f'<div class="longline" data-measure-cp="{measure_cp}" style="left:{mm(x_cp)};top:{mm(top)};line-height:1;{LONG_STYLE_CSS[style_id]}">'
            f'{esc(text)}</div>')


def reference_block(ctx: Context, ref: dict, wide: bool) -> str:
    dm = ref["dayMaster"]
    terms = "".join(
        f'<div class="refterm">{t(term["label"], "pinyin", "color:var(--ink-900)")} {t(term["hanzi"], "cjk muted", "font-weight:400")}</div>' for term in ref["terms"])
    grid = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm 8mm" if wide else ""
    return (f'<div style="display:flex;gap:3mm;align-items:center;margin-bottom:{5 if wide else 0}mm">'
            f'<div class="disc f-{dm["phase"]}" style="width:14mm;height:14mm;flex:none">{ctx.glyph(dm["character"], 9.5)}</div>'
            f'<div>{t(ref["label"], "label gold", "display:block")}<div class="body-small" style="color:var(--ink-900);margin-top:1mm">{t(ref["dayMasterLabel"])}{SEP}{t(dm["pinyin"])}{SEP}{t(dm["polarityLabel"])} {t(dm["phaseLabel"])}</div></div></div>'
            f'<div class="label" style="margin:{3 if wide else 7}mm 0 2mm">{t(ref["termsLabel"])}</div><div style="{grid}">{terms}</div>')


def long_form(ctx: Context, page: dict, c: dict) -> str:
    parts = []
    for line in c["headerLines"]:
        parts.append(line_html(ctx, line["text"], line["styleId"], line["xCp"], line["baselineCp"], ctx.content_w_cp))
    if c["runningKicker"] is not None:
        parts.append(f'<div class="kicker" style="position:absolute;left:20mm;top:22mm">{t(c["runningKicker"])}</div>')
    for f in c["fragments"]:
        if f["kind"] == "keyInsight":
            bx = f["boxCp"]
            parts.append(f'<div style="position:absolute;left:{mm(bx["xCp"])};top:{mm(bx["yCp"])};width:{mm(bx["widthCp"])};height:{mm(bx["heightCp"])};background:var(--ink-900);border-radius:var(--radius-panel)"></div>')
        elif f["kind"] == "pullQuote":
            bx = f["boxCp"]
            parts.append(f'<div style="position:absolute;left:{mm(bx["xCp"])};top:{mm(bx["yCp"])};width:{mm(bx["widthCp"])};height:0.25mm;background:var(--gold-500)"></div>')
            parts.append(f'<div style="position:absolute;left:{mm(bx["xCp"])};top:{mm(bx["yCp"] + bx["heightCp"] - 25)};width:{mm(bx["widthCp"])};height:0.25mm;background:var(--gold-500)"></div>')
        for line in f["lines"]:
            parts.append(line_html(ctx, line["text"], line.get("styleId", f["styleId"]), line["xCp"], line["baselineCp"], f["widthCp"]))
    if c["sidebar"] is not None:
        sb = c["sidebar"]
        parts.append(f'<div class="panel" style="position:absolute;left:{mm(sb["xCp"])};top:{mm(sb["yCp"])};width:{mm(sb["widthCp"])};padding:3.5mm">{reference_block(ctx, sb, False)}</div>')
    if c["referencePanel"] is not None:
        rp = c["referencePanel"]
        parts.append(f'<div class="panel recessed" style="position:absolute;left:{mm(rp["xCp"])};top:{mm(rp["yCp"])};width:{mm(rp["widthCp"])};padding:6mm">{reference_block(ctx, rp, True)}</div>')
    return head(ctx, page) + "".join(parts) + foot(page)


# ------------------------------------------------------------------ reflection / summary / closing / method

def reflection(ctx: Context, page: dict, c: dict) -> str:
    eight = "".join(
        f'<div style="display:flex;flex-direction:column;align-items:center;gap:2mm">{ctx.glyph(p["stem"]["character"], 13)}{ctx.glyph(p["branch"]["character"], 13)}'
        f'<div class="label" style="margin-top:1mm">{t(p["positionLabel"])}</div></div>' for p in c["characters"])
    questions = "".join(
        f'<div class="qrow">{t(q["number"], "label gold")}<div class="body" style="font-size:11.5pt;line-height:16pt;color:var(--ink-900)">{t(q["text"])}</div></div>'
        for q in c["questions"])
    return f'''{head(ctx, page)}
    <div class="blob b-metal" style="width:110mm;height:110mm;right:-40mm;top:30mm;opacity:.35"></div>
    <div class="blob b-earth" style="width:40mm;height:40mm;right:26mm;top:22mm;opacity:.4"></div>
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:3mm">{t(c["title"])}</div>
      <div class="label ink" style="margin-top:12mm">{t(c["charactersLabel"])}</div>
      <div style="display:flex;gap:12mm;margin-top:4mm;padding:7mm 10mm;background:var(--paper-100);border-radius:var(--radius-panel);width:max-content">{eight}</div>
      <div style="margin-top:12mm;max-width:155mm">{questions}<div class="rule"></div></div>
    </div>{foot(page)}'''


def summary(ctx: Context, page: dict, c: dict) -> str:
    dm = c["dayMaster"]
    return f'''{head(ctx, page)}
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1 small" style="margin-top:3mm">{t(c["title"])}</div>
      <div style="display:grid;grid-template-columns:1fr 64mm;gap:12mm;margin-top:12mm;align-items:start">
        {rows_table(c["rows"])}
        <div class="panel recessed" style="display:flex;flex-direction:column;align-items:center;padding:8mm 5mm">
          <div class="disc f-{dm["phase"]}" style="width:40mm;height:40mm">{ctx.glyph(dm["character"], 28)}</div>
          <div class="pinyin" style="margin-top:4mm;font-size:12pt;font-weight:400">{t(dm["pinyin"])}</div>
          <div class="label" style="margin-top:1mm">{t(c["dayMasterLabel"])}</div>
        </div>
      </div>
    </div>{foot(page)}'''


def closing(ctx: Context, page: dict, c: dict) -> str:
    return f'''
    <div class="blob b-water" style="width:120mm;height:120mm;left:-30mm;top:120mm;opacity:.5"></div>
    <div class="blob b-earth" style="width:60mm;height:60mm;left:120mm;top:60mm;opacity:.5"></div>
    <div class="blob b-metal" style="width:90mm;height:90mm;left:110mm;top:170mm;opacity:.5"></div>
    <div style="position:absolute;left:16mm;top:16mm;height:3mm;color:var(--ink-900)">{ctx.wordmark(3)}</div>
    <div style="position:absolute;left:20mm;right:20mm;top:88mm">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1" style="margin-top:4mm;max-width:150mm">{t(c["title"])}</div>
      <div class="rule gold" style="margin:10mm 0 5mm;max-width:130mm"></div>
      <div class="body" style="max-width:130mm">{t(c["preparedFor"])} {t(c["displayName"], "", "color:var(--ink-900);font-weight:500")}</div>
    </div>
    <div style="position:absolute;left:20mm;right:20mm;bottom:16mm;display:flex;justify-content:space-between;align-items:flex-end">
      <div><div style="height:3.4mm;color:var(--ink-900)">{ctx.wordmark(3.4)}</div><div class="label" style="margin-top:2mm">{t(c["product"])}</div></div>
      <div class="label gold">{t(page["pageLabel"])}</div>
    </div>'''


def method_note(ctx: Context, page: dict, c: dict) -> str:
    paragraphs = "".join(f'<p>{t(p)}</p>' for p in c["paragraphs"])
    return f'''{head(ctx, page)}
    <div class="content">
      <div class="kicker">{t(c["kicker"])}</div>
      <div class="h1 small" style="margin-top:3mm">{t(c["title"])}</div>
      <div class="body" style="margin-top:10mm;max-width:130mm">{paragraphs}</div>
    </div>{foot(page)}'''


BUILDERS = {
    "cover": cover, "identity": identity, "contents": contents, "glance": glance, "fourPillars": four_pillars,
    "foundation": foundation, "dayMaster": day_master, "wuXing": wu_xing, "fivePhases": five_phases,
    "tenGods": ten_gods, "hiddenStems": hidden_stems, "longForm": long_form, "reflection": reflection,
    "summary": summary, "closing": closing, "methodNote": method_note,
}


def page_html(ctx: Context, page: dict) -> str:
    content = page["content"]
    builder = BUILDERS.get(content["kind"])
    if builder is None:
        raise ValueError(f"UNKNOWN_PAGE_KIND {content['kind']!r}")
    inner = builder(ctx, page, content)
    return (f'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>{esc(page["pageId"])}</title>'
            f'<style>{ctx.tokens_css}\n{ctx.base_css}</style></head><body>{ctx.sprite}'
            f'<div class="sheet" data-page="{esc(page["pageId"])}">{inner}</div></body></html>')
