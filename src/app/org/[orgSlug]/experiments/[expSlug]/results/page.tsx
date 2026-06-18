import { redirect } from 'next/navigation'

export default async function ResultsRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string; expSlug: string }>
}) {
  const { orgSlug, expSlug } = await params
  redirect(`/org/${orgSlug}/experiments/${expSlug}?tab=resultados`)
}
