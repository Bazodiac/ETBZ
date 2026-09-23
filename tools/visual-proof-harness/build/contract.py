#!/usr/bin/env python3
"""Emit design-system.json (machine-readable component contract) and source-manifest.json (donor map)."""
import json, pathlib, hashlib, glob
ROOT = pathlib.Path(__file__).resolve().parent.parent
tok = json.loads((ROOT / "tokens.json").read_text()); man = json.loads((ROOT / "glyphs" / "manifest.json").read_text())
wm = json.loads((ROOT / "assets" / "wordmark.manifest.json").read_text())
structs = {p.stem: json.loads(p.read_text()) for p in sorted((ROOT / "structures").glob("*.json"))}

COMPONENTS = {
 "Wordmark": {"donors": {"primary": "V4 wordmark variant B (bazodiac_soft_editorial_v1_1 notes, 02-wordmarks)", "secondary": ["V6 wordmark.ts static contract"]}, "asset": "assets/wordmark.svg", "rules": ["static", "chart-independent", "no glyph slot", "gold point 0.4×cap on baseline", "tracking 0.34em"], "sha256": wm["sha256"]},
 "BazodiacDisplayGlyphSet": {"donors": {"primary": "V6 assets/etbz43/glyphs pipeline", "secondary": ["V4 agent-x-etbz-3.png (visual target: Noto Sans SC 900 + ink pass)", "V5 10-glyph-system.md"]}, "count": 27, "manifest": "glyphs/manifest.json", "manifestSha256": man["manifestSha256"], "regionPolicy": "CN_SIMPLIFIED", "status": man["visualTarget"]["status"], "guard": "DISPLAY_GLYPH_OUT_OF_CONTRACT for any other codepoint"},
 "InformationalCjkText": {"donors": {"primary": "V5 15-informational-cjk-text.md", "secondary": ["V4 Noto Sans SC 400/500 decision"]}, "face": "Noto Sans CJK SC 400/500", "usage": ["Ten Gods", "Hidden Stem terminology", "labels", "explanatory Chinese"], "neverRoutedThrough": "BazodiacDisplayGlyphSet"},
 "RunningHead": {"donors": {"primary": "V4 head (brand · customer, tag)", "secondary": ["V5 customer copy boundary: no SAMPLE tag on customer surface"]}, "tags": ["Your chart", "Your reading", "General education"]},
 "AtmosphericForm": {"donors": {"primary": "V4 cover blobs"}, "tokens": ["atmos-*"], "rule": "decorative only; never binds a fact; removed from data stages (V4 v1.1 LAW 5)"},
 "PhaseField": {"donors": {"primary": "V4 halos", "secondary": ["V5 field/mark tokens", "V6 region-scope guard"]}, "tokens": ["phase-*-field", "phase-*-mark"], "rule": "classifies exactly one fact-bearing region (stem | branch | hidden stem); never a pillar"},
 "Pillar": {"donors": {"primary": "V4 agent-x-etbz-5.png", "secondary": ["V5 neutral ground + gold selection", "V6 guards"]}, "container": "paper-100", "selected": {"container": "paper-200", "edge": "gold-500 0.35mm", "isPhase": False}, "rows": ["stem", "branch", "hiddenStems", "tenGod"]},
 "HiddenStemChip": {"donors": {"primary": "V4 chips", "secondary": ["V3 Qi-order rows", "V6 BLOCKED state"]}, "fields": ["glyph", "pinyin"], "order": "Qi order: principal, central, residual", "blocked": "phase missing → neutral field, no inheritance"},
 "DayMasterStage": {"donors": {"primary": "V4 agent-x-etbz-6.png"}, "stage": "paper-200 left column", "halo": "single phase field of the Day Master", "fullPageBlack": False, "darkPanel": "one compact 'Good to know' panel"},
 "ContentSlot": {"donors": {"primary": "V4 interpretive slots", "secondary": ["V5 47-customer-copy-boundary"]}, "customerVisibleLabels": ["Your reading · Day Master", "Your reading · Day pillar"], "hiddenOnCustomer": ["max chars", "slot ids", "content-layer notes"], "maxChars": {"dayMaster": 900, "dayPillar": 500}},
 "WuXingRing": {"donors": {"primary": "V2 agent_x_ETBZ-4.png", "secondary": ["V4 palette/spacing", "V6 presentation transform", "V5 45-presentation-transform.md"]}, "transform": {"id": "pt.linear-max-v1", "discRadiusMm": "11 + 7·v/max", "bar": "v/max", "monotonic": True, "recomputes": False, "infers": []}, "zeroRule": "0 → '0.0 in this distribution'", "allFiveVisible": True},
 "FivePhaseAnchors": {"donors": {"primary": "V5 WuXingEducationPage", "secondary": ["V4 pastel discs", "V6 structural prohibition of relation edges"]}, "relationEdges": False, "star": False, "shengKe": "excluded (METHOD_SCOPE_BLOCKED, developer surface only)"},
 "TenGodsMatrix": {"donors": {"primary": "V3 Ten Gods & Hidden Stems", "secondary": ["V5 InformationalCjkText", "V6 fail-closed"]}, "rows": 10, "marks": {"filled": "visible stem", "open": "hidden stem", "rule": "not present"}},
 "HiddenStemRows": {"donors": {"primary": "V3 Hidden Stems by Branch"}, "perHiddenPhaseMark": True},
 "LongForm": {"donors": {"primary": "V2 agent_x_ETBZ-6.png", "secondary": ["V6 paginate.ts contract", "V5 50-long-form-pagination.md", "V4 short-final-page reference panel"]}, "opener": "two balanced columns (82mm) under header", "continuation": "104mm column + 60mm sidebar", "modules": ["pullQuote (atomic, gold rules)", "keyInsight (atomic, ink-900 panel)", "chapterReference (sidebar / short final page)"], "rules": tok["meta"], "paginator": "build/paginate.py"},
 "Contents": {"donors": {"primary": "V3 Contents", "secondary": ["V4 type"]}, "pages": 30, "luckPillars": False},
 "ChartAtAGlance": {"donors": {"primary": "V3 Chart at a Glance", "secondary": ["V4 colour/glyph system", "V6 bindings"]}},
 "Closing": {"donors": {"primary": "V3 closing reflection", "secondary": ["V4 light atmosphere (no full-page black)"]}},
 "DeveloperProof": {"donors": {"primary": "V6 docs/evidence + receipts", "secondary": ["V5 dev contact sheet"]}, "pages": ["glyph proof", "glyph style decision", "wordmark", "bindings", "negative guards", "wu-xing zero case", "V6 fixture long-form ×2", "layout evidence ×2", "receipts"]},
}
PAGE_FAMILY = [{"page": s["pageNumber"], "id": s["pageId"], "family": s["family"], "donors": s["donors"], "bindings": s["factSlotBindings"], "structuralSha256": hashlib.sha256(json.dumps(s, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()} for s in sorted(structs.values(), key=lambda s: (s["surface"] != "customer", s["pageNumber"] or 0)) if s["surface"] == "customer"]
ds = {"name": "Bazodiac Final PDF Design System", "version": "1.0.0", "status": "PO analysis-selected composite — implementation candidate; not release acceptance",
      "convergence": {"V4": 0.35, "V6": 0.25, "V3": 0.20, "V2": 0.12, "V5": 0.06, "V1": 0.02},
      "geometry": {"authoring": {k: t["value"] for k, t in ((t["name"], t) for t in tok["geometry"]["tokens"])}, "centipoints": tok["geometryCentipoints"], "type": {"body": "10.5pt/14.17pt", "floor": "9pt (customer surface, captions included)", "scaleLock": 1.0, "orphanMin": 2, "widowMin": 2}},
      "palette": {t["name"]: t["value"]["light"] for t in tok["color"]["tokens"]},
      "cjkContract": {"A": "BazodiacDisplayGlyphSet — exactly 27 vector assets (glyphs/)", "B": "InformationalCjkText — Noto Sans CJK SC 400/500", "regionPolicy": "CN_SIMPLIFIED"},
      "surfaces": {"customer": {"forbidden": ["hashes", "fixture labels", "METHOD_SCOPE_BLOCKED", "rule ids", "font provenance", "slot chrome", "pipeline status"]}, "developer": {"contains": ["glyph manifest", "licence proof", "structural hashes", "render receipts", "fixture ids", "blocked-state tests", "layout evidence"]}},
      "exclusions": ["Luck Pillars / Da Yun / Liu Nian", "general Sheng/Ke graphic", "Western/Fusion/transit visuals", "whole-column phase tint", "customer Day Master as brand", "AI-generated Hanzi", "faux-Asian ornament", "design-side BaZi calculation", "status/proof chrome on customer surface", "shrink-to-fit, clipping, overlap, silent deletion, semantic shortening", "per-customer layout variants"],
      "components": COMPONENTS, "pageFamily": PAGE_FAMILY,
      "fixtures": {"chart": "fixtures/chart-fixture.json", "longFormCustomer": "longform/fixture-customer-chapter.json", "longFormV6": "longform/fixture-v6-677.json"},
      "rebuild": ["python3 build/extract_glyphs.py", "python3 build/wordmark.py", "python3 build/tokens.py", "python3 build/build_all.py (twice) → determinism-report.json", "python3 build/contract.py"]}
(ROOT / "design-system.json").write_text(json.dumps(ds, indent=2, ensure_ascii=False))
# source manifest: donors per final component + the six ZIP hashes from the PO manifest
po = json.loads(pathlib.Path("/tmp/claude-0/-home-claude/4cb480fe-b2b5-576c-914d-b59f49edf81a/scratchpad/src/FINAL/FINAL/ETBZ-43-source-manifest.json").read_text())
srcs = {}
for k in ("V1", "V2", "V3", "V4", "V5", "V6"):
    v = po["sources"][k]; srcs[k] = {"uploadedName": v["uploaded_name"], "sha256": v["sha256"], "bytes": v["bytes"], "files": [f["path"] for f in v["files"]]}
sm = {"manifestVersion": "bazodiac-final-source-manifest@1.0.0", "sources": srcs,
      "finalComponents": {name: c["donors"] for name, c in COMPONENTS.items()},
      "finalPages": [{"page": p["page"], "id": p["id"], "donors": p["donors"]} for p in PAGE_FAMILY],
      "fontsAndAssets": {"display": man["source"], "wordmarkSource": wm["source"], "latin": [{"file": f.name, "sha256": hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted((ROOT / "fonts").glob("*.ttf"))]}}
(ROOT / "source-manifest.json").write_text(json.dumps(sm, indent=2, ensure_ascii=False))
print("components", len(COMPONENTS), "pages", len(PAGE_FAMILY))
