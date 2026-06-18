'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
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
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-heading">{totalVisits.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground mt-1">Visitas totais</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-heading">{totalConversions.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground mt-1">Conversões totais</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-heading">{fmtPct(globalRate)}</p>
          <p className="text-xs text-muted-foreground mt-1">Taxa global</p>
        </Card>
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
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: v.color }}
                  />
                  <div>
                    <p className="font-medium">
                      {v.label} — {v.name}
                      {i === 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">(controle)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.visits} visitas · {v.conversions} conversões
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-xl font-bold font-heading">{fmtPct(v.rate)}</p>
                  {confidence !== null && (
                    <Badge variant={isSignificant && isBetter ? 'finished' : isSignificant ? 'secondary' : 'secondary'}>
                      {isSignificant && isBetter ? '↑ ' : ''}{Math.round(confidence * 100)}% confiança
                    </Badge>
                  )}
                  {confidence === null && i > 0 && (
                    <span className="text-xs text-muted-foreground">dados insuficientes</span>
                  )}
                </div>
              </div>
              {experimentStatus === 'active' && isSignificant && (
                <div className="mt-3 pt-3 border-t flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => declareWinner(v.id)}
                    disabled={loading === 'finished'}
                  >
                    Declarar {v.label} vencedor e encerrar
                  </Button>
                </div>
              )}
            </Card>
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
