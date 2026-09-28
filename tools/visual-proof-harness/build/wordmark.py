#!/usr/bin/env python3
"""Static Bazodiac wordmark (donor: V4 variant B feel; contract: V6 — static, chart-independent).
Letter outlines from the pinned Inter SemiBold file are converted to paths ONCE, tracked at 0.34 em,
followed by one gold point of 0.4 × cap-height. Output is a vector asset independent of font presence.
The mark never contains a customer glyph."""
import hashlib, json, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = pathlib.Path.home() / ".fonts" / "Inter-SemiBold.ttf"
TEXT = "BAZODIAC"
TRACK_EM = 0.34
GOLD = "#B2913F"

def main():
    f = TTFont(str(FONT)); upem = f["head"].unitsPerEm
    cap = f["OS/2"].sCapHeight
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f["hmtx"]
    x = 0; paths = []
    for ch in TEXT:
        gn = cmap[ord(ch)]
        pen = SVGPathPen(gs); tp = TransformPen(pen, (1, 0, 0, -1, x, 0))
        gs[gn].draw(tp)
        paths.append(pen.getCommands())
        x += hmtx[gn][0] + int(TRACK_EM * upem)
    x -= int(TRACK_EM * upem)  # no tracking after last letter
    r = cap * 0.4 / 2
    gap = int(0.22 * upem)
    cx = x + gap + r; cy = -r  # point sits on the baseline
    width = int(cx + r)
    d = "".join(paths)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-cap} {width} {cap}" role="img" aria-label="Bazodiac">'
           f'<title>Bazodiac</title><path d="{d}" fill="currentColor"/>'
           f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="{GOLD}"/></svg>')
    out = ROOT / "assets"; out.mkdir(exist_ok=True)
    (out / "wordmark.svg").write_text(svg, encoding="utf-8")
    meta = {"asset": "assets/wordmark.svg", "text": TEXT, "trackingEm": TRACK_EM, "pointDiameterCapRatio": 0.4,
            "pointColour": GOLD, "viewBox": [0, -cap, width, cap], "unitsPerEm": upem, "capHeight": cap,
            "source": {"family": "Inter", "style": "SemiBold", "file": FONT.name,
                       "version": f["name"].getDebugName(5), "fileSha256": "sha256:" + hashlib.sha256(FONT.read_bytes()).hexdigest(),
                       "licence": "SIL Open Font License 1.1"},
            "contract": {"static": True, "chartIndependent": True, "customerGlyphForbidden": True},
            "sha256": "sha256:" + hashlib.sha256(svg.encode()).hexdigest()}
    (out / "wordmark.manifest.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("wordmark", meta["sha256"], width, cap)

if __name__ == "__main__":
    main()
