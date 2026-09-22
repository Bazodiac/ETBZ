"""Developer proof pages — evidence surface only (donor V6 + V5). Never mixed with customer output."""
from __future__ import annotations
import json, pathlib
import shell as S
from shell import glyph, py, esc, wrap_page, component, begin, FIX, PHASES, PHASE_INFO, MANIFEST, WORDMARK
import guards, paginate as PG

ROOT = pathlib.Path(__file__).resolve().parent.parent
WM_META = json.loads((ROOT / "assets" / "wordmark.manifest.json").read_text())
DEV_CSS = """
.dhead{position:absolute;left:20mm;right:20mm;top:11mm;display:flex;justify-content:space-between;align-items:center;font-size:8pt;white-space:nowrap;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-400)}
.dhead b{color:var(--ink-900);font-weight:500}
.mono{font-family:"DejaVu Sans Mono",monospace;font-size:7.5pt;line-height:10pt;color:var(--ink-600);overflow-wrap:anywhere}
.grid>div{min-width:0;overflow:hidden}
.status{display:inline-block;white-space:nowrap;padding:0.8mm 2mm;border-radius:0.8mm;font-size:8pt;letter-spacing:.1em;text-transform:uppercase;font-weight:500}
.status.warn{background:#F0DDC2;color:#6B4A0C}.status.ok{background:var(--phase-wood-field);color:var(--phase-wood-mark)}.status.block{background:var(--phase-fire-field);color:var(--phase-fire-mark)}
table.ev{width:100%;border-collapse:collapse}table.ev td,table.ev th{padding:1.2mm 1.2mm;border-top:0.25mm solid var(--rule-200);font-size:8pt;line-height:10.5pt;vertical-align:top;text-align:left;overflow-wrap:anywhere}
table.ev th{color:var(--ink-400);font-weight:500;letter-spacing:.1em;text-transform:uppercase;border-top:none}
table.rc td{padding:0.7mm 1mm;white-space:nowrap;overflow:hidden}
"""
def dhead(title, right=""):
    return f'<div class="dhead"><div><b>Bazodiac</b> · Developer proof · {esc(title)}</div><div>{esc(right)}</div></div>'
def dfoot(n, note="Evidence surface · not customer output"):
    return f'<div class="foot"><div>{esc(note)}</div><span class="pn">D{n:02d}</span></div>'

def glyph_proof():
    st = begin("dev-glyph-proof", "developer", 1, "developer-proof", {"primary": "V6 glyph-proof.svg + manifest pipeline", "secondary": ["V4 agent-x-etbz-3.png visual target", "V5 GlyphProof"]}, [])
    component("dev.glyphGrid", kind="glyphProof", count=27, manifest=MANIFEST["manifestSha256"])
    def cell(g):
        return (f'<div style="text-align:center;padding:2mm 0 1.5mm;background:var(--paper-100);border-radius:1mm">'
                f'<div style="display:flex;justify-content:center">{glyph(g["character"], 11)}</div>'
                f'<div class="pinyin" style="margin-top:1mm">{g["pinyin"]}</div><div class="mono" style="font-size:7pt;line-height:9pt">{g["codepoint"]}<br>{g["sha256"][7:15]}</div></div>')
    stems = "".join(cell(g) for g in MANIFEST["glyphs"] if g["role"] == "heavenly_stem")
    branches = "".join(cell(g) for g in MANIFEST["glyphs"] if g["role"] == "earthly_branch")
    wx = "".join(cell(g) for g in MANIFEST["glyphs"] if g["role"] == "wu_xing")
    src = MANIFEST["source"]; ink = MANIFEST["inkPass"]
    inner = f'''{dhead("BazodiacDisplayGlyphSet", MANIFEST["manifestVersion"])}
    <div class="content">
      <div class="kicker">Role A · 27 deterministic vector assets</div>
      <div class="h1 small" style="margin-top:2mm">Display glyph proof</div>
      <div class="body-small" style="margin-top:3mm;max-width:150mm">Every glyph is a versioned SVG outline extracted once from a pinned licensed face, rendered here through the same <span class="mono">&lt;use&gt;</span> path the customer pages use. Per-glyph SHA-256 over the canonical description; manifest SHA-256 over all 27 in ordinal order. Nothing is a font at render time; nothing is generated.</div>
      <div class="label ink" style="margin-top:6mm">Heavenly Stems · 10</div>
      <div class="grid" style="display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:1.5mm;margin-top:2mm">{stems}</div>
      <div class="label ink" style="margin-top:5mm">Earthly Branches · 12</div>
      <div class="grid" style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:1.5mm;margin-top:2mm">{branches}</div>
      <div class="label ink" style="margin-top:5mm">Wu Xing · 5</div>
      <div class="grid" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1.5mm;margin-top:2mm;max-width:70mm">{wx}</div>
      <table class="ev" style="margin-top:6mm">
          <tr><th colspan="2">Source &amp; licence provenance</th></tr>
          <tr><td style="width:30mm">Family / face</td><td>{src["family"]} · {src["postscriptName"]} (index {src["faceIndex"]}, weight {src["weight"]})</td></tr>
          <tr><td>Version</td><td class="mono">{esc(src["version"])}</td></tr>
          <tr><td>File SHA-256</td><td class="mono">{src["fileSha256"][7:]}</td></tr>
          <tr><td>Licence</td><td>{src["licence"]} · vendored as glyphs/OFL.txt · upstream {src["upstream"]}</td></tr>
          <tr><td>Region policy</td><td>{MANIFEST["regionPolicy"]}</td></tr>
          <tr><td>Geometry</td><td class="mono">emBox {MANIFEST["emBox"]} · viewBox {MANIFEST["viewBox"]} · upem {MANIFEST["unitsPerEm"]}</td></tr>
          <tr><td>Clipping test</td><td>27/27 bboxes strictly inside the shared viewBox incl. ink-pass margin (extractor asserts per glyph)</td></tr>
          <tr><td>Manifest SHA-256</td><td class="mono">{MANIFEST["manifestSha256"][7:]}</td></tr>
      </table>
    </div>{dfoot(1)}'''
    return "D01-glyph-proof", 1, wrap_page("Developer proof · glyphs", inner, DEV_CSS), st

def glyph_style_page():
    st = begin("dev-glyph-style", "developer", 2, "developer-proof", {"primary": "V4 agent-x-etbz-3.png (ink pass target)", "secondary": ["V6 asset pipeline", "V5 DISPLAY_GLYPH_SYSTEM_NOT_FINAL"]}, [])
    component("dev.inkPass", kind="glyphStyleDecision", status=MANIFEST["visualTarget"]["status"])
    ink = MANIFEST["inkPass"]
    def pair(ch):
        return (f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;text-align:center"><div><div style="display:flex;justify-content:center">{glyph(ch, 20)}</div><div class="caption">ink pass</div></div>'
                f'<div><svg class="disp" viewBox="{S.VB}" style="width:20mm;height:20mm;margin:0 auto"><path d="{S.GLYPHS[ch]["path"]}" fill="currentColor"/></svg><div class="caption">plain outline</div></div></div>')
    pairs = "".join(f'<div class="panel" style="padding:3mm">{pair(c)}</div>' for c in "金土木寅")
    inner = f'''{dhead("Display glyph style decision", "Role A")}
    <div class="content">
      <div class="kicker">Role A · visual target vs. verified asset</div>
      <div class="h1 small" style="margin-top:2mm">Ink pass and the open style decision</div>
      <div class="body-small" style="margin-top:3mm;max-width:155mm">The V4 target is a heavy, compact, geometric, subtly ink-printed silhouette. The final asset set approximates it with a deterministic presentation expansion on the licensed Noto Sans CJK SC Black outline: {ink["kind"]}, {ink["strokeUnits"]} font units, {ink["linejoin"]} joins, paint-order {ink["paintOrder"]}. The fill path is the unmodified outline; stroke identity, counters and Unicode identity are unchanged.</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm;margin-top:6mm">{pairs}</div>
      <div class="panel" style="margin-top:6mm;background:#F5EAD2"><span class="status warn">{MANIFEST["visualTarget"]["status"]}</span>
        <div class="body-small" style="margin-top:2.5mm;color:var(--ink-900)">{esc(MANIFEST["visualTarget"]["reason"])}</div>
        <div class="caption" style="margin-top:2mm">Target donor: {esc(MANIFEST["visualTarget"]["donor"])}. Options for the PO: (a) accept this asset set as the Bazodiac display style; (b) supply the original 金土木 reference or a licensed heavy CJK face for a new deterministic extraction; (c) ship plain outlines (ink pass off). None of the three changes a layout: the viewBox and glyph slots are fixed.</div></div>
      <table class="ev" style="margin-top:6mm">
        <tr><th>Rejected in this round</th><th>Why</th></tr>
        <tr><td>Image-generated Hanzi</td><td>Not text; no Unicode identity; not reproducible; forbidden by contract.</td></tr>
        <tr><td>Guessed font identity for the reference</td><td>No evidence; would be an invented claim.</td></tr>
        <tr><td>Distorting outlines toward the target</td><td>Stroke identity would change; a character that is not the character.</td></tr>
        <tr><td>Runtime font (rather than vector assets)</td><td>Same licence basis, but re-introduces font presence, subsetting and embedding-mode variables into the customer artefact (V6 ADR-0008).</td></tr>
      </table>
    </div>{dfoot(2)}'''
    return "D02-glyph-style", 2, wrap_page("Developer proof · glyph style", inner, DEV_CSS), st

def wordmark_page():
    st = begin("dev-wordmark", "developer", 3, "developer-proof", {"primary": "V4 wordmark variant B (gold point + tracked caps)", "secondary": ["V6 wordmark contract (static, chart-independent)"]}, [])
    component("dev.wordmark", kind="wordmarkContract", asset=WM_META["asset"], sha256=WM_META["sha256"])
    wm = lambda h, col="var(--ink-900)": WORDMARK.replace('<svg ', f'<svg style="height:{h}mm;width:auto;color:{col}" ')
    inner = f'''{dhead("Wordmark contract", "assets/wordmark.svg")}
    <div class="content">
      <div class="kicker">One final wordmark · no alternatives</div>
      <div class="h1 small" style="margin-top:2mm">Static brand asset</div>
      <div class="body-small" style="margin-top:3mm;max-width:150mm">Letter outlines from the pinned Inter SemiBold file converted to paths once, tracked at {WM_META["trackingEm"]} em, followed by one gold point of {WM_META["pointDiameterCapRatio"]} × cap-height on the baseline. The asset is independent of font presence and of any chart fact.</div>
      <div style="margin-top:10mm;padding:12mm;background:var(--paper-100);border-radius:var(--radius-panel)">{wm(12)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:6mm">
        <div style="padding:8mm;background:var(--paper-000);border:0.25mm solid var(--rule-200);border-radius:var(--radius-panel)">{wm(5)}<div style="height:4mm"></div>{wm(3)}<div style="height:4mm"></div>{wm(2.2)}<div class="caption" style="margin-top:4mm">Running-head scale (2.6 mm), cover scale (3 mm), micro scale (2.2 mm)</div></div>
        <div style="padding:8mm;background:var(--ink-900);border-radius:var(--radius-panel)">{wm(5, "var(--paper-000)")}<div style="height:4mm"></div>{wm(3, "var(--paper-000)")}<div class="caption" style="margin-top:4mm;color:var(--ink-400)">On ink-900 · gold point stays #B2913F</div></div>
      </div>
      <table class="ev" style="margin-top:8mm">
        <tr><th>Rule</th><th>Enforcement</th><th>Evidence</th></tr>
        <tr><td>Mark is static</td><td>No template parameter reaches the asset</td><td class="mono">sha256 {WM_META["sha256"][7:39]}…</td></tr>
        <tr><td>Chart-independent</td><td>The customer Day Master never enters the mark</td><td><span class="status ok">guard</span> wordmark("辛") → WORDMARK_MUST_BE_STATIC</td></tr>
        <tr><td>Source face</td><td>{WM_META["source"]["family"]} {WM_META["source"]["style"]} · {esc(WM_META["source"]["version"])} · {WM_META["source"]["licence"]}</td><td class="mono">{WM_META["source"]["fileSha256"][7:39]}…</td></tr>
        <tr><td>Subtitle handling</td><td>Product subtitle set separately in Inter Display Light; never part of the mark</td><td>Cover, closing</td></tr>
      </table>
      <div class="panel" style="margin-top:6mm;display:flex;gap:6mm;align-items:center">
        <div style="opacity:.35;display:flex;align-items:center;gap:3mm">{glyph("辛", 10)}<span class="label" style="letter-spacing:.34em">Bazodiac</span></div>
        <div class="body-small"><span class="status block">rejected</span>&nbsp; A customer glyph as brand mark. Structurally impossible: the wordmark component has no glyph slot.</div>
      </div>
    </div>{dfoot(3)}'''
    return "D03-wordmark", 3, wrap_page("Developer proof · wordmark", inner, DEV_CSS), st

def bindings_page(customer_structs: list[dict]):
    fxc = "bazodiac-final/fixture/long-form/general-education-chapter-v1"
    st = begin("dev-bindings", "developer", 4, "developer-proof", {"primary": "V6 factSlotBindings receipts", "secondary": ["V5 customer/evidence boundary"]}, [])
    component("dev.bindings", kind="bindingTable", pages=len(customer_structs))
    rows = ""
    for s in customer_structs:
        for b in s["factSlotBindings"]:
            kinds = ", ".join(b.get("consumedFactKinds", [])) or "— (derives nothing)"
            fx = b.get("fixture", ""); fxs = ("F1" if fx == FIX["fixtureId"] else ("F2" if fx else "—")) + ((" · " + b["presentationTransform"]) if b.get("presentationTransform") else "") + (" · content layer" if b.get("contentLayer") else "")
            rows += f'<tr><td class="mono">{s["pageNumber"]:02d}</td><td class="mono">{esc(b["slotId"])}</td><td>{esc(kinds)}</td><td class="mono">{fxs}</td></tr>'
    inner = f'''{dhead("Fact-slot bindings", FIX["fixtureId"])}
    <div class="content">
      <div class="kicker">Every fact-bearing region, bound</div>
      <div class="h1 small" style="margin-top:2mm">What each page consumes</div>
      <div class="body-small" style="margin-top:3mm;max-width:150mm">Each customer page records which fact kinds its slots consume and from which fixture. A slot with no fact kinds derives nothing. No slot computes, weights, ranks or infers; the only registered transform is the monotonic presentation mapping on the Wu Xing page.</div>
      <table class="ev" style="margin-top:5mm"><tr><th>Pg</th><th>Slot</th><th>Consumed fact kinds</th><th>Fixture / transform</th></tr>{rows}</table>
      <div class="caption" style="margin-top:3mm">F1 = {esc(FIX["fixtureId"])} · F2 = {esc(fxc)} · {esc(FIX["notice"])}</div>
    </div>{dfoot(4)}'''
    return "D04-bindings", 4, wrap_page("Developer proof · bindings", inner, DEV_CSS), st

def negative_page():
    st = begin("dev-negative", "developer", 5, "developer-proof", {"primary": "V6 tests/negative", "secondary": ["V5 70-evidence-and-open-decisions"]}, [])
    res = guards.run_all()
    component("dev.negativeTests", kind="guardResults", passed=sum(r["pass"] for r in res), total=len(res))
    rows = "".join(f'<tr><td><span class="status {"ok" if r["pass"] else "block"}">{"pass" if r["pass"] else "FAIL"}</span></td><td>{esc(r["test"])}</td><td class="mono">{esc(r["expected"])}</td><td class="mono">{esc(r["observed"])[:70]}</td></tr>' for r in res)
    # rendered blocked cell + inherited-tint rejection, visually
    blocked = guards.hidden_stem_cell({"ch": "丁"}, "fire")
    inner = f'''{dhead("Negative-path guards", f"{sum(r['pass'] for r in res)}/{len(res)} executed")}
    <div class="content">
      <div class="kicker">Executed, not described</div>
      <div class="h1 small" style="margin-top:2mm">Blocked states</div>
      <div class="body-small" style="margin-top:2mm;max-width:150mm">Each row is a guard function called with the input shown; the observed column is its actual return or raised code.</div>
      <table class="ev" style="margin-top:4mm"><tr><th style="width:12mm"></th><th style="width:52mm">Test</th><th style="width:38mm">Expected</th><th>Observed</th></tr>{rows}</table>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;margin-top:4mm">
        <div class="panel" style="padding:3mm"><div class="label" style="margin-bottom:2mm">Blocked hidden-stem cell</div>
          <div style="display:flex;gap:3mm;align-items:center"><div style="width:14mm;height:14mm;border-radius:50%;background:var(--{blocked["fill"]});border:0.3mm dashed var(--ink-400);display:flex;align-items:center;justify-content:center" class="mono">—</div><div class="caption">Phase not supplied → neutral field, no glyph, no inherited Branch tint. <span class="mono">{blocked["code"]}</span></div></div></div>
        <div class="panel" style="padding:3mm"><div class="label" style="margin-bottom:2mm">Out-of-contract glyph</div>
          <div style="display:flex;gap:3mm;align-items:center"><div style="width:14mm;height:14mm;border-radius:1mm;background:var(--phase-fire-field);display:flex;align-items:center;justify-content:center" class="mono">U+9F8D</div><div class="caption">龍 requested through Role A → refused. The same string renders through Role B: <span class="cjk" style="color:var(--ink-900)">龍</span></div></div></div>
        <div class="panel" style="padding:3mm"><div class="label" style="margin-bottom:2mm">Sheng/Ke request</div>
          <div class="caption"><span class="status block">METHOD_SCOPE_BLOCKED</span><br><span style="display:block;margin-top:2mm">Developer surface only; customer templates have no relation-edge slot.</span></div></div>
      </div>
    </div>{dfoot(5)}'''
    return "D05-negative", 5, wrap_page("Developer proof · negative paths", inner, DEV_CSS), st

def layout_evidence_page(n, title, png_rel_paths, layout, note):
    st = begin(f"dev-layout-{n}", "developer", n, "developer-proof", {"primary": "V6 render evidence + pagination receipts", "secondary": ["V4 audit stamps", "V2 rhythm"]}, [])
    component("dev.layoutEvidence", kind="paginationReport", pages=len(layout["pages"]), lines=layout["lineCount"], findings=len(layout["findings"]))
    thumbs = "".join(f'<div style="max-width:52mm"><img src="{p}" style="width:100%;border:0.25mm solid var(--rule-200)"><div class="caption" style="text-align:center;margin-top:1mm">page {i+1} · {len(layout["pages"][i]["fragments"])} fragments · used {layout["pages"][i]["usedBottomCp"]} cp</div></div>' for i, p in enumerate(png_rel_paths))
    frag_rows = ""
    for pg in layout["pages"]:
        for f in pg["fragments"]:
            frag_rows += f'<tr><td class="mono">{pg["pageNumber"]}</td><td class="mono">{esc(f["blockId"])}#{f["fragmentIndex"]}</td><td>{f["kind"]}</td><td class="mono">{len(f["lines"])}</td><td class="mono">{f["xCp"]}</td><td class="mono">{f["topCp"]}</td><td class="mono">{f["heightCp"]}</td><td class="mono">{"→" if f.get("continuesOnNextPage") else ""}{"←" if f.get("continuedFromPreviousPage") else ""}</td></tr>'
    g = layout["geometry"]
    inner = f'''{dhead("Long-form layout evidence", "")}
    <div class="content">
      <div class="kicker">Deterministic pagination · integer centipoints</div>
      <div class="h1 small" style="margin-top:2mm">{esc(title)}</div>
      <div class="body-small" style="margin-top:3mm;max-width:155mm">{esc(note)} Words {layout["wordCount"]} · lines placed {layout["lineCount"]} · pages {len(layout["pages"])} · findings {len(layout["findings"])} · content box {g["contentWidthCp"]}×{g["contentHeightCp"]} cp · baseline {g["baselineCp"]} cp · tolerance {g["toleranceCp"]} cp.</div>
      <div style="display:flex;gap:4mm;margin-top:5mm">{thumbs}</div>
      <div class="mono" style="margin-top:3mm">pagination structural sha256 · {layout["structuralSha256"][7:]}</div>
      <table class="ev" style="margin-top:3mm;font-size:7.5pt"><tr><th>Pg</th><th>Fragment</th><th>Kind</th><th>Lines</th><th>x cp</th><th>top cp</th><th>h cp</th><th>split</th></tr>{frag_rows}</table>
    </div>{dfoot(n)}'''
    return f"D{n:02d}-layout", n, wrap_page("Developer proof · layout", inner, DEV_CSS), st

def receipts_page(n, receipts: list[dict], artifact_hashes: dict):
    st = begin("dev-receipts", "developer", n, "developer-proof", {"primary": "V6 receipts/*.receipt.json", "secondary": []}, [])
    component("dev.receipts", kind="receiptTable", pages=len(receipts))
    rows = "".join(f'<tr><td class="mono">{r["surface"][0].upper()}{r["pageNumber"]:02d}</td><td class="mono">{esc(r["pageId"])}</td><td class="mono">{r["structuralSha256"][7:31]}…</td><td class="mono">{r["pngSha256"][7:31]}…</td><td class="mono">{r["domFindings"]}</td><td class="mono">{r["glyphRefs"]}</td></tr>' for r in receipts)
    ah = "".join(f'<tr><td>{esc(k)}</td><td class="mono" style="font-size:8pt">{v}</td></tr>' for k, v in artifact_hashes.items())
    inner = f'''{dhead("Render receipts", "run 1 = run 2")}
    <div class="content">
      <div class="kicker">Per-page structural hash · artifact hash · DOM overlap scan</div>
      <div class="h1 small" style="margin-top:2mm">Receipts</div>
      <div class="body-small" style="margin-top:3mm;max-width:155mm">Structural hash = SHA-256 of the page's canonical structure (component ids, bindings, glyph refs, cp layout). PNG hash = SHA-256 of the 2× raster produced by the proof harness. DOM findings = text/glyph boxes overlapping or leaving the sheet, measured on the rendered page. The whole build is executed twice; the final table in the receipt JSON confirms identical structural hashes.</div>
      <table class="ev rc" style="margin-top:4mm"><tr><th style="width:10mm">Pg</th><th style="width:34mm">Page</th><th>Structural</th><th>PNG</th><th style="width:10mm">DOM</th><th style="width:12mm">Glyphs</th></tr>{rows}</table>
      <table class="ev rc" style="margin-top:4mm"><tr><th colspan="2">Artifact hashes</th></tr>{ah}</table>
    </div>{dfoot(n)}'''
    return f"D{n:02d}-receipts", n, wrap_page("Developer proof · receipts", inner, DEV_CSS), st
