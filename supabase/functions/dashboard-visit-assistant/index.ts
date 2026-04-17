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
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') || 'google/gemma-3-4b-it'
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

  const prompt = [
    'تعليمات المساعد:',
    '- دائمًا كن ودودًا، بشريًا، وتجنب الأسلوب الآلي أو الرسمي.',
    '- اشرح ببساطة أولًا، ثم أضف تفاصيل أعمق إذا احتاج المستخدم.',
    '- أضف أمثلة عملية كلما أمكن (مثال: "يعني لو سألتني عن زيارات اليوم، أقولك: عندك 3 زيارات النهارده، زي: زيارة مكتب الرياض...").',
    '- اقترح أفكار أو خطوات تالية مفيدة للمستخدم بشكل استباقي.',
    '- اسأل سؤال متابعة واحد إذا كان منطقيًا (مثال: "تحب أجيبلك تفاصيل زيارة معينة؟").',
    '- لا تعطي إجابات قصيرة جدًا إلا لو السؤال بسيط جدًا.',
    '- تجنب أسلوب التوثيق أو الكتب الدراسية، وكن تفاعليًا.',
    '- تفاعل مع المستخدم كأنك شخص حقيقي، وتوقع احتياجاته القادمة.',
    '- أضف نصائح أو لمحات صغيرة بجانب الإجابة المباشرة.',
    '- لا تخترع بيانات غير موجودة في JSON المرسل.',
    '- إذا لا توجد نتيجة، قل بوضوح: لا توجد زيارات مطابقة.',
    '- عند ذكر نتائج، اذكر العدد ثم أهم الزيارات كسطور قصيرة.',
    `- صلاحية المستخدم الحالية: ${role}.`,
    '',
    `السؤال: ${question}`,
    '',
    'بيانات الزيارات (JSON):',
    JSON.stringify(visits),
  ].join('\n')

  return [{ role: 'user', content: prompt }]
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
      temperature: 0.25,
      max_tokens: 350,
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
