#!/usr/bin/env python3
"""Make every page self-contained: inline assets/shared.css and assets/shared.js, embed the xkcd images.

Idempotent: re-run after editing assets/shared.css or shared.js and every page picks up the change.
Pages keep working from any context (a browser tab, the Claude app side panel, email, Drive preview).
"""
import base64, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
css = (ROOT / "assets/shared.css").read_text()
js = (ROOT / "assets/shared.js").read_text()
def datauri(name):
    return "data:image/png;base64," + base64.b64encode((ROOT / "assets" / name).read_bytes()).decode()
IMG = {n: datauri(n) for n in ["xkcd-1205-is-it-worth-the-time.png", "xkcd-1205-is-it-worth-the-time_2x.png"]}
CSS_BLOCK = '<style data-shared="css">\n' + css + '\n</style>'
JS_BLOCK = '<script data-shared="js">\n' + js + '\n</script>'
for page in sorted(ROOT.glob("*.html")):
    s = page.read_text(); before = s
    s = re.sub(r'<link[^>]+href="assets/shared\.css(?:\?[^"]*)?"[^>]*>', lambda m: CSS_BLOCK, s)
    s = re.sub(r'<style data-shared="css">.*?</style>', lambda m: CSS_BLOCK, s, flags=re.S)
    s = re.sub(r'<script[^>]+src="assets/shared\.js(?:\?[^"]*)?"[^>]*>\s*</script>', lambda m: JS_BLOCK, s)
    s = re.sub(r'<script data-shared="js">.*?</script>', lambda m: JS_BLOCK, s, flags=re.S)
    for name, uri in IMG.items():
        s = s.replace(f"assets/{name}", uri)
    if s != before:
        page.write_text(s)
    print(f"{page.name}: {'bundled' if s != before else 'unchanged'} ({len(s)//1024} KB)")
