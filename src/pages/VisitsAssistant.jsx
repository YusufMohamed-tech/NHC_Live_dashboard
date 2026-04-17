import { Bot, LoaderCircle, MessageSquareText, SendHorizonal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { supabase } from '../lib/supabase'
import { runVisitAssistant, summarizeVisitsForModel } from '../utils/visitAssistant'

const USE_LLM_FALLBACK = String(import.meta.env.VITE_VISITS_ASSISTANT_USE_LLM ?? 'false') === 'true'
const TYPEWRITER_DELAY_MS = 10
const TYPEWRITER_CHUNK_SIZE = 4

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
    visit.officeName,
    visit.city,
    visit.date,
    visit.time,
    visit.status,
    shopperName ? `المتحري الخفي: ${shopperName}` : null,
  ]
    .filter(Boolean)
    .join(' | ')
}

function buildInitialMessage() {
  return {
    id: 'assistant-initial',
    role: 'assistant',
    text: 'أنا مساعدك في الزيارات. اسأل براحتك عن العدد، الحالة، المدينة أو المتحري الخفي.',
    matches: [],
    suggestions: [
      'كام زيارة معلقة النهارده؟',
      'هات آخر 5 زيارات',
      'ورّيني زيارات مدينة الرياض',
      'عايز زيارات متحري خفي معيّن',
    ],
  }
}

export default function VisitsAssistant() {
  const { user, visits, shoppers, dataLoading, dataError } = useOutletContext()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([buildInitialMessage()])
  const [isThinking, setIsThinking] = useState(false)
  const [typingAssistantId, setTypingAssistantId] = useState(null)
  const typingTimeoutRef = useRef(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

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

    // call LLM with a timeout so UI doesn't hang waiting for a slow network/model
    const compactVisits = summarizeVisitsForModel(visits, shoppersById, 80)
    const invokePromise = supabase.functions.invoke('dashboard-visit-assistant', {
      body: {
        question: inputQuestion,
        role: user?.role || 'admin',
        visits: compactVisits,
      },
    })

    const TIMEOUT_MS = Number(import.meta.env.VITE_VISITS_ASSISTANT_LLM_TIMEOUT_MS ?? 3000)

    try {
      const { data, error } = await Promise.race([
        invokePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), TIMEOUT_MS)),
      ])

      if (error || !data?.answer) {
        return localResult
      }

      return {
        ...localResult,
        answer: data.answer,
      }
    } catch (err) {
      // Timeout or other error — return localResult quickly to avoid long UI loading
      return localResult
    }
  }

  const appendAssistantMessageWithTypewriter = (result) => {
    return new Promise((resolve) => {
      const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const fullText = String(result?.answer ?? '')
      const matchedVisits = Array.isArray(result?.matchedVisits) ? result.matchedVisits : []
      const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : []

      if (!isMountedRef.current) {
        resolve()
        return
      }

      setMessages((previous) => [
        ...previous,
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          matches: [],
          suggestions: [],
        },
      ])
      setTypingAssistantId(assistantId)

      if (!fullText) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  text: fullText,
                  matches: matchedVisits,
                  suggestions,
                }
              : message,
          ),
        )
        setTypingAssistantId(null)
        resolve()
        return
      }

      let currentLength = 0

      const writeStep = () => {
        if (!isMountedRef.current) {
          resolve()
          return
        }

        currentLength = Math.min(fullText.length, currentLength + TYPEWRITER_CHUNK_SIZE)
        const isDone = currentLength >= fullText.length
        const nextText = fullText.slice(0, currentLength)

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  text: nextText,
                  matches: isDone ? matchedVisits : [],
                  suggestions: isDone ? suggestions : [],
                }
              : message,
          ),
        )

        if (isDone) {
          setTypingAssistantId(null)
          typingTimeoutRef.current = null
          resolve()
          return
        }

        typingTimeoutRef.current = window.setTimeout(writeStep, TYPEWRITER_DELAY_MS)
      }

      typingTimeoutRef.current = window.setTimeout(writeStep, TYPEWRITER_DELAY_MS)
    })
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

    await appendAssistantMessageWithTypewriter(finalResult)

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
              مساعدك السريع لبيانات الزيارات. اسأل وأنا أرد عليك فورًا.
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
                {message.role === 'user' ? 'أنت' : 'مساعدك'}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {message.text}
                {typingAssistantId === message.id && (
                  <span className="ms-1 inline-block animate-pulse text-indigo-500">|</span>
                )}
              </p>

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
                      disabled={isThinking}
                      onClick={() => handleAsk(suggestion)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}

          {isThinking && !typingAssistantId && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              ثانية واحدة... بشوفلك الإجابة.
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
            placeholder="اسألني براحتك... مثال: كام زيارة مكتملة النهارده؟"
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
