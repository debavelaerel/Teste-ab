export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between bg-foreground text-background p-12">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold font-heading">
            AB
          </div>
          <span className="text-sm font-semibold font-heading">Experimentos A/B</span>
        </div>

        <blockquote className="space-y-3">
          <p className="text-2xl font-heading font-bold leading-snug">
            "Dados reais de visitantes reais, não achismo."
          </p>
          <footer className="text-sm text-background/60">
            Plataforma de testes A/B para produtores digitais
          </footer>
        </blockquote>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-2">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              AB
            </div>
            <span className="text-sm font-semibold">Experimentos A/B</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
