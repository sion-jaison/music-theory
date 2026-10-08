"""Assemble Motif into two pages:
   dist/index.html             page content for the claude.ai artifact (the host adds the document skeleton)
   dist/motif-standalone.html  a complete document to open from your own site or localhost, where the mic works

   CSS:  src/styles.css, then src/styles/*.css in name order
   JS:   src/pitch.js as its own script (listening engine, globals)
         one strict-mode wrapper holding src/theory.js, then src/app/*.js in name order

   Set MOTIF_DIST to build somewhere other than dist/ (the tests read MOTIF_PAGE).
"""
import os
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
NODE_GUARD = "if (typeof module !== 'undefined')"


def browser(path):
    """Read a source file, switching off the Node-only export at its end."""
    return path.read_text().replace(NODE_GUARD, "if (false)")


styles = "\n".join([(src / "styles.css").read_text()] + [p.read_text() for p in sorted((src / "styles").glob("*.css"))])
parts = [browser(src / "theory.js")] + [p.read_text() for p in sorted((src / "app").glob("*.js"))]
app = "(function () {\n'use strict';\n\n" + "\n".join(parts) + "})();\n"

shell = (src / "shell.html").read_text()
page = (shell
        .replace("/*STYLES*/", styles)
        .replace("/*PITCH*/", browser(src / "pitch.js"))
        .replace("/*APP*/", app))

dist = Path(os.environ.get("MOTIF_DIST", root / "dist"))
dist.mkdir(parents=True, exist_ok=True)
(dist / "index.html").write_text(page)

RESET = (":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
         "body{margin:0;font:14px system-ui,sans-serif;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}")
standalone = ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
              "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
              f"<style>{RESET}</style></head><body>\n{page}\n</body></html>\n")
(dist / "motif-standalone.html").write_text(standalone)
print("built", len(page) // 1024, "KB")
