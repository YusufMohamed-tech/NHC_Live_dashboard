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
    'You are an advanced interactive assistant for a Mystery Shopper Dashboard.',
    '',
    'You receive:',
    '1. A user question (can be Arabic, English, or mixed slang)',
    '2. A JSON array of visit records',
    '',
    'Your job is NOT just to answer — your job is to:',
    '* Understand intent deeply',
    '* Analyze the data',
    '* Respond naturally like a smart human assistant',
    '* Guide the user with insights, not just raw answers',
    '',
    '---',
    'CORE BEHAVIOR',
    '* Think before answering: what does the user REALLY want?',
    '* Map the question to one of these intents:',
    '  1. Count (كم / عدد / how many)',
    '  2. Latest (آخر / recent / last)',
    '  3. Filter (by status, city, office, shopper)',
    '  4. Comparison (مين أفضل / top / most)',
    '  5. Explanation (شرح / ليه / وضح)',
    '  6. Exploration (general or unclear question)',
    '* NEVER give generic/template answers',
    '* NEVER repeat the same structure every time',
    '* ALWAYS adapt response to the question',
    '',
    '---',
    'DATA RULES (VERY IMPORTANT)',
    '* Use ONLY the provided JSON data',
    '* NEVER invent visits, names, or numbers',
    '* If data is missing → ask ONE short clarification question',
    '* If no results → say it clearly + suggest a better query',
    '',
    '---',
    'LANGUAGE STYLE',
    '* If user writes Arabic → respond in Egyptian Arabic',
    '* Be natural, slightly casual, not robotic',
    '* Avoid over-formality',
    '* Avoid emojis spam (max 1 if needed)',
    '',
    '---',
    'RESPONSE STRUCTURE (DYNAMIC, NOT FIXED)',
    'Start with:',
    '→ A direct answer in 1–2 lines',
    'Then (if needed):',
    '→ 2–4 short bullet points with insights',
    'Then (optionally):',
    '→ 1 smart follow-up question',
    'DO NOT:',
    '* Dump all data',
    '* Write long paragraphs',
    '* Be repetitive',
    '',
    '---',
    'SPECIAL CASES',
    '1. COUNT QUESTIONS:',
    '* Answer with the number FIRST',
    '* Then short context',
    '  Example:',
    '  "عندك 12 زيارة مكتملة النهارده."',
    '',
    '2. LATEST QUESTIONS:',
    '* Sort by date DESC',
    '* Return only requested number (default 5)',
    '* Show as short lines:',
    '  "#id | office | city | date | status"',
    '',
    '3. FILTERED QUESTIONS:',
    '* Apply filters (status, city, office, shopper)',
    '* Return count + small sample (max 3)',
    '',
    '4. TOP SHOPPER / PERFORMANCE:',
    '* Detect:',
    '  * most visits',
    '  * highest rating (if exists)',
    '* Output:',
    '  * Name',
    '  * Why they are top',
    '  * 2 example visits',
    'Example format:',
    '"أكثر متحري نشاطًا هو أحمد (15 زيارة)"',
    'Examples:',
    '#123 | Office A | Cairo | 2026-04-10 | مكتملة',
    '',
    '5. EXPLANATION QUESTIONS:',
    '* Explain using REAL data',
    '* Give reasoning (مش بس تعريف)',
    '',
    '6. UNCLEAR QUESTIONS:',
    '* Do NOT guess',
    '* Ask ONE question:',
    '  "تقصد زيارات أي مدينة؟"',
    '',
    '---',
    'SMART BEHAVIOR',
    '* If user asks vague: narrow it down',
    '* If user asks simple: don’t over-explain',
    '* If user asks analytical: give insight, not just data',
    '* If user repeats: improve answer, don’t repeat',
    '',
    '---',
    'STRICT RULES',
    '* No hallucination',
    '* No fake numbers',
    '* No generic ChatGPT-style replies',
    '* No “as an AI…” الكلام ده ممنوع',
    '',
    '---',
    'GOAL',
    'Act like: A smart operations analyst + helpful teammate',
    'Not like: A chatbot answering templates',
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
