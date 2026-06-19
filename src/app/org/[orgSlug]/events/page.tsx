'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Activity, ShoppingCart, RefreshCw } from 'lucide-react'

type Visit = {
  id: string
  createdAt: string
  visitorId: string
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

type Tab = 'all' | 'visits' | 'conversions'

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
  const [visits, setVisits] = useState<Visit[]>([])
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [tab, setTab] = useState<Tab>('all')

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/org/${orgSlug}/events`)
      if (!res.ok) return
      const data = await res.json()
      setVisits(data.visits)
      setConversions(data.conversions)
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
    | { kind: 'visit'; data: Visit }
    | { kind: 'conversion'; data: Conversion }

  const allEvents: Event[] = [
    ...visits.map(v => ({ kind: 'visit' as const, data: v })),
    ...conversions.map(c => ({ kind: 'conversion' as const, data: c })),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime())

  const filtered =
    tab === 'visits'
      ? allEvents.filter(e => e.kind === 'visit')
      : tab === 'conversions'
        ? allEvents.filter(e => e.kind === 'conversion')
        : allEvents

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Auditoria de Eventos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Últimas 100 visitas e conversões · atualiza a cada 15s
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {lastRefresh.toLocaleTimeString('pt-BR')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/40 p-1 rounded-lg w-fit">
        {(['all', 'visits', 'conversions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'all' ? 'Todos' : t === 'visits' ? `Visitas (${visits.length})` : `Conversões (${conversions.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl bg-muted/30">
          <Activity className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum evento ainda</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(event => {
            if (event.kind === 'visit') {
              const v = event.data
              return (
                <div key={`v-${v.id}`} className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-primary-subtle flex items-center justify-center shrink-0">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{v.experiment}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {v.variant}
                      </span>
                      <span className="text-xs text-muted-foreground">visita</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                      {v.visitorId.slice(0, 8)}…
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(v.createdAt)}</span>
                </div>
              )
            }

            const c = event.data
            return (
              <div key={`c-${c.id}`} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.experiment}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-mono">
                      {c.variant}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">conversão</span>
                    {c.amount && (
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                        R$ {Number(c.amount).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                    {c.source} · {c.orderId}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(c.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
