import { ExperimentForm } from '@/components/experiment-form'

export default async function NewExperimentPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Novo experimento</h1>
      <ExperimentForm orgSlug={orgSlug} />
    </div>
  )
}
