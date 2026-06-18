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
        <h1 className="text-2xl font-bold font-heading">Experimentos</h1>
        <Link
          href={`/org/${orgSlug}/experiments/new`}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3 h-9 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Novo experimento
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl mb-8 bg-muted/30">
          <div className="w-12 h-12 rounded-xl bg-primary-subtle flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-heading font-semibold text-foreground">Nenhum experimento ativo</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-xs">
            Crie seu primeiro teste A/B e comece a comparar variantes com dados reais.
          </p>
          <Link
            href={`/org/${orgSlug}/experiments/new`}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 h-9 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Criar primeiro experimento
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
