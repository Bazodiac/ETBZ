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

Steps: (1) environment and font pins — the five Inter faces equal the committed
asset digests, the informational CJK face equals the pinned Noto Sans CJK TTC;
(2) glyph and CJK checks — every display glyph is one of the 27, every CJK
character is covered by the pinned SC face and is one em wide (the advance the
long-form layout measured); (3) render every page through Chromium in
deterministic mode, `--runs` times; (4) QA per page — every text node is a
projection string, every display glyph is a projection glyph, nothing outside
the sheet, no line wider than its measure, no overlap, the Wu Xing medallion
clear, every web font loaded; (5) merge deterministically, read the PDF back —
MIME magic, page count, A4 media boxes, only the pinned faces embedded; (6) the
last two runs must be byte-identical; (7) only then write the PDF, the contact
sheet, the QA report and the manifest. A failed check writes the QA report with
`BLOCKED` and no PDF — there is no partial artefact.

Local only: Python 3 with playwright (Chromium), pikepdf, fontTools, Pillow.
Nothing here runs in CI; CI verifies the projection and the committed evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import platform
import shutil
import sys
import tempfile
from importlib.metadata import version as pkg_version

import pikepdf
from fontTools.ttLib import TTCollection
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

# The renderer writes nothing into the repository - not even a bytecode cache beside its sources.
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pages as P  # noqa: E402

RENDERER_REF = "bazodiac-pdf-renderer@1.0.0"
MANIFEST_VERSION = "bazodiac-artifact-manifest.v1"
QA_REPORT_VERSION = "bazodiac-pdf-qa-report.v1"
PROJECTION_VERSION = "bazodiac-presentation-projection.v1"

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ASSETS = ROOT / "assets" / "visual-system-v1"
CHROMIUM_ARGS = ["--deterministic-mode", "--disable-gpu", "--force-color-profile=srgb", "--font-render-hinting=none"]
A4_PX = (794, 1123)
A4_PT = (595.2756, 841.8898)
SEPARATORS = {"·"}

INTER_FILES = ["Inter-Regular.ttf", "Inter-Medium.ttf", "Inter-SemiBold.ttf", "InterDisplay-Light.ttf", "InterDisplay-Regular.ttf"]
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
EMBEDDED_FONT_PATTERN = ("Inter-", "InterDisplay-", "NotoSansCJKsc-")
# The faces Chromium may actually use to set text, by PostScript name: the committed Inter faces (web fonts) and the pinned SC face.
ALLOWED_POSTSCRIPT_PREFIXES = ("Inter-", "InterDisplay-", "NotoSansCJKsc-")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: pathlib.Path) -> str:
    return sha256_bytes(path.read_bytes())


class Blocked(Exception):
    def __init__(self, check: str, detail: object):
        super().__init__(f"{check}: {detail}")
        self.check = check
        self.detail = detail


# ------------------------------------------------------------------ DOM QA (runs in the page)

DOM_QA = """
(allowed) => {
  const W = 793.7, H = 1122.5, MM = 96 / 25.4, CP = 96 / 7200, findings = [];
  const allowedSet = new Set(allowed.strings), glyphSet = new Set(allowed.glyphs);
  const sheet = document.querySelector('.sheet');
  const texts = []; const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT); let n;
  while ((n = walker.nextNode())) { const s = n.textContent.trim(); if (s.length === 0) continue;
    if (n.parentElement && n.parentElement.closest('title')) { if (!allowedSet.has(s)) findings.push({code: 'TEXT_NOT_IN_PROJECTION', text: s.slice(0, 60)}); continue; }
    texts.push(s); if (!allowedSet.has(s) && !allowed.separators.includes(s)) findings.push({code: 'TEXT_NOT_IN_PROJECTION', text: s.slice(0, 60)}); }
  const glyphs = Array.from(sheet.querySelectorAll('svg.disp')).map(g => String.fromCodePoint(parseInt(g.dataset.glyph.slice(2), 16)));
  for (const g of glyphs) if (!glyphSet.has(g)) findings.push({code: 'GLYPH_NOT_IN_PROJECTION', glyph: g});
  const els = []; const walk = (node) => { for (const c of node.children) walk(c);
    const own = Array.from(node.childNodes).some(x => x.nodeType === 3 && x.textContent.trim().length);
    if (own || (node.tagName === 'svg' && node.classList.contains('disp'))) els.push(node); };
  walk(sheet);
  const boxes = els.map(e => ({e, r: e.getBoundingClientRect()})).filter(b => b.r.width > 0 && b.r.height > 0 && !b.e.closest('title'));
  for (const b of boxes) {
    if (b.r.left < -0.5 || b.r.top < -0.5 || b.r.right > W + 0.5 || b.r.bottom > H + 0.5) findings.push({code: 'OUTSIDE_SHEET', text: b.e.textContent.trim().slice(0, 40)});
    if (b.e.scrollWidth > b.e.clientWidth + 1 && getComputedStyle(b.e).overflow !== 'visible') findings.push({code: 'CLIPPED', text: b.e.textContent.trim().slice(0, 40)});
    if (b.e.classList.contains('longline')) { const measure = parseInt(b.e.dataset.measureCp, 10) * CP;
      if (b.r.width > measure + 0.5) findings.push({code: 'LINE_EXCEEDS_MEASURE', text: b.e.textContent.slice(0, 40), widthPx: +b.r.width.toFixed(2), measurePx: +measure.toFixed(2)}); }
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 1.5 && y > 1.5) findings.push({code: 'OVERLAP', a: a.e.textContent.trim().slice(0, 30), b: b.e.textContent.trim().slice(0, 30)});
  }
  return {findings, textCount: texts.length, glyphCount: glyphs.length};
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
    cjk_path = next((d / CJK_FACE["file"] for d in CJK_DIRS if (d / CJK_FACE["file"]).is_file()), None)
    if cjk_path is None:
        raise Blocked("CJK_FACE_MISSING", {"file": CJK_FACE["file"], "searched": [str(d) for d in CJK_DIRS]})
    cjk_sha = sha256_file(cjk_path)
    if cjk_sha != CJK_FACE["sha256"]:
        raise Blocked("CJK_FACE_PIN", {"file": str(cjk_path), "expected": CJK_FACE["sha256"], "actual": cjk_sha})
    fonts.append({"role": "informational-cjk", "family": CJK_FACE["family"], "file": CJK_FACE["file"], "sha256": f"sha256:{cjk_sha}",
                  "upstream": CJK_FACE["upstream"], "licence": CJK_FACE["licence"], "licenceFile": CJK_FACE["licenceFile"], "installedAt": "host font directory"})
    return {"fonts": fonts, "cjkPath": cjk_path}


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

def render_run(projection: dict, ctx: P.Context, work: pathlib.Path) -> dict:
    pages_dir = work / "pages"
    pages_dir.mkdir(parents=True)
    allowed = {"strings": projection["customerStrings"], "glyphs": projection["displayGlyphs"], "separators": sorted(SEPARATORS)}
    entries = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=CHROMIUM_ARGS)
        chromium_version = browser.version
        context = browser.new_context(device_scale_factor=2)
        page = context.new_page()
        page.set_viewport_size({"width": A4_PX[0], "height": A4_PX[1]})
        for entry in projection["pages"]:
            html_path = pages_dir / f"{entry['pageLabel']}-{entry['pageId']}.html"
            html_path.write_text(P.page_html(ctx, entry), encoding="utf-8")
            page.goto(html_path.as_uri())
            page.wait_for_load_state("networkidle")
            fonts = page.evaluate(FONT_STATUS)
            page.evaluate("Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => null)))")
            page.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
            page.wait_for_timeout(250)
            png = pages_dir / f"{entry['pageLabel']}-{entry['pageId']}.png"
            pdf = pages_dir / f"{entry['pageLabel']}-{entry['pageId']}.pdf"
            page.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": A4_PX[0], "height": A4_PX[1]})
            page.pdf(path=str(pdf), width="210mm", height="297mm", print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                     prefer_css_page_size=True)
            dom = page.evaluate(DOM_QA, allowed)
            used_fonts = platform_fonts(context, page)
            wx = page.evaluate(WX_QA) if entry["content"]["kind"] == "wuXing" else []
            # "unloaded" is a declared face the page never asked for; "error" is a face that failed and fell back.
            failed = [f for f in fonts if f["status"] == "error"]
            findings = dom["findings"] + wx + ([{"code": "FONT_LOAD_FAILED", "fonts": failed}] if failed else [])
            foreign = sorted(f"{family}|{ps}" for family, ps in used_fonts if not ps.startswith(ALLOWED_POSTSCRIPT_PREFIXES))
            if foreign:
                findings.append({"code": "TEXT_SET_IN_UNPINNED_FACE", "families": foreign})
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
    return {"entries": entries, "pdf": merged, "pdfSha256": sha256_file(merged), "chromium": chromium_version}


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
            if name != "Type3" and not base.startswith(EMBEDDED_FONT_PATTERN):
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


def platform_fonts(context, page) -> set:
    """(family, postScriptName) of every platform font Chromium used to set the page's text (DevTools CSS domain)."""
    cdp = context.new_cdp_session(page)
    try:
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root = cdp.send("DOM.getDocument", {"depth": 0})["root"]["nodeId"]
        node_ids = cdp.send("DOM.querySelectorAll", {"nodeId": root, "selector": ".sheet, .sheet *"})["nodeIds"]
        used = set()
        for node_id in node_ids:
            for font in cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node_id})["fonts"]:
                used.add((font["familyName"], font.get("postScriptName", "")))
        return used
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
    if out_dir.exists():
        print(f"refusing to write into an existing directory: {out_dir}", file=sys.stderr)
        return 2
    projection_path = pathlib.Path(args.projection).resolve()
    projection_bytes = projection_path.read_bytes()
    projection = json.loads(projection_bytes)
    checks = []
    staging = pathlib.Path(tempfile.mkdtemp(prefix="bazodiac-pdf-"))
    status = "BLOCKED"
    manifest = None
    runs = []
    try:
        if projection.get("projectionVersion") != PROJECTION_VERSION:
            raise Blocked("PROJECTION_VERSION", projection.get("projectionVersion"))
        checks.append({"id": "PROJECTION_VERSION", "result": "PASS", "detail": PROJECTION_VERSION})
        env = check_environment()
        checks.append({"id": "FONT_PINS", "result": "PASS", "detail": [f["file"] for f in env["fonts"]]})
        glyph_manifest = json.loads((ASSETS / "glyphs" / "manifest.json").read_text())
        checks.append({"id": "GLYPHS_AND_CJK", "result": "PASS", "detail": check_glyphs_and_cjk(projection, env["cjkPath"], glyph_manifest)})

        base_css = (HERE / "base.css").read_text().replace("{{FONTS}}", (ASSETS / "fonts").as_uri())
        ctx = P.Context((ASSETS / "tokens.css").read_text(), base_css, (ASSETS / "glyphs" / "sprite.svg").read_text(),
                        (ASSETS / "brand" / "wordmark.svg").read_text(), glyph_manifest, projection["longFormStyles"],
                        projection["template"]["geometry"]["contentW"])
        for run in range(args.runs):
            runs.append(render_run(projection, ctx, staging / f"run-{run + 1}"))
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
                         "glyphManifestSha256": projection["template"]["glyphManifestSha256"]},
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

    report = {"reportVersion": QA_REPORT_VERSION, "status": status, "state": "QA_PASSED" if status == "PASSED" else "BLOCKED",
              "projectionStructuralHash": projection.get("structuralHash"), "checks": checks,
              "pages": [{"pageLabel": e["pageLabel"], "pageId": e["pageId"], "pngSha256": f"sha256:{e['pngSha256']}", "textNodes": e["textNodes"],
                         "displayGlyphs": e["glyphs"], "platformFonts": e["platformFonts"], "findings": e["findings"]} for e in (runs[-1]["entries"] if runs else [])]}
    out_dir.mkdir(parents=True)
    (out_dir / "qa-report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    if status == "PASSED" and manifest is not None:
        shutil.copy2(runs[-1]["pdf"], out_dir / "bazodiac-reading.pdf")
        shutil.copy2(staging / "contact-sheet.png", out_dir / "contact-sheet.png")
        pages_out = out_dir / "pages"
        pages_out.mkdir()
        for e in runs[-1]["entries"]:
            shutil.copy2(e["png"], pages_out / e["png"].name)
        (out_dir / "artifact-manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    elif runs:
        # Diagnostics only: the page images of the blocked run, never a PDF.
        diagnostics = out_dir / "diagnostics"
        diagnostics.mkdir()
        for e in runs[-1]["entries"]:
            shutil.copy2(e["png"], diagnostics / e["png"].name)
    shutil.rmtree(staging, ignore_errors=True)
    print(json.dumps({"status": status, "out": str(out_dir), "checks": [(c["id"], c["result"]) for c in checks]}, ensure_ascii=False))
    if status != "PASSED":
        print(json.dumps(checks[-1], ensure_ascii=False, indent=1)[:4000], file=sys.stderr)
    return 0 if status == "PASSED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
