import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { ExperimentForm } from '@/components/experiment-form'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { requireOrgMember } from '@/lib/require-org-member'

export default async function ExperimentConfigPage({
  params,
}: {
  params: Promise<{ orgSlug: string; expSlug: string }>
}) {
  const { orgSlug, expSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const experiment = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.slug, expSlug), eq(abExperiments.orgId, org.id)),
    with: { variants: true },
  })

  if (!experiment) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const redirectorUrl = `${appUrl}/r/${orgSlug}/${expSlug}`

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{experiment.name}</h1>
        <Badge>{experiment.status}</Badge>
        <Link
          href={`/org/${orgSlug}/experiments/${expSlug}/results`}
          className="ml-auto text-sm text-muted-foreground hover:underline"
        >
          Ver resultados →
        </Link>
      </div>

      <div className="mb-6 p-3 rounded-md bg-muted text-sm font-mono break-all">
        {redirectorUrl}
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Script para instalar na landing page:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{experiment.checkoutType === 'hotmart'
  ? `<script src="${appUrl}/tracker-hotmart.js"></script>`
  : `<script src="${appUrl}/tracker.js"></script>`}
        </pre>
      </div>

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
    </div>
  )
}
