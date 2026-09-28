#!/usr/bin/env python3
"""Differential oracle for the TypeScript long-form paginator (ETBZ-55).

Lays out a deterministic set of synthetic chapters with the CANONICAL ETBZ-49
paginator (tools/visual-proof-harness/build/paginate.py, staged exactly as the
ETBZ-49 proof stages it: the committed tokens and Inter binaries beside it) and
writes the layouts to tests/support/etbz55-paginator-oracle.json. The unit suite
requires the TypeScript port to reproduce every layout line for line.

The chapters are built to reach the branches the two recovered fixtures never
reach: a paragraph split whose remainder would be a widow, a subhead that fits
but leaves fewer than two body lines below it, an atomic module that must lead
the next page, a band below a spanning module that is too short.

    PY=/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
    "$PY" tools/pdf-renderer/oracle/build_paginator_oracle.py

Deterministic: no clock, no randomness; the word stream is a fixed cycle.
"""
from __future__ import annotations

import importlib
import json
import pathlib
import shutil
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[3]
HARNESS = ROOT / "tools" / "visual-proof-harness"
ASSETS = ROOT / "assets" / "visual-system-v1"
OUT = ROOT / "tests" / "support" / "etbz55-paginator-oracle.json"

WORDS = ("Stamm Zweig Phase Säule Tagesmeister Verteilung Wandlung Beziehung Ausdruck Anforderung Rückhalt "
         "Unterstützung innen außen sichtbar verborgen zugleich zwei Orten gelesen werden kann eine mögliche "
         "Lesart dieser Chart zeigt wiederkehrend Monat Jahr Stunde Tag Holz Feuer Erde Metall Wasser").split()


def words(start: int, count: int) -> str:
    return " ".join(WORDS[(start + i) % len(WORDS)] for i in range(count))


def chapters() -> list:
    out = []
    # A: paragraph lengths swept so that some split leaves exactly one line for the next column (widow rule).
    for n, size in enumerate((58, 61, 64, 67, 70, 73, 76, 79, 82)):
        blocks = [{"id": f"p{i}", "kind": "paragraph", "text": words(i * 7 + n, size + (i % 3) * 5)} for i in range(9)]
        out.append({"id": f"widow-{n}", "header": [{"id": "k", "kind": "kicker", "text": "KAPITEL 01"}, {"id": "t", "kind": "sectionTitle", "text": words(n, 6)}], "blocks": blocks})
    # B: the opening paragraph swept a few words at a time, so that the subhead after it lands at every
    # depth near the foot of the first column (keep-with-next rule), then further subheads deeper in the flow.
    for n in range(16):
        blocks = [{"id": "p0", "kind": "paragraph", "text": words(n, 236 + n * 3)},
                  {"id": "s0", "kind": "subhead", "text": words(n + 2, 4)},
                  {"id": "p1", "kind": "paragraph", "text": words(n + 5, 150 + n * 5)},
                  {"id": "s1", "kind": "subhead", "text": words(n + 7, 3)},
                  {"id": "p2", "kind": "paragraph", "text": words(n + 9, 120)}]
        out.append({"id": f"subhead-{n}", "header": [{"id": "k", "kind": "kicker", "text": "KAPITEL 02"}, {"id": "t", "kind": "sectionTitle", "text": words(n + 3, 5)}], "blocks": blocks})
    # C: atomic modules at varying depths (band balancing, module leading the next page, short bands).
    for n in range(6):
        blocks = [{"id": "p0", "kind": "paragraph", "text": words(n, 60 + n * 22)},
                  {"id": "q0", "kind": "pullQuote", "text": words(n + 2, 14 + n)},
                  {"id": "p1", "kind": "paragraph", "text": words(n + 4, 70 + n * 9)},
                  {"id": "k0", "kind": "keyInsight", "title": "Kernaussage", "text": words(n + 6, 30 + n * 6)},
                  {"id": "p2", "kind": "paragraph", "text": words(n + 8, 90)},
                  {"id": "s0", "kind": "subhead", "text": words(n + 1, 3)},
                  {"id": "p3", "kind": "paragraph", "text": words(n + 9, 80 + n * 11)}]
        out.append({"id": f"module-{n}", "header": [{"id": "k", "kind": "kicker", "text": "KAPITEL 03"}, {"id": "t", "kind": "sectionTitle", "text": words(n + 5, 7)},
                                                   {"id": "s", "kind": "standfirst", "text": words(n + 9, 18)}], "blocks": blocks})
    return out


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="etbz55-oracle-") as tmp:
        stage = pathlib.Path(tmp)
        shutil.copytree(HARNESS / "build", stage / "build", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copy2(ASSETS / "tokens.json", stage / "tokens.json")
        shutil.copytree(ASSETS / "fonts", stage / "fonts")
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(stage / "build"))
        paginate = importlib.import_module("paginate")
        results = []
        for chapter in chapters():
            header_h = 0
            for block in chapter["header"]:
                style = block["kind"]
                measure = {"kicker": paginate.CONTENT_W, "sectionTitle": int(paginate.CONTENT_W * 0.72), "standfirst": int(paginate.CONTENT_W * 0.78)}[style]
                lines = paginate.wrap(block["text"], style, measure)
                header_h += paginate.ceil_bl(len(lines) * paginate.STYLES[style][2]) + (paginate.BL if style != "standfirst" else 0)
            header_h += 3 * paginate.BL
            layout = paginate.paginate(chapter["blocks"], header_h)
            layout.pop("structuralSha256", None)
            results.append({"id": chapter["id"], "header": chapter["header"], "blocks": chapter["blocks"], "headerHeightCp": header_h, "layout": layout})
    OUT.write_text(json.dumps({"oracleVersion": "etbz55-paginator-oracle@1", "source": "tools/visual-proof-harness/build/paginate.py (canonical ETBZ-49 paginator)",
                               "generator": "tools/pdf-renderer/oracle/build_paginator_oracle.py", "chapters": results},
                              ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(results)} chapters")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
