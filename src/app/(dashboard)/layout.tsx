import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { Separator } from '@/components/ui/separator'
import { SignOutButton } from '@/components/sign-out-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col gap-1 p-4 shrink-0">
        <div className="mb-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            A/B Testing
          </span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Experimentos
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Docs
          </Link>
        </nav>
        <Separator className="my-2" />
        <SignOutButton />
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
