import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

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

  // Use a clear system message so the model (Gemma) knows behavior and when to ask a follow-up.
  // Gemma: be interactive, ask one short clarifying question when needed, produce main-points and short examples,
  // and prefer returning visit identifiers in the form #<visitId> so the UI can link to them.
  const systemMessage = [
    'تعليمات المساعد (System):',
    '- اسمك Gemma؛ أنت مساعد تفاعلي للداشبورد.',
    '- لديك وصول قراءة كامل فقط إلى بيانات الزيارات المرسلة في JSON؛ استخدمها فقط ولا تختلق بيانات.',
    '- ابدأ بإجابة قصيرة وبسيطة (جملة أو جملتين)، ثم أعطِ 2-4 "main points" واضحة عند الحاجة، كل نقطة قصيرة.',
    '- عند طلب ملخص المتحريين، اذكر: الاسم، سبب التفوق (عدد زيارات أو متوسط تقييم)، ونموذجين قصيرين من زياراته بصيغة: "#visitId | Office | City | date | status"',
    '- اقترح خطوة متابعة أو سؤال واحد مباشر بنهاية الإجابة (مثال: "تحب أشوف تفاصيل زياراته؟").',
    '- اطلب سؤال متابعة واحد فقط إذا كانت البيانات ناقصة أو لتضييق نطاق الاستعلام.',
    '- لا تعرض جميع التقارير كاملة تلقائيًا — قدم أمثلة مختارة (حتى 3 زيارات) وروابط معرفية باستخدام #<id>.',
    '- كن ودودًا وطبيعيًا، وتجنب أسلوب التوثيق الجاف.',
    `- صلاحية المستخدم الحالية: ${role}.`,
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

serve(async (req) => {
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
