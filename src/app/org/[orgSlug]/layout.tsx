import { redirect } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'
import { SidebarNav } from '@/components/sidebar-nav'
import { SignOutButton } from '@/components/sign-out-button'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  let session, org
  try {
    const result = await requireOrgMember(orgSlug)
    session = result.session
    org = result.org
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(e.status === 403 ? '/org' : '/login?_=1')
    }
    throw e
  }

  const orgInitials = getInitials(org.name)
  const userDisplay = session.user.name ?? session.user.email ?? 'Usuário'
  const userInitials = getInitials(userDisplay)

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        {/* Org header */}
        <div className="h-14 px-4 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
            {orgInitials}
          </div>
          <span className="text-sm font-semibold truncate">{org.name}</span>
        </div>

        <Separator />

        {/* Nav */}
        <SidebarNav orgSlug={orgSlug} />

        <div className="flex-1" />

        <Separator />

        {/* User footer */}
        <div className="h-14 px-4 flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center shrink-0">
            {userInitials}
          </div>
          <span className="text-xs text-muted-foreground truncate flex-1">{userDisplay}</span>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
