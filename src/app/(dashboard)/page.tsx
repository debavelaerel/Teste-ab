import Link from 'next/link'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { desc } from 'drizzle-orm'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  finished: 'outline',
}

export default async function ExperimentsPage() {
  const experiments = await db.query.abExperiments.findMany({
    orderBy: [desc(abExperiments.createdAt)],
    with: { variants: true, winner: true },
  })

  const active = experiments.filter(e => e.status !== 'finished')
  const finished = experiments.filter(e => e.status === 'finished')

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Experimentos</h1>
        <Link
          href="/experiments/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          + Novo experimento
        </Link>
      </div>

      {/* Active / Paused */}
      {active.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground mb-8">
          <p className="text-sm">Nenhum experimento ativo</p>
        </Card>
      ) : (
        <div className="space-y-2 mb-8">
          {active.map(exp => (
            <Card key={exp.id} className="p-4">
              <Link href={`/experiments/${exp.slug}`} className="flex items-center justify-between hover:opacity-80">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{exp.name}</span>
                  <Badge variant={STATUS_VARIANT[exp.status]}>
                    {STATUS_LABEL[exp.status]}
                  </Badge>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/r/{exp.slug}</code>
                </div>
                <span className="text-muted-foreground text-xs">
                  {exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''}
                </span>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Finished */}
      {finished.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Finalizados
          </h2>
          <div className="space-y-2">
            {finished.map(exp => (
              <Card key={exp.id} className="p-4">
                <Link href={`/experiments/${exp.slug}/results`} className="flex items-center justify-between hover:opacity-80">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{exp.name}</span>
                    {exp.winner && (
                      <Badge variant="secondary">Vencedor: {exp.winner.label}</Badge>
                    )}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/r/{exp.slug}</code>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''} · {exp.finishedAt?.toLocaleDateString('pt-BR')}
                  </span>
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
