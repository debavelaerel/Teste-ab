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
      <h1 className="text-2xl font-semibold mb-8">Configurações</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Organização
        </h2>
        <div className="border rounded-lg divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Nome</span>
            <span className="text-sm font-medium">{org.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Slug</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">{org.slug}</code>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Webhooks
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Tokens configurados como variáveis de ambiente no Railway. Edição via Railway dashboard.
        </p>
        <div className="border rounded-lg divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Kiwify webhook secret</span>
            <span className={`text-xs font-medium ${kiwifySet ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {kiwifySet ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Hotmart webhook token</span>
            <span className={`text-xs font-medium ${hotmartSet ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {hotmartSet ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
