import { ExperimentForm } from '@/components/experiment-form'

export default async function NewExperimentPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-900 tracking-tight mb-6">Novo experimento</h1>
      <ExperimentForm orgSlug={orgSlug} />
    </div>
  )
}
