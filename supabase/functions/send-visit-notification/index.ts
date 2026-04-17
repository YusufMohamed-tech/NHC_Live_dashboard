import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type NotificationRole = 'superadmin' | 'admin' | 'ops' | 'shopper'

type NotificationRecipient = {
  email: string
  name?: string
  role: NotificationRole
}

type VisitPayload = {
  id: string
  officeName?: string
  city?: string
  date?: string
  time?: string
  status?: string
  scenario?: string
  membershipId?: string
  assignedShopperId?: string | null
  assignedShopperName?: string | null
}

type ActorPayload = {
  id?: string
  name?: string
  role?: NotificationRole
  email?: string
  personalEmail?: string
}

type RequestPayload = {
  eventType:
    | 'visit_created'
    | 'visit_assigned'
    | 'visit_delete_requested'
    | 'visit_updated'
    | 'visit_completed'
    | 'visit_reassigned'
  visit: VisitPayload
  previousVisit?: VisitPayload | null
  actor?: ActorPayload | null
  recipients: NotificationRecipient[]
  appBaseUrl?: string
}

type MessageContent = {
  subject: string
  title: string
  description: string
  details: string[]
}

const APP_NAME = 'NHC Mystery Shopper'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || ''
const RESEND_REPLY_TO = Deno.env.get('RESEND_REPLY_TO') || ''

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function dedupeRecipientsByEmail(recipients: NotificationRecipient[]) {
  const seen = new Set<string>()

  return recipients.filter((recipient) => {
    const email = normalizeEmail(recipient.email)
    if (!email || seen.has(email)) return false
    seen.add(email)
    return true
  })
}

function roleLabel(role?: NotificationRole) {
  if (role === 'superadmin') return 'سوبر أدمن'
  if (role === 'admin') return 'مدير'
  if (role === 'ops') return 'فريق العمليات'
  if (role === 'shopper') return 'متسوق'
  return 'مستخدم'
}

function buildVisitUrl(baseUrl: string, role: NotificationRole, visitId: string) {
  const safeBase = String(baseUrl || '').trim().replace(/\/$/, '')
  if (!safeBase) return ''

  if (role === 'shopper') {
    return `${safeBase}/shopper/visits/${visitId}`
  }

  if (role === 'superadmin') {
    return `${safeBase}/superadmin/visits`
  }

  if (role === 'admin') {
    return `${safeBase}/admin/visits`
  }

  return `${safeBase}/ops/visits`
}

function collectVisitDetails(visit: VisitPayload, options?: { includeAssignedShopper?: boolean }) {
  const details: string[] = []

  if (visit.officeName) details.push(`المكتب: ${visit.officeName}`)
  if (visit.city) details.push(`المدينة: ${visit.city}`)
  if (visit.date) details.push(`التاريخ: ${visit.date}`)
  if (visit.time) details.push(`الوقت: ${visit.time}`)
  if (visit.status) details.push(`الحالة: ${visit.status}`)
  if (visit.scenario) details.push(`السيناريو: ${visit.scenario}`)

  if (options?.includeAssignedShopper && visit.assignedShopperName) {
    details.push(`المتسوق المكلف: ${visit.assignedShopperName}`)
  }

  return details
}

function buildMessageContent(payload: RequestPayload, recipient: NotificationRecipient): MessageContent {
  const visit = payload.visit
  const actorName = payload.actor?.name || ''
  const actorRole = roleLabel(payload.actor?.role)
  const includeCreatorAndAssignee =
    payload.eventType !== 'visit_created' || recipient.role === 'superadmin'

  const details = collectVisitDetails(visit, {
    includeAssignedShopper: includeCreatorAndAssignee,
  })

  if (includeCreatorAndAssignee && actorName) {
    details.push(`تم الإجراء بواسطة: ${actorName} (${actorRole})`)
  }

  if (payload.eventType === 'visit_reassigned') {
    if (payload.previousVisit?.assignedShopperName) {
      details.push(`المتسوق السابق: ${payload.previousVisit.assignedShopperName}`)
    }

    if (payload.visit.assignedShopperName) {
      details.push(`المتسوق الجديد: ${payload.visit.assignedShopperName}`)
    }
  }

  if (payload.eventType === 'visit_created') {
    return {
      subject: `تم إنشاء زيارة جديدة | ${APP_NAME}`,
      title: 'تم إنشاء زيارة جديدة',
      description:
        recipient.role === 'superadmin'
          ? 'تم إنشاء زيارة جديدة في النظام مع جميع التفاصيل.'
          : 'تم إنشاء زيارة جديدة في النظام.',
      details,
    }
  }

  if (payload.eventType === 'visit_assigned') {
    return {
      subject: `تم إسناد زيارة جديدة | ${APP_NAME}`,
      title: 'تم إسناد زيارة جديدة لك',
      description: 'تم تعيين زيارة جديدة لك. يرجى مراجعة التفاصيل من خلال الزر أدناه.',
      details,
    }
  }

  if (payload.eventType === 'visit_delete_requested') {
    return {
      subject: `طلب حذف زيارة | ${APP_NAME}`,
      title: 'طلب حذف زيارة من فريق العمليات',
      description: 'تم إرسال طلب حذف زيارة من حساب عمليات، يرجى المراجعة والتأكيد.',
      details,
    }
  }

  if (payload.eventType === 'visit_updated') {
    return {
      subject: `تم تعديل زيارة | ${APP_NAME}`,
      title: 'تم تعديل زيارة',
      description: 'تم تحديث بيانات زيارة في النظام.',
      details,
    }
  }

  if (payload.eventType === 'visit_completed') {
    return {
      subject: `تم إكمال زيارة | ${APP_NAME}`,
      title: 'تم إكمال زيارة',
      description: 'تم إكمال زيارة وتحديث بياناتها بنجاح.',
      details,
    }
  }

  return {
    subject: `تمت إعادة إسناد زيارة | ${APP_NAME}`,
    title: 'تمت إعادة إسناد زيارة',
    description: 'تم تغيير المتسوق المكلّف بالزيارة.',
    details,
  }
}

function renderEmailTemplate(content: MessageContent, ctaUrl: string) {
  const detailsHtml = content.details
    .map((line) => `<li style="margin-bottom:8px;">${escapeHtml(line)}</li>`)
    .join('')

  const buttonHtml = ctaUrl
    ? `<a href="${escapeHtml(
        ctaUrl,
      )}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">عرض الزيارة</a>`
    : ''

  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <div style="background:#0f766e;color:#ffffff;padding:18px 20px;font-size:18px;font-weight:800;">${escapeHtml(
          APP_NAME,
        )}</div>
        <div style="padding:20px;">
          <h2 style="margin:0 0 10px;font-size:22px;line-height:1.5;">${escapeHtml(content.title)}</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#334155;">${escapeHtml(
            content.description,
          )}</p>
          <ul style="margin:0 0 20px;padding:0 18px;color:#0f172a;font-size:14px;line-height:1.8;">
            ${detailsHtml}
          </ul>
          ${buttonHtml}
        </div>
      </div>
    </div>
  `
}

async function sendEmailWithResend(to: string, subject: string, html: string) {
  const payload: Record<string, unknown> = {
    from: RESEND_FROM_EMAIL,
    to: [to],
    subject,
    html,
  }

  if (RESEND_REPLY_TO) {
    payload.reply_to = RESEND_REPLY_TO
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Resend API request failed')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS,
    })
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

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }

  if (!RESEND_FROM_EMAIL) {
    return new Response(JSON.stringify({ error: 'RESEND_FROM_EMAIL is not configured' }), {
      status: 500,
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

  if (!payload?.eventType || !payload?.visit?.id || !Array.isArray(payload?.recipients)) {
    return new Response(JSON.stringify({ error: 'Missing required payload fields' }), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }

  const recipients = dedupeRecipientsByEmail(payload.recipients).filter((recipient) =>
    normalizeEmail(recipient.email),
  )

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, failures: [] }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }

  const failures: Array<{ email: string; error: string }> = []
  let sent = 0

  for (const recipient of recipients) {
    try {
      const content = buildMessageContent(payload, recipient)
      const visitUrl = buildVisitUrl(payload.appBaseUrl || '', recipient.role, payload.visit.id)
      const html = renderEmailTemplate(content, visitUrl)
      await sendEmailWithResend(normalizeEmail(recipient.email), content.subject, html)
      sent += 1
    } catch (error) {
      failures.push({
        email: normalizeEmail(recipient.email),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const status = failures.length > 0 ? 207 : 200

  return new Response(
    JSON.stringify({
      sent,
      failed: failures.length,
      failures,
    }),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    },
  )
})
