import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { requireOrgMember } from '@/lib/require-org-member'
import { ExperimentCard } from '@/components/experiment-card'

export default async function OrgExperimentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const experiments = await db.query.abExperiments.findMany({
    where: eq(abExperiments.orgId, org.id),
    orderBy: [desc(abExperiments.createdAt)],
    with: { variants: true, winner: true },
  })

  const active = experiments.filter(e => e.status !== 'finished')
  const finished = experiments.filter(e => e.status === 'finished')

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Experimentos</h1>
        <Link
          href={`/org/${orgSlug}/experiments/new`}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3 h-9 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Novo experimento
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border rounded-lg mb-8">
          <p className="text-sm">Nenhum experimento ativo</p>
          <Link
            href={`/org/${orgSlug}/experiments/new`}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Criar primeiro experimento →
          </Link>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {active.map(exp => (
            <ExperimentCard key={exp.id} orgSlug={orgSlug} exp={exp} />
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Finalizados
          </h2>
          <div className="space-y-2">
            {finished.map(exp => (
              <ExperimentCard key={exp.id} orgSlug={orgSlug} exp={exp} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
