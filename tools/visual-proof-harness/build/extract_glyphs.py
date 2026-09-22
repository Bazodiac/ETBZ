#!/usr/bin/env python3
"""
Bazodiac FINAL — BazodiacDisplayGlyphSet extraction (donor: V6 pipeline, V4 visual target).

Produces the 27 display glyph assets ONCE as versioned SVG outlines + manifest.
- Source face: NotoSansCJKsc-Black (SIL OFL 1.1), pinned by SHA-256 of the exact file.
- Region policy: CN_SIMPLIFIED (the `sc` face of the collection).
- Geometry: font units kept (upem 1000), y negated once; one shared padded viewBox;
  every glyph bbox asserted strictly inside the viewBox (machine-checkable "never cropped").
- Ink pass (V4 target): a deterministic outline expansion expressed as an SVG stroke of
  INK_PASS_UNITS font units with round joins/caps, painted under the fill. It is a
  registered presentation parameter, not a new font and not a distortion: the fill path
  is the unmodified licensed outline and remains the identity of the glyph.
- Determinism: integer font units, explicit M/L/Q/C/Z, per-glyph SHA-256 over the
  canonical description, manifest SHA-256 over all glyphs in ordinal order.
"""
from __future__ import annotations
import hashlib, json, pathlib, sys, unicodedata
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTCollection

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "glyphs"
OUT.mkdir(parents=True, exist_ok=True)

SOURCE_FONT = pathlib.Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc")
SOURCE_PS = "NotoSansCJKsc-Black"
LICENCE = pathlib.Path("/usr/share/doc/fonts-noto-cjk/copyright")

STEMS = "甲乙丙丁戊己庚辛壬癸"; BRANCHES = "子丑寅卯辰巳午未申酉戌亥"; WUXING = "木火土金水"
SLUGS = (["jia","yi","bing","ding","wu","ji","geng","xin","ren","gui"] +
         ["zi","chou","yin","mao","chen","si","wu-branch","wei","shen","you","xu","hai"] +
         ["mu","huo","tu","jin","shui"])
PINYIN = (["jiǎ","yǐ","bǐng","dīng","wù","jǐ","gēng","xīn","rén","guǐ"] +
          ["zǐ","chǒu","yín","mǎo","chén","sì","wǔ","wèi","shēn","yǒu","xū","hài"] +
          ["mù","huǒ","tǔ","jīn","shuǐ"])
PHASE = (["wood","wood","fire","fire","earth","earth","metal","metal","water","water"] +
         ["water","earth","wood","wood","earth","fire","fire","earth","metal","metal","earth","water"] +
         ["wood","fire","earth","metal","water"])
POLARITY = (["yang","yin"]*5) + (["yang","yin"]*6) + [None]*5
ANIMAL = [None]*10 + ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"] + [None]*5
ROLE = ["heavenly_stem"]*10 + ["earthly_branch"]*12 + ["wu_xing"]*5

UPEM = 1000
EM_BOX = (0, -880, 1000, 1000)
PADDING = 80
VIEW_BOX = (EM_BOX[0]-PADDING, EM_BOX[1]-PADDING, EM_BOX[2]+2*PADDING, EM_BOX[3]+2*PADDING)
INK_PASS_UNITS = 14           # V4 target: heavier printed mass, softened terminals
ASSET_FORMAT_VERSION = "2.0.0"
MANIFEST_VERSION = "bazodiac-final-glyph-manifest@2.0.0"

def sha(b: bytes) -> str: return "sha256:" + hashlib.sha256(b).hexdigest()

def load_face():
    coll = TTCollection(str(SOURCE_FONT))
    for i, f in enumerate(coll.fonts):
        if f["name"].getDebugName(6) == SOURCE_PS:
            return f, i
    sys.exit("GLYPH_SOURCE_FACE_NOT_FOUND")

def rp(p): return (int(round(p[0])), int(round(-p[1])))

def outline(font, ch):
    gname = font.getBestCmap()[ord(ch)]
    pen = RecordingPen(); font.getGlyphSet()[gname].draw(pen)
    cmds, xs, ys = [], [], []
    def emit(letter, pts):
        r = [rp(p) for p in pts]
        for x, y in r: xs.append(x); ys.append(y)
        cmds.append(letter + " ".join(f"{x} {y}" for x, y in r))
    for op, args in pen.value:
        if op == "moveTo": emit("M", args)
        elif op == "lineTo": emit("L", args)
        elif op == "qCurveTo": emit("Q", args)
        elif op == "curveTo": emit("C", args)
        elif op == "closePath": cmds.append("Z")
        elif op == "endPath": cmds.append("Z")
        else: sys.exit(f"UNSUPPORTED_PEN_OP {op}")
    return "".join(cmds), (min(xs), min(ys), max(xs), max(ys)), gname

def inside(bbox):
    x0,y0,x1,y1 = bbox; vx,vy,vw,vh = VIEW_BOX
    m = INK_PASS_UNITS/2
    return x0-m > vx and y0-m > vy and x1+m < vx+vw and y1+m < vy+vh

def main():
    font, face_index = load_face()
    font_bytes = SOURCE_FONT.read_bytes()
    glyphs = []
    for i, ch in enumerate(STEMS + BRANCHES + WUXING):
        path, bbox, gname = outline(font, ch)
        if not inside(bbox): sys.exit(f"GLYPH_WOULD_CLIP {ch} {bbox}")
        cp = f"U+{ord(ch):04X}"
        canonical = json.dumps({"character": ch, "codepoint": cp, "path": path, "viewBox": VIEW_BOX,
                                "inkPassUnits": INK_PASS_UNITS, "assetFormatVersion": ASSET_FORMAT_VERSION},
                               ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        digest = sha(canonical)
        asset = f"u{ord(ch):04x}-{SLUGS[i]}.svg"
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEW_BOX[0]} {VIEW_BOX[1]} {VIEW_BOX[2]} {VIEW_BOX[3]}" '
               f'role="img" aria-label="{cp} {unicodedata.name(ch)}"><title>{ch} {cp} {PINYIN[i]}</title>'
               f'<path d="{path}" fill="currentColor" stroke="currentColor" stroke-width="{INK_PASS_UNITS}" '
               f'stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"/></svg>')
        (OUT / asset).write_text(svg, encoding="utf-8")
        glyphs.append({"ordinal": i, "character": ch, "codepoint": cp, "unicodeName": unicodedata.name(ch),
                       "slug": SLUGS[i], "pinyin": PINYIN[i], "role": ROLE[i], "phase": PHASE[i],
                       "polarity": POLARITY[i], "animalLabel": ANIMAL[i], "sourceGlyphName": gname,
                       "asset": asset, "bbox": list(bbox), "path": path, "sha256": digest})
    manifest = {
        "manifestVersion": MANIFEST_VERSION,
        "assetFormatVersion": ASSET_FORMAT_VERSION,
        "role": "BazodiacDisplayGlyphSet",
        "regionPolicy": "CN_SIMPLIFIED",
        "glyphCount": len(glyphs),
        "emBox": list(EM_BOX), "viewBox": list(VIEW_BOX), "paddingUnits": PADDING, "unitsPerEm": UPEM,
        "inkPass": {"kind": "svg-stroke-under-fill", "strokeUnits": INK_PASS_UNITS,
                    "linejoin": "round", "linecap": "round", "paintOrder": "stroke fill",
                    "note": "Deterministic presentation expansion toward the V4 heavy/ink target. Fill path is the unmodified licensed outline."},
        "source": {"family": "Noto Sans CJK SC", "postscriptName": SOURCE_PS, "weight": 900,
                   "faceIndex": face_index, "version": font["name"].getDebugName(5),
                   "file": str(SOURCE_FONT), "fileSha256": sha(font_bytes),
                   "licence": "SIL Open Font License 1.1", "licenceFile": "OFL.txt",
                   "upstream": "https://github.com/notofonts/noto-cjk"},
        "visualTarget": {"donor": "V4 agent-x-etbz-3.png (Noto Sans SC 900 + ink pass)",
                         "status": "HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED",
                         "reason": "The original 金土木 reference typeface remains unidentified (FONT_IDENTITY_MISSING inherited from V4/V5). This asset set is a verified, licensed, deterministic approximation of the V4 look; it is not a claim of identity with the reference."},
        "glyphs": glyphs,
    }
    all_digest = sha("".join(g["sha256"] for g in glyphs).encode())
    manifest["manifestSha256"] = all_digest
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    # OFL text vendored next to the assets (required for OFL derivatives)
    (OUT / "OFL.txt").write_text(LICENCE.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    # sprite for inline use in pages: <symbol id="g-<slug>">
    syms = "".join(
        f'<g id="g-{g["slug"]}">'
        f'<path d="{g["path"]}" fill="currentColor" stroke="currentColor" stroke-width="{INK_PASS_UNITS}" '
        f'stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"/></g>' for g in glyphs)
    (OUT / "sprite.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>{syms}</defs></svg>', encoding="utf-8")
    print("glyphs", len(glyphs), "manifest", all_digest)

if __name__ == "__main__":
    main()
