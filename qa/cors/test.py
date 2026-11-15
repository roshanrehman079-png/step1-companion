import json, re, subprocess, time, datetime as dt
from playwright.sync_api import sync_playwright
tok = open('/tmp/azka.jwt').read().strip()
sess = {"access_token": tok, "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 864000, "refresh_token": "r", "user": {"id": "11111111-1111-1111-1111-111111111111", "aud": "authenticated"}}
for mode in ['old', 'new']:
    srv = subprocess.Popen(['python3', '-I', 'server.py', mode], stderr=subprocess.DEVNULL); time.sleep(1.2)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); ctx = b.new_context()
        ctx.add_init_script(f"localStorage.setItem('sb-localhost-auth-token', {json.dumps(json.dumps(sess))}); for (const d of ['2026-11-15','2026-11-16','2026-11-17']) localStorage.setItem('birthday-seen-'+d,'1');")
        pg = ctx.new_page(); cons = []; pg.on("console", lambda m: m.type == "error" and cons.append(m.text[:120]))
        pg.goto("http://localhost:4174/#/debug"); pg.get_by_role("button", name="Test Ask").click(); pg.wait_for_timeout(2500)
        out = pg.locator("pre").last.inner_text()
        print(f"[{mode} function deployed] result: {out}")
        print("   requests that reached the function:", open(f'/tmp/fn-{mode}.log').read().strip().replace('\n', ' | ') or 'none')
        print("   browser CORS errors:", len([c for c in cons if 'CORS' in c]))
        b.close()
    srv.terminate(); time.sleep(0.5)
