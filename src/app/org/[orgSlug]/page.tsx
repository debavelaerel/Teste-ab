import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { requireOrgMember } from '@/lib/require-org-member'
import { ExperimentCard } from '@/components/experiment-card'
import { FlaskConical } from 'lucide-react'

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
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Experimentos</h1>
        <Link
          href={`/org/${orgSlug}/experiments/new`}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 h-8 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          + Novo experimento
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 rounded-xl mb-8 bg-zinc-50/50">
          <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
            <FlaskConical className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="font-semibold text-zinc-900 text-sm">Nenhum experimento ativo</p>
          <p className="text-sm text-zinc-400 mt-1 mb-5 max-w-xs">
            Crie seu primeiro teste A/B e compare variantes com dados reais.
          </p>
          <Link
            href={`/org/${orgSlug}/experiments/new`}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 h-8 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
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
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Finalizados
          </p>
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
