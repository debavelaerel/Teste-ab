'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

interface VariantRow {
  id?: string
  name: string
  url: string
  weight: number
}

interface Props {
  orgSlug: string
  experimentId?: string
  initialName?: string
  initialSlug?: string
  initialCookieDays?: number
  initialCheckoutType?: 'kiwify' | 'hotmart'
  initialVariants?: VariantRow[]
}

export function ExperimentForm({
  orgSlug,
  experimentId,
  initialName = '',
  initialSlug = '',
  initialCookieDays = 30,
  initialCheckoutType = 'kiwify',
  initialVariants = [
    { name: 'Controle', url: '', weight: 50 },
    { name: 'Teste B', url: '', weight: 50 },
  ],
}: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [cookieDays, setCookieDays] = useState(initialCookieDays)
  const [checkoutType, setCheckoutType] = useState<'kiwify' | 'hotmart'>(initialCheckoutType)
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0)

  function autoSlug(val: string) {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function updateVariant(i: number, field: keyof VariantRow, value: string | number) {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    if (variants.length >= 5) return
    const remaining = Math.max(0, 100 - totalWeight)
    setVariants(prev => [
      ...prev,
      { name: `Teste ${String.fromCharCode(65 + prev.length)}`, url: '', weight: remaining },
    ])
  }

  function removeVariant(i: number) {
    if (variants.length <= 2) return
    setVariants(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalWeight !== 100) {
      setError('A soma dos pesos deve ser 100')
      return
    }
    setLoading(true)
    setError('')

    const payload = { name, slug, cookieDays, checkoutType, variants }
    const url = experimentId
      ? `/api/org/${orgSlug}/experiments/${experimentId}`
      : `/api/org/${orgSlug}/experiments`

    const res = await fetch(url, {
      method: experimentId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Erro desconhecido')
      return
    }

    const expSlug = experimentId ? slug : data.slug
    router.push(`/org/${orgSlug}/experiments/${expSlug}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Nome do experimento</Label>
          <Input
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (!experimentId) setSlug(autoSlug(e.target.value))
            }}
            placeholder="Meu experimento"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Slug (URL)</Label>
          <Input
            value={slug}
            onChange={e => setSlug(autoSlug(e.target.value))}
            placeholder="meu-experimento"
            required
            disabled={!!experimentId}
          />
          {slug && <p className="text-xs text-muted-foreground">/r/{orgSlug}/{slug}</p>}
        </div>
      </div>

      <div className="space-y-1 max-w-xs">
        <Label>Duração do cookie (dias)</Label>
        <Input
          type="number"
          value={cookieDays}
          onChange={e => setCookieDays(Number(e.target.value))}
          min={1}
          max={365}
        />
      </div>

      <div className="space-y-1 max-w-xs">
        <Label>Checkout</Label>
        <div className="flex gap-4 pt-1">
          {(['kiwify', 'hotmart'] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="checkoutType"
                value={opt}
                checked={checkoutType === opt}
                onChange={() => setCheckoutType(opt)}
                disabled={!!experimentId}
              />
              <span className="text-sm capitalize">{opt}</span>
            </label>
          ))}
        </div>
        {!!experimentId && (
          <p className="text-xs text-muted-foreground">O checkout não pode ser alterado após a criação</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Variantes</Label>
          <span className={`text-xs font-medium ${totalWeight === 100 ? 'text-green-500' : 'text-destructive'}`}>
            Soma: {totalWeight}%
          </span>
        </div>
        <div className="space-y-3">
          {variants.map((v, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold w-6 text-center">{String.fromCharCode(65 + i)}</span>
                <Input
                  value={v.name}
                  onChange={e => updateVariant(i, 'name', e.target.value)}
                  placeholder={i === 0 ? 'Controle' : `Teste ${String.fromCharCode(65 + i)}`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={v.weight}
                  onChange={e => updateVariant(i, 'weight', Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">%</span>
                {variants.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)}>✕</Button>
                )}
              </div>
              <Input
                value={v.url}
                onChange={e => updateVariant(i, 'url', e.target.value)}
                placeholder="https://seusite.com/pagina-a"
                type="url"
                required
              />
            </Card>
          ))}
        </div>
        {variants.length < 5 && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addVariant}>
            + Adicionar variante
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? 'Salvando...' : experimentId ? 'Salvar alterações' : 'Criar experimento'}
      </Button>
    </form>
  )
}
