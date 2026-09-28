#!/usr/bin/env python3
"""Quick preview renderer for individual pages during authoring."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import pages_customer as C
from render import render_many, A4_PX
ROOT = pathlib.Path(__file__).resolve().parent.parent
out = ROOT / "src" / "pages"; out.mkdir(parents=True, exist_ok=True)
prev = ROOT / "out" / "preview"; prev.mkdir(parents=True, exist_ok=True)
jobs = []
for name in sys.argv[1:]:
    pid, num, html, st = getattr(C, name)()
    f = out / f"{pid}.html"; f.write_text(html, encoding="utf-8")
    jobs.append((str(f), str(prev / f"{pid}.png"), None, *A4_PX))
render_many(jobs)
print("\n".join(j[1] for j in jobs))
