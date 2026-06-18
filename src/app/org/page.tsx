import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abMemberships, abOrganizations } from '@/db/schema'

export default async function OrgRootPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const rows = await db
    .select({ org: abOrganizations })
    .from(abMemberships)
    .innerJoin(abOrganizations, eq(abMemberships.orgId, abOrganizations.id))
    .where(eq(abMemberships.userId, session.user.id))
    .limit(1)

  if (rows.length === 0) {
    // User has a session but belongs to no org — avoid redirect loop with proxy.ts
    // (proxy would send /login back to /org creating an infinite loop)
    return (
      <div className="flex min-h-screen items-center justify-center text-center p-8">
        <div>
          <h1 className="text-xl font-semibold mb-2">Sem acesso</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta não está associada a nenhuma organização. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    )
  }
  redirect(`/org/${rows[0].org.slug}`)
}
