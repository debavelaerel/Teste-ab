'use client'
import { useState } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResultsSummary } from '@/components/results-summary'
import { DailyChart } from '@/components/daily-chart'
import { ExperimentForm } from '@/components/experiment-form'

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

interface Experiment {
  id: string
  name: string
  slug: string
  status: string
  checkoutType: string
  cookieDays: number
  variants: {
    id: string
    name: string
    label: string
    url: string
    weight: number
    color: string
  }[]
}

interface Props {
  orgSlug: string
  experiment: Experiment
  variants: VariantResult[]
  dailyData: Record<string, string | number>[]
  appUrl: string
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
}

const TABS = [
  { key: 'resultados', label: 'Resultados' },
  { key: 'configuracao', label: 'Configuração' },
  { key: 'instalacao', label: 'Instalação' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-xs border border-input hover:bg-muted transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

export function ExperimentTabs({ orgSlug, experiment, variants, dailyData, appUrl }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeTab = searchParams.get('tab') ?? 'resultados'

  const redirectorUrl = `${appUrl}/r/${orgSlug}/${experiment.slug}`
  const scriptUrl = experiment.checkoutType === 'hotmart'
    ? `${appUrl}/tracker-hotmart.js`
    : `${appUrl}/tracker.js`
  const scriptTag = `<script src="${scriptUrl}"></script>`

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold font-heading">{experiment.name}</h1>
        <Badge variant={experiment.status as 'active' | 'paused' | 'finished'}>
          {STATUS_LABEL[experiment.status] ?? experiment.status}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <Link
              key={tab.key}
              href={`${pathname}?tab=${tab.key}`}
              scroll={false}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'resultados' && (
        <div className="space-y-8">
          <ResultsSummary
            orgSlug={orgSlug}
            experimentId={experiment.id}
            experimentStatus={experiment.status}
            variants={variants}
          />
          {dailyData.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Evolução diária — Taxa de conversão
              </h2>
              <DailyChart data={dailyData} variants={variants} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'configuracao' && (
        <ExperimentForm
          orgSlug={orgSlug}
          experimentId={experiment.id}
          initialName={experiment.name}
          initialSlug={experiment.slug}
          initialCookieDays={experiment.cookieDays}
          initialCheckoutType={experiment.checkoutType as 'kiwify' | 'hotmart'}
          initialVariants={experiment.variants.map(v => ({
            id: v.id,
            name: v.name,
            url: v.url,
            weight: v.weight,
          }))}
        />
      )}

      {activeTab === 'instalacao' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <p className="text-sm font-medium mb-2">URL do Redirector</p>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted font-mono text-sm break-all">
              <span className="flex-1">{redirectorUrl}</span>
              <CopyButton text={redirectorUrl} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Script para a landing page</p>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted font-mono text-xs break-all">
              <span className="flex-1">{scriptTag}</span>
              <CopyButton text={scriptTag} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
