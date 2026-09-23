#!/usr/bin/env python3
"""Build everything: customer pages, developer proof, PDFs, contact sheet, receipts, pagination report, manifests."""
from __future__ import annotations
import hashlib, json, pathlib, shutil, subprocess, sys, datetime
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import shell as S, pages_customer as C, pages_longform as L, pages_dev as D
from render import A4_PX
from playwright.sync_api import sync_playwright
import pikepdf
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "pages"; OUT = ROOT / "out"
CUST = OUT / "customer"; DEV = OUT / "developer"
for d in (SRC, CUST, DEV):
    if d.exists(): shutil.rmtree(d)
    d.mkdir(parents=True, exist_ok=True)

def sha(b: bytes) -> str: return "sha256:" + hashlib.sha256(b).hexdigest()

DOM_SCAN = """
() => {
  const W = 793.7, H = 1122.5, els = [];
  const walk = (n) => { for (const c of n.children) { walk(c); }
    const own = Array.from(n.childNodes).some(x => x.nodeType === 3 && x.textContent.trim().length);
    if (own || (n.tagName === 'svg' && n.classList.contains('disp'))) els.push(n); };
  walk(document.querySelector('.sheet'));
  const boxes = els.map(e => ({e, r: e.getBoundingClientRect()})).filter(b => b.r.width > 0 && b.r.height > 0);
  const findings = [];
  for (const b of boxes) {
    if (b.r.left < -0.5 || b.r.top < -0.5 || b.r.right > W + 0.5 || b.r.bottom > H + 0.5) findings.push({code: 'OUTSIDE_SHEET', text: b.e.textContent.trim().slice(0, 40)});
    if (b.e.classList.contains('longline') && b.e.scrollWidth > b.e.clientWidth + 1) findings.push({code: 'LINE_OVERFLOW', text: b.e.textContent.slice(0, 40)});
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 1.5 && y > 1.5) findings.push({code: 'OVERLAP', a: a.e.textContent.trim().slice(0, 30), b: b.e.textContent.trim().slice(0, 30)});
  }
  return findings;
}
"""

# Wu Xing protected-centre oracle: geometry measured against the rendered medallion circle, not the author's intent.
WX_GEOMETRY_SCAN = """
(required) => {
  const MM = 96 / 25.4, MARGIN = 2 * MM, findings = [], mm = (px) => +(px / MM).toFixed(2);
  const m = document.querySelector('#wx-medallion[data-wx="medallion"]');
  if (!m) return required ? [{code: 'WX_MEDALLION_MISSING'}] : [];
  const mr = m.getBoundingClientRect(), cs = getComputedStyle(m);
  const cx = mr.left + mr.width / 2, cy = mr.top + mr.height / 2;
  const rOuter = mr.width / 2, rInner = rOuter - parseFloat(cs.borderTopWidth || '0');
  if (Math.abs(mr.width - mr.height) > 0.5 || cs.borderTopLeftRadius !== '50%') findings.push({code: 'WX_MEDALLION_NOT_CIRCLE', w: mm(mr.width), h: mm(mr.height), radius: cs.borderTopLeftRadius});
  if (Math.abs(mr.width - 44 * MM) > 0.5) findings.push({code: 'WX_MEDALLION_DIAMETER', mm: mm(mr.width)});
  const textRects = (el) => { const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 0 && q.height > 0) out.push({q, text: n.textContent.trim().slice(0, 30)}); }
    return out; };
  const label = m.querySelector('#wx-centre-label[data-wx="centre-label"]');
  if (!label) findings.push({code: 'WX_CENTRE_LABEL_MISSING'});
  else {
    const rects = textRects(label);
    if (rects.length < 3) findings.push({code: 'WX_CENTRE_LABEL_INCOMPLETE', lines: rects.length});
    for (const {q, text} of rects) {
      const far = Math.max(...[[q.left, q.top], [q.right, q.top], [q.left, q.bottom], [q.right, q.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
      if (far > rInner - MARGIN) findings.push({code: 'WX_CENTRE_LABEL_OUTSIDE_CIRCLE', text, marginMm: mm(rInner - far)});
    }
  }
  // clearance of a rectangle from the medallion: nearest rect point to the circle centre, minus the rendered outer radius
  const rectClear = (q) => Math.hypot(Math.max(q.left, Math.min(cx, q.right)) - cx, Math.max(q.top, Math.min(cy, q.bottom)) - cy) - rOuter;
  const blocks = Array.from(document.querySelectorAll('[data-wx="phase-block"]'));
  if (blocks.length !== 5 || new Set(blocks.map(b => b.dataset.phase)).size !== 5) findings.push({code: 'WX_PHASE_BLOCK_COUNT', n: blocks.length});
  for (const b of blocks) {
    const parts = [{q: b.getBoundingClientRect(), text: 'block'}, ...textRects(b),
                   ...Array.from(b.querySelectorAll('[data-wx="value"], [data-wx="bar"]')).map(e => ({q: e.getBoundingClientRect(), text: e.dataset.wx}))];
    if (!b.querySelector('[data-wx="value"]') || !b.querySelector('[data-wx="bar"]')) findings.push({code: 'WX_PHASE_BLOCK_INCOMPLETE', phase: b.dataset.phase});
    for (const {q, text} of parts) {
      const c = rectClear(q);
      if (c < MARGIN) findings.push({code: 'WX_PHASE_BLOCK_INTRUDES', phase: b.dataset.phase, part: text, clearanceMm: mm(c)});
    }
  }
  for (const d of document.querySelectorAll('[data-wx="disc"], [data-wx="track"]')) {
    const q = d.getBoundingClientRect();
    const c = Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy) - q.width / 2 - rOuter;
    if (c < MARGIN) findings.push({code: 'WX_PHASE_DISC_INTRUDES', phase: d.dataset.phase, part: d.dataset.wx, clearanceMm: mm(c)});
  }
  return findings;
}
"""

def build_pages():
    """Generate every page. Returns dict surface -> list of (page_id, number, html, struct)."""
    cust = [C.cover(), C.identity(), C.contents(), C.glance(), C.four_pillars(), C.foundation(), C.day_master(), C.wu_xing(), C.five_phases(), C.ten_gods(), C.hidden_stems()]
    fx_c = json.loads((ROOT / "longform" / "fixture-customer-chapter.json").read_text())
    lf_pages, lf_layout = L.render(fx_c, 12, "customer", "read", L.CHAPTER_REF)
    cust += lf_pages
    cust += [C.reflection(), C.summary(), C.closing(), C.method_note()]
    fx_v6 = json.loads((ROOT / "longform" / "fixture-v6-677.json").read_text())
    v6_pages, v6_layout = L.render(fx_v6, 1, "developer", "gen", None)
    zero = C.wu_xing(vector=FIX_ZERO["vector"], page=8, fixture_id=FIX_ZERO["fixtureId"], surface="developer")
    return cust, {"customer": (fx_c, lf_layout, lf_pages), "v6": (fx_v6, v6_layout, v6_pages)}, zero

FIX_ZERO = S.FIX["wuXingZeroCase"]

def write(page_tuple, folder):
    pid, n, html, st = page_tuple
    f = SRC / f"{pid}.html"; f.write_text(html, encoding="utf-8")
    return {"pageId": pid, "pageNumber": n, "html": f, "struct": json.loads(json.dumps(st)), "surface": st["surface"], "folder": folder}

def render_all(entries, ctx):
    page = ctx.new_page(); page.set_viewport_size({"width": A4_PX[0], "height": A4_PX[1]})
    for e in entries:
        page.goto(e["html"].resolve().as_uri()); page.wait_for_load_state("networkidle"); page.evaluate("document.fonts.ready"); page.wait_for_timeout(80)
        png = e["folder"] / f"{e['pageId']}.png"; pdf = e["folder"] / f"{e['pageId']}.pdf"
        page.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": A4_PX[0], "height": A4_PX[1]})
        page.pdf(path=str(pdf), width="210mm", height="297mm", print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}, prefer_css_page_size=True)
        e["dom"] = page.evaluate(DOM_SCAN) + page.evaluate(WX_GEOMETRY_SCAN, e["struct"]["pageId"].startswith("wu-xing-distribution"))
        e["png"], e["pdf"] = png, pdf
        e["pngSha256"] = sha(png.read_bytes()); e["structuralSha256"] = S.structural_hash(e["struct"])
    page.close()

def merge(entries, target):
    pdf = pikepdf.Pdf.new()
    for e in entries:
        src = pikepdf.open(e["pdf"]); pdf.pages.extend(src.pages)
    pdf.docinfo["/Title"] = target.stem; pdf.docinfo["/Producer"] = "Bazodiac FINAL build"
    pdf.save(target, deterministic_id=True, fix_metadata_version=True)

def contact_sheet(entries, target, cols=4):
    pick = entries[:20]
    w, h = 400, 566; pad = 28; labelh = 30
    rows = (len(pick) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * pad, rows * (h + labelh) + (rows + 1) * pad + 60), "#EBE7DD")
    d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype(str(ROOT / "fonts" / "Inter-Medium.ttf"), 15); big = ImageFont.truetype(str(ROOT / "fonts" / "InterDisplay-Light.ttf"), 30)
    except Exception: font = big = ImageFont.load_default()
    d.text((pad, 18), "BAZODIAC · FINAL DESIGN SYSTEM · CUSTOMER PAGE FAMILY (V4 shell · V6 spine · V3 IA · V2 rhythm · V5 tokens)", fill="#16181A", font=big)
    for i, e in enumerate(pick):
        im = Image.open(e["png"]).convert("RGB").resize((w, h), Image.LANCZOS)
        x = pad + (i % cols) * (w + pad); y = 60 + pad + (i // cols) * (h + labelh + pad)
        sheet.paste(im, (x, y)); d.rectangle([x - 1, y - 1, x + w, y + h], outline="#DCD7CB")
        d.text((x, y + h + 8), f"{e['pageNumber']:02d}  {e['pageId'].split('-', 1)[1].replace('-', ' ')}", fill="#4A4F52", font=font)
    sheet.save(target, optimize=True)

def main():
    started = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    cust, lf, zero = build_pages()
    entries = [write(p, CUST) for p in cust]
    dev_entries = []
    fx_v6, v6_layout, v6_pages = lf["v6"]; fx_c, lf_layout, lf_pages = lf["customer"]
    v6_entries = [write(p, DEV) for p in v6_pages]
    zero_entry = write(zero, DEV)
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(device_scale_factor=2)
        render_all(entries, ctx); render_all(v6_entries + [zero_entry], ctx)
        # developer pages that depend on rendered evidence
        dev_pages = [D.glyph_proof(), D.glyph_style_page(), D.wordmark_page(), D.bindings_page([e["struct"] for e in entries]), D.negative_page()]
        dev_pages.append(D.layout_evidence_page(6, "Customer chapter · 749 words", [str(e["png"].resolve()) for e in entries if "longform" in e["pageId"]], lf_layout, "Customer-safe general-education chapter, the shipped long-form stress proof."))
        dev_pages.append(D.layout_evidence_page(7, "V6 baseline fixture · pagination-stress-v1", [str(e["png"].resolve()) for e in v6_entries], v6_layout, "The V6 evidence fixture carried verbatim (non-canonical layout content) through the final layout: continuity with the V6 baseline."))
        dev_entries = [write(pg, DEV) for pg in dev_pages]
        render_all(dev_entries, ctx)
        receipts = [{"surface": e["surface"], "pageId": e["pageId"], "pageNumber": e["pageNumber"], "structuralSha256": e["structuralSha256"], "pngSha256": e["pngSha256"], "pdfSha256": sha(e["pdf"].read_bytes()), "domFindings": len(e["dom"]), "dom": e["dom"], "glyphRefs": len(e["struct"]["glyphRefs"])} for e in entries + v6_entries + [zero_entry] + dev_entries]
        # merge customer + dev PDFs, then receipts page with artifact hashes
        merge(entries, ROOT / "customer-sample.pdf")
        contact_sheet(entries, ROOT / "final-contact-sheet.png")
        art = {"customer-sample.pdf": sha((ROOT / "customer-sample.pdf").read_bytes())[7:], "final-contact-sheet.png": sha((ROOT / "final-contact-sheet.png").read_bytes())[7:],
               "glyphs/manifest.json": S.MANIFEST["manifestSha256"][7:], "tokens.json": sha((ROOT / "tokens.json").read_bytes())[7:], "assets/wordmark.svg": D.WM_META["sha256"][7:]}
        rec_entry = write(D.receipts_page(8, receipts, art), DEV)
        render_all([rec_entry], ctx)
        receipts.append({"surface": "developer", "pageId": rec_entry["pageId"], "pageNumber": 8, "structuralSha256": rec_entry["structuralSha256"], "pngSha256": rec_entry["pngSha256"], "pdfSha256": sha(rec_entry["pdf"].read_bytes()), "domFindings": len(rec_entry["dom"]), "dom": rec_entry["dom"], "glyphRefs": 0})
        merge(dev_entries[:5] + [zero_entry] + v6_entries + dev_entries[5:] + [rec_entry], ROOT / "developer-proof.pdf")
        b.close()
    art["developer-proof.pdf"] = sha((ROOT / "developer-proof.pdf").read_bytes())[7:]
    receipt = {"receiptVersion": "bazodiac-final-render-receipt@1.0.0", "generatedAt": started, "designTokensSha256": sha((ROOT / "tokens.json").read_bytes()),
               "glyphManifestSha256": S.MANIFEST["manifestSha256"], "wordmarkSha256": D.WM_META["sha256"], "geometryCentipoints": json.loads((ROOT / "tokens.json").read_text())["geometryCentipoints"],
               "pinnedFaces": [{"label": k, "file": str(v.name), "sha256": sha(v.read_bytes())} for k, v in {"regular": ROOT / "fonts" / "Inter-Regular.ttf", "medium": ROOT / "fonts" / "Inter-Medium.ttf", "display-light": ROOT / "fonts" / "InterDisplay-Light.ttf"}.items()]
                              + [{"label": "informational-cjk", "file": "NotoSansCJK-Regular.ttc (system)", "sha256": sha(pathlib.Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc").read_bytes())}],
               "harness": {"renderer": "Chromium (Playwright) — proof tooling, not a production contract", "deviceScaleFactor": 2},
               "pages": receipts, "artifacts": art}
    (ROOT / "render-receipt.json").write_text(json.dumps(receipt, indent=2, ensure_ascii=False))
    (ROOT / "longform" / "pagination-report.json").write_text(json.dumps({
        "reportVersion": "bazodiac-final-pagination-report@1.0.0",
        "rules": {"orphanMinLines": 2, "widowMinLines": 2, "keepWithNextLines": 2, "atomic": ["pullQuote", "keyInsight"], "shrinkToFit": False, "clipping": False, "semanticShortening": False, "hyphenation": False, "justification": False, "minBandLines": 8, "shortFinalPageRule": "fill < 60% receives chapter reference panel (no stretch, no shrink)"},
        "fixtures": [{"fixtureId": fx_c["fixtureId"], "surface": "customer", "wordCount": lf_layout["wordCount"], "pages": len(lf_layout["pages"]), "lines": lf_layout["lineCount"], "findings": lf_layout["findings"], "structuralSha256": lf_layout["structuralSha256"], "layout": lf_layout},
                     {"fixtureId": fx_v6["fixtureId"], "surface": "developer", "wordCount": v6_layout["wordCount"], "pages": len(v6_layout["pages"]), "lines": v6_layout["lineCount"], "findings": v6_layout["findings"], "structuralSha256": v6_layout["structuralSha256"], "layout": v6_layout}]}, indent=1, ensure_ascii=False))
    # per-page structure dumps (rebuild source)
    sd = ROOT / "structures"; sd.mkdir(exist_ok=True)
    for e in entries + v6_entries + [zero_entry] + dev_entries + [rec_entry]:
        (sd / f"{e['pageId']}.json").write_text(json.dumps(e["struct"], indent=1, ensure_ascii=False))
    dom_total = sum(len(e["dom"]) for e in entries + v6_entries + [zero_entry] + dev_entries + [rec_entry])
    print("customer pages", len(entries), "dev pages", len(dev_entries) + len(v6_entries) + 2, "DOM findings", dom_total)
    for e in entries + v6_entries + [zero_entry] + dev_entries + [rec_entry]:
        if e["dom"]: print("  ", e["pageId"], e["dom"][:4])
    return receipt

if __name__ == "__main__":
    main()
