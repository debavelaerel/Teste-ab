export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: 'radial-gradient(ellipse at 35% 30%, #1c1c1e 0%, #111 40%, #09090b 100%)',
      }}
    >
      {children}
    </div>
  )
}
