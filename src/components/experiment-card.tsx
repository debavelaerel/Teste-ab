'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
}

const STATUS_BORDER_COLOR: Record<string, string> = {
  active: '#6366f1',
  paused: '#f59e0b',
  finished: '#10b981',
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

  async function handleToggle() {
    if (!expanded && stats === null) {
      setLoadingStats(true)
      const res = await fetch(`/api/org/${orgSlug}/experiments/${exp.id}/stats`)
      if (res.ok) setStats(await res.json())
      setLoadingStats(false)
    }
    setExpanded(v => !v)
  }

  const borderColor = STATUS_BORDER_COLOR[exp.status] ?? '#e5e7eb'

  return (
    <Card
      style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
      className="cursor-pointer hover:shadow-sm transition-shadow"
      onClick={handleToggle}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-medium">{exp.name}</span>
            <Badge variant={exp.status as 'active' | 'paused' | 'finished'}>
              {STATUS_LABEL[exp.status] ?? exp.status}
            </Badge>
            <Badge variant="outline">
              {exp.checkoutType === 'hotmart' ? 'Hotmart' : 'Kiwify'}
            </Badge>
            {exp.winner && (
              <Badge variant="finished">Vencedor: {exp.winner.label}</Badge>
            )}
          </div>
          <div className="text-muted-foreground shrink-0">
            {expanded
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronRight className="w-4 h-4" />
            }
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <code className="bg-muted px-1.5 py-0.5 rounded">/r/{orgSlug}/{exp.slug}</code>
          <span>·</span>
          <span>{exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>
            {new Date(exp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
            {loadingStats ? (
              <div className="col-span-3 text-center text-sm text-muted-foreground py-2">
                Carregando...
              </div>
            ) : stats ? (
              <>
                <div className="text-center">
                  <p className="text-xl font-bold">{stats.visits.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">visitas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{stats.conversions.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">conversões</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">
                    {stats.visits > 0 ? (stats.rate * 100).toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">taxa</p>
                </div>
              </>
            ) : (
              <div className="col-span-3 text-center text-sm text-muted-foreground py-2">
                Sem dados
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ver resultados →
            </Link>
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}?tab=configuracao`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-input hover:bg-muted transition-colors"
            >
              Configurar →
            </Link>
          </div>
        </div>
      )}
    </Card>
  )
}
