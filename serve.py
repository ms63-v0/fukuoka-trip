"""로컬 미리보기 서버 (캐시 끔).

사용법:
    python serve.py            # http://localhost:5180
    python serve.py 8000       # 포트 지정
"""
import http.server
import sys
from functools import partial
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
ROOT = Path(__file__).resolve().parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


http.server.ThreadingHTTPServer.allow_reuse_address = True
handler = partial(NoCacheHandler, directory=str(ROOT))
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"Fukuoka trip notes -> http://localhost:{PORT}", flush=True)
    httpd.serve_forever()
