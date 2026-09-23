#!/usr/bin/env python3
"""
Deterministic long-form paginator (donor: V6 contract; visual rhythm: V2; budgets: V5).

Contract
- All lengths are integer centipoints (cp). No floats survive into the layout.
- Overflow has exactly one resolution: another page. No scale factor, no clip, no shortening.
- Text is measured against pinned font files (advance widths, kerning off) — never asked of a renderer.
- Rules: orphan/widow ≥ 2 lines; subhead keeps with next 2 lines; pull quote / key insight atomic;
  spaceBefore collapses at a region top.
- Opener page: two balanced columns (V2). Continuation pages: one 104 mm column + 60 mm sidebar (V2/V3).
- Output: layout JSON (structural) + word-count/line-count proof that every input word was placed.
"""
from __future__ import annotations
import hashlib, json, pathlib
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOK = json.loads((ROOT / "tokens.json").read_text())
G = TOK["geometryCentipoints"]
PT = 100
BL = G["baseline"]                    # 1417 cp
TOLERANCE = 300                       # cp reserved so a renderer's rounding never widens a line past its measure
CONTENT_X, CONTENT_Y = G["marginSide"], G["marginTop"]
CONTENT_W, CONTENT_H = G["contentW"], G["contentH"]
CONTENT_BOTTOM = CONTENT_Y + CONTENT_H
GUTTER = G["gutter"]
RUNNING_HEAD_H = 4 * BL               # running head band on continuation pages
MIN_BAND_LINES = 8                    # a two-column band below a spanning module needs at least this many lines

FACES = {
    "regular": ROOT / "fonts" / "Inter-Regular.ttf",
    "medium": ROOT / "fonts" / "Inter-Medium.ttf",
    "display-light": ROOT / "fonts" / "InterDisplay-Light.ttf",
    "display-regular": ROOT / "fonts" / "InterDisplay-Regular.ttf",
}
# styleId: (face, sizeCp, leadingCp, trackingEm)
STYLES = {
    "kicker": ("medium", 900, BL, 0.16),
    "sectionTitle": ("display-light", 2600, 2 * BL, -0.015),
    "standfirst": ("regular", 1250, 1700, 0.0),
    "subhead": ("medium", 1300, BL, -0.005),
    "body": ("regular", 1050, BL, 0.0),
    "pullQuote": ("display-light", 1500, 2000, -0.01),
    "panelTitle": ("medium", 900, 1200, 0.16),
    "panelBody": ("regular", 950, 1350, 0.0),
}

_fonts = {}
def face(name):
    if name not in _fonts:
        f = TTFont(str(FACES[name]))
        _fonts[name] = (f, f["head"].unitsPerEm, f["hmtx"], f.getBestCmap(), f["OS/2"].sTypoAscender, f["OS/2"].sTypoDescender)
    return _fonts[name]

def text_width(text: str, style_id: str) -> int:
    fname, size, _, track = STYLES[style_id]
    f, upem, hmtx, cmap, _, _ = face(fname)
    units = 0
    for ch in text:
        gn = cmap.get(ord(ch)) or cmap.get(ord("?"))
        units += hmtx[gn][0]
    w = units * size / upem + track * size * len(text)
    return int(round(w))

def wrap(text: str, style_id: str, measure: int) -> list[str]:
    limit = measure - TOLERANCE
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        cand = w if not cur else cur + " " + w
        if text_width(cand, style_id) <= limit:
            cur = cand
        else:
            if cur: lines.append(cur)
            if text_width(w, style_id) > limit:
                raise SystemExit(f"PAGINATE_WORD_EXCEEDS_MEASURE {w!r}")
            cur = w
    if cur: lines.append(cur)
    return lines

def first_baseline(style_id: str) -> int:
    fname, size, leading, _ = STYLES[style_id]
    f, upem, _, _, asc, desc = face(fname)
    a = round(asc * size / upem); d = round(abs(desc) * size / upem)
    return a + round((leading - a - d) / 2)

def ceil_bl(v: int) -> int: return ((v + BL - 1) // BL) * BL

# ---------- flow model ----------
class Line:
    __slots__ = ("block", "idx", "n", "text", "style")
    def __init__(self, block, idx, n, text, style): self.block, self.idx, self.n, self.text, self.style = block, idx, n, text, style

def wrap_block(block, measure):
    k = block["kind"]
    if k in ("paragraph", "subhead"):
        style = "body" if k == "paragraph" else "subhead"
        ls = wrap(block["text"], style, measure)
        return [Line(block, i, len(ls), t, style) for i, t in enumerate(ls)]
    return None

def module_lines(block, measure):
    """Atomic modules: returns (heightCp, [(style, text, dy_from_top)] , padding)"""
    if block["kind"] == "pullQuote":
        inset = 0
        ls = wrap("“" + block["text"] + "”", "pullQuote", measure - 2 * inset)
        lead = STYLES["pullQuote"][2]
        h = ceil_bl(BL + len(ls) * lead + BL)           # gold rule, text, space
        out = [("pullQuote", t, BL + i * lead) for i, t in enumerate(ls)]
        return h, out, {"kind": "pullQuote", "rule": True}
    if block["kind"] == "keyInsight":
        pad = 1400
        ls_t = [block["title"]]
        ls = wrap(block["text"], "panelBody", measure - 2 * pad)
        lead = STYLES["panelBody"][2]
        inner = pad + 1200 + 600 + len(ls) * lead + pad
        h = ceil_bl(inner)
        out = [("panelTitle", block["title"], pad)] + [("panelBody", t, pad + 1200 + 600 + i * lead) for i, t in enumerate(ls)]
        return h, out, {"kind": "keyInsight", "pad": pad}
    raise SystemExit("UNKNOWN_MODULE " + block["kind"])

def space_before(kind): return {"pullQuote": BL, "keyInsight": BL, "subhead": BL}.get(kind, 0)
def space_after(kind): return {"paragraph": BL, "subhead": 0, "pullQuote": BL, "keyInsight": BL}.get(kind, 0)

class Column:
    def __init__(self, x, top, bottom, w):
        self.x, self.top, self.bottom, self.w = x, top, bottom, w
        self.y = top; self.items = []   # items: dict fragments
    def free(self): return self.bottom - self.y

class Page:
    def __init__(self, number, template):
        self.number, self.template, self.fragments = number, template, []
        self.cols = []          # list of Column in a 2-col band region (opener) or a single main column
        self.sidebar = None
    def used_bottom(self):
        b = self.top
        for f in self.fragments: b = max(b, f["topCp"] + f["heightCp"])
        return b

def make_page(number, opener_header_h):
    p = Page(number, "opener" if number == 1 else "continuation")
    if number == 1:
        p.top = CONTENT_Y + opener_header_h
        cw = (CONTENT_W - GUTTER) // 2
        p.cols = [Column(CONTENT_X, p.top, CONTENT_BOTTOM, cw), Column(CONTENT_X + cw + GUTTER, p.top, CONTENT_BOTTOM, cw)]
        p.colmode = 2
    else:
        p.top = CONTENT_Y + RUNNING_HEAD_H
        main_w = int(round(104 / 25.4 * 72 * 100))
        p.cols = [Column(CONTENT_X, p.top, CONTENT_BOTTOM, main_w)]
        p.sidebar = {"xCp": CONTENT_X + main_w + GUTTER, "yCp": p.top, "widthCp": CONTENT_W - main_w - GUTTER}
        p.colmode = 1
    return p

def paginate(blocks: list[dict], header_h_cp: int):
    """Flows the body blocks (everything after the fixed opener header)."""
    pages = [make_page(1, ceil_bl(header_h_cp))]
    page = pages[0]; band_start = page.top
    ci = 0                                # active column index within the page
    pending_space = 0
    placed_lines = 0
    all_lines_text = []

    def col(): return page.cols[ci]

    def new_page():
        nonlocal page, ci, pending_space, band_start
        page = make_page(len(pages) + 1, 0); pages.append(page); ci = 0; pending_space = 0; band_start = page.top

    def next_column():
        nonlocal ci, pending_space
        if ci + 1 < len(page.cols): ci += 1; pending_space = 0
        else: new_page()

    def place_lines(lines, start, end):
        """place lines[start:end] in current column, returns fragment"""
        c = col(); y = c.y + (pending_space if c.y > c.top else 0)
        style = lines[start].style; _, size, lead, _ = STYLES[style]
        fb = first_baseline(style)
        frag = {"blockId": lines[start].block["id"], "kind": lines[start].block["kind"], "fragmentIndex": lines[start].idx,
                "continuedFromPreviousPage": lines[start].idx > 0, "continuesOnNextPage": end < lines[start].n,
                "xCp": c.x, "topCp": y, "widthCp": c.w, "heightCp": (end - start) * lead, "styleId": style,
                "lines": [{"text": l.text, "xCp": c.x, "baselineCp": y + fb + (i) * lead, "widthCp": text_width(l.text, style)}
                          for i, l in enumerate(lines[start:end])]}
        page.fragments.append(frag); c.items.append(frag); c.y = y + (end - start) * lead
        return frag

    def balance_band():
        """Opener only: rebalance the current two-column band so an atomic module can span below it."""
        nonlocal ci
        if page.colmode != 2: return
        c1, c2 = page.cols
        if c1.y == c1.top: return  # nothing in the band → nothing to balance
        # collect line-level entries in order
        frags = [f for f in page.fragments if f["topCp"] >= band_start]
        entries = []
        for f in frags:
            for i, l in enumerate(f["lines"]):
                entries.append((f["blockId"], f["kind"], f["styleId"], l["text"], f["fragmentIndex"] + i))
        # remove them
        page.fragments = [f for f in page.fragments if f not in frags]
        c1.items = [f for f in c1.items if f not in frags]; c2.items = [f for f in c2.items if f not in frags]
        n = len(entries); k = (n + 1) // 2
        # constraints: don't strand <2 lines of a paragraph either side, no subhead at column foot
        def ok(k):
            if k <= 0 or k >= n: return False
            a, b = entries[k - 1], entries[k]
            if a[1] == "subhead": return False
            if a[0] == b[0]:  # same block split
                before = sum(1 for e in entries[:k] if e[0] == a[0]); after = sum(1 for e in entries[k:] if e[0] == a[0])
                if before < 2 or after < 2: return False
            return True
        cands = sorted(range(1, n), key=lambda j: (abs(j - k), j))
        k = next((j for j in cands if ok(j)), k)
        c1.y = band_start; c2.y = band_start
        def emit(target, ents):
            nonlocal ci
            ci = target; cur = []
            for e in ents:
                if cur and (e[0] != cur[-1][0]): flush(cur); cur = []
                cur.append(e)
            if cur: flush(cur)
        def flush(cur):
            c = col(); bid, kind, style, _, _ = cur[0]
            _, size, lead, _ = STYLES[style]; fb = first_baseline(style)
            y = c.y + (space_before(kind) if (c.y > band_start and kind == "subhead") else 0)
            if c.y > band_start and kind == "paragraph" and cur[0][4] == 0: y = c.y + BL  # paragraph gap
            block_n = next(bn for bn in block_line_counts if bn[0] == bid)[1]
            frag = {"blockId": bid, "kind": kind, "fragmentIndex": cur[0][4], "continuedFromPreviousPage": cur[0][4] > 0,
                    "continuesOnNextPage": cur[-1][4] + 1 < block_n, "xCp": c.x, "topCp": y, "widthCp": c.w,
                    "heightCp": len(cur) * lead, "styleId": style,
                    "lines": [{"text": e[3], "xCp": c.x, "baselineCp": y + fb + i * lead, "widthCp": text_width(e[3], style)} for i, e in enumerate(cur)]}
            page.fragments.append(frag); c.items.append(frag); c.y = y + len(cur) * lead
        emit(0, entries[:k]); emit(1, entries[k:])
        ci = 1

    block_line_counts = []
    i = 0
    while i < len(blocks):
        b = blocks[i]; kind = b["kind"]
        if kind in ("paragraph", "subhead"):
            lines = wrap_block(b, col().w)
            block_line_counts.append((b["id"], len(lines)))
            all_lines_text.extend(l.text for l in lines)
            pending_space = space_before(kind) if col().y > col().top else 0
            if kind == "paragraph" and col().y > col().top: pending_space = BL
            start = 0
            while start < len(lines):
                c = col(); lead = STYLES[lines[0].style][2]
                y0 = c.y + (pending_space if c.y > c.top else 0)
                fit = (c.bottom - y0) // lead
                remaining = len(lines) - start
                need_next = 2 if kind == "subhead" else 0
                if kind == "subhead":
                    # keep with next 2 body lines
                    nxt = blocks[i + 1] if i + 1 < len(blocks) else None
                    nl = STYLES["body"][2]
                    if fit < remaining or (c.bottom - (y0 + remaining * lead)) < 2 * nl:
                        next_column(); continue
                    place_lines(lines, 0, len(lines)); placed_lines += len(lines); break
                if fit >= remaining:
                    place_lines(lines, start, len(lines)); placed_lines += remaining; break
                # split: at least 2 here, at least 2 travel
                take = fit
                if remaining - take < 2: take = remaining - 2
                if take < 2 or (start == 0 and take < 2):
                    if c.y == c.top and start == 0 and fit >= 2:
                        take = max(2, min(fit, remaining - 2))
                    else:
                        next_column(); continue
                place_lines(lines, start, start + take); placed_lines += take
                start += take; next_column()
            i += 1; continue
        # atomic module
        measure = CONTENT_W if page.colmode == 2 else col().w
        if page.colmode == 2:
            balance_band()
            y0 = max(page.cols[0].y, page.cols[1].y)
            x0 = CONTENT_X
        else:
            y0 = col().y; x0 = col().x
        h, ls, meta = module_lines(b, measure)
        sb = space_before(kind) if y0 > page.top else 0
        if y0 + sb + h > CONTENT_BOTTOM:
            # does not fit: page ends (opener stays as balanced/greedy), module leads next page
            new_page(); y0 = col().y; x0 = col().x; sb = 0
            measure = col().w; h, ls, meta = module_lines(b, measure)
        frag = {"blockId": b["id"], "kind": kind, "fragmentIndex": 0, "continuedFromPreviousPage": False,
                "continuesOnNextPage": False, "xCp": x0, "topCp": y0 + sb, "widthCp": measure, "heightCp": h,
                "styleId": kind, "boxCp": {"xCp": x0, "yCp": y0 + sb, "widthCp": measure, "heightCp": h}, "meta": meta,
                "lines": [{"text": t, "styleId": st, "xCp": x0 + (meta.get("pad", 0)),
                           "baselineCp": y0 + sb + dy + first_baseline(st), "widthCp": text_width(t, st)} for st, t, dy in ls]}
        page.fragments.append(frag)
        all_lines_text.extend(t for _, t, _ in ls)
        if page.colmode == 2:
            band_start = y0 + sb + h + BL
            if CONTENT_BOTTOM - band_start < MIN_BAND_LINES * BL:
                new_page()            # a band shorter than MIN_BAND_LINES would be a stub, not a column
            else:
                for c in page.cols: c.y = band_start; c.top = band_start  # new band begins under the module
                ci = 0
        else:
            col().y = y0 + sb + h; pending_space = BL
        i += 1

    # ---- validation (walk the result, not the intention) ----
    findings = []
    for p in pages:
        boxes = []
        for f in p.fragments:
            if f["xCp"] < CONTENT_X or f["xCp"] + f["widthCp"] > CONTENT_X + CONTENT_W + 1: findings.append(("OUTSIDE_X", p.number, f["blockId"]))
            if f["topCp"] < CONTENT_Y or f["topCp"] + f["heightCp"] > CONTENT_BOTTOM: findings.append(("OUTSIDE_Y", p.number, f["blockId"]))
            for l in f["lines"]:
                if l["widthCp"] > f["widthCp"]: findings.append(("LINE_EXCEEDS_MEASURE", p.number, f["blockId"]))
                sid = l.get("styleId", f["styleId"])
                if STYLES[sid][1] < G["textFloorCp"]: findings.append(("BELOW_TEXT_FLOOR", p.number, f["blockId"]))
            bx = (f["xCp"], f["topCp"], f["xCp"] + f["widthCp"], f["topCp"] + f["heightCp"])
            for o in boxes:
                if bx[0] < o[2] and o[0] < bx[2] and bx[1] < o[3] and o[1] < bx[3]: findings.append(("OVERLAP", p.number, f["blockId"]))
            boxes.append(bx)
    # every word placed, in order
    src_words = " ".join((b.get("text") if b["kind"] != "keyInsight" else b["title"] + " " + b["text"]) for b in blocks).split()
    placed = " ".join(l["text"] for p in pages for f in p.fragments for l in f["lines"]).replace("“", "").replace("”", "").split()
    if src_words != placed: findings.append(("TEXT_MISMATCH", 0, f"{len(src_words)} vs {len(placed)}"))
    total_lines = sum(len(f["lines"]) for p in pages for f in p.fragments)
    layout = {"pages": [{"pageNumber": p.number, "template": p.template, "sidebar": p.sidebar,
                         "fragments": p.fragments, "usedBottomCp": p.used_bottom()} for p in pages],
              "lineCount": total_lines, "wordCount": len(src_words), "findings": findings,
              "geometry": {"contentXCp": CONTENT_X, "contentYCp": CONTENT_Y, "contentWidthCp": CONTENT_W,
                           "contentHeightCp": CONTENT_H, "baselineCp": BL, "toleranceCp": TOLERANCE}}
    layout["structuralSha256"] = "sha256:" + hashlib.sha256(json.dumps(layout, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return layout

if __name__ == "__main__":
    import sys
    fx = json.loads(pathlib.Path(sys.argv[1]).read_text())
    lay = paginate(fx["blocks"], fx["openerHeaderCp"])
    print(json.dumps({k: lay[k] for k in ("lineCount", "wordCount", "findings", "structuralSha256")}, indent=1), "pages", len(lay["pages"]))
