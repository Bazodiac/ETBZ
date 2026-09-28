#!/usr/bin/env python3
"""Executed negative evidence for the gates of the Bazodiac PDF renderer (ETBZ-55).

A gate that has never failed is not proven. Each canary below breaks exactly one
thing - the projection, a pin, the host fonts, or one page builder - and runs the
real renderer (`render_pdf.main`) in a child process against it. The canary holds
only if the run ends BLOCKED at the expected check (with the expected finding
code where the check reports findings), exits 1, and leaves no PDF and no
ArtifactManifest behind. The results are written to
docs/evidence/etbz-55/renderer-canaries.json, bound to the renderer source
digest; the contract suite requires every canary to hold and the digest to equal
the one the committed ArtifactManifest states.

    PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
    "$PY" tools/pdf-renderer/qa/run_canaries.py --executed-at 2026-09-28

Local only, like the renderer. A doctored projection is rehashed where the canary
targets a later gate, so that the identity check lets it through; the renderer
trusts a projection only as far as its hash, which is exactly what the hash
canaries prove.
"""
from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import argparse  # noqa: E402
import json  # noqa: E402
import pathlib  # noqa: E402
import platform  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
RENDERER = HERE.parent
ROOT = RENDERER.parent.parent
sys.path.insert(0, str(RENDERER))
import pages as P  # noqa: E402
import render_pdf as R  # noqa: E402

PROJECTION = ROOT / "docs" / "evidence" / "etbz-55" / "presentation-projection.json"
OUT = ROOT / "docs" / "evidence" / "etbz-55" / "renderer-canaries.json"
CANARY_VERSION = "bazodiac-renderer-canaries.v1"


# ------------------------------------------------------------------ helpers (child side)

def u16(text: str) -> bytes:
    return text.encode("utf-16-be")


def load() -> dict:
    return json.loads(PROJECTION.read_text(encoding="utf-8"))


def rehash(projection: dict) -> dict:
    projection["structuralHash"] = R.structural_hash({k: v for k, v in projection.items() if k != "structuralHash"})
    return projection


def page_of(projection: dict, kind: str) -> dict:
    return next(page for page in projection["pages"] if page["content"]["kind"] == kind)


def restring(projection: dict, page: dict, old: str, new: str) -> None:
    """Replace one printed string and keep the page strings and the inventory exact."""
    page["strings"] = sorted({new if s == old else s for s in page["strings"]}, key=u16)
    projection["customerStrings"] = sorted(set().union(*(set(p["strings"]) for p in projection["pages"])), key=u16)


def wrap_builder(kind: str, transform) -> None:
    original = P.BUILDERS[kind]
    P.BUILDERS[kind] = lambda ctx, page, c: transform(original(ctx, page, c), ctx, page, c)


def wrap_page_html(transform) -> None:
    original = P.page_html
    P.page_html = lambda ctx, page: transform(original(ctx, page), page)


def patch_digest(path: str) -> None:
    original = R.asset_digests
    R.asset_digests = lambda: {**original(), path: "0" * 64}


def fake_cjk_face(directory: pathlib.Path) -> None:
    """A second, different font file that names itself Noto Sans CJK SC / NotoSansCJKsc-Regular."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    directory.mkdir(parents=True, exist_ok=True)
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder([".notdef"])
    builder.setupCharacterMap({})
    pen = TTGlyphPen(None)
    pen.moveTo((0, 0))
    pen.lineTo((0, 500))
    pen.lineTo((500, 500))
    pen.closePath()
    builder.setupGlyf({".notdef": pen.glyph()})
    builder.setupHorizontalMetrics({".notdef": (500, 0)})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": "Noto Sans CJK SC", "styleName": "Regular", "psName": "NotoSansCJKsc-Regular"})
    builder.setupOS2()
    builder.setupPost()
    builder.save(str(directory / "FakeNotoSansCJKsc.ttf"))


# ------------------------------------------------------------------ the canaries
# Each apply(work) patches the renderer in this child process and returns a doctored projection, or None for
# the committed one.

def c_projection_version(work):
    p = load()
    p["projectionVersion"] = "bazodiac-presentation-projection.v0"
    return rehash(p)


def c_projection_hash(work):
    p = load()
    page_of(p, "cover")["content"]["title"] = "Ein anderer Titel"
    return p


def c_template_hash(work):
    p = load()
    p["template"]["labels"]["brand"]["text"] = "Bazodiak"
    return rehash(p)


def c_font_pin(work):
    patch_digest("fonts/Inter-Regular.ttf")


def c_template_asset_pin(work):
    patch_digest("glyphs/sprite.svg")


def c_cjk_face_pin(work):
    R.CJK_FACE["sha256"] = "0" * 64


def c_cjk_face_ambiguous(work):
    fake_cjk_face(work / "fonts")
    R.CJK_DIRS = [*R.CJK_DIRS, work / "fonts"]


def c_glyph_out_of_contract(work):
    p = load()
    p["displayGlyphs"] = sorted([*p["displayGlyphs"], "天"], key=u16)
    return rehash(p)


def c_cjk_uncovered(work):
    p = load()
    p["cjkText"] = sorted([*p["cjkText"], "\ue000"], key=u16)
    return rehash(p)


def c_page_build(work):
    p = load()
    page_of(p, "methodNote")["content"]["kind"] = "unknownKind"
    return rehash(p)


def c_text_injected(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html + '<div class="body" style="position:absolute;left:20mm;top:240mm">Ein Satz, den die Projektion nicht kennt.</div>')


def c_text_dropped(work):
    original = P.BUILDERS["summary"]
    P.BUILDERS["summary"] = lambda ctx, page, c: original(ctx, page, {**c, "rows": c["rows"][:-1]})


def c_glyph_not_in_projection(work):
    p = load()
    p["displayGlyphs"] = [g for g in p["displayGlyphs"] if g != "庚"]
    return rehash(p)


def c_generated_content(work):
    wrap_page_html(lambda html, page: html.replace("</head>", '<style>.kicker::after{content:" neu"}</style></head>', 1))


def c_invisible_text(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:10mm;max-width:130mm;color:transparent"', 1))


def c_clipped_by_ancestor(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:10mm;max-width:130mm;height:6mm;overflow:hidden"', 1))


def c_overflows_container(work):
    # The real defect of the first round-2 render: separators without a break opportunity let the sidebar's
    # Day-Master line run out of its panel.
    P.SEP_BREAK = P.SEP


def c_outside_sheet(work):
    p = load()
    page = page_of(p, "methodNote")
    old = page["content"]["paragraphs"][0]
    words = old.split(" ")
    new = " ".join(words[i % len(words)] for i in range(900))[:5900].rsplit(" ", 1)[0]
    page["content"]["paragraphs"][0] = new
    restring(p, page, old, new)
    return rehash(p)


def c_line_exceeds_measure(work):
    P.LONG_STYLE_CSS["body"] = P.LONG_STYLE_CSS["body"].replace("font-size:10.5pt", "font-size:11.5pt")


def c_overlap(work):
    wrap_builder("methodNote", lambda html, ctx, page, c: html.replace('margin-top:10mm;max-width:130mm"', 'margin-top:-14mm;max-width:130mm"', 1))


def c_wu_xing_medallion(work):
    P.WX_GEOMETRY["medallion"]["d"] = 100


def c_unpinned_face(work):
    wrap_page_html(lambda html, page: html.replace("</head>", '<style>.sheet,.sheet *{font-family:"Helvetica" !important}</style></head>', 1))


def c_font_load_failed(work):
    original = P.Context.__init__

    def init(self, tokens_css, base_css, *rest):
        original(self, tokens_css, base_css.replace((R.ASSETS / "fonts").as_uri(), "file:///nonexistent-etbz55-fonts"), *rest)

    P.Context.__init__ = init


def c_pdf_page_count(work):
    p = load()
    p["pageCount"] = p["pageCount"] + 1
    return rehash(p)


def c_determinism(work):
    calls = {"n": 0}
    pages = len(load()["pages"])

    def vary(html, page):
        run = calls["n"] // pages
        calls["n"] += 1
        marker = f'<div style="position:absolute;left:{run * 3}px;top:0;width:2px;height:2px;background:#000"></div>'
        return html.replace("</div></body></html>", marker + "</div></body></html>", 1)

    wrap_page_html(vary)


# id -> (gate, what the canary breaks, expected check, expected finding code or None, apply)
CANARIES = {
    "projection-version": ("projection identity", "the projection declares another projection version (rehashed)", "PROJECTION_VERSION", None, c_projection_version),
    "projection-hash": ("projection identity", "a cover string is edited without rehashing the projection", "PROJECTION_HASH", None, c_projection_hash),
    "template-hash": ("template identity", "a template label is edited; the projection is rehashed, the template is not", "TEMPLATE_HASH", None, c_template_hash),
    "font-pin": ("font pins", "the committed Inter-Regular digest no longer matches", "FONT_PIN", None, c_font_pin),
    "template-asset-pin": ("template asset pins", "the committed glyph sprite digest no longer matches", "TEMPLATE_ASSET_PIN", None, c_template_asset_pin),
    "cjk-face-pin": ("font pins", "the pinned Noto Sans CJK digest no longer matches the host file", "CJK_FACE_PIN", None, c_cjk_face_pin),
    "cjk-face-ambiguous": ("font pins", "a second font file naming itself Noto Sans CJK SC sits in a font directory", "CJK_FACE_AMBIGUOUS", None, c_cjk_face_ambiguous),
    "glyph-out-of-contract": ("glyphs", "the projection lists a display glyph outside the 27 (rehashed)", "GLYPH_OUT_OF_CONTRACT", None, c_glyph_out_of_contract),
    "cjk-uncovered": ("CJK coverage", "the projection lists a character the pinned SC face does not cover (rehashed)", "CJK_GLYPH_UNCOVERED", None, c_cjk_uncovered),
    "page-build": ("page build", "a page of a kind no builder knows (rehashed)", "PAGE_BUILD", None, c_page_build),
    "text-injected": ("renderer adds no text", "the method-note builder prints a sentence the projection does not carry", "PAGE_QA", "TEXT_NOT_IN_PROJECTION", c_text_injected),
    "text-dropped": ("renderer drops no text", "the summary builder leaves out its last fact row", "PAGE_QA", "TEXT_MISSING_FROM_PAGE", c_text_dropped),
    "glyph-not-in-projection": ("glyphs", "a page draws a display glyph the projection does not list (rehashed)", "PAGE_QA", "GLYPH_NOT_IN_PROJECTION", c_glyph_not_in_projection),
    "generated-content": ("renderer adds no text", "the stylesheet adds text through ::after", "PAGE_QA", "PSEUDO_CONTENT", c_generated_content),
    "invisible-text": ("no hidden text", "the method note is set in a transparent colour", "PAGE_QA", "TEXT_INVISIBLE", c_invisible_text),
    "clipped-by-ancestor": ("no content cut", "the method note is cut to 6 mm by its container", "PAGE_QA", "CLIPPED_BY_ANCESTOR", c_clipped_by_ancestor),
    "overflows-container": ("no content cut", "separators lose their break opportunity; the sidebar line runs out of its panel", "PAGE_QA", "OVERFLOWS_CONTAINER", c_overflows_container),
    "outside-sheet": ("no content cut", "the method note is 5,900 characters long (rehashed)", "PAGE_QA", "OUTSIDE_SHEET", c_outside_sheet),
    "line-exceeds-measure": ("long-form measure", "long-form body text is set one point larger than it was measured", "PAGE_QA", "LINE_EXCEEDS_MEASURE", c_line_exceeds_measure),
    "overlap": ("no overlap", "the method note is pulled up over the page title", "PAGE_QA", "OVERLAP", c_overlap),
    "wu-xing-medallion": ("Wu Xing medallion", "the medallion is drawn 100 mm wide", "PAGE_QA", "WX_DISC_INTRUDES", c_wu_xing_medallion),
    "unpinned-face": ("font pins", "every page is set in a host face", "PAGE_QA", "TEXT_SET_IN_UNPINNED_FACE", c_unpinned_face),
    "font-load-failed": ("font pins", "the Inter web fonts point at a missing directory", "PAGE_QA", "FONT_LOAD_FAILED", c_font_load_failed),
    "pdf-page-count": ("PDF readback", "the projection states one page more than it has (rehashed)", "PDF_READBACK", "PDF_PAGE_COUNT", c_pdf_page_count),
    "determinism": ("determinism", "every run draws one marker pixel at a different place", "DETERMINISM", None, c_determinism),
}


def child(canary_id: str, work: pathlib.Path) -> int:
    projection = CANARIES[canary_id][4](work)
    path = PROJECTION
    if projection is not None:
        path = work / "projection.json"
        path.write_text(json.dumps(projection, ensure_ascii=False), encoding="utf-8")
    sys.argv = ["render_pdf.py", "--projection", str(path), "--out", str(work / "out"), "--runs", "2",
                "--executed-at", "canary", "--repository-head", "canary"]
    return R.main()


# ------------------------------------------------------------------ parent

def run_one(canary_id: str) -> dict:
    gate, mutation, expected_check, expected_code, _ = CANARIES[canary_id]
    with tempfile.TemporaryDirectory(prefix=f"etbz55-canary-{canary_id}-") as tmp:
        work = pathlib.Path(tmp)
        proc = subprocess.run([sys.executable, "-B", str(pathlib.Path(__file__).resolve()), "--child", canary_id, "--work", str(work)],
                              capture_output=True, text=True, timeout=1800)
        out = work / "out"
        report_path = out / "qa-report.json"
        report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else None
        pdfs = sorted(str(p.relative_to(out)) for p in out.rglob("*.pdf")) if out.exists() else []
        manifest = (out / "artifact-manifest.json").is_file()
    last = report["checks"][-1] if report else None
    detail = last["detail"] if last else None
    codes = sorted({f["code"] for f in detail if isinstance(f, dict) and "code" in f}) if isinstance(detail, list) else []
    holds = (proc.returncode == 1 and report is not None and report["status"] == "BLOCKED" and last["result"] == "BLOCKED"
             and last["id"] == expected_check and (expected_code is None or expected_code in codes) and not pdfs and not manifest)
    result = {
        "id": canary_id, "gate": gate, "mutation": mutation, "expectedCheck": expected_check, "expectedCode": expected_code,
        "observed": {"exitCode": proc.returncode, "status": report["status"] if report else None, "check": last["id"] if last else None, "codes": codes},
        "pdfWritten": bool(pdfs), "manifestWritten": manifest,
        "verdict": "BLOCKED_AS_EXPECTED" if holds else "NOT_AS_EXPECTED",
    }
    if not holds:
        result["stderrTail"] = proc.stderr[-2000:]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--child")
    parser.add_argument("--work")
    parser.add_argument("--executed-at")
    parser.add_argument("--only", nargs="*")
    args = parser.parse_args()
    if args.child:
        return child(args.child, pathlib.Path(args.work))
    if not args.executed_at:
        parser.error("--executed-at is required")
    ids = args.only or list(CANARIES)
    results = []
    for canary_id in ids:
        result = run_one(canary_id)
        results.append(result)
        print(f"{canary_id:26s} {result['verdict']:20s} {result['observed']['check']} {result['observed']['codes'][:4]}", flush=True)
    held = sum(1 for r in results if r["verdict"] == "BLOCKED_AS_EXPECTED")
    projection = load()
    record = {
        "canaryVersion": CANARY_VERSION,
        "renderer": {"ref": R.RENDERER_REF, "sourceSha256": R.renderer_source_digest()},
        "projectionStructuralHash": projection["structuralHash"],
        "executedAt": args.executed_at,
        "host": f"{platform.system()} {platform.machine()}",
        "summary": {"canaries": len(results), "blockedAsExpected": held},
        "canaries": results,
    }
    if args.only:
        print(json.dumps(record["summary"]))
        return 0 if held == len(results) else 1
    OUT.write_text(json.dumps(record, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {held}/{len(results)} canaries blocked as expected")
    return 0 if held == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
