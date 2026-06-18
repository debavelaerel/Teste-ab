/**
 * Cria o primeiro usuário admin e sua organização.
 * Uso: npx tsx scripts/bootstrap-admin.ts
 *
 * Variáveis de ambiente necessárias (via .env.local ou env do Railway):
 *   DATABASE_URL
 *   BETTER_AUTH_SECRET
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD
 *   BOOTSTRAP_ORG_NAME      (opcional, padrão: "Minha Org")
 *   BOOTSTRAP_ORG_SLUG      (opcional, padrão: derivado do nome)
 */
import 'dotenv/config'
import crypto from 'crypto'
import { db } from '../src/db'
import { abOrganizations, abMemberships } from '../src/db/schema'
import { user as userTable } from '../src/db/auth-schema'
import { eq } from 'drizzle-orm'

const email = process.env.BOOTSTRAP_ADMIN_EMAIL
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
const orgName = process.env.BOOTSTRAP_ORG_NAME ?? 'Minha Org'
const orgSlug =
  process.env.BOOTSTRAP_ORG_SLUG ??
  orgName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

if (!email || !password) {
  console.error('❌  Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD')
  process.exit(1)
}

const adminEmail: string = email
const adminPassword: string = password

async function createUser(adminEmail: string, adminPassword: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword, name: adminEmail.split('@')[0] }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Falha ao criar usuário via Better Auth API: ${res.status} ${body}`)
  }
}

async function main() {
  console.log(`\n🔧  Bootstrap admin`)
  console.log(`   Email : ${adminEmail}`)
  console.log(`   Org   : ${orgName} (/${orgSlug})\n`)

  // 1. Criar usuário via Better Auth API (garante hash correto)
  console.log('1/3  Criando usuário...')
  await createUser(adminEmail, adminPassword)

  // 2. Buscar userId recém-criado
  const users = await db.select().from(userTable).where(eq(userTable.email, adminEmail))
  if (users.length === 0) throw new Error('Usuário não encontrado após criação')
  const userId = users[0].id
  console.log(`     ✓ userId: ${userId}`)

  // 3. Criar organização
  console.log('2/3  Criando organização...')
  const existing = await db.select().from(abOrganizations).where(eq(abOrganizations.slug, orgSlug))
  let orgId: string
  if (existing.length > 0) {
    orgId = existing[0].id
    console.log(`     ✓ Organização já existe (id: ${orgId})`)
  } else {
    const [org] = await db.insert(abOrganizations).values({ name: orgName, slug: orgSlug }).returning()
    orgId = org.id
    console.log(`     ✓ Organização criada (id: ${orgId})`)
  }

  // 4. Criar membership
  console.log('3/3  Adicionando membership...')
  await db
    .insert(abMemberships)
    .values({ userId, orgId, role: 'admin' })
    .onConflictDoNothing()
  console.log(`     ✓ Membership criado`)

  console.log(`\n✅  Pronto! Acesse: ${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/org/${orgSlug}`)
  process.exit(0)
}

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
