"""Customer page family — V4 visual shell, V3 information architecture, V5 tokens, V6 bindings.
Every page returns (page_id, page_number, html, structure)."""
from __future__ import annotations
import json, math, pathlib
import shell as S
from shell import glyph, py, esc, head, foot, wrap_page, component, begin, FIX, PHASES, PHASE_INFO, POL, WORDMARK

DM = FIX["dayMaster"]; P = FIX["pillars"]; NAME = FIX["customer"]["displayName"]

# ------------------------------------------------------------------ 01 COVER (donor V4 agent-x-etbz-4.png)
def cover():
    st = begin("cover", "customer", 1, "cover", {"primary": "V4 agent-x-etbz-4.png", "secondary": ["V6 wordmark contract", "V1 whitespace"]},
               [{"slotId": "cover.primaryGlyph", "consumedFactKinds": ["day_master_stem"], "fixture": FIX["fixtureId"]}])
    component("cover.atmosphere", kind="decorative", binds=None, forms=5)
    component("cover.primaryGlyph", kind="displayGlyph", ch=DM["ch"], fullyVisible=True)
    component("cover.wordmark", kind="staticBrand", asset="assets/wordmark.svg", chartIndependent=True)
    blobs = (
        '<div class="blob b-metal" style="width:138mm;height:138mm;left:76mm;top:38mm;opacity:.55"></div>'
        '<div class="blob b-water" style="width:88mm;height:88mm;left:21mm;top:110mm;opacity:.55"></div>'
        '<div class="blob b-fire" style="width:66mm;height:66mm;left:138mm;top:148mm;opacity:.5"></div>'
        '<div class="blob b-earth" style="width:48mm;height:48mm;left:34mm;top:60mm;opacity:.6"></div>'
        '<div class="blob b-wood" style="width:37mm;height:37mm;left:159mm;top:47mm;opacity:.55"></div>')
    inner = f'''
    {blobs}
    <div style="position:absolute;left:16mm;top:16mm;height:3mm;color:var(--ink-900)">{WORDMARK.replace('<svg ', '<svg style="height:3mm;width:auto" ')}</div>
    <div style="position:absolute;left:0;right:0;top:66mm;text-align:center">
      <div style="display:flex;justify-content:center">{glyph(DM["ch"], 82)}</div>
      <div class="label" style="margin-top:6mm;letter-spacing:.3em;color:var(--ink-600)">Day Master · <span style="color:var(--ink-900)">{py(DM["ch"])}</span> · {POL[DM["polarity"]]} {PHASE_INFO[DM["phase"]]["en"]}</div>
    </div>
    <div style="position:absolute;left:16mm;right:16mm;bottom:38mm;height:0.25mm;background:var(--gold-500)"></div>
    <div style="position:absolute;left:16mm;right:16mm;bottom:48mm">
      <div class="label ink" style="letter-spacing:.42em;margin-bottom:5mm">Bazodiac</div>
      <div class="h1" style="font-size:36pt;line-height:37pt;margin-bottom:7mm">Personalized<br>BaZi Reading</div>
      <div class="label" style="margin-bottom:1.5mm">Prepared for</div>
      <div style="font-size:22pt;font-weight:500;letter-spacing:-.01em">{esc(NAME)}</div>
    </div>
    <div style="position:absolute;left:16mm;right:16mm;bottom:16mm;display:flex;justify-content:space-between" class="label">
      <div>{FIX["customer"]["edition"]} · <span class="cjk" style="text-transform:none;letter-spacing:.1em">四柱</span> Sìzhù</div><div class="gold">{FIX["customer"]["documentNumber"]}</div>
    </div>'''
    return "01-cover", 1, wrap_page("Cover", inner), st

# ------------------------------------------------------------------ 02 IDENTITY / DOCUMENT NOTE (donor V3 identity, restyled V4)
def identity():
    st = begin("identity", "customer", 2, "front-matter", {"primary": "V3 identity page (contact sheet, page 02)", "secondary": ["V4 shell", "V5 customer copy boundary"]},
               [{"slotId": "identity.parameters", "consumedFactKinds": ["chart_parameters"], "fixture": FIX["fixtureId"]}])
    prm = FIX["parameters"]
    rows = "".join(f"<tr><td>{esc(k)}</td><td>{v}</td></tr>" for k, v in [
        ("Prepared for", esc(NAME)), ("Chart basis", prm["chartBasis"].replace("四柱", '<span class="cjk">四柱</span>')),
        ("Day boundary", prm["dayBoundary"]), ("Hour pillar", prm["hourPillar"]), ("Script", prm["scriptPolicy"]),
        ("Birth data", prm["birthData"]), ("Chart values", prm["source"]), ("Edition", f'{FIX["customer"]["edition"]} · {FIX["customer"]["documentNumber"]}')])
    component("identity.parameters", kind="factsTable", rows=8)
    inner = f'''{head(2)}
    <div class="blob b-earth" style="width:70mm;height:70mm;right:-22mm;top:-18mm;opacity:.35"></div>
    <div class="content">
      <div class="kicker">This document</div>
      <div class="h1 small" style="margin-top:3mm;max-width:120mm">One chart, read in two kinds of writing</div>
      <div class="standfirst" style="margin-top:6mm;max-width:126mm">Everything in this reading is either a fact of your chart or general education about the classical system. Each page says which.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:14mm">
        <div>
          <div class="label ink" style="margin-bottom:3mm"><span class="tag you">Your chart</span></div>
          <div class="body">Pages carrying this mark show values supplied for your chart: the eight characters, their phases, the Hidden Stems, the Ten Gods relations and the Wu Xing tally. They are printed as supplied and are the same wherever they recur in this document.</div>
          <div class="label ink" style="margin:9mm 0 3mm"><span class="tag gen">General education</span></div>
          <div class="body">Pages carrying this mark explain the classical system itself. They are identical in every copy of this edition and are not based on your chart.</div>
        </div>
        <div>
          <table class="facts">{rows}</table>
          <div class="caption" style="margin-top:4mm">Chinese characters are set as real, complete text. Pinyin carries tone marks. A Branch is never replaced by its animal.</div>
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0" >
        <div class="rule gold" style="margin-bottom:5mm"></div>
        <div class="body-small" style="max-width:130mm">Bazodiac is positioned as entertainment and reflection. It makes no predictive, medical, financial or legal claims. A chart is a structure, not an instruction.</div>
      </div>
    </div>{foot(2)}'''
    return "02-identity", 2, wrap_page("This document", inner), st

# ------------------------------------------------------------------ 03 CONTENTS (donor V3)
CONTENTS = [
    ("A", "Front matter", [(1, "Cover", None), (2, "This document", None), (3, "Contents", None)]),
    ("B", "Chart foundation", [(4, "Your chart at a glance", "一"), (5, "Your Four Pillars", "四"), (6, "Reading the pillars", "柱"),
                               (7, "Your Day Master", "日"), (8, "Your Wu Xing distribution", "五"), (9, "The Five Phases", "行"),
                               (10, "Ten Gods overview", "神"), (11, "Hidden Stems", "藏")]),
    ("C", "Interpretation", [(12, "How to read this reading", None), (15, "The Day Master in its pillar", None), (17, "Year and month · the outer stems", None),
                             (19, "Branches and their Hidden Stems", None), (21, "The Ten Gods present in your chart", None),
                             (23, "Wu Xing · the tally read", None), (25, "The hour pillar", None)]),
    ("D", "Reflection & closure", [(27, "Bringing it together", None), (28, "Your chart, in summary", None), (29, "Closing", None), (30, "Method note & glossary", None)]),
]
def contents():
    st = begin("contents", "customer", 3, "front-matter", {"primary": "V3 Contents (contact sheet, page 03)", "secondary": ["V4 shell/type", "V5 tokens"]},
               [{"slotId": "contents.entries", "consumedFactKinds": [], "derivedNothing": True}])
    component("contents.structure", kind="toc", sections=[s[0] for s in CONTENTS], pages=30, luckPillars=False)
    cols = []
    for letter, title, entries in CONTENTS:
        rows = "".join(
            f'<div style="display:flex;align-items:baseline;gap:3mm;padding:2.2mm 0;border-top:0.25mm solid var(--rule-200)">'
            f'<span class="label gold" style="width:8mm">{n:02d}</span><span class="body" style="color:var(--ink-900);flex:1">{esc(t)}</span>'
            f'<span class="cjk" style="font-size:10pt;color:var(--ink-400)">{c or ""}</span></div>' for n, t, c in entries)
        first, last = entries[0][0], entries[-1][0]
        cols.append(f'<div><div class="kicker" style="display:flex;justify-content:space-between"><span>{letter} · {esc(title)}</span><span class="muted">{first:02d}–{last:02d}</span></div><div style="margin-top:3mm">{rows}</div></div>')
    inner = f'''{head(3)}
    <div class="blob b-water" style="width:60mm;height:60mm;left:-24mm;bottom:20mm;opacity:.3"></div>
    <div class="content">
      <div class="kicker">The reading</div>
      <div class="h1" style="margin-top:3mm">Contents</div>
      <div class="label" style="margin-top:4mm">Thirty pages · four sections</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12mm 14mm;margin-top:12mm">{"".join(cols)}</div>
      <div style="position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm">
        <div class="panel"><div class="label gold" style="margin-bottom:2mm">Section B</div><div class="body-small">The technical chart: what the eight characters are, one item per page, values as supplied.</div></div>
        <div class="panel"><div class="label gold" style="margin-bottom:2mm">Section C</div><div class="body-small">Interpretive chapters. Each names the part of the chart it reads and stays within it.</div></div>
        <div class="panel"><div class="label gold" style="margin-bottom:2mm">Section D</div><div class="body-small">Reflection, a one-page summary, the closing note and the method conventions used.</div></div>
      </div>
    </div>{foot(3)}'''
    return "03-contents", 3, wrap_page("Contents", inner), st

# ------------------------------------------------------------------ 04 CHART AT A GLANCE (donor V3)
def glance():
    st = begin("glance", "customer", 4, "chart-foundation", {"primary": "V3 Chart at a Glance (contact sheet, page 04)", "secondary": ["V4 colour/glyph system", "V6 fact bindings"]},
               [{"slotId": "glance.dayMaster", "consumedFactKinds": ["day_master_stem", "stem_phase", "stem_polarity"], "fixture": FIX["fixtureId"]},
                {"slotId": "glance.pillars", "consumedFactKinds": ["pillar_stem", "pillar_branch"], "fixture": FIX["fixtureId"]},
                {"slotId": "glance.wuXing", "consumedFactKinds": ["wu_xing_vector"], "fixture": FIX["fixtureId"], "presentationTransform": None}])
    ph = DM["phase"]
    component("glance.dayMasterStage", kind="displayGlyph", ch=DM["ch"], halo=f"phase-{ph}-field", region="stem")
    pil = "".join(
        f'<div style="text-align:center"><div class="label" style="margin-bottom:2mm">{p["label"]}</div>'
        f'<div style="display:flex;flex-direction:column;align-items:center;gap:1mm">{glyph(p["stem"]["ch"], 11)}{glyph(p["branch"]["ch"], 11)}</div>'
        f'<div class="pinyin" style="margin-top:2mm;color:var(--ink-600)">{py(p["stem"]["ch"])} {py(p["branch"]["ch"])}</div></div>' for p in P)
    wx = FIX["wuXing"]["vector"]
    tally = "".join(
        f'<div style="text-align:center"><div style="display:flex;justify-content:center">{glyph(PHASE_INFO[k]["ch"], 8, color=f"var(--phase-{k}-mark)")}</div>'
        f'<div style="font-size:14pt;font-weight:300;margin-top:1.5mm;font-family:var(--font-display)">{wx[k]:.1f}</div><div class="label">{PHASE_INFO[k]["en"]}</div></div>' for k in PHASES)
    component("glance.pillars", kind="pillarStrip", pillars=[(p["stem"]["ch"], p["branch"]["ch"]) for p in P])
    component("glance.wuXingTally", kind="valueStrip", values=wx, transform=None)
    prm = FIX["parameters"]
    inner = f'''{head(4, "you")}
    <div class="content">
      <div class="kicker">Chapter 01 · Your chart at a glance</div>
      <div class="h1" style="margin-top:3mm">Your chart at a glance</div>
      <div class="standfirst" style="margin-top:5mm;max-width:130mm">Everything the following pages unfold, on one spread. Each value here is supplied by the chart engine and repeated — never recalculated — on its own page later in the report.</div>
      <div style="display:grid;grid-template-columns:64mm 1fr;gap:10mm;margin-top:12mm;align-items:start">
        <div class="panel recessed" style="height:96mm;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="position:absolute;width:52mm;height:52mm;border-radius:50%;background:var(--phase-{ph}-field);top:12mm"></div>
          <div style="position:relative">{glyph(DM["ch"], 44)}</div>
          <div class="pinyin" style="position:relative;margin-top:4mm;font-size:12pt;font-weight:400">{py(DM["ch"])}</div>
          <div class="label" style="position:relative;margin-top:1.5mm">{S.phase_dot(ph)}{POL[DM["polarity"]]} {PHASE_INFO[ph]["en"]} · Day Master</div>
        </div>
        <div>
          <div class="label ink" style="margin-bottom:4mm">Your Four Pillars <span class="cjk muted" style="text-transform:none;letter-spacing:.1em;margin-left:2mm">四柱</span></div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;background:var(--paper-100);border-radius:var(--radius-panel);padding:5mm 4mm">{pil}</div>
          <div class="label ink" style="margin:8mm 0 3mm">Wu Xing distribution <span class="cjk muted" style="text-transform:none;letter-spacing:.1em;margin-left:2mm">五行</span></div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2mm">{tally}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:64mm 1fr;gap:10mm;margin-top:10mm">
        <table class="facts">
          <tr><td>Day boundary</td><td>{prm["dayBoundary"]}</td></tr><tr><td>Hour pillar</td><td>{prm["hourPillar"]}</td></tr>
          <tr><td>Script</td><td>{prm["scriptPolicy"]}</td></tr><tr><td>Source</td><td>{prm["source"]}</td></tr>
        </table>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
          <div><div class="label gold" style="margin-bottom:2.5mm">What this report gives you</div><div class="body-small">Your eight chart characters, in full · The Ten Gods relations named against your Day Master · The Hidden Stems your Branches carry · Your supplied Wu Xing tally · Long-form interpretation from the approved content layer</div></div>
          <div><div class="label gold" style="margin-bottom:2.5mm">What it deliberately leaves out</div><div class="body-small">Day Master strength and rooting · A nominated favourable element · Predictive statements about events · Luck pillars, annual transits, lucky numbers, colours or directions · Any remedy or health correspondence</div></div>
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">Every character on this page is supplied for your chart and repeats unchanged on its own page. Nothing here is derived, ranked or weighted by the report.</div>
    </div>{foot(4)}'''
    return "04-glance", 4, wrap_page("Your chart at a glance", inner), st

# ------------------------------------------------------------------ 05 FOUR PILLARS (donor V4 agent-x-etbz-5.png · guards V5/V6)
def four_pillars():
    st = begin("four-pillars", "customer", 5, "chart-foundation", {"primary": "V4 agent-x-etbz-5.png", "secondary": ["V6 region-scoped colour guard", "V5 neutral pillar ground + gold selection"]},
               [{"slotId": "pillars.stem[*]", "consumedFactKinds": ["pillar_stem", "stem_phase", "stem_polarity"], "fixture": FIX["fixtureId"]},
                {"slotId": "pillars.branch[*]", "consumedFactKinds": ["pillar_branch", "branch_phase", "branch_animal_label"], "fixture": FIX["fixtureId"]},
                {"slotId": "pillars.hidden[*]", "consumedFactKinds": ["hidden_stem", "hidden_stem_phase", "hidden_stem_qi_role"], "fixture": FIX["fixtureId"]},
                {"slotId": "pillars.tenGod[*]", "consumedFactKinds": ["ten_god_relation"], "fixture": FIX["fixtureId"]}])
    cols = []
    for p in P:
        day = p["position"] == "day"
        sp, bp = p["stem"]["phase"], p["branch"]["phase"]
        component(f"pillar.{p['position']}", kind="pillar", container="neutral", stemRegion=f"phase-{sp}", branchRegion=f"phase-{bp}",
                  hiddenRegions=[f"phase-{h['phase']}" for h in p["hidden"]], selected=day, selectionStyle="gold-edge" if day else None, wholeColumnTint=False)
        hs = "".join(
            f'<div class="f-{h["phase"]}" style="flex:1;text-align:center;padding:2.4mm 0 2mm;border-radius:1mm">'
            f'<div style="display:flex;justify-content:center">{glyph(h["ch"], 7.5)}</div>'
            f'<div class="pinyin" style="margin-top:1.2mm;color:var(--ink-600)">{py(h["ch"])}</div></div>' for h in p["hidden"])
        cols.append(f'''<div style="background:{'var(--paper-200)' if day else 'var(--paper-100)'};border-radius:var(--radius-panel);padding:4mm 3mm;{'outline:0.35mm solid var(--gold-500);outline-offset:1.2mm;' if day else ''}">
          <div class="label ink" style="display:flex;justify-content:space-between;{'color:var(--gold-700)' if day else ''}"><span>{p["label"]}</span><span class="cjk muted" style="text-transform:none;letter-spacing:.1em">{p["cjk"]}</span></div>
          <div style="border-top:0.25mm solid var(--rule-200);margin-top:3mm;padding-top:3mm;display:flex;align-items:center;gap:2.5mm">
            <div style="width:19mm;height:19mm;border-radius:50%;background:var(--phase-{sp}-field);display:flex;align-items:center;justify-content:center;flex:none">{glyph(p["stem"]["ch"], 13.5)}</div>
            <div class="body-small" style="line-height:12pt"><span class="pinyin" style="display:block">{py(p["stem"]["ch"])}</span>{POL[p["stem"]["polarity"]]}<br>{PHASE_INFO[sp]["en"]}{'<br><span class="label gold" style="font-size:9pt;letter-spacing:.1em">Day Master</span>' if day else ''}</div>
          </div>
          <div style="border-top:0.25mm solid var(--rule-200);margin-top:3mm;padding-top:3mm;display:flex;align-items:center;gap:2.5mm">
            <div style="width:19mm;height:19mm;border-radius:50%;background:var(--phase-{bp}-field);display:flex;align-items:center;justify-content:center;flex:none">{glyph(p["branch"]["ch"], 13.5)}</div>
            <div class="body-small" style="line-height:12pt"><span class="pinyin" style="display:block">{py(p["branch"]["ch"])}</span>{PHASE_INFO[bp]["en"]}<br><span class="muted">{p["branch"]["animal"]}</span></div>
          </div>
          <div style="border-top:0.25mm solid var(--rule-200);margin-top:3mm;padding-top:3mm;display:flex;gap:1.5mm">{hs}</div>
          <div style="border-top:0.25mm solid var(--rule-200);margin-top:3mm;padding-top:3mm">
            <div class="h2" style="font-size:10.5pt;line-height:13pt;{'color:var(--gold-700)' if day else ''}">{p["tenGod"]["en"]}</div>
            <div class="body-small" style="color:var(--ink-400);margin-top:0.5mm">{p["tenGod"]["py"]}<br><span class="cjk" style="color:var(--ink-600)">{p["tenGod"]["cjk"]}</span></div>
          </div></div>''')
    rowlabels = ''.join(f'<div class="label" style="height:{h}mm;padding-top:{pt}mm">{t}</div>' for t, h, pt in
                        [("&nbsp;", 8.5, 0), ("Heavenly<br>Stem<br><span class='cjk' style='text-transform:none;letter-spacing:0'>天干</span>", 25.5, 5), ("Earthly<br>Branch<br><span class='cjk' style='text-transform:none;letter-spacing:0'>地支</span>", 25.5, 4), ("Hidden<br>Stems<br><span class='cjk' style='text-transform:none;letter-spacing:0'>藏干</span>", 21, 4), ("Ten<br>God<br><span class='cjk' style='text-transform:none;letter-spacing:0'>十神</span>", 20, 4)])
    legend = "".join(f'<div class="i"><span class="dot m-{k}"></span>{PHASE_INFO[k]["en"]} <span class="cjk">{PHASE_INFO[k]["ch"]}</span></div>' for k in PHASES)
    inner = f'''{head(5, "you")}
    <div class="blob b-fire" style="width:95mm;height:95mm;right:-32mm;top:-28mm;opacity:.28"></div>
    <div class="blob b-water" style="width:70mm;height:70mm;left:-30mm;bottom:14mm;opacity:.3"></div>
    <div class="content">
      <div class="kicker">Chapter 02 · The Four Pillars</div>
      <div class="h1" style="margin-top:3mm">Your Four Pillars</div>
      <div class="body" style="margin-top:4mm;max-width:118mm">Eight characters — four Heavenly Stems above four Earthly Branches. Read from left to right: Year, Month, Day, Hour. The Day Stem is your Day Master.</div>
      <div style="display:grid;grid-template-columns:17mm repeat(4,1fr);gap:0 3mm;margin-top:9mm;align-items:start">
        <div>{rowlabels}</div>{"".join(cols)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:7mm">
        <div class="panel"><div class="label" style="margin-bottom:2mm">Reading key · Stem</div><div class="body-small">The visible upper character of a pillar. Each stem carries a phase and a Yin or Yang polarity.</div></div>
        <div class="panel"><div class="label" style="margin-bottom:2mm">Reading key · Branch</div><div class="body-small">The lower character. A branch holds one to three Hidden Stems, listed by Qi order.</div></div>
        <div class="panel"><div class="label" style="margin-bottom:2mm">Reading key · Ten Gods</div><div class="body-small">Each visible stem's classical relation to your Day Master. The Hidden Stems' relations follow on page 11.</div></div>
      </div>
      <div class="legend" style="margin-top:6mm">{legend}</div>
      <div class="caption" style="margin-top:3mm;max-width:150mm">Chart values are supplied by the validated chart engine. Hidden Stems are listed in Qi order: principal, central, residual. Animal names are associations of the Earthly Branch, not a replacement for it. Colour marks one character at a time; the Day pillar's gold edge is a selection, not a phase.</div>
    </div>{foot(5)}'''
    return "05-four-pillars", 5, wrap_page("Your Four Pillars", inner), st

# ------------------------------------------------------------------ 06 READING THE PILLARS (chart foundation, donor V3 IA + V4 shell)
def foundation():
    st = begin("foundation", "customer", 6, "chart-foundation", {"primary": "V3 page-family architecture (chart foundation)", "secondary": ["V4 shell", "V2 column rhythm"]},
               [{"slotId": "foundation.eight", "consumedFactKinds": ["pillar_stem", "pillar_branch", "stem_polarity", "stem_phase", "branch_phase"], "fixture": FIX["fixtureId"]}])
    component("foundation.eightCharacters", kind="factList", count=8)
    rows = ""
    for p in P:
        for role, c in (("Stem", p["stem"]), ("Branch", p["branch"])):
            ph = c["phase"]
            pol = f' · {POL[c["polarity"]]}' if role == "Stem" else f' · {c["animal"]}'
            rows += (f'<div style="display:flex;align-items:center;gap:3mm;padding:1.8mm 0;border-top:0.25mm solid var(--rule-200)">'
                     f'<div style="width:11mm;height:11mm;border-radius:50%;background:var(--phase-{ph}-field);display:flex;align-items:center;justify-content:center;flex:none">{glyph(c["ch"], 7.5)}</div>'
                     f'<div style="flex:1"><div class="pinyin">{py(c["ch"])}</div><div class="caption">{p["label"]} {role.lower()} · {PHASE_INFO[ph]["en"]}{pol}</div></div>'
                     f'{S.phase_dot(ph)}</div>')
    inner = f'''{head(6, "you")}
    <div class="content">
      <div class="kicker">Chapter 02 · The Four Pillars · continued</div>
      <div class="h1 small" style="margin-top:3mm">Reading the pillars</div>
      <div style="display:grid;grid-template-columns:1fr 66mm;gap:12mm;margin-top:8mm">
        <div class="body">
          <p>Each pillar is a pair: a Heavenly Stem above, an Earthly Branch below. The four pairs are read from left to right as Year, Month, Day and Hour. The pairing is fixed by the calendar; nothing in this report rearranges it.</p>
          <p><b style="font-weight:500;color:var(--ink-900)">Heavenly Stems</b> <span class="cjk">天干</span> are ten characters. Each carries one of the Five Phases and a polarity, Yang or Yin, in strict alternation. Your chart shows four of the ten, one per pillar.</p>
          <p><b style="font-weight:500;color:var(--ink-900)">Earthly Branches</b> <span class="cjk">地支</span> are twelve characters. Each also carries a phase, and each traditionally travels with an animal. The animal is a label for the Branch, never the Branch itself, which is why every Branch here is printed as its character.</p>
          <p><b style="font-weight:500;color:var(--ink-900)">Hidden Stems</b> <span class="cjk">藏干</span> are the Stems a Branch is said to contain, listed in Qi order: principal first, then central, then residual where present. They are supplied with your chart and are laid out on page 11.</p>
          <p><b style="font-weight:500;color:var(--ink-900)">The Day Master</b> <span class="cjk">日主</span> is the Stem of the Day pillar. Every other Stem in the chart, visible or hidden, is named by its relation to this one character. Those names are the Ten Gods, introduced on page 10.</p>
        </div>
        <div>
          <div class="label ink" style="margin-bottom:3mm">Your eight characters</div>
          {rows}
          <div class="rule" style="margin-top:0"></div>
          <div class="caption" style="margin-top:3mm">Order: Year, Month, Day, Hour; Stem above Branch. Colour marks the phase of one character at a time.</div>
        </div>
      </div>
      <div style="margin-top:14mm;max-width:150mm" class="panel dark" >
        <div class="label" style="margin-bottom:2mm">Good to know</div>
        <div class="body-small">A pillar is not a unit of colour. Its Stem and its Branch usually belong to different phases, so this report never tints a whole column. Where a phase is shown, it belongs to exactly the character beside it.</div>
      </div>
    </div>{foot(6)}'''
    return "06-foundation", 6, wrap_page("Reading the pillars", inner), st

# ------------------------------------------------------------------ 07 DAY MASTER (donor V4 agent-x-etbz-6.png)
def day_master():
    st = begin("day-master", "customer", 7, "chart-foundation", {"primary": "V4 agent-x-etbz-6.png", "secondary": ["V6 deterministic glyph placement", "V5 customer/evidence boundary"]},
               [{"slotId": "dayMaster.hero", "consumedFactKinds": ["day_master_stem", "stem_phase", "stem_polarity", "day_pillar"], "fixture": FIX["fixtureId"]},
                {"slotId": "dayMaster.reading", "consumedFactKinds": ["approved_interpretation:day_master"], "contentLayer": True, "maxChars": 900},
                {"slotId": "dayMaster.pillarReading", "consumedFactKinds": ["approved_interpretation:day_pillar"], "contentLayer": True, "maxChars": 500}])
    ph = DM["phase"]; pi = PHASE_INFO[ph]
    component("dayMaster.stage", kind="displayGlyph", ch=DM["ch"], halo=f"phase-{ph}-field", stage="paper-200", fullPageBlack=False)
    component("dayMaster.readingPanel", kind="contentSlot", edge="gold")
    component("dayMaster.goodToKnow", kind="darkPanel", compact=True)
    inner = f'''{head(7, "you")}
    <div style="position:absolute;left:0;top:22mm;width:96mm;height:243mm;background:var(--paper-200);border-radius:0 3mm 3mm 0">
      <div class="blob b-earth" style="width:30mm;height:30mm;left:10mm;top:26mm;opacity:.7"></div>
      <div class="blob b-water" style="width:40mm;height:40mm;left:62mm;top:18mm;opacity:.7"></div>
      <div style="position:absolute;left:0;right:0;top:36mm;display:flex;justify-content:center">
        <div style="position:relative;width:64mm;height:64mm;border-radius:50%;background:var(--phase-{ph}-field);display:flex;align-items:center;justify-content:center">{glyph(DM["ch"], 54)}</div>
      </div>
      <div style="position:absolute;left:0;right:0;top:110mm;text-align:center">
        <div style="font-family:var(--font-display);font-weight:300;font-size:26pt;letter-spacing:.02em">{py(DM["ch"])}</div>
        <div class="label" style="margin-top:3mm;letter-spacing:.3em;color:var(--ink-600)">{POL[DM["polarity"]]} {pi["en"]} · Day Master</div>
      </div>
      <div style="position:absolute;left:12mm;right:12mm;top:146mm">
        <table class="facts">
          <tr><td>Stem</td><td><span class="cjk">{DM["ch"]}</span> · {DM["ordinal"]}</td></tr>
          <tr><td>Phase</td><td>{pi["en"]} <span class="cjk">{pi["ch"]}</span> {pi["py"]}</td></tr>
          <tr><td>Polarity</td><td>{POL[DM["polarity"]]} <span class="cjk">{"阴" if DM["polarity"]=="yin" else "阳"}</span></td></tr>
          <tr><td>Day pillar</td><td><span class="cjk">{DM["pillar"]}</span> {DM["pillarPinyin"]}</td></tr>
          <tr><td>Source</td><td>Validated chart engine</td></tr>
        </table>
        <div class="caption" style="margin-top:4mm">The halo marks the phase of this one character. It is a fact of the Stem, not an assessment of its strength.</div>
      </div>
    </div>
    <div style="position:absolute;left:108mm;right:20mm;top:22mm;bottom:20mm;display:flex;flex-direction:column">
      <div class="kicker">Chapter 03 · Day Master</div>
      <div class="h1 small" style="margin-top:3mm">Your Day Master<br>is {POL[DM["polarity"]]} {pi["en"]}</div>
      <div class="standfirst" style="margin-top:5mm">The Day Master is the single character the whole reading is oriented around: the Stem of your birth day.</div>
      <div class="rule gold" style="margin:6mm 0 5mm"></div>
      <div class="body"><span class="label" style="margin-right:2mm">General</span>In classical BaZi the Day Stem stands for the person themselves; every other Stem in the chart is described by its relation to it. {py(DM["ch"]).capitalize()} is the {DM["ordinal"].replace(" of 10","")} of the ten Heavenly Stems and the {POL[DM["polarity"]]} counterpart within {pi["en"]}. In your chart it is paired with the Branch {py(P[2]["branch"]["ch"])}, forming the Day pillar <span class="cjk">{DM["pillar"]}</span>.</div>
      <div class="panel edge" style="margin-top:7mm">
        <div class="label gold" style="margin-bottom:2.5mm">Your reading · Day Master</div>
        <div class="body" style="color:var(--ink-900);font-size:11.5pt;line-height:15.5pt">This passage reads the Day Master itself: the character, its phase and its polarity, and how the tradition describes a chart that is oriented around it.</div>
        <div class="body" style="margin-top:3.5mm">It is drawn from the approved content layer for {POL[DM["polarity"]]} {pi["en"]} and speaks about the character, not about outcomes. It does not assess strength or rooting and does not nominate a favourable phase. Read it as a description of a structure the following chapters return to, one part of the chart at a time.</div>
      </div>
      <div class="panel" style="margin-top:4mm;border-left:0.6mm solid var(--phase-{P[2]["branch"]["phase"]}-mark);border-radius:0 var(--radius-panel) var(--radius-panel) 0">
        <div class="label" style="margin-bottom:2.5mm">Your reading · Day pillar <span class="cjk" style="text-transform:none;letter-spacing:.08em;color:var(--ink-900)">{DM["pillar"]}</span></div>
        <div class="body">The Day pillar pairs your Day Master with the Branch {py(P[2]["branch"]["ch"])} ({PHASE_INFO[P[2]["branch"]["phase"]]["en"]}), which carries the Hidden Stems {", ".join(py(h["ch"]) for h in P[2]["hidden"])}. Chapter 05 reads this pairing in full.</div>
      </div>
      <div class="panel dark" style="margin-top:auto">
        <div class="label" style="margin-bottom:2mm">Good to know</div>
        <div class="body-small">{pi["en"]} stems in the classical system: <span class="cjk">{pi["stems"].split()[0]}</span> {py(pi["stems"].split()[0])} (Yang) and <span class="cjk">{pi["stems"].split()[1]}</span> {py(pi["stems"].split()[1])} (Yin). This report describes the Day Master itself — it does not assess strength, rooting or favourable phases.</div>
      </div>
    </div>{foot(7)}'''
    return "07-day-master", 7, wrap_page("Your Day Master", inner), st

# ------------------------------------------------------------------ 08 WU XING DISTRIBUTION (donor V2 agent_x_ETBZ-4.png · transform V6)
# Ring geometry (mm, ring-box coordinates). Discs keep the approved direction (Fire at top, clockwise). Each value/bar
# block hangs below its disc; the 44 mm medallion sits in the protected region at the visual centre of the five
# disc+value units, so the Fire block ends above it and the centre label stacks inside the real circle.
WX_GEOMETRY = {"ringCx": 85, "ringCy": 80, "ringR": 58, "trackR": 21, "medallion": {"cx": 85, "cy": 88, "d": 44},
               "block": {"w": 36, "dy": 22, "h": 17.8}, "labelLines": [(13, 6.35), (20, 3.88), (30, 3.88)], "labelGap": 1.0}

def wu_xing_positions():
    g = WX_GEOMETRY
    return {k: (g["ringCx"] + g["ringR"] * math.cos(math.radians(-90 + i * 72)), g["ringCy"] + g["ringR"] * math.sin(math.radians(-90 + i * 72)))
            for i, k in enumerate(["fire", "earth", "metal", "water", "wood"])}

def wu_xing_geometry():
    """Nominal boxes (mm, ring-box coordinates) for the placement wu_xing() renders; checked by guards.wu_xing_centre_clearance."""
    g = WX_GEOMETRY; m = g["medallion"]; b = g["block"]
    lines = g["labelLines"]; y = m["cy"] - (sum(h for _, h in lines) + g["labelGap"] * (len(lines) - 1)) / 2
    label = []
    for w, h in lines:
        label.append((m["cx"] - w / 2, y, m["cx"] + w / 2, y + h)); y += h + g["labelGap"]
    blocks = {k: (x - b["w"] / 2, py_ + b["dy"], x + b["w"] / 2, py_ + b["dy"] + b["h"]) for k, (x, py_) in wu_xing_positions().items()}
    return {"circle": (m["cx"], m["cy"], m["d"] / 2), "label": label, "blocks": blocks}

def wu_xing(vector=None, page=8, fixture_id=None, surface="customer"):
    vec = vector or FIX["wuXing"]["vector"]
    st = begin("wu-xing-distribution" if surface == "customer" else "wu-xing-distribution-zero-case", surface, page, "chart-foundation",
               {"primary": "V2 agent_x_ETBZ-4.png", "secondary": ["V4 palette/spacing", "V6 presentation transform", "V5 zero-is-zero copy rule"]},
               [{"slotId": "wuXing.vector", "consumedFactKinds": ["wu_xing_vector"], "fixture": fixture_id or FIX["fixtureId"],
                 "presentationTransform": "pt.linear-max-v1", "derives": []}])
    mx = max(vec.values())
    # registered deterministic monotonic presentation transform: r = r_min + (r_max - r_min) * v / max ; bar = v / max
    def radius(v): return round(11 + 7 * (v / mx if mx else 0), 2)
    component("wuXing.ring", kind="fivePhaseRing", transform="pt.linear-max-v1", allFiveVisible=True, values=vec)
    g = WX_GEOMETRY; md = g["medallion"]; bw, bdy = g["block"]["w"], g["block"]["dy"]; tr = g["trackR"]
    component("wuXing.centre", kind="protectedMedallion", diameterMm=md["d"], centreMm=[md["cx"], md["cy"]], labelInside=True, blocksClear=True)
    pos = wu_xing_positions()
    discs = ""
    for k in PHASES:
        x, y = pos[k]; r = radius(vec[k]); pi = PHASE_INFO[k]
        val = f"{vec[k]:.1f}" if isinstance(vec[k], float) else str(vec[k])
        discs += (f'<div data-wx="track" data-phase="{k}" style="position:absolute;left:{x-tr:.2f}mm;top:{y-tr:.2f}mm;width:{2*tr}mm;height:{2*tr}mm;border-radius:50%;border:0.25mm solid var(--rule-200)"></div>'
                  f'<div id="wx-disc-{k}" data-wx="disc" data-phase="{k}" style="position:absolute;left:{x-r:.2f}mm;top:{y-r:.2f}mm;width:{2*r:.2f}mm;height:{2*r:.2f}mm;border-radius:50%;background:var(--phase-{k}-field);display:flex;align-items:center;justify-content:center">{glyph(pi["ch"], 13)}</div>'
                  f'<div id="wx-block-{k}" data-wx="phase-block" data-phase="{k}" style="position:absolute;left:{x-bw/2:.2f}mm;top:{y+bdy:.2f}mm;width:{bw}mm;text-align:center">'
                  f'<div data-wx="value" style="font-family:var(--font-display);font-weight:300;font-size:18pt;line-height:20pt;font-variant-numeric:tabular-nums">{val}</div>'
                  f'<div class="pinyin" style="margin-top:0.5mm;line-height:11pt">{pi["py"]}</div><div class="label">{pi["en"]}</div>'
                  f'<div data-wx="bar" style="margin:1.8mm auto 0;width:26mm;height:0.7mm;background:var(--rule-200);border-radius:1mm"><div style="width:{(vec[k]/mx*100 if mx else 0):.1f}%;height:100%;background:var(--phase-{k}-mark);border-radius:1mm"></div></div></div>')
    table = "".join(f'<div style="border-top:0.25mm solid var(--rule-200);padding-top:2.5mm"><div class="body-small" style="color:var(--ink-900)"><span class="cjk">{PHASE_INFO[k]["ch"]}</span> {PHASE_INFO[k]["en"]} · {vec[k]:.1f}</div><div class="caption">in this distribution</div></div>' for k in PHASES)
    zero_note = " A value of 0 is shown as “0 in this distribution” — a tally of zero, never a deficiency." if all(v > 0 for v in vec.values()) else " A value of 0 here is a tally of zero in this distribution. It does not mean a phase is missing, weak or in need of remedy."
    inner = f'''{head(page, "you")}
    <div class="content">
      <div class="kicker">Chapter 05 · Wu Xing</div>
      <div class="h1" style="margin-top:3mm">Your Wu Xing Distribution</div>
      <div class="standfirst" style="margin-top:4mm;max-width:132mm">How the five phases are tallied across your Four Pillars, as supplied by the chart engine. Values are displayed as supplied; nothing here is a judgement of balance.</div>
      <div style="position:relative;height:168mm;margin-top:4mm">
        <div id="wx-medallion" data-wx="medallion" style="position:absolute;left:{md["cx"]-md["d"]/2:.2f}mm;top:{md["cy"]-md["d"]/2:.2f}mm;width:{md["d"]}mm;height:{md["d"]}mm;border-radius:50%;border:0.25mm solid var(--gold-500);display:flex;align-items:center;justify-content:center">
          <div id="wx-centre-label" data-wx="centre-label" style="display:flex;flex-direction:column;align-items:center;text-align:center"><div class="cjk term" style="font-size:14pt;line-height:18pt;letter-spacing:.3em;margin-right:-.3em;color:var(--ink-900)">五行</div><div class="label" style="margin-top:{g["labelGap"]}mm;letter-spacing:.16em">wǔ xíng</div><div class="label" style="margin-top:{g["labelGap"]}mm;letter-spacing:.16em">Five Phases</div></div>
        </div>
        {discs}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4mm;margin-top:2mm">{table}</div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">Values are read directly from the validated chart output. Disc size and bar length map each supplied value in proportion to the largest one and carry no further meaning.{zero_note} The Five Phases themselves are introduced on the next page as general education.</div>
    </div>{foot(page)}'''
    return ("08-wu-xing" if surface == "customer" else "dev-wu-xing-zero"), page, wrap_page("Your Wu Xing Distribution", inner), st

# ------------------------------------------------------------------ 09 FIVE PHASES EDUCATION (donor V5 composition · V4 atmosphere · V6 guard)
def five_phases():
    st = begin("five-phases", "customer", 9, "general-education", {"primary": "V5 WuXingEducationPage (open five-part composition)", "secondary": ["V4 pastel atmosphere", "V6 structural prohibition of relation edges"]},
               [{"slotId": "education.anchors", "consumedFactKinds": [], "derivedNothing": True, "personalised": False, "relationEdges": "structurally impossible"}])
    component("education.fiveAnchors", kind="fivePhaseAnchors", arrows=False, star=False, shengKe=False)
    cards = ""
    for k in PHASES:
        pi = PHASE_INFO[k]
        stems = " ".join(f'<span class="cjk">{c}</span>' for c in pi["stems"].split())
        branches = " ".join(f'<span class="cjk">{c}</span>' for c in pi["branches"].split())
        cards += (f'<div style="text-align:center"><div style="width:30mm;height:30mm;border-radius:50%;background:var(--phase-{k}-field);margin:0 auto;display:flex;align-items:center;justify-content:center">{glyph(pi["ch"], 19)}</div>'
                  f'<div class="pinyin" style="margin-top:3.5mm;font-size:11pt;font-weight:400">{pi["py"]}</div><div class="label" style="margin-top:1mm">{pi["en"]}</div>'
                  f'<div style="margin-top:5mm;border-top:0.25mm solid var(--rule-200);padding-top:3mm"><div class="caption" style="margin-bottom:1mm">Stems</div><div class="body" style="color:var(--ink-900);font-size:11pt;line-height:16pt">{stems}</div>'
                  f'<div class="caption" style="margin:2.5mm 0 1mm">Branches</div><div class="body" style="color:var(--ink-900);font-size:11pt;line-height:16pt">{branches}</div></div></div>')
    inner = f'''{head(9, "gen")}
    <div class="blob b-wood" style="width:80mm;height:80mm;left:-30mm;top:40mm;opacity:.25"></div>
    <div class="blob b-fire" style="width:60mm;height:60mm;right:-20mm;top:120mm;opacity:.25"></div>
    <div class="content">
      <div class="kicker">Chapter 05 · Wu Xing · General education</div>
      <div class="h1" style="margin-top:3mm">The Five Phases</div>
      <div class="standfirst" style="margin-top:4mm;max-width:132mm">Wu Xing names five phases of transformation. Each Heavenly Stem and each Earthly Branch belongs to one of them. This page introduces the five as a set; it is identical in every copy of this edition and is not based on your chart.</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4mm;margin-top:16mm">{cards}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:16mm">
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">How to read this page</div><div class="body-small">The five phases are shown as five equal categories. The order on this page is the customary listing order and implies no ranking. Each phase's Stems and Branches are listed so you can find your own characters on the previous pages.</div></div>
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">Not a personal diagnosis</div><div class="body-small">Your own tally is on the previous page. The classical relationships between individual phases are outside the scope of this edition and are not drawn here.</div></div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">Pinyin with tone marks: mù, huǒ, tǔ, jīn, shuǐ. Earth holds four Branches; each other phase holds two.</div>
    </div>{foot(9)}'''
    return "09-five-phases", 9, wrap_page("The Five Phases", inner), st

# ------------------------------------------------------------------ 10 TEN GODS OVERVIEW (donor V3)
TEN_GODS = [("比肩", "Bǐ Jiān", "Friend"), ("劫财", "Jié Cái", "Rob Wealth"), ("食神", "Shí Shén", "Eating God"), ("伤官", "Shāng Guān", "Hurting Officer"),
            ("偏财", "Piān Cái", "Indirect Wealth"), ("正财", "Zhèng Cái", "Direct Wealth"), ("七杀", "Qī Shā", "Seven Killings"), ("正官", "Zhèng Guān", "Direct Officer"),
            ("偏印", "Piān Yìn", "Indirect Resource"), ("正印", "Zhèng Yìn", "Direct Resource")]
def ten_gods():
    st = begin("ten-gods", "customer", 10, "chart-foundation", {"primary": "V3 Ten Gods & Hidden Stems (contact sheet, page 08)", "secondary": ["V5 InformationalCjkText contract", "V6 fail-closed facts", "V4 tokens"]},
               [{"slotId": "tenGods.presence", "consumedFactKinds": ["ten_god_relation", "hidden_stem_ten_god_relation"], "fixture": FIX["fixtureId"], "cjkRole": "InformationalCjkText"}])
    component("tenGods.table", kind="presenceMatrix", rows=10, columns=["year", "month", "day", "hour"], cjkRole="InformationalCjkText")
    presence = {g[0]: {} for g in TEN_GODS}
    for p in P:
        if p["tenGod"]["cjk"] in presence: presence[p["tenGod"]["cjk"]][p["position"]] = "stem"
        for t in p["hiddenTenGods"]:
            presence[t["cjk"]].setdefault(p["position"], "hidden")
    rows = ""
    for cjk, pyn, en in TEN_GODS:
        cells = ""
        for pos in ("year", "month", "day", "hour"):
            v = presence[cjk].get(pos)
            mark = ('<span style="display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;background:var(--ink-900)"></span>' if v == "stem" else
                    '<span style="display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;border:0.3mm solid var(--ink-600)"></span>' if v == "hidden" else
                    '<span style="display:inline-block;width:2.6mm;height:0.25mm;background:var(--rule-200)"></span>')
            cells += f'<td style="text-align:center;width:14mm">{mark}</td>'
        rows += (f'<tr><td style="width:18mm"><span class="cjk term">{cjk}</span></td><td style="width:30mm" class="pinyin">{pyn}</td>'
                 f'<td style="color:var(--ink-900)">{en}</td>{cells}</tr>')
    inner = f'''{head(10, "you")}
    <div class="content">
      <div class="kicker">Chapter 04 · Ten Gods <span class="cjk" style="text-transform:none;letter-spacing:.1em">十神</span></div>
      <div class="h1" style="margin-top:3mm">Ten Gods overview</div>
      <div class="standfirst" style="margin-top:4mm;max-width:132mm">Each Stem in your chart, visible or hidden, is named by its classical relation to your Day Master. There are ten such names. This page lists all ten and marks which of them your chart carries, and where.</div>
      <table style="width:100%;border-collapse:collapse;margin-top:10mm" class="tg">
        <thead><tr class="label"><td></td><td></td><td>Relation to Day Master <span class="cjk" style="text-transform:none;letter-spacing:.08em">{DM["ch"]}</span> {py(DM["ch"])}</td><td style="text-align:center">Year</td><td style="text-align:center">Month</td><td style="text-align:center">Day</td><td style="text-align:center">Hour</td></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div class="legend" style="margin-top:6mm">
        <div class="i"><span style="display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;background:var(--ink-900)"></span> Visible stem</div>
        <div class="i"><span style="display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;border:0.3mm solid var(--ink-600)"></span> Hidden stem</div>
        <div class="i"><span style="display:inline-block;width:2.6mm;height:0.25mm;background:var(--rule-200)"></span> Not present</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:8mm">
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">What a Ten God is</div><div class="body-small">A name for the relation between one Stem and the Day Master, derived from their phases and polarities. The Day pillar's own Stem is the Day Master itself and carries no relation name.</div></div>
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">What this table does not say</div><div class="body-small">Presence is presence. A filled mark is a visible Stem; an open mark is a Hidden Stem inside a Branch. The table ranks nothing and counts nothing; it shows where each name occurs in your chart as supplied.</div></div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">Terminology is set in the informational Chinese text face with tone-marked pinyin. Relations are supplied with your chart and repeat unchanged on pages 05 and 11.</div>
    </div>{foot(10)}'''
    css = "table.tg td{padding:2.4mm 1.5mm;border-top:0.25mm solid var(--rule-200);font-size:10pt;line-height:12.5pt;vertical-align:middle} table.tg thead td{border-top:none;padding-bottom:2mm;color:var(--ink-400)} table.tg tbody tr:last-child td{border-bottom:0.25mm solid var(--rule-200)}"
    return "10-ten-gods", 10, wrap_page("Ten Gods overview", inner, css), st

# ------------------------------------------------------------------ 11 HIDDEN STEMS (donor V3)
def hidden_stems():
    st = begin("hidden-stems", "customer", 11, "chart-foundation", {"primary": "V3 Ten Gods & Hidden Stems (contact sheet, page 08)", "secondary": ["V4 display glyphs + phase fields", "V5 InformationalCjkText", "V6 fail-closed"]},
               [{"slotId": "hidden.rows", "consumedFactKinds": ["pillar_branch", "hidden_stem", "hidden_stem_phase", "hidden_stem_qi_role", "hidden_stem_ten_god_relation"], "fixture": FIX["fixtureId"]}])
    component("hidden.branchRows", kind="branchRows", rows=4, perHiddenPhaseMark=True)
    rows = ""
    for p in P:
        b = p["branch"]; bp = b["phase"]
        hs = ""
        for h, t in zip(p["hidden"], p["hiddenTenGods"]):
            hs += (f'<div style="display:grid;grid-template-columns:12mm 30mm 1fr 26mm;align-items:center;gap:3mm;padding:1.2mm 0;border-top:0.25mm solid var(--rule-200)">'
                   f'<div style="width:11mm;height:11mm;border-radius:50%;background:var(--phase-{h["phase"]}-field);display:flex;align-items:center;justify-content:center">{glyph(h["ch"], 8)}</div>'
                   f'<div><div class="pinyin">{py(h["ch"])}</div><div class="caption">{h["qi"]}</div></div>'
                   f'<div><div class="body-small" style="color:var(--ink-900)">{t["en"]}</div><div class="caption"><span class="cjk">{t["cjk"]}</span> {t["py"]}</div></div>'
                   f'<div class="caption" style="color:var(--ink-600)">{S.phase_dot(h["phase"])}{PHASE_INFO[h["phase"]]["en"]}</div></div>')
        rows += (f'<div style="display:grid;grid-template-columns:40mm 1fr;gap:6mm;align-items:center;padding:3.5mm 0;border-top:0.25mm solid var(--rule-200)">'
                 f'<div style="display:flex;align-items:center;gap:3mm"><div style="width:20mm;height:20mm;border-radius:50%;background:var(--phase-{bp}-field);display:flex;align-items:center;justify-content:center;flex:none">{glyph(b["ch"], 14)}</div>'
                 f'<div><div class="label">{p["label"]}<br>branch</div><div class="pinyin" style="font-size:11pt;margin-top:1mm">{py(b["ch"])}</div><div class="caption">{PHASE_INFO[bp]["en"]} · {b["animal"]}</div></div></div>'
                 f'<div style="border-top:none">{hs}</div></div>')
    inner = f'''{head(11, "you")}
    <div class="content">
      <div class="kicker">Chapter 04 · Hidden Stems <span class="cjk" style="text-transform:none;letter-spacing:.1em">藏干</span></div>
      <div class="h1" style="margin-top:3mm">Hidden Stems</div>
      <div class="standfirst" style="margin-top:4mm;max-width:140mm">Each Earthly Branch carries one to three Stems. They are listed in Qi order — principal, central, residual — each with its own phase and its own relation to your Day Master.</div>
      <div style="margin-top:8mm">{rows}<div class="rule"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:6mm">
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">Two layers of the same chart</div><div class="body-small">Visible Stems are the upper row of your pillars; Hidden Stems are what the Branches carry. Both are named against the same Day Master, so this page and page 05 can be read side by side.</div></div>
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">Colour, one character at a time</div><div class="body-small">Every Hidden Stem shows its own phase field. A Branch's phase is never inherited by the Stems it carries, and the Branch's own field belongs to the Branch alone.</div></div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">Hidden Stems, their phases, Qi roles and relations are supplied with your chart. Where a value is not supplied, the cell stays empty rather than inferred.</div>
    </div>{foot(11)}'''
    return "11-hidden-stems", 11, wrap_page("Hidden Stems", inner), st

# ------------------------------------------------------------------ 27 INTEGRATION / REFLECTION (donor V3 guidance IA · V4 shell)
def reflection():
    st = begin("reflection", "customer", 27, "reflection-closure", {"primary": "V3 Guidance & closure section (contact sheet IA)", "secondary": ["V4 shell", "V2 whitespace rhythm"]},
               [{"slotId": "reflection.prompts", "consumedFactKinds": [], "derivedNothing": True, "contentClass": "GENERAL_EDUCATION"}])
    component("reflection.prompts", kind="promptList", count=3, predictive=False)
    eight = "".join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:2mm">{glyph(p["stem"]["ch"], 13)}{glyph(p["branch"]["ch"], 13)}<div class="label" style="margin-top:1mm">{p["label"]}</div></div>' for p in P)
    prompts = [("Which passages held?", "Note the chapters that described something you recognise, and the ones that did not. Both are information about how a classical structure meets one life; neither is a verdict."),
               ("Which characters recur?", "Several relation names appear more than once in your chart. Return to pages 10 and 11 and see where they sit. A repeated name is a repeated pattern in the structure, not a repeated instruction."),
               ("What stays yours?", "A chart describes a structure and the tendencies a tradition attaches to it. What is done with the structure is not in the chart and was never claimed to be.")]
    pr = "".join(f'<div style="padding:7mm 0;border-top:0.25mm solid var(--rule-200);display:grid;grid-template-columns:10mm 1fr;gap:4mm"><div class="label gold">0{i+1}</div><div><div class="h2" style="font-size:15pt;line-height:19pt;font-weight:400">{esc(t)}</div><div class="body" style="margin-top:2.5mm;font-size:11pt;line-height:15.5pt">{esc(b)}</div></div></div>' for i, (t, b) in enumerate(prompts))
    inner = f'''{head(27, "read")}
    <div class="blob b-metal" style="width:110mm;height:110mm;right:-40mm;top:30mm;opacity:.35"></div>
    <div class="blob b-earth" style="width:40mm;height:40mm;right:26mm;top:22mm;opacity:.4"></div>
    <div class="content">
      <div class="kicker">Chapter 10 · Bringing it together</div>
      <div class="h1" style="margin-top:3mm;max-width:120mm">A structure,<br>not an instruction</div>
      <div class="standfirst" style="margin-top:5mm;max-width:120mm">The chapters before this one read the chart one part at a time. This page sets the eight characters side by side again and leaves three questions with you.</div>
      <div style="display:flex;gap:12mm;margin-top:14mm;padding:7mm 10mm;background:var(--paper-100);border-radius:var(--radius-panel);width:max-content">{eight}</div>
      <div style="margin-top:14mm;max-width:155mm">{pr}<div class="rule"></div></div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">These prompts are identical in every copy of this edition. They ask; they do not predict.</div>
    </div>{foot(27)}'''
    return "27-reflection", 27, wrap_page("Bringing it together", inner), st

# ------------------------------------------------------------------ 28 SUMMARY (donor V3 closing summary column · V4 shell)
def summary():
    st = begin("summary", "customer", 28, "reflection-closure", {"primary": "V3 closing page summary column", "secondary": ["V4 shell", "V6 fact bindings"]},
               [{"slotId": "summary.facts", "consumedFactKinds": ["day_master_stem", "pillar_stem", "pillar_branch", "wu_xing_vector", "chart_parameters"], "fixture": FIX["fixtureId"]}])
    component("summary.table", kind="factsTable", rows=9)
    wx = FIX["wuXing"]["vector"]
    pil = "".join(f'<tr><td>{p["label"]} pillar</td><td><span class="cjk term">{p["stem"]["ch"]}{p["branch"]["ch"]}</span> <span class="muted">{py(p["stem"]["ch"])} {py(p["branch"]["ch"])}</span></td></tr>' for p in P)
    tally = " · ".join(f'<span class="cjk">{PHASE_INFO[k]["ch"]}</span> {wx[k]:.1f}' for k in PHASES)
    prm = FIX["parameters"]
    inner = f'''{head(28, "you")}
    <div class="content">
      <div class="kicker">Your chart, in summary</div>
      <div class="h1 small" style="margin-top:3mm">Everything supplied, on one page</div>
      <div style="display:grid;grid-template-columns:1fr 64mm;gap:12mm;margin-top:10mm;align-items:start">
        <table class="facts">
          <tr><td>Day Master</td><td><span class="cjk term">{DM["ch"]}</span> {py(DM["ch"])} · {POL[DM["polarity"]]} {PHASE_INFO[DM["phase"]]["en"]}</td></tr>
          {pil}
          <tr><td>Wu Xing tally</td><td>{tally}</td></tr>
          <tr><td>Day boundary</td><td>{prm["dayBoundary"]}</td></tr>
          <tr><td>Script</td><td>{prm["scriptPolicy"]}</td></tr>
          <tr><td>Source</td><td>{prm["source"]}</td></tr>
        </table>
        <div class="panel recessed" style="display:flex;flex-direction:column;align-items:center;padding:8mm 5mm">
          <div style="width:40mm;height:40mm;border-radius:50%;background:var(--phase-{DM["phase"]}-field);display:flex;align-items:center;justify-content:center">{glyph(DM["ch"], 28)}</div>
          <div class="pinyin" style="margin-top:4mm;font-size:12pt;font-weight:400">{py(DM["ch"])}</div>
          <div class="label" style="margin-top:1mm">Day Master</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:12mm">
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">Included in this edition</div><div class="body-small">Eight characters · phases and polarities · Hidden Stems in Qi order · Ten Gods relations · supplied Wu Xing tally · general education on the Five Phases · interpretive chapters from the approved content layer.</div></div>
        <div class="panel"><div class="label gold" style="margin-bottom:2.5mm">Deliberately not included</div><div class="body-small">Day Master strength · favourable element · luck pillars and annual transits · lucky numbers, colours, directions · remedies · health, financial or legal correspondences · predictions of any kind.</div></div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">Values on this page are the same values shown on pages 04 to 11. Nothing is recalculated here.</div>
    </div>{foot(28)}'''
    return "28-summary", 28, wrap_page("Your chart, in summary", inner), st

# ------------------------------------------------------------------ 29 CLOSING (donor V3 closing · restyled V4: light, quiet, personal)
def closing():
    st = begin("closing", "customer", 29, "reflection-closure", {"primary": "V3 closing reflection (contact sheet, page 28) — sense of resolution", "secondary": ["V4 cover atmosphere (light, not full black)", "V6 static wordmark"]},
               [{"slotId": "closing.name", "consumedFactKinds": ["customer_display_name"], "fixture": FIX["fixtureId"]}])
    component("closing.statement", kind="quietStatement", predictive=False, fullPageBlack=False)
    inner = f'''
    <div class="blob b-water" style="width:120mm;height:120mm;left:-30mm;top:120mm;opacity:.5"></div>
    <div class="blob b-earth" style="width:60mm;height:60mm;left:120mm;top:60mm;opacity:.5"></div>
    <div class="blob b-metal" style="width:90mm;height:90mm;left:110mm;top:170mm;opacity:.5"></div>
    <div style="position:absolute;left:16mm;top:16mm;height:3mm;color:var(--ink-900)">{WORDMARK.replace('<svg ', '<svg style="height:3mm;width:auto" ')}</div>
    <div style="position:absolute;left:20mm;right:20mm;top:88mm">
      <div class="kicker">Closing</div>
      <div class="h1" style="margin-top:4mm;max-width:150mm">What you do with it<br>is the part that is yours.</div>
      <div class="standfirst" style="margin-top:8mm;max-width:130mm">A chart is a structure, not an instruction. It describes a pattern; it does not decide what you make of it. This reading set out eight characters, named the relations between them in the traditional vocabulary, and showed the classical system those names come from. It did not tell you what will happen, and it was not built to.</div>
      <div class="rule gold" style="margin:10mm 0 5mm;max-width:130mm"></div>
      <div class="body" style="max-width:130mm">Prepared for <span style="color:var(--ink-900);font-weight:500">{esc(NAME)}</span>. Bazodiac is positioned as entertainment and reflection. It makes no predictive, medical, financial or legal claims.</div>
    </div>
    <div style="position:absolute;left:20mm;right:20mm;bottom:16mm;display:flex;justify-content:space-between;align-items:flex-end">
      <div><div style="height:3.4mm;color:var(--ink-900)">{WORDMARK.replace('<svg ', '<svg style="height:3.4mm;width:auto" ')}</div><div class="label" style="margin-top:2mm">Personalized BaZi Reading · {FIX["customer"]["edition"]}</div></div>
      <div class="label gold">29</div>
    </div>'''
    return "29-closing", 29, wrap_page("Closing", inner), st

# ------------------------------------------------------------------ 30 METHOD NOTE & GLOSSARY
def method_note():
    st = begin("method-note", "customer", 30, "reflection-closure", {"primary": "V3 method note / symbol key IA", "secondary": ["V5 customer copy boundary (no internal states)", "V4 shell"]},
               [{"slotId": "method.conventions", "consumedFactKinds": [], "derivedNothing": True}])
    component("method.glossary", kind="glossary", terms=8)
    gl = [("Heavenly Stem", "天干 tiān gān", "One of ten characters; the upper character of a pillar. Carries a phase and a polarity."),
          ("Earthly Branch", "地支 dì zhī", "One of twelve characters; the lower character of a pillar. Travels with an animal label."),
          ("Hidden Stem", "藏干 cáng gān", "A Stem contained in a Branch. Listed in Qi order: principal, central, residual."),
          ("Day Master", "日主 rì zhǔ", "The Stem of the Day pillar. The reference point every other Stem is named against."),
          ("Ten Gods", "十神 shí shén", "The ten relation names between any Stem and the Day Master."),
          ("Wu Xing", "五行 wǔ xíng", "The Five Phases: Wood, Fire, Earth, Metal, Water. Each Stem and Branch belongs to one."),
          ("Polarity", "阴阳 yīn yáng", "Yin or Yang. Stems alternate strictly; the label is shown for every Stem."),
          ("Pinyin", "拼音 pīn yīn", "Romanisation of Chinese, always shown with tone marks in this document.")]
    rows = "".join(f'<div style="padding:3mm 0;border-top:0.25mm solid var(--rule-200)"><div class="pinyin" style="color:var(--ink-900)">{esc(t)} <span class="cjk muted" style="font-weight:400;margin-left:1mm">{c}</span></div><div class="body-small" style="margin-top:1mm">{esc(d)}</div></div>' for t, c, d in gl)
    conv = [("Chart basis", "Four Pillars (Sìzhù): year, month, day, hour."), ("Day boundary", "Midnight, as declared for this chart."), ("Script", "Simplified Chinese throughout."),
            ("Hidden Stems", "Listed in Qi order as supplied; none derived."), ("Ten Gods", "Named as supplied against the Day Master."), ("Wu Xing tally", "Displayed as supplied; no weighting, ranking or balance judgement."),
            ("Left aside", "Day Master strength, favourable element, luck pillars, annual transits, phase relationships, remedies.")]
    cv = "".join(f'<tr><td>{esc(k)}</td><td style="text-align:left">{esc(v)}</td></tr>' for k, v in conv)
    inner = f'''{head(30)}
    <div class="content">
      <div class="kicker">Method note &amp; glossary</div>
      <div class="h1 small" style="margin-top:3mm">Conventions used in this edition</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:9mm">
        <div><div class="label ink" style="margin-bottom:3mm">Glossary</div>{rows}<div class="rule"></div></div>
        <div><div class="label ink" style="margin-bottom:3mm">Conventions</div><table class="facts">{cv}</table>
          <div class="panel" style="margin-top:8mm"><div class="label gold" style="margin-bottom:2.5mm">Typography</div><div class="body-small">Every Chinese character is real, complete text. Large display characters and terminology use two separate faces; none are drawn or generated. Nothing in this document is smaller than nine points.</div></div>
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0" class="caption">This page is general and identical in every copy of the edition.</div>
    </div>{foot(30)}'''
    return "30-method-note", 30, wrap_page("Method note & glossary", inner), st
