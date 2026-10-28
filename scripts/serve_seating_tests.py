"""Local-only static regression server; does not write or change application files."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import json
import argparse
from threading import Lock
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
REQUEST_LOG = None
LOG_LOCK = Lock()


class RegressionHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_response(self, code, message=None):
        if REQUEST_LOG:
            with LOG_LOCK:
                with REQUEST_LOG.open("a", encoding="utf-8") as output:
                    output.write(json.dumps({"method": self.command, "url": self.path, "status": code}) + "\n")
        super().send_response(code, message)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if "migrationAudit=1" in self.path:
            candidate = (ROOT / unquote(urlsplit(self.path).path).lstrip("/")).resolve()
            if candidate.is_dir(): candidate = candidate / "index.html"
            if candidate.is_relative_to(ROOT) and candidate.is_file() and candidate.suffix == ".html":
                markup = candidate.read_text(encoding="utf-8")
                probe = '<script src="/tests/browser/migration-observer.js"></script>'
                # Instrumentation is test-server-only, before page scripts, with no storage access.
                if "<head>" in markup: markup = markup.replace("<head>", "<head>" + probe, 1)
                else: markup = markup.replace("<title>", probe + "<title>", 1)
                content = markup.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers(); self.wfile.write(content); return
        if urlsplit(self.path).path in ("/webpages/SeatingChart.html", "/seating-chart/", "/seating-chart/index.html"):
            page_file = "seating-chart/index.html" if self.path.startswith("/seating-chart/") else "webpages/SeatingChart.html"
            markup = (ROOT / page_file).read_text(encoding="utf-8")
            def revision_link(match):
                attribute, relative = match.groups()
                revision = (ROOT / relative.lstrip("/")).resolve().stat().st_mtime_ns
                return f'{attribute}="{relative}?regression={revision}"'
            markup = re.sub(r'(src|href)="(/(?:javascript|css)/[^"?]+)"', revision_link, markup).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(markup)))
            self.end_headers()
            self.wfile.write(markup)
        elif urlsplit(self.path).path == "/javascript/seating_data_protection.js":
            # Cache-bust the dynamically loaded core as well; the controller's
            # behavior and disk contents remain unchanged.
            revision = (ROOT / "javascript/Seating_Chart.js").stat().st_mtime_ns
            code = (ROOT / "javascript/seating_data_protection.js").read_text(encoding="utf-8")
            code = code.replace("'../javascript/Seating_Chart.js'", f"'../javascript/Seating_Chart.js?regression={revision}'").encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(code)))
            self.end_headers()
            self.wfile.write(code)
        else:
            super().do_GET()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--request-log")
    options = parser.parse_args()
    if options.request_log:
        REQUEST_LOG = Path(options.request_log).resolve()
        REQUEST_LOG.parent.mkdir(parents=True, exist_ok=True)
    with ThreadingHTTPServer(("127.0.0.1", 8873), RegressionHandler) as server:
        print("Synthetic tests only: http://127.0.0.1:8873/tests/browser/seating-stability-harness.html", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
