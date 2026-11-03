"""Build christianpipal.com from the YAML files in content/.

    python build.py            # build the theme set in content/site.yml into _site/
    python build.py serve      # same, served on http://localhost:8000, rebuilt on change
    python build.py preview    # build every theme into _preview/<theme>/ with a theme switcher,
                               # served on http://localhost:8000

Themes: templates/themes/<theme>/ overrides templates/shared/; theme CSS/JS lives in static/themes/<theme>/.
"""

import http.server
import json
import re
import shutil
import sys
import threading
from datetime import date
from pathlib import Path

import markdown as md
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

ROOT = Path(__file__).parent
CONTENT, TEMPLATES, STATIC, OUT = (ROOT / d for d in ("content", "templates", "static", "_site"))
PREVIEW = ROOT / "_preview"
PAGES = ["index", "research", "publications", "teaching", "cv"]


def load(name):
    with open(CONTENT / f"{name}.yml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def markdown_filter(text, inline=False):
    html = md.markdown(text or "", extensions=["smarty"])
    if inline:
        html = re.sub(r"^<p>(.*)</p>$", r"\1", html.strip(), flags=re.S)
    return Markup(html)


def format_authors(authors, me):
    """["Pipal, Christian", "Wack, Morgan"] -> 'Pipal, C., Wack, M.' with `me` in bold."""
    out = []
    for a in authors:
        last, _, first = a.partition(",")
        # "Eva-Maria" -> "E.-M.", "Mariken A. C. G." -> "M. A. C. G."
        initials = " ".join("-".join(h[0] + "." for h in p.split("-")) for p in first.split())
        name = f"{last.strip()}, {initials}" if initials else last.strip()
        out.append(f"<strong>{name}</strong>" if last.strip() == me else name)
    if len(out) > 1:
        return Markup(", ".join(out[:-1]) + " &amp; " + out[-1])
    return Markup(out[0])


def themes():
    return sorted(d.name for d in (STATIC / "themes").iterdir() if (d / "style.css").exists())


def load_all():
    site = load("site")
    research = load("research")
    pubs = load("publications")

    # Research lines are the single source of truth for which paper belongs where:
    # each paper gets the lines (and projects) that list it.
    by_id = {}
    for section in pubs["sections"]:
        for p in section["items"]:
            p.setdefault("lines", [])
            p.setdefault("projects", [])
            p["section"] = section["key"]
            by_id[p["id"]] = p
    for line in research["lines"]:
        for cluster in line["clusters"]:
            for pid in cluster["papers"]:
                if pid not in by_id:
                    sys.exit(f"research.yml: unknown paper id '{pid}' in {line['key']}")
                if line["key"] not in by_id[pid]["lines"]:
                    by_id[pid]["lines"].append(line["key"])
    for proj in research["projects"]:
        for pid in proj.get("papers", []):
            if pid not in by_id:
                sys.exit(f"research.yml: unknown paper id '{pid}' in project {proj['key']}")
            by_id[pid]["projects"].append(proj["key"])
    for p in by_id.values():
        if p.get("figure") and not (STATIC / p["figure"]).exists():
            print(f"  warning: figure missing for {p['id']}: static/{p['figure']}")
            p["figure"] = None

    # Plain-data version of the papers for themes that draw them with JavaScript (e.g. a plot).
    papers_json = json.dumps([
        {k: p.get(k) for k in ("id", "title", "year", "venue", "section", "lines", "projects", "doi", "preprint")}
        | {"authors": str(format_authors(p["authors"], site["me"]))}
        for p in by_id.values()
    ], ensure_ascii=False)

    return dict(
        site=site,
        research=research,
        pubs=pubs,
        papers=by_id,
        papers_json=Markup(papers_json),
        lines={l["key"]: l for l in research["lines"]},
        projects={p["key"]: p for p in research["projects"]},
        teaching=load("teaching"),
        cv=load("cv"),
        cv_pdf=(STATIC / "files" / "cv.pdf").exists(),
        year=date.today().year,
    )


def switcher(current, all_themes):
    links = " ".join(
        f'<a href="../{t}/{{page}}.html"{" aria-current=page" if t == current else ""}>{t}</a>' for t in all_themes
    )
    return (
        '<div id="theme-switcher" style="position:fixed;z-index:9999;bottom:12px;left:50%;transform:translateX(-50%);'
        "display:flex;gap:4px;align-items:center;padding:6px 8px;border-radius:999px;background:#111;color:#eee;"
        'font:12px/1 ui-monospace,Menlo,monospace;box-shadow:0 4px 16px rgb(0 0 0/.3)">'
        '<span style="padding:0 6px;opacity:.6">theme</span>' + links + "</div>"
        "<style>#theme-switcher a{color:#ccc;text-decoration:none;padding:5px 9px;border-radius:999px}"
        "#theme-switcher a:hover{background:#333}#theme-switcher a[aria-current]{background:#eee;color:#111}</style>"
    )


def build(theme=None, out=OUT, preview_themes=None):
    ctx = load_all()
    theme = theme or ctx["site"].get("theme", "classic")
    env = Environment(
        loader=FileSystemLoader([TEMPLATES / "themes" / theme, TEMPLATES / "shared"]),
        autoescape=select_autoescape(),
    )
    env.filters["md"] = markdown_filter
    env.filters["authors"] = lambda a: format_authors(a, ctx["site"]["me"])

    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(STATIC, out, ignore=shutil.ignore_patterns("themes"))
    shutil.copytree(STATIC / "themes" / theme, out / "themes" / theme)
    for page in PAGES:
        html = env.get_template(f"{page}.html").render(page=page, theme=theme, **ctx)
        if preview_themes:
            html = html.replace("</body>", switcher(theme, preview_themes).replace("{page}", page) + "</body>")
        (out / f"{page}.html").write_text(html, encoding="utf-8")
    print(f"built {theme}: {len(PAGES)} pages, {len(ctx['papers'])} papers -> {out.relative_to(ROOT)}/")


def build_preview():
    all_themes = themes()
    PREVIEW.mkdir(exist_ok=True)
    for t in all_themes:
        try:
            build(t, PREVIEW / t, all_themes)
        except Exception as e:  # one broken theme shouldn't take the others down
            print(f"  theme {t} failed: {type(e).__name__}: {e}")
    items = "".join(f'<li><a href="{t}/index.html">{t}</a></li>' for t in all_themes)
    (PREVIEW / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>Theme preview</title>'
        '<body style="font:16px/1.6 ui-monospace,Menlo,monospace;max-width:40em;margin:4em auto;padding:0 16px">'
        f"<h1>christianpipal.com — themes</h1><ul>{items}</ul></body>",
        encoding="utf-8",
    )


def latest_mtime():
    return max(f.stat().st_mtime for d in (CONTENT, TEMPLATES, STATIC) for f in d.rglob("*") if f.is_file())


def serve(rebuild, directory, port=8000):
    built_at = [latest_mtime()]
    lock = threading.Lock()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(directory), **kw)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path.endswith("/"):
                path += "index.html"
            elif "." not in path.rsplit("/", 1)[-1]:
                path += ".html"
            self.path = path
            # Rebuild on page loads only, one at a time (assets requested in parallel must not race a rebuild).
            if path.endswith(".html"):
                with lock:
                    if latest_mtime() > built_at[0]:
                        built_at[0] = latest_mtime()
                        try:
                            rebuild()
                        except SystemExit as e:
                            print(e)
            with lock:
                super().do_GET()

        def log_message(self, *a):
            pass

    print(f"serving on http://localhost:{port}  (edits in content/, templates/, static/ rebuild on reload)")
    http.server.ThreadingHTTPServer(("", port), Handler).serve_forever()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    if cmd == "preview":
        build_preview()
        serve(build_preview, PREVIEW, port)
    else:
        build()
        if cmd == "serve":
            serve(build, OUT, port)
