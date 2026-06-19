import { requireOrgMember } from '@/lib/require-org-member'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const kiwifySet = !!process.env.KIWIFY_WEBHOOK_SECRET
  const hotmartSet = !!process.env.HOTMART_WEBHOOK_TOKEN

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-900 tracking-tight mb-8">Configurações</h1>

      <section className="mb-8">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Organização
        </h2>
        <div className="border border-zinc-100 rounded-xl divide-y divide-zinc-100 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Nome</span>
            <span className="text-sm font-semibold text-zinc-900">{org.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Slug</span>
            <code className="text-xs bg-zinc-50 border border-zinc-100 px-2 py-1 rounded font-mono text-zinc-600">{org.slug}</code>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Webhooks
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          Tokens configurados como variáveis de ambiente no Railway.
        </p>
        <div className="border border-zinc-100 rounded-xl divide-y divide-zinc-100 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Kiwify webhook secret</span>
            <span className={`text-xs font-semibold ${kiwifySet ? 'text-emerald-600' : 'text-zinc-400'}`}>
              {kiwifySet ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Hotmart webhook token</span>
            <span className={`text-xs font-semibold ${hotmartSet ? 'text-emerald-600' : 'text-zinc-400'}`}>
              {hotmartSet ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
