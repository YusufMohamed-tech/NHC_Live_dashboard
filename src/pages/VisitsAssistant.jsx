import { Bot, LoaderCircle, MessageSquareText, SendHorizonal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { supabase } from '../lib/supabase'
import { runVisitAssistant, summarizeVisitsForModel } from '../utils/visitAssistant'

const USE_LLM_FALLBACK = String(import.meta.env.VITE_VISITS_ASSISTANT_USE_LLM ?? 'false') === 'true'

function getVisitPath(role, visitId) {
  const safeVisitId = String(visitId ?? '').trim()

  if (role === 'shopper') {
    return safeVisitId ? `/shopper/visits/${encodeURIComponent(safeVisitId)}` : '/shopper/visits'
  }

  if (role === 'superadmin') {
    return safeVisitId
      ? `/superadmin/visits?visitId=${encodeURIComponent(safeVisitId)}`
      : '/superadmin/visits'
  }

  if (role === 'ops') {
    return safeVisitId ? `/ops/visits?visitId=${encodeURIComponent(safeVisitId)}` : '/ops/visits'
  }

  return safeVisitId ? `/admin/visits?visitId=${encodeURIComponent(safeVisitId)}` : '/admin/visits'
}

function formatVisitCard(visit, shoppersById) {
  const shopperName = shoppersById.get(visit.assignedShopperId)?.name

  return [
    visit.membershipId || visit.id,
    visit.officeName,
    visit.city,
    visit.date,
    visit.time,
    visit.status,
    shopperName ? `المتسوق: ${shopperName}` : null,
  ]
    .filter(Boolean)
    .join(' | ')
}

function buildInitialMessage() {
  return {
    id: 'assistant-initial',
    role: 'assistant',
    text: 'أنا مساعد الزيارات. اسألني عن حالة الزيارات، العدد، المدينة، المتسوق، أو رقم العضوية.',
    matches: [],
    suggestions: [
      'كم عدد الزيارات المعلقة اليوم؟',
      'اعرض آخر 5 زيارات',
      'زيارات مدينة الرياض',
      'ابحث برقم العضوية NHC-12345',
    ],
  }
}

export default function VisitsAssistant() {
  const { user, visits, shoppers, dataLoading, dataError } = useOutletContext()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([buildInitialMessage()])
  const [isThinking, setIsThinking] = useState(false)

  const shoppersById = useMemo(() => {
    return new Map((shoppers ?? []).map((shopper) => [shopper.id, shopper]))
  }, [shoppers])

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (!Array.isArray(visits) || visits.length === 0) {
    return <EmptyState message="لا توجد زيارات حالياً لبدء المحادثة" />
  }

  const askWithLlmFallback = async (inputQuestion, localResult) => {
    if (!USE_LLM_FALLBACK || !localResult?.needsLlm) {
      return localResult
    }

    try {
      const compactVisits = summarizeVisitsForModel(visits, shoppersById, 80)
      const { data, error } = await supabase.functions.invoke('dashboard-visit-assistant', {
        body: {
          question: inputQuestion,
          role: user?.role || 'admin',
          visits: compactVisits,
        },
      })

      if (error || !data?.answer) {
        return localResult
      }

      return {
        ...localResult,
        answer: data.answer,
      }
    } catch {
      return localResult
    }
  }

  const handleAsk = async (overrideQuestion = '') => {
    const userQuestion = String(overrideQuestion || question).trim()
    if (!userQuestion || isThinking) return

    setQuestion('')
    setMessages((previous) => [
      ...previous,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: userQuestion,
        matches: [],
        suggestions: [],
      },
    ])

    setIsThinking(true)

    const localResult = runVisitAssistant({
      question: userQuestion,
      visits,
      shoppers,
    })

    const finalResult = await askWithLlmFallback(userQuestion, localResult)

    setMessages((previous) => [
      ...previous,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: finalResult.answer,
        matches: finalResult.matchedVisits,
        suggestions: finalResult.suggestions,
      },
    ])

    setIsThinking(false)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex rounded-xl bg-indigo-100 p-2 text-indigo-700">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-black text-slate-900">مساعد الزيارات</h2>
            <p className="text-sm text-slate-500">
              مساعد فوري خاص بالداشبورد للإجابة عن بيانات الزيارات.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-xl border p-3 ${
                message.role === 'user'
                  ? 'ms-auto max-w-3xl border-indigo-200 bg-indigo-50'
                  : 'me-auto max-w-4xl border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <MessageSquareText className="h-3.5 w-3.5" />
                {message.role === 'user' ? 'أنت' : 'المساعد'}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{message.text}</p>

              {Array.isArray(message.matches) && message.matches.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {message.matches.slice(0, 10).map((visit) => (
                    <div
                      key={`${message.id}-${visit.id}`}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700"
                    >
                      <p>{formatVisitCard(visit, shoppersById)}</p>
                      <Link
                        to={getVisitPath(user?.role, visit.id)}
                        className="mt-1 inline-flex rounded-md border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        عرض الزيارة
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(message.suggestions) && message.suggestions.length > 0 && message.role === 'assistant' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.suggestions.slice(0, 4).map((suggestion) => (
                    <button
                      key={`${message.id}-${suggestion}`}
                      type="button"
                      onClick={() => handleAsk(suggestion)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}

          {isThinking && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              جاري تحليل السؤال...
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleAsk()
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="اسأل عن الزيارات... مثال: كم زيارة مكتملة اليوم؟"
            className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={isThinking}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendHorizonal className="h-4 w-4" />
            إرسال
          </button>
        </form>
      </section>
    </div>
  )
}
