#!/usr/bin/env python3
"""Playwright/Chromium render harness (proof tooling, not a production contract).
Renders an A4 HTML page to PNG (2x, 1588 px wide) and to single-page PDF (A4, CSS page size)."""
from __future__ import annotations
import sys, pathlib
from playwright.sync_api import sync_playwright

A4_PX = (794, 1123)  # CSS px at 96 dpi

def render_many(jobs, scale=2):
    """jobs: list of (html_path, png_path|None, pdf_path|None, width_px, height_px)"""
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(device_scale_factor=scale)
        page = ctx.new_page()
        for html, png, pdf, w, h in jobs:
            page.set_viewport_size({"width": w, "height": h})
            page.goto(pathlib.Path(html).resolve().as_uri())
            page.wait_for_load_state("networkidle")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(120)
            if png:
                page.screenshot(path=str(png), full_page=False, clip={"x": 0, "y": 0, "width": w, "height": h})
            if pdf:
                page.pdf(path=str(pdf), width=f"{w}px", height=f"{h}px", print_background=True,
                         margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}, prefer_css_page_size=True)
        b.close()

if __name__ == "__main__":
    html, png = sys.argv[1], sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else A4_PX[0]
    h = int(sys.argv[4]) if len(sys.argv) > 4 else A4_PX[1]
    render_many([(html, png, None, w, h)])
