#!/usr/bin/env python3
"""Project-native proof entrypoint for the ETBZ-49 visual system.

Declared in the repository-root `.agent-proofs.json`, so the Delivery Runner can run it
at an exact commit without a per-run approval. It is also runnable by hand:

    python3 tools/visual-proof-harness/proof/run_proof.py --out .etbz-verify/visual-proof

Why this file exists: `build/build_all.py` expects the directory layout it was recovered
with — tokens, glyphs, fixtures, long-form fixtures, fonts and the wordmark beside it.
In this repository those inputs live under `assets/visual-system-v1/`, and build_all
exits 0 even when its DOM scan or Wu Xing oracle reports findings. This entrypoint:

  1. stages that layout in a fresh directory, from committed files only;
  2. runs the harness's own guards (including the prior-geometry counterexamples);
  3. renders every page through the harness's own builders, DOM scan and Wu Xing
     geometry oracle, and regenerates the contact sheet and merged PDFs;
  4. renders the Wu Xing page once more with the PRIOR defective geometry and requires
     the oracle to reject it, so a green result cannot come from an oracle that never fires;
  5. writes `proof-report.json` and exits non-zero on any finding.

It writes nothing outside --out and changes no tracked file. It is proof tooling: the
production contract is `src/application/visual/`, and nothing here is imported by it.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import json
import pathlib
import platform
import shutil
import subprocess
import sys

HARNESS = pathlib.Path(__file__).resolve().parent.parent
REPO = HARNESS.parent.parent
ASSETS = REPO / "assets" / "visual-system-v1"
REPORT_VERSION = "etbz49-visual-proof-report@1"

# Rendered-geometry measurement (read-only). The pass/fail oracle stays the harness's
# own WX_GEOMETRY_SCAN; this only reports the margins it decides on, in mm.
WX_MEASURE = """
() => {
  const MM = 96 / 25.4, mm = (px) => +(px / MM).toFixed(2);
  const m = document.querySelector('#wx-medallion[data-wx="medallion"]');
  if (!m) return null;
  const mr = m.getBoundingClientRect(), cs = getComputedStyle(m);
  const cx = mr.left + mr.width / 2, cy = mr.top + mr.height / 2;
  const rOuter = mr.width / 2, rInner = rOuter - parseFloat(cs.borderTopWidth || '0');
  const textRects = (el) => { const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 0 && q.height > 0) out.push(q); }
    return out; };
  const label = m.querySelector('[data-wx="centre-label"]');
  const labelMargin = label ? Math.min(...textRects(label).map(q => rInner - Math.max(...[[q.left, q.top], [q.right, q.top],
    [q.left, q.bottom], [q.right, q.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy))))) : null;
  const clear = (q) => Math.hypot(Math.max(q.left, Math.min(cx, q.right)) - cx, Math.max(q.top, Math.min(cy, q.bottom)) - cy) - rOuter;
  const phases = {};
  for (const b of document.querySelectorAll('[data-wx="phase-block"]')) {
    const rects = [b.getBoundingClientRect(), ...textRects(b), ...Array.from(b.querySelectorAll('[data-wx="value"], [data-wx="bar"]')).map(e => e.getBoundingClientRect())];
    phases[b.dataset.phase] = mm(Math.min(...rects.map(clear)));
  }
  return {medallionDiameterMm: mm(mr.width), labelLines: label ? textRects(label).length : 0,
          labelMarginMm: labelMargin === null ? null : mm(labelMargin), phaseClearanceMm: phases};
}
"""

FONT_STATUS = """
async () => { await document.fonts.ready;
  return Array.from(document.fonts).map(f => ({family: f.family.replace(/"/g, ''), weight: f.weight, status: f.status})); }
"""


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stage(root: pathlib.Path) -> None:
    """Rebuild the recovered harness layout from committed files only."""
    shutil.copytree(HARNESS / "build", root / "build", ignore=shutil.ignore_patterns("__pycache__"))
    (root / "src").mkdir()
    shutil.copy2(HARNESS / "src" / "base.css", root / "src" / "base.css")
    for name in ("tokens.css", "tokens.json", "design-system.json", "source-manifest.json"):
        shutil.copy2(ASSETS / name, root / name)
    for name in ("glyphs", "fixtures", "longform", "fonts"):
        shutil.copytree(ASSETS / name, root / name)
    # base.css loads url("../fonts/…") relative to the generated pages in src/pages/.
    # Without this copy Chromium silently falls back to a host font and every metric moves.
    shutil.copytree(ASSETS / "fonts", root / "src" / "fonts")
    (root / "assets").mkdir()
    for name in ("wordmark.svg", "wordmark.manifest.json"):
        shutil.copy2(ASSETS / "brand" / name, root / "assets" / name)


def source_revision() -> str | None:
    proc = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True, shell=False)
    return proc.stdout.strip() if proc.returncode == 0 else None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", required=True, help="output directory, relative to the repository root")
    args = parser.parse_args(argv)
    out = (REPO / args.out).resolve()
    if REPO.resolve() not in out.parents:
        print(f"refusing --out outside the repository: {out}", file=sys.stderr)
        return 2
    if out.exists():
        print(f"refusing to reuse an existing output directory: {out}", file=sys.stderr)
        return 2

    root = out / "stage"
    root.mkdir(parents=True)
    stage(root)
    sys.path.insert(0, str(root / "build"))
    import build_all as B  # noqa: E402  (the staged harness; ROOT resolves to `root`)
    import guards as G  # noqa: E402
    import pages_customer as C  # noqa: E402
    import pages_dev as D  # noqa: E402
    from playwright.sync_api import sync_playwright  # noqa: E402

    failures: list[str] = []

    # 1. The harness's own guards, including both prior-geometry counterexamples.
    guard_results = G.run_all()
    failures += [f"guard: {g['test']} expected {g['expected']}, observed {g['observed']}"
                 for g in guard_results if not g["pass"]]

    # 2. Every page through the harness's own builders, DOM scan and Wu Xing oracle (build_all.main order).
    cust, lf, zero = B.build_pages()
    entries = [B.write(p, B.CUST) for p in cust]
    _fx_v6, v6_layout, v6_pages = lf["v6"]
    _fx_c, lf_layout, _lf_pages = lf["customer"]
    # The paginator's own findings (widows, orphans, overflow …): build_all.main() only
    # records them in pagination-report.json; here they fail the proof.
    pagination = {name: {"words": layout["wordCount"], "pages": len(layout["pages"]), "lines": layout["lineCount"],
                         "findings": layout["findings"]}
                  for name, layout in (("customer", lf_layout), ("v6", v6_layout))}
    failures += [f"pagination: {name} {finding}" for name, info in pagination.items() for finding in info["findings"]]
    v6_entries = [B.write(p, B.DEV) for p in v6_pages]
    zero_entry = B.write(zero, B.DEV)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(device_scale_factor=2)
        B.render_all(entries, ctx)
        B.render_all(v6_entries + [zero_entry], ctx)
        dev_pages = [D.glyph_proof(), D.glyph_style_page(), D.wordmark_page(),
                     D.bindings_page([e["struct"] for e in entries]), D.negative_page()]
        dev_pages.append(D.layout_evidence_page(6, "Customer chapter · 749 words",
                                                [str(e["png"].resolve()) for e in entries if "longform" in e["pageId"]],
                                                lf_layout, "Customer-safe general-education chapter, the shipped long-form stress proof."))
        dev_pages.append(D.layout_evidence_page(7, "V6 baseline fixture · pagination-stress-v1",
                                                [str(e["png"].resolve()) for e in v6_entries], v6_layout,
                                                "The V6 evidence fixture carried verbatim (non-canonical layout content) through the final layout: continuity with the V6 baseline."))
        dev_entries = [B.write(pg, B.DEV) for pg in dev_pages]
        B.render_all(dev_entries, ctx)
        receipts = [{"surface": e["surface"], "pageId": e["pageId"], "pageNumber": e["pageNumber"],
                     "structuralSha256": e["structuralSha256"], "pngSha256": e["pngSha256"],
                     "pdfSha256": B.sha(e["pdf"].read_bytes()), "domFindings": len(e["dom"]), "dom": e["dom"],
                     "glyphRefs": len(e["struct"]["glyphRefs"])} for e in entries + v6_entries + [zero_entry] + dev_entries]
        B.merge(entries, out / "customer-sample.pdf")
        B.contact_sheet(entries, out / "final-contact-sheet.png")
        art = {"customer-sample.pdf": sha256(out / "customer-sample.pdf"),
               "final-contact-sheet.png": sha256(out / "final-contact-sheet.png"),
               "glyphs/manifest.json": B.S.MANIFEST["manifestSha256"][7:],
               "tokens.json": sha256(root / "tokens.json"), "assets/wordmark.svg": D.WM_META["sha256"][7:]}
        rec_entry = B.write(D.receipts_page(8, receipts, art), B.DEV)
        B.render_all([rec_entry], ctx)
        B.merge(dev_entries[:5] + [zero_entry] + v6_entries + dev_entries[5:] + [rec_entry], out / "developer-proof.pdf")
        all_entries = entries + v6_entries + [zero_entry] + dev_entries + [rec_entry]

        # 3. Measured geometry and font loading on the rendered Wu Xing pages.
        page = ctx.new_page()
        page.set_viewport_size({"width": B.A4_PX[0], "height": B.A4_PX[1]})
        wu_xing = {}
        for e in (x for x in all_entries if x["struct"]["pageId"].startswith("wu-xing-distribution")):
            page.goto(e["html"].resolve().as_uri())
            page.wait_for_load_state("networkidle")
            fonts = page.evaluate(FONT_STATUS)
            wu_xing[e["pageId"]] = {"measured": page.evaluate(WX_MEASURE), "fonts": fonts,
                                    "oracleFindings": [f for f in e["dom"] if str(f.get("code", "")).startswith("WX_")]}
            broken = [f for f in fonts if f["status"] == "error"]
            loaded = {(f["family"], f["weight"]) for f in fonts if f["status"] == "loaded"}
            if broken or not {("Inter", "400"), ("Inter Display", "300")} <= loaded:
                failures.append(f"fonts: {e['pageId']} did not load the committed Inter faces: {fonts}")

        # 4. Counterexample: the PRIOR geometry (medallion centred on the ring, 50 mm value
        #    blocks from y+20) through the same template must be rejected by the same oracle.
        saved = copy.deepcopy(C.WX_GEOMETRY)
        try:
            C.WX_GEOMETRY["medallion"]["cy"] = C.WX_GEOMETRY["ringCy"]
            C.WX_GEOMETRY["block"].update(w=50, dy=20)
            _pid, _n, html, _st = C.wu_xing()
        finally:
            C.WX_GEOMETRY.clear()
            C.WX_GEOMETRY.update(saved)
        counter_html = B.SRC / "counterexample-08-wu-xing-prior-geometry.html"
        counter_html.write_text(html, encoding="utf-8")
        (out / "counterexample").mkdir()
        counter_png = out / "counterexample" / "08-wu-xing-prior-geometry.png"
        page.goto(counter_html.resolve().as_uri())
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(80)
        page.screenshot(path=str(counter_png), clip={"x": 0, "y": 0, "width": B.A4_PX[0], "height": B.A4_PX[1]})
        counter_findings = page.evaluate(B.WX_GEOMETRY_SCAN, True)
        counter_measured = page.evaluate(WX_MEASURE)
        fired = any(f.get("code") == "WX_PHASE_BLOCK_INTRUDES" and f.get("phase") == "fire" for f in counter_findings)
        if not fired:
            failures.append(f"counterexample: the oracle did not reject the prior Fire-block geometry: {counter_findings}")
        page.close()
        chromium_version = browser.version
        browser.close()

    pages = []
    for e in all_entries:
        folder = out / e["surface"]
        folder.mkdir(exist_ok=True)
        shutil.copy2(e["png"], folder / f"{e['pageId']}.png")
        pages.append({"surface": e["surface"], "pageId": e["pageId"], "pageNumber": e["pageNumber"],
                      "png": f"{e['surface']}/{e['pageId']}.png", "pngSha256": e["pngSha256"][7:],
                      "structuralSha256": e["structuralSha256"], "domFindings": e["dom"]})
        failures += [f"dom: {e['pageId']} {f}" for f in e["dom"]]

    report = {
        "reportVersion": REPORT_VERSION,
        "sourceRevision": source_revision(),
        "passed": not failures,
        "failures": failures,
        "guards": guard_results,
        "pagination": pagination,
        "wuXing": wu_xing,
        "counterexample": {"png": "counterexample/08-wu-xing-prior-geometry.png", "pngSha256": sha256(counter_png),
                           "geometry": "medallion centred on the ring (85, 80); value blocks 50 mm wide from y+20",
                           "oracleFindings": counter_findings, "measured": counter_measured, "rejected": fired},
        "pages": pages,
        "domFindingsTotal": sum(len(p["domFindings"]) for p in pages),
        "artifacts": {name: sha256(out / name) for name in ("final-contact-sheet.png", "customer-sample.pdf",
                                                            "developer-proof.pdf")},
        "environment": {"python": platform.python_version(), "platform": sys.platform, "playwright": importlib.metadata.version("playwright"),
                        "chromium": chromium_version,
                        "informationalCjkFace": "host fallback: Noto Sans CJK SC is not committed; display glyphs are SVG"},
        "scope": "artifact integrity, harness guards and rendered geometry; visual correctness needs human or model inspection",
    }
    (out / "proof-report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"pages {len(pages)} · DOM findings {report['domFindingsTotal']} · guards "
          f"{sum(g['pass'] for g in guard_results)}/{len(guard_results)} · counterexample rejected {fired}")
    for failure in failures:
        print("FAIL", failure)
    print("PROOF", "PASSED" if not failures else "FAILED")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
