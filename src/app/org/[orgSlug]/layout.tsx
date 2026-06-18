import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { SignOutButton } from '@/components/sign-out-button'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  try {
    await requireOrgMember(orgSlug)
  } catch (e) {
    if (e instanceof AuthError) redirect('/login')
    throw e
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-card flex flex-col gap-1 p-4 shrink-0">
        <div className="mb-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            A/B Testing
          </span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <Link
            href={`/org/${orgSlug}`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Experimentos
          </Link>
          <Link
            href={`/org/${orgSlug}/docs`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Docs
          </Link>
        </nav>
        <Separator className="my-2" />
        <SignOutButton />
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
