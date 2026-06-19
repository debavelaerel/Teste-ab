'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { calcConfidence, fmtPct } from '@/lib/stats'

interface VariantResult {
  id: string
  label: string
  name: string
  color: string
  visits: number
  conversions: number
  rate: number
  revenue: string
}

interface Props {
  orgSlug: string
  experimentId: string
  experimentStatus: string
  variants: VariantResult[]
}

export function ResultsSummary({ orgSlug, experimentId, experimentStatus, variants }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const control = variants[0]

  async function updateStatus(status: string, winnerVariantId?: string) {
    setLoading(status)
    await fetch(`/api/org/${orgSlug}/experiments/${experimentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, winnerVariantId }),
    })
    setLoading(null)
    router.refresh()
  }

  async function declareWinner(variantId: string) {
    await updateStatus('finished', variantId)
  }

  const totalVisits = variants.reduce((s, v) => s + v.visits, 0)
  const totalConversions = variants.reduce((s, v) => s + v.conversions, 0)
  const globalRate = totalVisits > 0 ? totalConversions / totalVisits : 0

  return (
    <div className="space-y-6">
      {/* Global summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-100 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-zinc-900 font-mono">{totalVisits.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-zinc-400 mt-1">Visitas totais</p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-zinc-900 font-mono">{totalConversions.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-zinc-400 mt-1">Conversões totais</p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-zinc-900 font-mono">{fmtPct(globalRate)}</p>
          <p className="text-xs text-zinc-400 mt-1">Taxa global</p>
        </div>
      </div>

      {/* Per-variant cards */}
      <div className="grid gap-3">
        {variants.map((v, i) => {
          const confidence = i === 0
            ? null
            : calcConfidence(control.visits, control.conversions, v.visits, v.conversions)
          const isSignificant = confidence !== null && confidence >= 0.95
          const isBetter = v.rate > control.rate

          return (
            <div key={v.id} className="rounded-xl border border-zinc-100 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: v.color }} />
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">
                      {v.label} — {v.name}
                      {i === 0 && <span className="ml-2 text-xs text-zinc-400 font-normal">(controle)</span>}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {v.visits} visitas · {v.conversions} conversões
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-xl font-bold text-zinc-900 font-mono">{fmtPct(v.rate)}</p>
                  {confidence !== null && (
                    <Badge variant={isSignificant && isBetter ? 'active' : 'outline'}>
                      {isSignificant && isBetter ? '↑ ' : ''}{Math.round(confidence * 100)}% confiança
                    </Badge>
                  )}
                  {confidence === null && i > 0 && (
                    <span className="text-xs text-zinc-400">dados insuficientes</span>
                  )}
                </div>
              </div>
              {experimentStatus === 'active' && isSignificant && (
                <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => declareWinner(v.id)}
                    disabled={!!loading}
                  >
                    Declarar {v.label} vencedor e encerrar
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status actions */}
      {experimentStatus !== 'finished' && (
        <div className="flex gap-2">
          {experimentStatus === 'active' && (
            <Button variant="outline" onClick={() => updateStatus('paused')} disabled={!!loading}>
              Pausar
            </Button>
          )}
          {experimentStatus === 'paused' && (
            <Button variant="outline" onClick={() => updateStatus('active')} disabled={!!loading}>
              Retomar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
