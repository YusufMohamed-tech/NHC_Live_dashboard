import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// The runtime for Supabase Edge Functions is Deno. Some local TypeScript
// analyzers used by editors may not have the Deno types available which
// causes spurious "Cannot find name 'Deno'" errors. Declare a loose
// ambient so local checks pass while preserving correct runtime behavior.
declare const Deno: any

type VisitSummary = {
  id: string
  officeName?: string
  city?: string
  date?: string
  time?: string
  status?: string
  scenario?: string
  assignedShopperId?: string | null
  assignedShopperName?: string | null
}

type RequestPayload = {
  question: string
  role?: 'superadmin' | 'admin' | 'ops' | 'shopper'
  visits: VisitSummary[]
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || ''
// Default model: prefer the larger Gemma model for best Arabic understanding and conversational behavior.
// Do NOT hardcode your API key here — set OPENROUTER_API_KEY in your deployment environment/secrets.
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') || 'google/gemma-4-31b-it'
const OPENROUTER_SITE_URL = Deno.env.get('OPENROUTER_SITE_URL') || ''
const OPENROUTER_APP_NAME = Deno.env.get('OPENROUTER_APP_NAME') || 'NHC Mystery Shopper Dashboard'

function sanitizeText(value: unknown, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function compactVisits(visits: VisitSummary[]) {
  return visits.slice(0, 120).map((visit) => ({
    id: sanitizeText(visit.id, 64),
    officeName: sanitizeText(visit.officeName, 120),
    city: sanitizeText(visit.city, 120),
    date: sanitizeText(visit.date, 24),
    time: sanitizeText(visit.time, 24),
    status: sanitizeText(visit.status, 64),
    scenario: sanitizeText(visit.scenario, 280),
    assignedShopperName: sanitizeText(visit.assignedShopperName, 120),
  }))
}

function buildMessages(payload: RequestPayload) {
  const role = sanitizeText(payload.role || 'admin', 32)
  const question = sanitizeText(payload.question, 600)
  const visits = compactVisits(payload.visits ?? [])

  // System instructions: embed the user's assistant spec precisely so the model follows
  // intent mapping, language rules, data rules, and output structure required by the dashboard.
  const systemMessage = [
    'Assistant instructions (System): You are an advanced, interactive assistant for the NHC Mystery Shopper Dashboard.',
    '- Purpose: analyze only the provided visits JSON and answer like a smart human analyst; do NOT invent data.',
    '- THINK before answering: map the question to one intent from this list:',
    '  1) Count — keywords: كم، عدد، how many, count',
    '  2) Latest — keywords: آخر، recent، last',
    '  3) Filter — (by status, city, office, shopper)',
    '  4) Comparison — مين أفضل، top، most',
    '  5) Explanation — ليه، شرح، why',
    '  6) Exploration — general or unclear questions',
    '- DATA RULES: Use ONLY the provided JSON; NEVER invent visits/names/numbers. If data is missing, ask ONE short clarification question. If there are no results, state that clearly and suggest a better query.',
    "- LANGUAGE: If the user's input contains Arabic text, reply in Egyptian Arabic (عامية مصرية). Otherwise reply in the user's language. Keep tone natural, slightly casual, not robotic.",
    '- RESPONSE STRUCTURE (adapt, do not rigidly repeat):',
    '  1) Start with a direct answer (1–2 short lines).',
    '  2) Then 2–4 short bullet points with insights (each 1 short sentence).',
    '  3) Optionally end with ONE short follow-up question or suggested next step.',
    '- SPECIAL CASE FORMATS:',
    '  * COUNT: answer with the number FIRST in Arabic, then short context (e.g., "عندك 12 زيارة مكتملة النهارده.").',
    '  * LATEST: sort by date DESC and return up to requested number (default 5) as short lines: "#id | Office | City | date | status".',
    '  * FILTERED: apply filters, return count + up to 3 sample visits (as #id lines).',
    '  * TOP SHOPPER / PERFORMANCE: detect by most visits or highest rating (if rating exists); output: "أكثر متحري نشاطًا هو <Name> (<N> زيارة)" then 2 example visits as "#id | Office | City | date | status".',
    '  * EXPLANATION: base reasoning only on real data (show short supporting facts).',
    '  * UNCLEAR / BROAD: do NOT guess — ask ONE short clarifying question (e.g., "تقصد زيارات أي مدينة؟").',
    "- SMART BEHAVIOR: narrow vague queries, don't over-explain simple ones, provide insight for analytical queries, and improve answers on repetition.",
    "- STRICT RULES: no hallucination; do NOT say 'as an AI' or similar meta-disclaimers; avoid long paragraphs; avoid repeating the exact same response structure every time.",
    "- OUTPUT HELPERS: prefer visit IDs formatted as #<visitId> so the UI can link to them; when giving examples, include up to 3 visits only.",
    `- Current user role: ${role}.`,
  ].join('\n')

  const userMessage = [
    `السؤال: ${question}`,
    '',
    'بيانات الزيارات (JSON):',
    JSON.stringify(visits),
  ].join('\n')

  return [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ]
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY is not configured' }), {
      status: 503,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }

  let payload: RequestPayload
  try {
    payload = (await req.json()) as RequestPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }

  const question = sanitizeText(payload?.question, 600)
  const visits = Array.isArray(payload?.visits) ? payload.visits : []

  if (!question || visits.length === 0) {
    return new Response(
      JSON.stringify({
        error: 'Missing question or visits payload',
      }),
      {
        status: 400,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const openRouterHeaders: Record<string, string> = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Title': OPENROUTER_APP_NAME,
  }

  if (OPENROUTER_SITE_URL) {
    openRouterHeaders['HTTP-Referer'] = OPENROUTER_SITE_URL
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: openRouterHeaders,
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      // Use a slightly higher temperature so Gemma can be more conversational
      temperature: 0.6,
      // Allow longer replies to include main points, examples and a follow-up question
      max_tokens: 700,
      messages: buildMessages(payload),
    }),
  })

  const rawBody = await response.text()

  if (!response.ok) {
    return new Response(
      JSON.stringify({
        error: 'OpenRouter request failed',
        details: rawBody,
      }),
      {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  let parsed: unknown = null
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null
  } catch {
    parsed = null
  }

  const answer =
    (parsed as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
      ?.content || ''

  return new Response(
    JSON.stringify({
      answer: sanitizeText(answer, 4000),
      model: OPENROUTER_MODEL,
    }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    },
  )
})
