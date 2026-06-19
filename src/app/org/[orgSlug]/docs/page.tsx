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
      <h1 className="text-2xl font-semibold">Guia rápido</h1>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Como funciona o redirecionamento</h2>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Visitante acessa a URL do redirecionador <code className="bg-muted px-1 rounded">/r/{orgSlug}/SEU-SLUG</code></li>
          <li>Se já visitou antes, mantém a mesma variante (cookie pelo período configurado)</li>
          <li>Se novo: variante sorteada conforme o split configurado</li>
          <li>Redirecionado para a URL da variante com <code className="bg-muted px-1 rounded">?s1=SEU-SLUG:VARIANTE</code></li>
          <li>O tracker.js injeta esse parâmetro nos links da Kiwify</li>
          <li>Na compra aprovada, o webhook registra a conversão automaticamente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1 · Instalar o tracker na landing page</h2>
        <p className="text-muted-foreground">Cole antes do fechamento do <code className="bg-muted px-1 rounded">&lt;/body&gt;</code>:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`<script src="${appUrl}/tracker.js"></script>`}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1b · Instalar o tracker Hotmart (se usar Hotmart)</h2>
        <p className="text-muted-foreground">Para experimentos com checkout Hotmart, use este script em vez do tracker.js:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`<script src="${appUrl}/tracker-hotmart.js"></script>`}
        </pre>
        <p className="text-muted-foreground text-xs">O script injeta o parâmetro <code className="bg-muted px-1 rounded">xcod</code> nos links <code className="bg-muted px-1 rounded">pay.hotmart.com</code>. Use apenas um tracker por landing page.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">2 · Configurar webhook na Kiwify</h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Acesse o painel da Kiwify → Configurações → Webhooks</li>
          <li>Adicione a URL: <code className="bg-muted px-1 rounded">{appUrl}/api/webhook/kiwify</code></li>
          <li>Evento: <strong>order.paid</strong></li>
          <li>Copie o token gerado e adicione como <code className="bg-muted px-1 rounded">KIWIFY_WEBHOOK_SECRET</code> nas variáveis de ambiente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">2b · Configurar webhook na Hotmart</h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Acesse o painel da Hotmart → Ferramentas → Webhooks</li>
          <li>Adicione a URL: <code className="bg-muted px-1 rounded">{appUrl}/api/webhook/hotmart</code></li>
          <li>Evento: <strong>PURCHASE_APPROVED</strong></li>
          <li>Copie o token gerado e adicione como <code className="bg-muted px-1 rounded">HOTMART_WEBHOOK_TOKEN</code> nas variáveis de ambiente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">3 · Pré-requisitos para significância estatística</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Mínimo de 100 visitas por variante antes de analisar resultados</li>
          <li>Confiança ≥ 95% para declarar vencedor com segurança</li>
          <li>Máximo de 5 variantes por experimento</li>
          <li>Cookies podem ser bloqueados por ~3-5% dos usuários com ad blockers</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Ações disponíveis</h2>
        <dl className="space-y-2 text-muted-foreground">
          <div><dt className="font-medium text-foreground inline">Pausar</dt> — suspende o sorteio de variantes e a coleta de dados</div>
          <div><dt className="font-medium text-foreground inline">Retomar</dt> — reativa após pausa</div>
          <div><dt className="font-medium text-foreground inline">Encerrar</dt> — declara vencedor e finaliza o experimento</div>
        </dl>
      </section>
    </div>
  )
}
