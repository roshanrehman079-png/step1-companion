# Fake Supabase on another origin (port 5555) so the browser applies real CORS rules.
# /rest/v1/* is proxied to the local PostgREST; /functions/v1/ask-mochi mimics an OLD or NEW deploy.
import json, sys, urllib.request, http.server
MODE = sys.argv[1]  # old | new
TOKEN = open('/tmp/azka.jwt').read().strip()
ALLOW = 'authorization, x-client-info, apikey, content-type' + (', x-region' if MODE == 'new' else '')
class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', ALLOW if 'functions' in self.path else '*')
        self.send_header('Access-Control-Allow-Methods', '*'); self.send_header('Access-Control-Expose-Headers', 'content-range')
    def do_OPTIONS(self):
        if 'functions' in self.path: log.write(f"OPTIONS asks={self.headers.get('Access-Control-Request-Headers')} allowed={ALLOW}\n"); log.flush()
        self.send_response(200); self.cors(); self.end_headers()
    def proxy(self, method):
        n = int(self.headers.get('content-length') or 0); body = self.rfile.read(n) if n else None
        if self.path.startswith('/auth/v1'):
            out, code, extra = json.dumps({'id': '11111111-1111-1111-1111-111111111111'}).encode(), 200, {}
        elif self.path.startswith('/functions/v1/ask-mochi'):
            log.write(f"{method} {self.path} x-region={self.headers.get('x-region')}\n"); log.flush()
            out, code, extra = json.dumps({'text': 'Hello from Dr. Mochi, purr!', 'sources': [], 'left': 29}).encode(), 200, {}
        else:
            req = urllib.request.Request('http://localhost:3000' + self.path[len('/rest/v1'):], data=body, method=method,
                headers={k: v for k, v in self.headers.items() if k.lower() in ('accept', 'content-type', 'prefer', 'range')} | {'Authorization': 'Bearer ' + TOKEN})
            try: r = urllib.request.urlopen(req); out, code, extra = r.read(), r.status, {'Content-Range': r.headers.get('Content-Range') or ''}
            except urllib.error.HTTPError as e: out, code, extra = e.read(), e.code, {}
        self.send_response(code); self.cors(); self.send_header('Content-Type', 'application/json')
        for k, v in extra.items():
            if v: self.send_header(k, v)
        self.end_headers(); self.wfile.write(out)
    do_GET = lambda s: s.proxy('GET'); do_POST = lambda s: s.proxy('POST'); do_PATCH = lambda s: s.proxy('PATCH'); do_HEAD = lambda s: s.proxy('HEAD')
    def log_message(self, *a): pass
log = open(f'/tmp/fn-{MODE}.log', 'w')
http.server.ThreadingHTTPServer(('127.0.0.1', 5555), H).serve_forever()
