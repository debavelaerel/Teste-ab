import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { ExperimentForm } from '@/components/experiment-form'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function ExperimentConfigPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.slug, slug),
    with: { variants: true },
  })

  if (!experiment) notFound()

  const redirectorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{experiment.name}</h1>
        <Badge>{experiment.status}</Badge>
        <Link
          href={`/experiments/${slug}/results`}
          className="ml-auto text-sm text-muted-foreground hover:underline"
        >
          Ver resultados →
        </Link>
      </div>

      {/* Redirector URL */}
      <div className="mb-6 p-3 rounded-md bg-muted text-sm font-mono break-all">
        {redirectorUrl}
      </div>

      {/* Tracker script */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Script para instalar na landing page:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`<script src="${appUrl}/tracker.js" data-exp="${slug}"></script>`}
        </pre>
      </div>

      <ExperimentForm
        experimentId={experiment.id}
        initialName={experiment.name}
        initialSlug={experiment.slug}
        initialCookieDays={experiment.cookieDays}
        initialVariants={experiment.variants.map(v => ({
          id: v.id,
          name: v.name,
          url: v.url,
          weight: v.weight,
        }))}
      />
    </div>
  )
}
