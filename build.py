"""Assemble Motif.

   public/              the website: deploy this folder (Cloudflare Workers or Pages, or any static host)
     index.html         the complete app in one page
     _headers, …        everything in src/site/, copied as is (response headers, favicon)
   dist/index.html      page content for a claude.ai artifact (the host adds the document skeleton)

   CSS:  src/styles.css, then src/styles/*.css in name order
   JS:   src/pitch.js as its own script (listening engine, globals)
         one strict-mode wrapper holding src/theory.js, then src/app/*.js in name order

   MOTIF_PUBLIC and MOTIF_DIST build somewhere else; the tests read MOTIF_PAGE (default public/index.html).
"""
import os
import shutil
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
HEAD = ("<meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
        "<meta name=\"description\" content=\"Learn music theory by playing: Motif listens to the notes and chords you play and builds your skills a little every day.\">"
        "<meta name=\"theme-color\" content=\"#2C43D4\">"
        "<link rel=\"icon\" href=\"favicon.svg\" type=\"image/svg+xml\">")
standalone = (f"<!doctype html><html lang=\"en\"><head>{HEAD}"
              f"<style>{RESET}</style></head><body>\n{page}\n</body></html>\n")

public = Path(os.environ.get("MOTIF_PUBLIC", root / "public"))
if public.resolve() in (root.resolve(), src.resolve()) or (public / ".git").exists():
    raise SystemExit(f"refusing to replace {public}: point MOTIF_PUBLIC at a build folder")
if public.exists():
    shutil.rmtree(public)
shutil.copytree(src / "site", public)
(public / "index.html").write_text(standalone)
print("built", len(page) // 1024, "KB:", public / "index.html", "and", dist / "index.html")
