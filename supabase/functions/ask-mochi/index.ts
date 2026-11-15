// "Ask Dr. Mochi": answers Azka's study questions with Google's Gemini (free AI Studio key).
// Deploy: Supabase > Edge Functions > Deploy a new function > "ask-mochi" > paste this file.
// Secrets (Edge Functions > Secrets): GEMINI_API_KEY (required), GEMINI_MODEL (optional).
// The key lives only here, on the server. The browser never sees it.
import { createClient } from 'npm:@supabase/supabase-js@2'

const DAILY_LIMIT = 30
// Tried in order until one answers. GEMINI_MODEL (optional secret) goes first.
const MODELS = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.0-flash'].filter(Boolean) as string[]
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const persona = (catName: string) => `You are ${catName}, a warm, encouraging cat who is also a doctor and a USMLE Step 1 tutor.
You help Azka, a medical graduate preparing for Step 1.
Rules:
- Explain the concept clearly and briefly: at most about 180 words, plain language, short paragraphs or a few bullet points.
- Be accurate. If unsure, say so. Never invent facts, numbers or sources.
- Mention which First Aid section or topic to check when useful.
- Do not reproduce UWorld, NBME or other copyrighted questions; explain concepts instead.
- No personal medical advice; this is exam study only.
- Finish with one short, kind line of encouragement in a cat voice (a single "purr" at most).`

type Msg = { role: 'user' | 'model'; text: string }

async function callGemini(model: string, key: string, catName: string, history: Msg[], withSearch: boolean) {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: persona(catName) }] },
    contents: history.slice(-8).map(m => ({ role: m.role, parts: [{ text: m.text.slice(0, 2000) }] })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
  }
  if (withSearch) body.tools = [{ google_search: {} }]
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try { return await handle(req) } catch (e) {
    console.error('ask-mochi crashed', e)
    return json({ error: 'crash', detail: String(e) }, 500)
  }
})

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'not-configured' }, 503)

  // Who is asking? Validate their login token with the server key.
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_KEY')
  if (!serviceKey) return json({ error: 'not-configured' }, 503)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: u } = await admin.auth.getUser(token)
  if (!u?.user) return json({ error: 'sign-in' }, 401)
  const { data: profile } = await admin.from('profiles').select('role, cat_name, ai_enabled').eq('user_id', u.user.id).maybeSingle()
  if (!profile || profile.role !== 'learner') return json({ error: 'not-allowed' }, 403)
  if (!profile.ai_enabled) return json({ error: 'off' }, 403)

  const { messages, localDate } = await req.json().catch(() => ({}))
  if (!Array.isArray(messages) || !messages.length) return json({ error: 'empty' }, 400)
  const day = typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : new Date().toISOString().slice(0, 10)

  // Daily limit, counted with the server key (users cannot edit their own counter).
  const { data: usage } = await admin.from('ai_usage').select('count').eq('owner_id', u.user.id).eq('day', day).maybeSingle()
  const used = usage?.count ?? 0
  if (used >= DAILY_LIMIT) return json({ error: 'limit', limit: DAILY_LIMIT }, 429)

  const catName = `Dr. ${String(profile.cat_name || 'Mochi').replace(/^dr\.?\s+/i, '')}`
  // For each model: try with Google Search grounding (often not on the free tier), then without.
  let res: Awaited<ReturnType<typeof callGemini>> | null = null
  let searched = false
  const tried: string[] = []
  outer: for (const model of MODELS) {
    for (const withSearch of [true, false]) {
      res = await callGemini(model, key, catName, messages, withSearch)
      tried.push(`${model}${withSearch ? '+search' : ''}:${res.status}`)
      if (res.ok && res.data?.candidates?.[0]?.content?.parts?.length) { searched = withSearch; break outer }
      const msg = String(res.data?.error?.message ?? '')
      // Problems no other model will fix: bad key, unsupported location, quota.
      if (/API key|location is not supported|quota/i.test(msg) && !withSearch) break outer
    }
  }
  if (!res || !res.ok) {
    console.error('gemini failed', tried.join(' '), JSON.stringify(res?.data?.error ?? {}))
    return json({ error: 'ai', status: res?.status ?? 0, detail: `${res?.data?.error?.message ?? 'no answer'} [${tried.join(' ')}]` }, 502)
  }
  const cand = res.data?.candidates?.[0]
  const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim()
  const chunks = cand?.groundingMetadata?.groundingChunks ?? []
  const sources = chunks.map((c: { web?: { uri: string; title: string } }) => c.web).filter(Boolean).slice(0, 5)

  await admin.from('ai_usage').upsert({ owner_id: u.user.id, day, count: used + 1 })
  return json({ text: text || 'Hmm, I could not find a good answer. Try asking another way?', sources, searched, left: DAILY_LIMIT - used - 1 })
}
