// Harness: run the edge function with fake Supabase + fake Gemini to check its decisions.
import { build } from 'esbuild'
const out = await build({ entryPoints: ['/home/claude/step1-companion/supabase/functions/ask-mochi/index.ts'], bundle: true, write: false, format: 'esm',
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /^npm:/ }, () => ({ path: 'stub', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
    export function createClient() { const q = { select(){return q}, eq(){return q}, maybeSingle: async () => ({ data: globalThis.__row() }), upsert: async () => ({}) };
      return { auth: { getUser: async (t) => ({ data: t === 'good' ? { user: { id: 'u1' } } : {} }) }, from: (t) => { globalThis.__table = t; return q } } }` })) } }] })
let handler
globalThis.Deno = { env: { get: k => ({ GEMINI_API_KEY: 'k', SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] }, serve: h => { handler = h } }
globalThis.__row = () => globalThis.__table === 'profiles' ? { role: 'learner', cat_name: 'Biscuit', ai_enabled: true } : null
const calls = []
async function scenario(name, gemini, token = 'good') {
  calls.length = 0
  globalThis.fetch = async (url, init) => { const b = JSON.parse(init.body); const m = url.match(/models\/([^:]+)/)[1]; calls.push(m + (b.tools ? '+s' : '')); const [status, data] = gemini(m, !!b.tools, b); return new Response(JSON.stringify(data), { status }) }
  const r = await handler(new Request('http://f', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify({ messages: [{ role: 'user', text: 'type 2 vs 3?' }], localDate: '2026-11-16' }) }))
  console.log(name, r.status, JSON.stringify(await r.json()).slice(0, 160), '| calls:', calls.join(' '))
}
await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const ok = (sys) => [200, { candidates: [{ content: { parts: [{ text: 'Type II is antibody against cells; type III is immune complexes.' }] } }] }]
await scenario('happy path', () => ok())
await scenario('search not on free tier', (m, s) => s ? [400, { error: { message: 'Search Grounding is not supported' } }] : ok())
await scenario('first model retired', (m, s) => m === 'gemini-flash-latest' ? [404, { error: { message: 'model not found' } }] : ok())
await scenario('bad key stops early', () => [400, { error: { message: 'API key not valid. Please pass a valid API key.' } }])
await scenario('location unsupported', () => [400, { error: { message: 'User location is not supported for the API use.' } }])
await scenario('not signed in', () => ok(), 'bad')
