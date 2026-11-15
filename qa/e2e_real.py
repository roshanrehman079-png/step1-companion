"""End-to-end QA: built app in Chrome -> Playwright -> local PostgREST -> Postgres with the real migrations + RLS.
Only Supabase Auth and the Gemini function are simulated."""
import base64, hashlib, hmac, json, re, subprocess, sys, time, datetime as dt, os
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:4173/"
REF = "gbyjwfaprhfxjknslivu"
SECRET = b"e2e-local-secret-e2e-local-secret-123456"
AZKA = ("11111111-1111-1111-1111-111111111111", "azka@x.com")
MUM = ("22222222-2222-2222-2222-222222222222", "mum@x.com")
SHOTS = "/home/claude/e2e/real"; os.makedirs(SHOTS, exist_ok=True)
CLOCK = dt.datetime(2026, 11, 20, 10, 0)
problems, log = [], []

def sql(q):
    return subprocess.run(["su", "pg", "-c", f"psql -h /tmp/pgdata -p 5433 -d e2e -At -c \"{q}\""], capture_output=True, text=True).stdout.strip()

def jwt(uid, email):
    b = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b"=")
    h, p = b({"alg": "HS256", "typ": "JWT"}), b({"sub": uid, "email": email, "role": "authenticated", "aud": "authenticated", "exp": int(CLOCK.timestamp()) + 86400 * 30})
    sig = base64.urlsafe_b64encode(hmac.new(SECRET, h + b"." + p, hashlib.sha256).digest()).rstrip(b"=")
    return (h + b"." + p + b"." + sig).decode()

def check(cond, what):
    (log if cond else problems).append(("ok  " if cond else "FAIL ") + what)

def browser(p, user, w, h, tag, join=None):
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=w < 500)
    tok = jwt(*user)
    sess = {"access_token": tok, "token_type": "bearer", "expires_in": 3600, "expires_at": int(CLOCK.timestamp()) + 86400 * 30, "refresh_token": "r",
            "user": {"id": user[0], "email": user[1], "aud": "authenticated", "role": "authenticated"}}
    init = f"localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(sess))});"
    if join: init += f"localStorage.setItem('join-code', '{join}');"
    ctx.add_init_script(init)
    def handle(route, req):
        u = req.url
        if "/auth/v1/" in u:
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": user[0], "email": user[1], "aud": "authenticated"}))
        if "/functions/v1/ask-mochi" in u:
            return route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"},
                                 body=json.dumps({"text": "Type II: antibodies bind cell surfaces. Type III: immune complexes deposit in tissue. Purr!", "sources": [], "left": 29}))
        m = re.match(r"https://[^/]+/rest/v1(/.*)", u)
        if m:
            hdrs = {k: v for k, v in req.headers.items() if k.lower() in ("accept", "content-type", "prefer", "range", "content-profile", "accept-profile")}
            hdrs["Authorization"] = f"Bearer {tok}"
            resp = route.fetch(url="http://localhost:3000" + m.group(1), headers=hdrs)
            if resp.status >= 400: problems.append(f"FAIL {tag}: API {req.method} {m.group(1)[:80]} -> {resp.status} {resp.text()[:160]}")
            return route.fulfill(response=resp, headers={**resp.headers, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range"})
        return route.continue_()
    ctx.route(re.compile(r"https://.*supabase\.co/.*"), handle)
    ctx.route(re.compile(r"https://fonts\.(googleapis|gstatic)\.com/.*"), lambda r, q: r.fulfill(status=200, body=""))
    pg = ctx.new_page(); pg.clock.install(time=CLOCK)
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and problems.append(f"FAIL {tag} console: {m.text[:200]}"))
    pg.on("pageerror", lambda e: problems.append(f"FAIL {tag} pageerror: {e}"))
    pg.set_default_timeout(8000)
    return b, pg

def shot(pg, name):
    pg.wait_for_timeout(350); pg.screenshot(path=f"{SHOTS}/{name}.png", full_page=True)
    over = pg.evaluate("() => { const w = window.innerWidth; const bad = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > w + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('[class*=overflow-x-auto]') && !e.closest('dialog:not([open])') }); return { sw: document.documentElement.scrollWidth, w, bad: bad.slice(0,3).map(e => e.tagName + '.' + (e.className||'').toString().slice(0,40) + ':' + (e.textContent||'').slice(0,30)) } }")
    check(over["sw"] <= over["w"] and not over["bad"], f"{name}: fits {over['w']}px wide {'' if not over['bad'] else over['bad']}")

with sync_playwright() as p:
    # ---------------- Azka, phone ----------------
    b, pg = browser(p, AZKA, 390, 844, "azka")
    pg.goto(BASE); pg.get_by_role("link", name="Set up my study space").click()
    pg.get_by_role("button", name="Start").click(); pg.get_by_role("button", name="Biscuit").click()
    pg.get_by_role("button", name="That's my name").click(); pg.get_by_role("button", name="Next").click(); pg.get_by_role("button", name="Next").click()
    pg.get_by_role("button", name="Show me today").click(); pg.get_by_text("How are you feeling?").wait_for()
    check(sql("select count(*) from study_days") == "45", "onboarding created 45 plan days")
    sql("update profiles set onboarded_at = '2026-11-16T08:00:00Z'")  # pretend she started on day 1, so earlier days count for Pending
    pg.reload(); pg.get_by_text("How are you feeling?").wait_for(); shot(pg, "01-checkin-390")
    pg.get_by_role("button", name=re.compile("^Okay")).click()
    pg.get_by_text("Biochemistry application").first.wait_for(); shot(pg, "02-today-390")
    check(pg.get_by_text("8:00 am").count() > 0, "today shows clock times from 8:00 am")
    pg.get_by_role("checkbox", name="Tick off: Anki flashcards").click(); pg.wait_for_timeout(500)
    check(sql("select count(*) from events where kind='step' and payload->>'task'='t1' and not voided") == "1", "ticking Anki saved a tick")
    pg.get_by_role("checkbox", name=re.compile("Untick: Anki")).click(); pg.wait_for_timeout(500)
    check(sql("select count(*) from events where kind='step' and payload->>'task'='t1' and not voided") == "0", "unticking voids the tick")
    pg.get_by_role("checkbox", name=re.compile("Tick off: Block 1")).click(); pg.get_by_role("dialog").get_by_role("button", name="Save").click(); pg.wait_for_timeout(600)
    check(sql("select payload->>'fresh' from events where kind='qblock'") == "20", "block log saved 20 questions")
    check(pg.get_by_role("checkbox", name=re.compile("Untick: Block 1")).is_checked(), "block shows ticked after logging")
    pg.get_by_role("button", name="+250 mL").first.click(); pg.wait_for_timeout(400); pg.get_by_role("button", name="Undo last water").click(); pg.wait_for_timeout(400)
    check(sql("select count(*) from events where kind='water' and not voided") == "0", "water add + undo")
    check(pg.get_by_text(re.compile("pending from earlier days")).count() == 1, "today shows pending-from-earlier card")

    # Planner: search
    pg.get_by_role("navigation", name="Main").last.get_by_role("link", name="Planner").click()
    pg.get_by_label("Search the plan").fill("mehlman"); pg.wait_for_timeout(300)
    check("match" in pg.get_by_text(re.compile(r"days? match")).first.inner_text(), "search for Mehlman lists matching days"); shot(pg, "03-search-390")
    pg.get_by_label("Search the plan").fill("immuno"); pg.wait_for_timeout(200)
    n_imm = pg.get_by_text(re.compile(r"days? match")).first.inner_text(); check(n_imm.startswith("2") or n_imm.startswith("3"), f"search immuno: {n_imm}")
    pg.get_by_label("Search the plan").fill("")

    # Edit a past reading day: add 20 questions, rename (duplicate warning), save
    pg.goto(BASE + "#/planner?day=2026-11-19"); pg.get_by_role("button", name="Edit this day").click()
    pg.get_by_label("What you're studying").fill("Biochem vitamins"); pg.wait_for_timeout(200)
    check(pg.get_by_text("Already in your plan:").count() == 1, "renaming to a similar topic warns about duplicates");
    pg.get_by_role("button", name="+ 20 questions").click()
    pg.get_by_label("Day starts at").fill("09:00"); shot(pg, "04-editor-390")
    pg.get_by_role("button", name="Save changes").click(); pg.wait_for_timeout(800)
    tasks = json.loads(sql("select tasks from study_days where day='2026-11-19'") or "[]")
    check(any(t["kind"] == "block" for t in tasks) and sql("select start_time from study_days where day='2026-11-19'") == "09:00", "reading day got 20 questions + 9:00 start")
    check(sql("select topic from study_days where day='2026-11-19'") == "Biochem vitamins", "topic renamed")
    pg.keyboard.press("Escape")

    # Pending: tick one, move one, let one go
    pg.goto(BASE + "#/planner?tab=pending"); pg.wait_for_timeout(600); shot(pg, "05-pending-390")
    before = pg.get_by_role("tab", name=re.compile("Pending")).inner_text()
    pg.locator("details summary").first.click(); pg.wait_for_timeout(200)
    rows = pg.locator("select[id^=mv]")
    pg.get_by_role("checkbox", name=re.compile("^Tick off")).first.click(); pg.wait_for_timeout(600)
    rows.first.select_option(index=3); pg.get_by_role("button", name="Move", exact=True).first.click(); pg.wait_for_timeout(900)
    pg.get_by_role("button", name="Let it go").first.click(); pg.wait_for_timeout(900)
    after = pg.get_by_role("tab", name=re.compile("Pending")).inner_text()
    check(int(re.search(r"\d+", after).group()) == int(re.search(r"\d+", before).group()) - 3, f"pending went {before} -> {after} after tick/move/let go")
    check(sql("select count(*) from study_days where tasks::text like '%\\\"from\\\"%'") == "1", "moved task landed on the chosen day")
    n1 = int(re.search(r"\d+", pg.get_by_role("tab", name=re.compile("Pending")).inner_text()).group())
    grp = pg.locator("details").nth(1); grp.locator("summary").click(); k = int(re.search(r"(\d+) pending", grp.locator("summary").inner_text()).group(1))
    grp.get_by_role("button", name="Let all of these go").click(); pg.wait_for_timeout(1000)
    n2 = int(re.search(r"\d+", pg.get_by_role("tab", name=re.compile("Pending")).inner_text()).group())
    check(n2 == n1 - k, f"'Let all of these go' cleared a day's {k} items ({n1} -> {n2})"); shot(pg, "05b-pending-grouped-390")

    # Add a day, check shift, then undo from Changes
    pg.goto(BASE + "#/planner?day=2026-11-23"); pg.get_by_role("button", name="Edit this day").click()
    pg.get_by_role("button", name=re.compile("Add another day of this topic")).click()
    check(pg.get_by_text(re.compile("This also moves fixed dates")).count() == 1, "warns that fixed NBME dates will move")
    pg.get_by_role("button", name="Yes, do it").click(); pg.wait_for_timeout(1200)
    check(sql("select count(*) from study_days") == "46" and sql("select topic from study_days where day='2026-11-24'") == sql("select topic from study_days where day='2026-11-23'"), "inserted a second Immunology day; plan is 46 days")
    pg.goto(BASE + "#/planner?tab=changes"); pg.wait_for_timeout(600); shot(pg, "06-changes-390")
    pg.get_by_role("button", name="Undo this").first.click(); pg.wait_for_timeout(1200)
    check(sql("select count(*) from study_days") == "45", "undo restored 45 days")
    # Swap two days
    pg.goto(BASE + "#/planner?day=2026-11-25"); pg.get_by_role("button", name="Edit this day").click()
    t25, t26 = sql("select topic from study_days where day='2026-11-25'"), sql("select topic from study_days where day='2026-11-26'")
    pg.get_by_label("Swap with").select_option("2026-11-26"); pg.get_by_role("button", name="Swap", exact=True).click(); pg.wait_for_timeout(1200)
    check(sql("select topic from study_days where day='2026-11-25'") == t26 and sql("select topic from study_days where day='2026-11-26'") == t25, "swap exchanged two days")

    # Ask
    pg.goto(BASE + "#/ask"); pg.get_by_label("Your question").fill("Type 2 vs type 3 hypersensitivity?"); pg.get_by_role("button", name="Ask").click()
    pg.get_by_text("immune complexes").wait_for(); shot(pg, "07-ask-390")
    # Settings: invite link
    pg.goto(BASE + "#/settings"); pg.get_by_label("Who is this invite for?").fill("Mum"); pg.get_by_role("button", name="Create invite").click(); pg.wait_for_timeout(700)
    code = sql("select invite_code from grants")
    check(len(code) == 12 and pg.get_by_text(f"#/join/{code}").count() >= 1, "invite link shown with code"); shot(pg, "08-settings-390")
    for path, name in [("#/", "09-today-again-390"), ("#/notes", "10-notes-390"), ("#/buddy", "11-buddy-390")]:
        pg.goto(BASE + path); pg.wait_for_timeout(700); shot(pg, name)
    # Wrap up
    pg.goto(BASE); pg.get_by_role("button", name=re.compile("wrap up", re.I)).click(); pg.wait_for_timeout(400); shot(pg, "12-wrap-390")
    pg.get_by_role("button", name="Close the day").click(); pg.wait_for_timeout(800)
    check(sql("select count(*) from events where kind='wrap'") == "1", "day closed")
    pg.wait_for_timeout(2000)  # let the guest summary publish
    b.close()
    check(sql("select (data->'plan'->0->'tasks') is not null from public_summary") == "t", "guest summary includes full plan with tasks")

    # ---------------- Azka, 360px + desktop ----------------
    for (w, h, tag) in [(360, 740, "360"), (1280, 900, "desk")]:
        b, pg = browser(p, AZKA, w, h, f"azka-{tag}")
        for path, name in [("#/", "today"), ("#/planner", "planner"), ("#/planner?day=2026-11-19", "dayview"), ("#/settings", "settings"), ("#/ask", "ask")]:
            pg.goto(BASE + path); pg.wait_for_timeout(900); shot(pg, f"20-{name}-{tag}")
        pg.goto(BASE + "#/planner?day=2026-11-19"); pg.get_by_role("button", name="Edit this day").click(); shot(pg, f"21-editor-{tag}")
        b.close()

    # ---------------- Mum (guest) with the invite code ----------------
    for (w, h, tag) in [(360, 740, "360"), (390, 844, "390"), (1280, 900, "desk")]:
        b, pg = browser(p, MUM, w, h, f"guest-{tag}", join=code if tag == "360" else None)
        pg.goto(BASE); pg.get_by_text("How Azka is doing").wait_for()
        if tag == "360": check(sql("select status from grants") == "active", "guest joined with the invite code")
        shot(pg, f"30-guest-week-{tag}")
        pg.locator("summary").first.click(); shot(pg, f"31-guest-day-open-{tag}")
        for t in ["Full plan", "Pending", "Changes"]:
            pg.get_by_role("tab", name=re.compile(t)).click(); shot(pg, f"32-guest-{t.split()[0].lower()}-{tag}")
        pg.get_by_role("tab", name="This week").click(); pg.get_by_label("Your name").fill("Mum"); pg.get_by_role("button", name="Proud of you").click(); pg.wait_for_timeout(600)
        b.close()
    check(sql("select count(*) from cheers") == "3", "cheers arrived (one per guest run)")
    check(sql("select count(*) from events where owner_id='" + MUM[0] + "'") == "0", "guest wrote nothing to Azka's events")

print("\n".join(log)); print("\n".join(problems) if problems else "NO PROBLEMS")
print(f"{len(log)} passed, {len(problems)} failed")
