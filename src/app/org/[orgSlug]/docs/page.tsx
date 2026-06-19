export default async function DocsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const appUrl = process.env.REDIRECT_DOMAIN
    ? `https://${process.env.REDIRECT_DOMAIN}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? '')

  return (
    <div className="max-w-2xl space-y-8 text-sm">
      <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Guia rápido</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Como funciona o redirecionamento</h2>
        <ol className="list-decimal list-inside space-y-1 text-zinc-500">
          <li>Visitante acessa a URL do redirecionador <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">/r/{orgSlug}/SEU-SLUG</code></li>
          <li>Se já visitou antes, mantém a mesma variante (cookie pelo período configurado)</li>
          <li>Se novo: variante sorteada conforme o split configurado</li>
          <li>Redirecionado para a URL da variante com <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">?s1=SEU-SLUG:VARIANTE</code></li>
          <li>O tracker.js injeta esse parâmetro nos links da Kiwify</li>
          <li>Na compra aprovada, o webhook registra a conversão automaticamente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">1 · Instalar o tracker na landing page</h2>
        <p className="text-zinc-500">Cole antes do fechamento do <code className="bg-zinc-100 border border-zinc-200 px-1 rounded font-mono text-xs">&lt;/body&gt;</code>:</p>
        <pre className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-zinc-700">
{`<script src="${appUrl}/tracker.js"></script>`}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">1b · Instalar o tracker Hotmart</h2>
        <p className="text-zinc-500">Para experimentos com checkout Hotmart:</p>
        <pre className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-zinc-700">
{`<script src="${appUrl}/tracker-hotmart.js"></script>`}
        </pre>
        <p className="text-zinc-400 text-xs">O script injeta o parâmetro <code className="bg-zinc-100 px-1 rounded font-mono">xcod</code> nos links <code className="bg-zinc-100 px-1 rounded font-mono">pay.hotmart.com</code>. Use apenas um tracker por landing page.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">2 · Configurar webhook na Kiwify</h2>
        <ol className="list-decimal list-inside space-y-2 text-zinc-500">
          <li>Acesse Kiwify → Configurações → Webhooks</li>
          <li>Adicione a URL: <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">{appUrl}/api/webhook/kiwify</code></li>
          <li>Evento: <strong className="text-zinc-700">order.paid</strong></li>
          <li>Copie o token e adicione como <code className="bg-zinc-100 px-1 rounded font-mono text-xs">KIWIFY_WEBHOOK_SECRET</code> no Railway</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">2b · Configurar webhook na Hotmart</h2>
        <ol className="list-decimal list-inside space-y-2 text-zinc-500">
          <li>Acesse Hotmart → Ferramentas → Webhooks</li>
          <li>Adicione a URL: <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">{appUrl}/api/webhook/hotmart</code></li>
          <li>Evento: <strong className="text-zinc-700">PURCHASE_APPROVED</strong></li>
          <li>Copie o token e adicione como <code className="bg-zinc-100 px-1 rounded font-mono text-xs">HOTMART_WEBHOOK_TOKEN</code> no Railway</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">3 · Pré-requisitos para significância estatística</h2>
        <ul className="list-disc list-inside space-y-1 text-zinc-500">
          <li>Mínimo de 100 visitas por variante antes de analisar</li>
          <li>Confiança ≥ 95% para declarar vencedor com segurança</li>
          <li>Máximo de 5 variantes por experimento</li>
          <li>Cookies bloqueados por ~3-5% dos usuários com ad blockers</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Ações disponíveis</h2>
        <dl className="space-y-2 text-zinc-500">
          <div><dt className="font-semibold text-zinc-900 inline">Pausar</dt> — suspende o sorteio de variantes e coleta de dados</div>
          <div><dt className="font-semibold text-zinc-900 inline">Retomar</dt> — reativa após pausa</div>
          <div><dt className="font-semibold text-zinc-900 inline">Encerrar</dt> — declara vencedor e finaliza o experimento</div>
        </dl>
      </section>
    </div>
  )
}
