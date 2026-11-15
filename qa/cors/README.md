Cross-origin check for the Ask Dr. Mochi call, in real Chrome with NO request interception
(Playwright answers CORS preflights itself when routing is on, which hides CORS bugs).
1. Build with VITE_SUPABASE_URL=http://localhost:5555, serve dist on :4174, PostgREST on :3000.
2. `python3 test.py` runs it against an "old" function (no x-region in CORS) and a "new" one.
