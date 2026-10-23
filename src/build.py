#!/usr/bin/env python3
"""Builds ../worker.js from dashboard.html + worker.template.js + icons/*.png.
Run:  python3 build.py   (only needed if you edit the files in src/)"""
import base64, json, pathlib
here = pathlib.Path(__file__).resolve().parent
b64 = lambda f: base64.b64encode((here / "icons" / f).read_bytes()).decode()
out = (here / "worker.template.js").read_text(encoding="utf-8")
out = out.replace("__ICON_MOJO__", b64("mojo.png")).replace("__ICON_CANDY__", b64("candy.png"))
# json.dumps gives a valid JS string literal; escape U+2028/2029 for older parsers
html = json.dumps((here / "dashboard.html").read_text(encoding="utf-8"), ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
out = out.replace("__HTML__", html)
(here.parent / "worker.js").write_text(out, encoding="utf-8")
print("wrote", here.parent / "worker.js", len(out), "bytes")
