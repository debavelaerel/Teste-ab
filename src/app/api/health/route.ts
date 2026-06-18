import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, db: true })
  } catch (err) {
    console.error('[health] db check failed', err)
    return NextResponse.json({ ok: false, db: false }, { status: 500 })
  }
}
