"""Final-artifact readback of the Bazodiac PDF (ETBZ-55): what the merged PDF itself shows, page by page, bound to what
the page printed.

Text layer. Every non-whitespace glyph the PDF shows - its text from the font's ToUnicode map, or from the ActualText
span it sits in - is bound by position to exactly one printed text node of its page: its centre must lie in the box
of one of that node's characters (the DOM measured them on the page the PDF was printed from; CSS px = PDF pt / 0.75).
Each node's glyphs, read in visual order (baseline rows top-down, each row left to right), must spell the node's
projection value (or the template's separator) - compared without whitespace and case-insensitively (both sides
upper-cased, then case-folded, then NFC), because the template upper-cases its labels. Every glyph must stand upright
(its text matrix neither rotated, skewed nor mirrored). So text the page does not hold as a printed node (generated
content, a list marker, a page margin box, a shadow tree), a missing or a duplicated string, an inserted character (a
hyphenation character), a string printed out of its order (a right-to-left run) and a glyph turned or mirrored all
block. Glyphs drawn invisibly (text render modes 3 and 7) do not count as printed; a glyph drawn under a frame clip or
with its centre outside a clip blocks (the template clips no text). Not measured here: colour and size (the page QA's
ink and size checks, on the same print rendering: it refuses media conditions page.pdf() would evaluate differently).

Vector layer. Every clip path must be a single convex contour (turning once around), or a convex frame around one
convex hole (a box shadow is painted outside its box that way). Every painted path (fill or stroke, form XObjects
included) must be either a canonical outline - one of the sprite glyphs or the wordmark path, recognised by its segment
sequence and an axis-aligned scale-and-shift fit to the pinned path data - drawn at the size and position its box's
viewBox gives, lying wholly in the box of the display glyph of that very character (or of a wordmark), upright (positive
scales), never under a frame clip and wholly inside every convex clip it is drawn under; or
a single convex contour (the template's rules, fields, discs, bars, rounded panels, atmosphere shapes and the
wordmark's dot). Every display glyph must be drawn by exactly one canonical fill (and at most one stroke); every
wordmark by one canonical path fill and one convex fill in the box its pinned circle takes under the same fit. No image,
inline image, shading, pattern, soft mask or annotation (the template paints flat shapes and text only). So a glyph
drawn from other path data, mirrored or turned, redrawn as another character, clipped, moved out of its box, missing or
drawn twice, a changed or clipped wordmark or one without its dot, and any concave or multi-contour shape or clip
outside the canonical set (words drawn as outlines or cut out by a clip path) all block. Not measured here: colour, and
a shape that is itself one convex contour.

pikepdf only - a declared renderer dependency. Pure functions of the PDF bytes and the page ledgers.
"""
from __future__ import annotations

import math
import re
import unicodedata

import pikepdf

PX_PER_PT = 1 / 0.75
# A glyph's centre may fall this far (CSS px) outside the box of the character it is bound to.
BIND_TOLERANCE_PX = 0.75
# Path points closer than this (CSS px) are one point; a canonical outline fits its pinned data within FIT_TOLERANCE_PX.
POINT_EPSILON_PX = 0.01
FIT_TOLERANCE_PX = 0.01
# The sine of a turn below which a control-polygon step counts as straight (convexity test).
STRAIGHT_SINE = 2e-3
# How far (CSS px) a glyph centre or an outline point may lie outside a clip, and an outline outside its owner's box.
CLIP_TOLERANCE_PX = 0.5
BOX_TOLERANCE_PX = 1.0
# A canonical outline stands where its box's viewBox puts it: its drawn viewport's size and origin within this many px
# (Chromium snaps an SVG viewport to whole pixels in the PDF - its size by up to 1 px, its origin by up to half of one;
# the evidence document deviates by at most 0.94 px, and a scaled or moved glyph by several px).
PLACEMENT_TOLERANCE_PX = 1.5
# A convex contour turns once around: its turns add up to 360 degrees, within this many radians.
TURNING_TOLERANCE = 0.05
# A text matrix is upright when its rotation and skew terms are this small against its scale terms.
UPRIGHT_RATIO = 1e-4
FILL_OPS = {"f", "F", "f*", "B", "B*", "b", "b*"}
STROKE_OPS = {"S", "s", "B", "B*", "b", "b*"}
PAINT_OPS = FILL_OPS | STROKE_OPS
INVISIBLE_RENDER_MODES = {3, 7}


# ------------------------------------------------------------------ content-stream walk

def _mul(a: list, b: list) -> list:
    return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]]


def _unicode(hex_text: str) -> str:
    return bytes.fromhex(hex_text).decode("utf-16-be", errors="replace")


def _to_unicode(stream) -> dict:
    text = stream.read_bytes().decode("latin-1")
    mapping = {}
    for block in re.findall(r"beginbfchar(.*?)endbfchar", text, re.S):
        for source, target in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>", block):
            mapping[int(source, 16)] = _unicode(target)
    for block in re.findall(r"beginbfrange(.*?)endbfrange", text, re.S):
        for low, high, target in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]*>)", block):
            low, high = int(low, 16), int(high, 16)
            if target.startswith("["):
                for offset, entry in enumerate(re.findall(r"<([0-9A-Fa-f]*)>", target)):
                    mapping[low + offset] = _unicode(entry)
            else:
                base = _unicode(target[1:-1])
                for offset in range(high - low + 1):
                    mapping[low + offset] = base[:-1] + chr(ord(base[-1]) + offset) if base else ""
    return mapping


class _Font:
    """What the text layer needs of a font: code width (text space) and code -> Unicode."""

    def __init__(self, font):
        self.composite = str(font.get("/Subtype")) == "/Type0"
        to_unicode = font.get("/ToUnicode")
        self.unicode = _to_unicode(to_unicode) if to_unicode is not None else {}
        self.widths: dict = {}
        if self.composite:
            descendant = font.DescendantFonts[0]
            self.default, self.scale = float(descendant.get("/DW", 1000)), 0.001
            spec = list(descendant.get("/W", []))
            i = 0
            while i < len(spec):
                first = int(spec[i])
                if isinstance(spec[i + 1], pikepdf.Array):
                    for offset, width in enumerate(spec[i + 1]):
                        self.widths[first + offset] = float(width)
                    i += 2
                else:
                    for cid in range(first, int(spec[i + 1]) + 1):
                        self.widths[cid] = float(spec[i + 2])
                    i += 3
        else:
            matrix = font.get("/FontMatrix")
            self.default, self.scale = 0.0, float(matrix[0]) if matrix is not None else 0.001
            first = int(font.get("/FirstChar", 0))
            for offset, width in enumerate(font.get("/Widths", [])):
                self.widths[first + offset] = float(width)

    def codes(self, data: bytes) -> list:
        return [int.from_bytes(data[i:i + 2], "big") for i in range(0, len(data) - 1, 2)] if self.composite else list(data)

    def width(self, cid: int) -> float:
        return self.widths.get(cid, self.default) * self.scale


def _numbers(operands) -> list:
    return [float(value) for value in operands]


def read_page(page) -> dict:
    """The glyphs (text units) and painted paths of one PDF page, in CSS px with y down, each with the clips it is drawn
    under; and what else the page paints or carries that the template never does (`foreign`: images, shadings, patterns,
    soft masks, annotations, clip paths that are not one convex contour)."""
    height = float(page.mediabox[3]) - float(page.mediabox[1])
    bottom = float(page.mediabox[1])
    glyphs, paths, foreign = [], [], []
    walks = [0]
    # An annotation draws outside the content streams (its own appearance); the template has none.
    foreign += ["an annotation" for _ in page.obj.get("/Annots", [])]

    def to_px(x: float, y: float) -> tuple:
        return x * PX_PER_PT, (height - (y - bottom)) * PX_PER_PT

    def walk(stream, resources, ctm: list, clips: tuple, depth: int) -> None:
        walks[0] += 1
        walk_id = walks[0]
        fonts: dict = {}
        # Graphics state, saved and restored by q/Q: the matrix, the text state and the clips (a tuple, never mutated).
        state = {"ctm": ctm, "clips": clips, "tc": 0.0, "tw": 0.0, "th": 1.0, "tl": 0.0, "rise": 0.0, "mode": 0, "font": None, "size": 0.0}
        stack: list = []
        spans: list = []
        span_seq = 0
        tm = tlm = [1, 0, 0, 1, 0, 0]
        segments: list = []
        clip_pending = False
        for instruction in pikepdf.parse_content_stream(stream):
            op, operands = str(instruction.operator), instruction.operands
            if op == "q":
                stack.append(dict(state))
            elif op == "Q":
                state = stack.pop() if stack else state
            elif op == "cm":
                state["ctm"] = _mul(_numbers(operands), state["ctm"])
            elif op == "gs":
                graphics = (resources.get("/ExtGState") or {}).get(operands[0])
                if graphics is not None and "/SMask" in graphics and str(graphics.SMask) != "/None":
                    foreign.append("a soft mask")
            elif op == "BT":
                tm = tlm = [1, 0, 0, 1, 0, 0]
            elif op == "Tf":
                key = str(operands[0])
                if key not in fonts:
                    fonts[key] = _Font(resources.Font[operands[0]])
                state["font"], state["size"] = fonts[key], float(operands[1])
            elif op in ("Tc", "Tw", "TL", "Ts", "Tr", "Tz"):
                value = float(operands[0])
                state[{"Tc": "tc", "Tw": "tw", "TL": "tl", "Ts": "rise", "Tr": "mode", "Tz": "th"}[op]] = value / 100 if op == "Tz" else value
            elif op == "Tm":
                tm = tlm = _numbers(operands)
            elif op in ("Td", "TD"):
                dx, dy = _numbers(operands)
                if op == "TD":
                    state["tl"] = -dy
                tm = tlm = _mul([1, 0, 0, 1, dx, dy], tlm)
            elif op == "T*":
                tm = tlm = _mul([1, 0, 0, 1, 0, -state["tl"]], tlm)
            elif op in ("BDC", "BMC"):
                span_seq += 1
                props = operands[1] if op == "BDC" and len(operands) > 1 else None
                if isinstance(props, pikepdf.Name):
                    props = (resources.get("/Properties") or {}).get(props)
                actual = str(props.ActualText) if isinstance(props, pikepdf.Dictionary) and "/ActualText" in props else None
                spans.append((span_seq, actual) if actual is not None else None)
            elif op == "EMC":
                if spans:
                    spans.pop()
            elif op in ("Tj", "TJ", "'", '"'):
                if op in ("'", '"'):
                    if op == '"':
                        state["tw"], state["tc"] = float(operands[0]), float(operands[1])
                    tm = tlm = _mul([1, 0, 0, 1, 0, -state["tl"]], tlm)
                font, size, th = state["font"], state["size"], state["th"]
                items = operands[0] if op == "TJ" else [operands[-1]]
                span = next((s for s in reversed(spans) if s is not None), None)
                for item in items:
                    if not isinstance(item, pikepdf.String):
                        tm = _mul([1, 0, 0, 1, -float(item) / 1000 * size * th, 0], tm)
                        continue
                    for cid in font.codes(bytes(item)):
                        trm = _mul([size * th, 0, 0, size, 0, state["rise"]], _mul(tm, state["ctm"]))
                        w0 = font.width(cid)
                        if int(state["mode"]) not in INVISIBLE_RENDER_MODES:
                            # The centre of the glyph cell: half the advance along the baseline, 0.3 em above it.
                            cx = trm[4] + 0.5 * w0 * trm[0] + 0.3 * trm[2]
                            cy = trm[5] + 0.5 * w0 * trm[1] + 0.3 * trm[3]
                            bx, by = to_px(trm[4], trm[5])
                            scale = max(abs(trm[0]), abs(trm[3]), 1e-9)
                            glyphs.append({"text": font.unicode.get(cid), "span": (walk_id, span[0]) if span else None,
                                           "actual": span[1] if span else None, "centre": to_px(cx, cy), "baseline": by, "x": bx,
                                           "em": abs(trm[3]) * PX_PER_PT or abs(trm[2]) * PX_PER_PT, "clips": state["clips"],
                                           "upright": trm[0] > 0 and trm[3] > 0 and abs(trm[1]) <= UPRIGHT_RATIO * scale and abs(trm[2]) <= UPRIGHT_RATIO * scale})
                        advance = (w0 * size + state["tc"] + (state["tw"] if not font.composite and cid == 32 else 0)) * th
                        tm = _mul([1, 0, 0, 1, advance, 0], tm)
            elif op in ("m", "l", "c", "v", "y", "h", "re"):
                segments.append((op, _numbers(operands), state["ctm"]))
            elif op in ("W", "W*"):
                clip_pending = op
            elif op in PAINT_OPS or op == "n":
                device = _device_segments(segments, to_px) if segments else []
                if op != "n" and device:
                    # A path is painted under the clips in force before it; its own W takes effect after this operator.
                    paths.append({"op": op, "segments": device, "clips": state["clips"], "depth": depth})
                if clip_pending and device:
                    clip = _clip(_contours(normalise(device, POINT_EPSILON_PX)), clip_pending == "W*")
                    if clip is not None:
                        state["clips"] = state["clips"] + (clip,)
                    else:
                        foreign.append("a clip path that is neither one convex shape nor a convex frame around one convex hole")
                segments, clip_pending = [], False
            elif op == "Do":
                xobject = resources.XObject[operands[0]]
                subtype = str(xobject.get("/Subtype"))
                if subtype == "/Form":
                    matrix = _numbers(xobject.get("/Matrix", [1, 0, 0, 1, 0, 0]))
                    walk(xobject, xobject.get("/Resources", resources), _mul(matrix, state["ctm"]), state["clips"], depth + 1)
                else:
                    foreign.append(f"an XObject {subtype}")
            elif op in ("BI", "INLINE IMAGE"):
                foreign.append("an inline image")
            elif op == "sh":
                foreign.append("a shading")
            elif op in ("scn", "SCN") and operands and isinstance(operands[-1], pikepdf.Name):
                foreign.append("a pattern")

    walk(page, page.Resources, [1, 0, 0, 1, 0, 0], (), 0)
    return {"glyphs": glyphs, "paths": paths, "foreign": foreign}


def _device_segments(segments: list, to_px) -> list:
    out, current = [], (0.0, 0.0)
    for op, values, ctm in segments:
        if op == "re":
            x, y, w, h = values
            corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
            points = [to_px(px * ctm[0] + py * ctm[2] + ctm[4], px * ctm[1] + py * ctm[3] + ctm[5]) for px, py in corners]
            out += [("m", list(points[0])), ("l", list(points[1])), ("l", list(points[2])), ("l", list(points[3])), ("h", [])]
            current = (x, y)
            continue
        if op == "v":
            # v takes the current point as its first control point, y its end point as its second.
            op, values = "c", [current[0], current[1], *values]
        elif op == "y":
            op, values = "c", [*values, values[2], values[3]]
        if values:
            current = (values[-2], values[-1])
        coords = []
        for j in range(0, len(values), 2):
            x, y = values[j], values[j + 1]
            coords += list(to_px(x * ctm[0] + y * ctm[2] + ctm[4], x * ctm[1] + y * ctm[3] + ctm[5]))
        out.append((op, coords))
    return out


# ------------------------------------------------------------------ canonical outlines

_NUMBER = r"-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?"


def parse_svg_path(d: str) -> list:
    """An absolute SVG path (M L H V C Q Z - what the pinned sprite and wordmark use) as PDF-style segments; a
    quadratic becomes its exact cubic, as a PDF writer must write it."""
    tokens = re.findall(r"[A-Za-z]|" + _NUMBER, d)
    out, i, command, current, start = [], 0, None, (0.0, 0.0), (0.0, 0.0)

    def number() -> float:
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    while i < len(tokens):
        if re.fullmatch("[A-Za-z]", tokens[i]):
            command = tokens[i]
            i += 1
        if command in ("Z", "z"):
            out.append(("h", []))
            current = start
            continue
        if command == "M":
            current = start = (number(), number())
            out.append(("m", list(current)))
            command = "L"
        elif command == "L":
            current = (number(), number())
            out.append(("l", list(current)))
        elif command == "H":
            current = (number(), current[1])
            out.append(("l", list(current)))
        elif command == "V":
            current = (current[0], number())
            out.append(("l", list(current)))
        elif command == "C":
            values = [number() for _ in range(6)]
            current = (values[4], values[5])
            out.append(("c", values))
        elif command == "Q":
            x1, y1, x, y = number(), number(), number(), number()
            x0, y0 = current
            out.append(("c", [x0 + 2 / 3 * (x1 - x0), y0 + 2 / 3 * (y1 - y0), x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), x, y]))
            current = (x, y)
        else:
            raise ValueError(f"path command {command!r} is not one the pinned assets use")
    return out


def normalise(segments: list, epsilon: float) -> list:
    """Close every contour with an explicit line to its start and drop zero-length lines - how the PDF writer writes a
    path - so the pinned data and the drawn path compare segment by segment."""
    out, start, current = [], None, None
    for op, values in segments:
        if op == "m":
            start = current = (values[0], values[1])
            out.append((op, values))
            continue
        if op == "h":
            if current is not None and start is not None and (abs(current[0] - start[0]) > epsilon or abs(current[1] - start[1]) > epsilon):
                out.append(("l", [start[0], start[1]]))
            out.append(("h", []))
            current = start
            continue
        end = (values[-2], values[-1])
        if op == "l" and current is not None and abs(end[0] - current[0]) <= epsilon and abs(end[1] - current[1]) <= epsilon:
            continue
        out.append((op, values))
        current = end
    return out


def canonical_outlines(sprite_svg: str, wordmark_svg: str) -> dict:
    """name -> normalised segments: every sprite glyph (`g-<slug>`) and every path of the wordmark (`wordmark`)."""
    outlines = {}
    for match in re.finditer(r'<g id="([^"]+)"><path d="([^"]+)"', sprite_svg):
        outlines[match.group(1)] = normalise(parse_svg_path(match.group(2)), 1e-9)
    for index, match in enumerate(re.finditer(r'<path d="([^"]+)"', wordmark_svg)):
        outlines[f"wordmark-{index}"] = normalise(parse_svg_path(match.group(1)), 1e-9)
    return outlines


def signature(segments: list) -> str:
    return "".join(op for op, _ in segments)


def _points(segments: list) -> list:
    return [(values[j], values[j + 1]) for _, values in segments for j in range(0, len(values), 2)]


def _fit(source: list, target: list) -> tuple:
    """target = scale * source + shift on each axis (least squares): (sx, sy, tx, ty, largest residual)."""
    fitted = []
    for axis in (0, 1):
        xs, ys = [p[axis] for p in source], [p[axis] for p in target]
        n = len(xs)
        mean_x, mean_y = sum(xs) / n, sum(ys) / n
        spread = sum((x - mean_x) ** 2 for x in xs)
        scale = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / spread if spread else 0.0
        shift = mean_y - scale * mean_x
        fitted.append((scale, shift, max(abs(scale * x + shift - y) for x, y in zip(xs, ys))))
    return fitted[0][0], fitted[1][0], fitted[0][1], fitted[1][1], max(fitted[0][2], fitted[1][2])


def _contours(segments: list) -> list:
    contours, current = [], []
    for op, values in segments:
        if op == "m" and current:
            contours.append(current)
            current = []
        current.append((op, values))
        if op == "h":
            contours.append(current)
            current = []
    if current:
        contours.append(current)
    return [contour for contour in contours if len(contour) > 1]


def _convex(contour: list) -> bool:
    """The contour's control polygon (which holds its curves) turns one way only (straight steps aside) and once around:
    its turning adds up to 360 degrees, so neither a star that winds twice nor a concave bay walked in tiny steps passes."""
    points = []
    for point in _points(contour):
        if not points or abs(point[0] - points[-1][0]) + abs(point[1] - points[-1][1]) > 1e-6:
            points.append(point)
    if len(points) > 1 and abs(points[0][0] - points[-1][0]) + abs(points[0][1] - points[-1][1]) <= 1e-6:
        points.pop()
    if len(points) < 3:
        return True
    turn, total = 0, 0.0
    for i in range(len(points)):
        a, b, c = points[i], points[(i + 1) % len(points)], points[(i + 2) % len(points)]
        ux, uy, vx, vy = b[0] - a[0], b[1] - a[1], c[0] - b[0], c[1] - b[1]
        angle = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        total += abs(angle)
        if abs(math.sin(angle)) <= STRAIGHT_SINE and abs(angle) < math.pi / 2:
            continue
        side = 1 if angle > 0 else -1
        if turn == 0:
            turn = side
        elif side != turn:
            return False
    return total <= 2 * math.pi + TURNING_TOLERANCE


def _inside(point: tuple, box: dict, tolerance: float) -> bool:
    return (box["x"] - tolerance <= point[0] <= box["x"] + box["w"] + tolerance
            and box["y"] - tolerance <= point[1] <= box["y"] + box["h"] + tolerance)


# ------------------------------------------------------------------ clips and boxes

def _polygon(contour: list) -> tuple:
    """A convex contour's control polygon (which holds the contour), without repeated points, counter-clockwise or
    clockwise as drawn, with the sign of its turn."""
    points = []
    for point in _points(contour):
        if not points or abs(point[0] - points[-1][0]) + abs(point[1] - points[-1][1]) > 1e-6:
            points.append(point)
    if len(points) > 1 and abs(points[0][0] - points[-1][0]) + abs(points[0][1] - points[-1][1]) <= 1e-6:
        points.pop()
    area = sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points)))
    return tuple(points), (1 if area > 0 else -1)


def _in_polygon(point: tuple, polygon: tuple, tolerance: float) -> bool:
    """Whether the point lies inside the convex polygon, or at most `tolerance` outside any of its edges."""
    points, turn = polygon
    if len(points) < 3:
        return False
    for i in range(len(points)):
        (ax, ay), (bx, by) = points[i], points[(i + 1) % len(points)]
        length = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        if length <= 1e-9:
            continue
        # Signed distance to the edge's line, positive on the inner side.
        if turn * ((bx - ax) * (point[1] - ay) - (by - ay) * (point[0] - ax)) / length < -tolerance:
            return False
    return True


def _clip(contours: list, even_odd: bool):
    """A clip region the template's rendering produces: inside one convex contour, or inside a convex frame and outside
    one convex hole within it (how a box shadow is painted outside its box). None for any other clip path."""
    if not contours or not all(_convex(contour) for contour in contours):
        return None
    if len(contours) == 1:
        return ("in", _polygon(contours[0]))
    if len(contours) != 2:
        return None
    first, second = _polygon(contours[0]), _polygon(contours[1])
    for outer, inner in ((first, second), (second, first)):
        if all(_in_polygon(point, outer, CLIP_TOLERANCE_PX) for point in inner[0]):
            # Non-zero winding with both contours turning the same way fills the whole frame: no hole.
            return ("out", outer, inner) if even_odd or outer[1] != inner[1] else ("in", outer)
    return None


def _in_clip(point: tuple, clip: tuple, tolerance: float) -> bool:
    if clip[0] == "in":
        return _in_polygon(point, clip[1], tolerance)
    return _in_polygon(point, clip[1], tolerance) and not _in_polygon(point, clip[2], -tolerance)


def _drawn_points(segments: list) -> list:
    """Points on a path as drawn: every segment end, and the middle of every curve."""
    out, current = [], None
    for op, values in segments:
        if op == "c" and current is not None:
            (x0, y0), (x1, y1), (x2, y2), (x3, y3) = current, values[0:2], values[2:4], values[4:6]
            out.append((0.125 * x0 + 0.375 * x1 + 0.375 * x2 + 0.125 * x3, 0.125 * y0 + 0.375 * y1 + 0.375 * y2 + 0.125 * y3))
        if values:
            current = (values[-2], values[-1])
            out.append(current)
    return out


def _bounds(points: list) -> tuple:
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def _box_holds(box: dict, bounds: tuple, tolerance: float) -> bool:
    return (bounds[0] >= box["x"] - tolerance and bounds[1] >= box["y"] - tolerance
            and bounds[2] <= box["x"] + box["w"] + tolerance and bounds[3] <= box["y"] + box["h"] + tolerance)


def _placement(box: dict, view_box) -> tuple | None:
    """Where an SVG's viewBox puts its content in its box (the default xMidYMid meet): (scale, shift x, shift y)."""
    if not view_box or view_box["w"] <= 0 or view_box["h"] <= 0:
        return None
    scale = min(box["w"] / view_box["w"], box["h"] / view_box["h"])
    return (scale, box["x"] + (box["w"] - view_box["w"] * scale) / 2 - view_box["x"] * scale,
            box["y"] + (box["h"] - view_box["h"] * scale) / 2 - view_box["y"] * scale)


def wordmark_dots(wordmark_svg: str) -> list:
    """The pinned wordmark's circles as (cx, cy, r), in its own units."""
    dots = []
    for match in re.finditer(r"<circle\b([^>]*)>", wordmark_svg):
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', match.group(1)))
        dots.append((float(attrs["cx"]), float(attrs["cy"]), float(attrs["r"])))
    return dots


# ------------------------------------------------------------------ checks

def _norm(text: str) -> str:
    """The comparison form: no whitespace, upper-cased as the template's text-transform would, then case-folded (so ß,
    ı and their capitals agree) and composed."""
    return unicodedata.normalize("NFC", "".join(text.split()).upper().casefold())


def text_units(glyphs: list) -> tuple:
    """One unit per glyph, or per ActualText span (its text once); whitespace glyphs print nothing. A unit drawn under a
    frame clip, or with its centre outside a clip it is drawn under, is clipped: the template clips no text. Returns
    (printed units, clipped units)."""
    units, spans, clipped = [], {}, []
    for glyph in glyphs:
        if glyph["actual"] is not None:
            if glyph["span"] in spans:
                continue
            spans[glyph["span"]] = True
            unit = {**glyph, "text": glyph["actual"]}
        else:
            unit = {**glyph, "text": glyph["text"] if glyph["text"] is not None else "�"}
        if not unit["text"].strip():
            continue
        if any(clip[0] == "out" for clip in unit["clips"]) or not all(_in_clip(unit["centre"], clip, CLIP_TOLERANCE_PX) for clip in unit["clips"]):
            clipped.append(unit)
            continue
        units.append(unit)
    return units, clipped


def _visual_order(units: list) -> str:
    rows: list = []
    for unit in sorted(units, key=lambda u: u["baseline"]):
        if rows and abs(unit["baseline"] - rows[-1][0]) <= 0.35 * max(unit["em"], 1.0):
            rows[-1][1].append(unit)
        else:
            rows.append((unit["baseline"], [unit]))
    return "".join(u["text"] for _, row in rows for u in sorted(row, key=lambda u: u["x"]))


def check_text_layer(glyphs: list, nodes: list) -> tuple:
    """Findings, and the counts the QA report records. `nodes`: [{"path", "expected", "chars": [[l, t, r, b], ...]}]."""
    findings = []
    units, clipped = text_units(glyphs)
    findings += [{"code": "PDF_TEXT_CLIPPED", "text": unit["text"][:20], "at": [round(unit["centre"][0], 1), round(unit["centre"][1], 1)]} for unit in clipped]
    grid: dict = {}
    for index, node in enumerate(nodes):
        for left, top, right, bottom in node["chars"]:
            for gx in range(int((left - BIND_TOLERANCE_PX) // 40), int((right + BIND_TOLERANCE_PX) // 40) + 1):
                for gy in range(int((top - BIND_TOLERANCE_PX) // 40), int((bottom + BIND_TOLERANCE_PX) // 40) + 1):
                    grid.setdefault((gx, gy), []).append((index, left, top, right, bottom))
    bound: dict = {}
    for unit in units:
        if not unit["upright"]:
            findings.append({"code": "PDF_TEXT_NOT_UPRIGHT", "text": unit["text"][:20], "reason": "the glyph is turned, skewed or mirrored"})
        x, y = unit["centre"]
        owners = {index for index, left, top, right, bottom in grid.get((int(x // 40), int(y // 40)), [])
                  if left - BIND_TOLERANCE_PX <= x <= right + BIND_TOLERANCE_PX and top - BIND_TOLERANCE_PX <= y <= bottom + BIND_TOLERANCE_PX}
        if len(owners) != 1:
            findings.append({"code": "PDF_TEXT_UNBOUND", "text": unit["text"][:20], "at": [round(x, 1), round(y, 1)],
                             "reason": "no printed character there" if not owners else "in the boxes of several printed strings"})
            continue
        bound.setdefault(owners.pop(), []).append(unit)
    for index, node in enumerate(nodes):
        printed = _visual_order(bound.get(index, []))
        if _norm(printed) != _norm(node["expected"]):
            findings.append({"code": "PDF_TEXT_MISMATCH", "path": node["path"], "expected": node["expected"][:60], "printed": printed[:60]})
    return findings, {"textUnits": len(units), "printedStrings": len(nodes), "clippedUnits": len(clipped)}


def check_vector_layer(paths: list, foreign: list, glyph_boxes: list, wordmark_boxes: list, outlines: dict, dots: list) -> tuple:
    """Findings, and the counts the QA report records. `glyph_boxes`: [{"path", "slug", "box"}]; `wordmark_boxes`: [box];
    `dots`: the pinned wordmark circles (cx, cy, r)."""
    findings = [{"code": "PDF_VECTOR_UNEXPECTED", "reason": f"{what} (the template paints flat shapes and text only)"} for what in foreign]
    by_signature: dict = {}
    for name, segments in outlines.items():
        by_signature.setdefault(signature(segments), []).append(name)
    fills = {("glyph", i): 0 for i in range(len(glyph_boxes))} | {("wordmark", i): 0 for i in range(len(wordmark_boxes))}
    strokes = dict.fromkeys(fills, 0)
    expected_dots: dict = {}
    convex_fills: list = []
    primitives = 0
    worst = [0.0]

    def clipped_away(points: list, clips: tuple) -> bool:
        # A canonical shape is never drawn under a frame clip (the template draws none there), and lies wholly inside
        # every convex clip it is drawn under.
        return any(clip[0] == "out" for clip in clips) or not all(_in_clip(point, clip, CLIP_TOLERANCE_PX) for clip in clips for point in points)

    for path in paths:
        segments = normalise(path["segments"], POINT_EPSILON_PX)
        best = None
        for name in by_signature.get(signature(segments), []):
            fit = _fit(_points(outlines[name]), _points(segments))
            if fit[4] <= FIT_TOLERANCE_PX and (best is None or fit[4] < best[1][4]):
                best = (name, fit)
        drawn = _drawn_points(segments)
        if best is None:
            contours = _contours(segments)
            if len(contours) == 1 and _convex(contours[0]):
                primitives += 1
                if path["op"] in FILL_OPS and drawn:
                    convex_fills.append((_bounds(drawn), drawn, path["clips"]))
            else:
                bounds = _bounds(drawn or [(0.0, 0.0)])
                findings.append({"code": "PDF_VECTOR_UNEXPECTED", "reason": f"{len(contours)} contour(s), not convex and no canonical outline",
                                 "box": [round(v, 1) for v in bounds]})
            continue
        name, (sx, sy, tx, ty, _) = best
        bounds = _bounds(drawn)
        centre = ((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2)
        at = [round(centre[0], 1), round(centre[1], 1)]
        if sx <= 0 or sy <= 0:
            findings.append({"code": "PDF_VECTOR_NOT_UPRIGHT", "outline": name, "at": at})
        if clipped_away(drawn, path["clips"]):
            findings.append({"code": "PDF_VECTOR_CLIPPED", "outline": name, "at": at})
        wordmark = name.startswith("wordmark-")
        owners = [("wordmark", i) for i, box in enumerate(wordmark_boxes) if _inside(centre, box, BOX_TOLERANCE_PX)] if wordmark else \
                 [("glyph", i) for i, g in enumerate(glyph_boxes) if _inside(centre, g["box"], BOX_TOLERANCE_PX)]
        if len(owners) != 1:
            findings.append({"code": "PDF_VECTOR_UNEXPECTED", "reason": f"canonical outline {name} outside the box of any {'wordmark' if wordmark else 'display glyph'}"
                             if not owners else f"canonical outline {name} in several boxes", "at": at})
            continue
        owner = owners[0]
        box = wordmark_boxes[owner[1]] if wordmark else glyph_boxes[owner[1]]["box"]
        view_box = wordmark_boxes[owner[1]].get("vb") if wordmark else glyph_boxes[owner[1]].get("vb")
        if not _box_holds(box, bounds, BOX_TOLERANCE_PX):
            findings.append({"code": "PDF_VECTOR_UNEXPECTED", "reason": f"canonical outline {name} leaves the box it belongs to", "at": at})
        placed = _placement(box, view_box)
        # The drawn viewport (the viewBox under the fit) against the one the box gives: width, height, left, top.
        deviation = None if placed is None else max(
            abs(sx - placed[0]) * view_box["w"], abs(sy - placed[0]) * view_box["h"],
            abs((tx + view_box["x"] * sx) - (placed[1] + view_box["x"] * placed[0])),
            abs((ty + view_box["y"] * sy) - (placed[2] + view_box["y"] * placed[0])))
        if deviation is None or deviation > PLACEMENT_TOLERANCE_PX:
            findings.append({"code": "PDF_VECTOR_MISPLACED", "outline": name, "at": at, "deviationPx": None if deviation is None else round(deviation, 2)})
        else:
            worst[0] = max(worst[0], deviation)
        if owner[0] == "glyph" and name != f"g-{glyph_boxes[owner[1]]['slug']}":
            findings.append({"code": "PDF_VECTOR_NOT_ITS_VALUE", "path": glyph_boxes[owner[1]]["path"], "expected": f"g-{glyph_boxes[owner[1]]['slug']}", "drawn": name})
            continue
        if path["op"] in FILL_OPS:
            fills[owner] += 1
            if wordmark:
                # The pinned dot, where the same fit puts it.
                expected_dots[owner[1]] = [(sx * (cx - r) + tx, sy * (cy - r) + ty, sx * (cx + r) + tx, sy * (cy + r) + ty) for cx, cy, r in dots]
        if path["op"] in STROKE_OPS:
            strokes[owner] += 1
    for owner, count in fills.items():
        what = glyph_boxes[owner[1]]["path"] if owner[0] == "glyph" else f"wordmark {owner[1]}"
        if count == 0:
            findings.append({"code": "PDF_VECTOR_MISSING", "kind": owner[0], "what": what})
        elif count > 1 or strokes[owner] > 1:
            findings.append({"code": "PDF_VECTOR_UNEXPECTED", "reason": f"{owner[0]} drawn {count} times (fills) and {strokes[owner]} times (strokes)", "what": what})
    dot_count = 0
    for index, targets in expected_dots.items():
        for target in targets:
            found = [(drawn, clips) for bounds, drawn, clips in convex_fills if all(abs(a - b) <= BOX_TOLERANCE_PX for a, b in zip(bounds, target))]
            if len(found) != 1:
                findings.append({"code": "PDF_VECTOR_MISSING", "kind": "wordmark dot", "what": f"wordmark {index}", "fills": len(found)})
                continue
            if clipped_away(*found[0]):
                findings.append({"code": "PDF_VECTOR_CLIPPED", "outline": "wordmark dot", "what": f"wordmark {index}"})
            dot_count += 1
    return findings, {"canonicalOutlines": sum(fills.values()), "displayGlyphs": len(glyph_boxes), "wordmarks": len(wordmark_boxes),
                      "wordmarkDots": dot_count, "convexShapes": primitives, "placementDeviationPx": round(worst[0], 3)}


def check_pdf_layers(pdf_path, ledgers: list, outlines: dict, dots: list) -> tuple:
    """Both layers of every page of the final PDF, page i against ledger i. Findings carry the page label."""
    text_findings, vector_findings = [], []
    text_counts = {"pages": 0, "textUnits": 0, "printedStrings": 0, "clippedUnits": 0}
    vector_counts = {"pages": 0, "canonicalOutlines": 0, "displayGlyphs": 0, "wordmarks": 0, "wordmarkDots": 0, "convexShapes": 0,
                     "placementDeviationPx": 0.0}
    with pikepdf.open(pdf_path) as pdf:
        if len(pdf.pages) != len(ledgers):
            # PDF_READBACK has already compared the page count with the projection; this is a renderer error.
            raise ValueError(f"{len(pdf.pages)} PDF pages for {len(ledgers)} page ledgers")
        for page, ledger in zip(pdf.pages, ledgers):
            layer = read_page(page)
            found, counts = check_text_layer(layer["glyphs"], ledger["text"])
            text_findings += [{"page": ledger["pageLabel"], **f} for f in found]
            text_counts["pages"] += 1
            for key, value in counts.items():
                text_counts[key] += value
            found, counts = check_vector_layer(layer["paths"], layer["foreign"], ledger["glyphs"], ledger["wordmarks"], outlines, dots)
            vector_findings += [{"page": ledger["pageLabel"], **f} for f in found]
            vector_counts["pages"] += 1
            for key, value in counts.items():
                vector_counts[key] = max(vector_counts[key], value) if key == "placementDeviationPx" else vector_counts[key] + value
    return text_findings, vector_findings, text_counts, vector_counts
