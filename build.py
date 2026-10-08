"""Assemble Motif into two pages:
   dist/index.html             page content for the claude.ai artifact (the host adds the document skeleton)
   dist/motif-standalone.html  a complete document to open from your own site or localhost, where the mic works
"""
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
shell = (src / "shell.html").read_text()
page = (shell
        .replace("/*STYLES*/", (src / "styles.css").read_text())
        .replace("/*PITCH*/", (src / "pitch.js").read_text().replace("if (typeof module !== 'undefined')", "if (false)"))
        .replace("/*APP*/", (src / "app.js").read_text()))

dist = root / "dist"
dist.mkdir(exist_ok=True)
(dist / "index.html").write_text(page)

RESET = (":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
         "body{margin:0;font:14px system-ui,sans-serif;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}")
standalone = ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
              "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
              f"<style>{RESET}</style></head><body>\n{page}\n</body></html>\n")
(dist / "motif-standalone.html").write_text(standalone)
print("built", len(page) // 1024, "KB")
