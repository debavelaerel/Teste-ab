'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Nome</Label>
        <Input
          id="name"
          value={name}
          onChange={e => {
            setName(e.target.value)
            if (!experimentId) setSlug(autoSlug(e.target.value))
          }}
          placeholder="Ex: Checkout Principal"
          required
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="slug" className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={e => setSlug(autoSlug(e.target.value))}
          placeholder="checkout-principal"
          required
          className="font-mono"
          disabled={!!experimentId}
        />
        <p className="text-xs text-zinc-400">Usado na URL: <code className="font-mono bg-zinc-100 px-1 rounded">/r/{orgSlug}/{slug || 'slug'}</code></p>
        {experimentId && <p className="text-xs text-zinc-400">O slug não pode ser alterado após a criação.</p>}
      </div>

      {/* Checkout type */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Plataforma</Label>
        <div className="flex gap-2">
          {(['kiwify', 'hotmart'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setCheckoutType(type)}
              disabled={!!experimentId}
              className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                checkoutType === type
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
              } ${!!experimentId ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''}`}
            >
              {type === 'kiwify' ? 'Kiwify' : 'Hotmart'}
            </button>
          ))}
        </div>
        {experimentId && <p className="text-xs text-zinc-400">A plataforma não pode ser alterada após a criação.</p>}
      </div>

      {/* Cookie days */}
      <div className="space-y-1.5">
        <Label htmlFor="cookieDays" className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Período do cookie (dias)</Label>
        <Input
          id="cookieDays"
          type="number"
          min={1}
          max={365}
          value={cookieDays}
          onChange={e => setCookieDays(Number(e.target.value))}
          className="w-32 font-mono"
        />
      </div>

      {/* Variants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Variantes</Label>
          <span className={`text-xs font-mono font-semibold ${totalWeight === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
            {totalWeight}/100
          </span>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl border border-zinc-100 bg-zinc-50">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  value={v.name}
                  onChange={e => updateVariant(i, 'name', e.target.value)}
                  placeholder={`Variante ${i + 1}`}
                />
                <Input
                  value={v.url}
                  onChange={e => updateVariant(i, 'url', e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <Input
                type="number"
                min={1}
                max={99}
                value={v.weight}
                onChange={e => updateVariant(i, 'weight', Number(e.target.value))}
                className="w-16 text-center font-mono"
              />
              <span className="text-xs text-zinc-400">%</span>
              {variants.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="text-zinc-300 hover:text-red-400 transition-colors text-lg leading-none px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {variants.length < 5 && (
          <button
            type="button"
            onClick={addVariant}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            + Adicionar variante
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || totalWeight !== 100}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 h-9 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Salvando...' : experimentId ? 'Salvar alterações' : 'Criar experimento'}
      </button>
    </form>
  )
}
