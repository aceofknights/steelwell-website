"""Local-only static regression server; does not write or change application files."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


class RegressionHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == "/webpages/SeatingChart.html":
            markup = (ROOT / "webpages/SeatingChart.html").read_text(encoding="utf-8")
            def revision_link(match):
                attribute, relative = match.groups()
                revision = (ROOT / "webpages" / relative).resolve().stat().st_mtime_ns
                return f'{attribute}="{relative}?regression={revision}"'
            markup = re.sub(r'(src|href)="(\.\./(?:javascript|css)/[^"?]+)"', revision_link, markup).encode("utf-8")
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
    with ThreadingHTTPServer(("127.0.0.1", 8873), RegressionHandler) as server:
        print("Synthetic tests only: http://127.0.0.1:8873/tests/browser/seating-stability-harness.html", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
