'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Activity, ShoppingCart, RefreshCw, Eye } from 'lucide-react'

type Session = {
  id: string
  createdAt: string
  visitorId: string
  isNewVisitor: string
  experiment: string
  experimentSlug: string
  variant: string
}

type Conversion = {
  id: string
  createdAt: string
  visitorId: string | null
  experiment: string
  experimentSlug: string
  variant: string
  orderId: string
  source: string
  amount: string | null
}

type Tab = 'all' | 'sessions' | 'conversions'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function EventsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [tab, setTab] = useState<Tab>('all')

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/org/${orgSlug}/events`)
      if (!res.ok) return
      const data = await res.json()
      setSessions(data.sessions ?? [])
      setConversions(data.conversions ?? [])
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [orgSlug])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 15000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  type Event =
    | { kind: 'session'; data: Session }
    | { kind: 'conversion'; data: Conversion }

  const allEvents: Event[] = [
    ...sessions.map(s => ({ kind: 'session' as const, data: s })),
    ...conversions.map(c => ({ kind: 'conversion' as const, data: c })),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime())

  const filtered =
    tab === 'sessions'
      ? allEvents.filter(e => e.kind === 'session')
      : tab === 'conversions'
        ? allEvents.filter(e => e.kind === 'conversion')
        : allEvents

  const newVisitors = sessions.filter(s => s.isNewVisitor === '1').length
  const returning = sessions.filter(s => s.isNewVisitor === '0').length

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Observabilidade</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Últimos 100 acessos e conversões · atualiza a cada 15s
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {lastRefresh.toLocaleTimeString('pt-BR')}
        </button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border border-zinc-100 bg-white p-3">
            <p className="text-xs text-zinc-400">Total de acessos</p>
            <p className="text-2xl font-bold text-zinc-900 font-mono mt-0.5">{sessions.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-white p-3">
            <p className="text-xs text-zinc-400">Visitantes novos</p>
            <p className="text-2xl font-bold text-zinc-900 font-mono mt-0.5">{newVisitors}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-white p-3">
            <p className="text-xs text-zinc-400">Retornos</p>
            <p className="text-2xl font-bold text-zinc-400 font-mono mt-0.5">{returning}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-50 border border-zinc-100 p-1 rounded-lg w-fit">
        {(['all', 'sessions', 'conversions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t
                ? 'bg-white text-zinc-900 shadow-sm font-medium border border-zinc-100'
                : 'text-zinc-400 hover:text-zinc-700'
            }`}
          >
            {t === 'all' ? 'Todos' : t === 'sessions' ? `Acessos (${sessions.length})` : `Conversões (${conversions.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-zinc-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
          <Activity className="w-8 h-8 text-zinc-300 mb-3" />
          <p className="text-sm text-zinc-400">Nenhum evento ainda</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(event => {
            if (event.kind === 'session') {
              const s = event.data
              const isNew = s.isNewVisitor === '1'
              return (
                <div key={`s-${s.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-100 bg-white hover:bg-zinc-50 transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isNew ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                    {isNew
                      ? <Activity className="w-3.5 h-3.5 text-white" />
                      : <Eye className="w-3.5 h-3.5 text-zinc-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">{s.experiment}</span>
                      <code className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-mono">{s.variant}</code>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isNew ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-50 text-zinc-400'}`}>
                        {isNew ? 'novo' : 'retorno'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate font-mono">{s.visitorId.slice(0, 8)}…</p>
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">{timeAgo(s.createdAt)}</span>
                </div>
              )
            }

            const c = event.data
            return (
              <div key={`c-${c.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900">{c.experiment}</span>
                    <code className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono">{c.variant}</code>
                    <span className="text-xs text-emerald-600 font-medium">conversão</span>
                    {c.amount && Number(c.amount) > 0 && (
                      <span className="text-xs text-emerald-700 font-medium font-mono">R$ {Number(c.amount).toFixed(2)}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate font-mono">{c.source} · {c.orderId}</p>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">{timeAgo(c.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
