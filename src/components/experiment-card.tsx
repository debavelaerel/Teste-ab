'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
}

interface Exp {
  id: string
  name: string
  slug: string
  status: string
  checkoutType: string
  createdAt: Date
  variants: { id: string }[]
  winner?: { label: string } | null
}

interface Props {
  orgSlug: string
  exp: Exp
}

export function ExperimentCard({ orgSlug, exp }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [stats, setStats] = useState<{ visits: number; conversions: number; rate: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  async function handleToggle() {
    if (!expanded && stats === null && !loadingStats) {
      setLoadingStats(true)
      try {
        const res = await fetch(`/api/org/${orgSlug}/experiments/${exp.id}/stats`)
        if (res.ok) setStats(await res.json())
        else setFetchError(true)
      } catch {
        setFetchError(true)
      } finally {
        setLoadingStats(false)
      }
    }
    setExpanded(v => !v)
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-100 bg-white cursor-pointer transition-shadow hover:shadow-sm',
        expanded && 'shadow-sm'
      )}
      onClick={handleToggle}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-zinc-900 text-sm">{exp.name}</span>
            <Badge variant={exp.status as 'active' | 'paused' | 'finished'}>
              {STATUS_LABEL[exp.status] ?? exp.status}
            </Badge>
            <Badge variant="outline" className="text-zinc-500">
              {exp.checkoutType === 'hotmart' ? 'Hotmart' : 'Kiwify'}
            </Badge>
            {exp.winner && (
              <Badge variant="finished">Vencedor: {exp.winner.label}</Badge>
            )}
          </div>
          <div className="text-zinc-400 shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
          <code className="font-mono bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded text-zinc-500">
            /r/{orgSlug}/{exp.slug}
          </code>
          <span>·</span>
          <span>{exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>
            {new Date(exp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-100" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
            {loadingStats ? (
              <div className="col-span-3 text-center text-sm text-zinc-400 py-2">Carregando...</div>
            ) : fetchError ? (
              <div className="col-span-3 text-center text-sm text-red-500 py-2">Erro ao carregar dados</div>
            ) : stats ? (
              <>
                <div className="text-center">
                  <p className="text-xl font-bold text-zinc-900 font-mono">{stats.visits.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">visitas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-zinc-900 font-mono">{stats.conversions.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">conversões</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-zinc-900 font-mono">
                    {stats.visits > 0 ? (stats.rate * 100).toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">taxa</p>
                </div>
              </>
            ) : (
              <div className="col-span-3 text-center text-sm text-zinc-400 py-2">Sem dados</div>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}`}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-8 px-3 bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              Ver resultados →
            </Link>
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}?tab=configuracao`}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-8 px-3 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Configurar →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
