import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextRequest, NextResponse } from 'next/server'

// Upstash rate limiter (persistent across deploys)
// Falls back to in-memory if env vars not set
let rateLimiter: { limit: (id: string) => Promise<{ success: boolean }> } | null = null

async function getRateLimiter() {
  if (rateLimiter) return rateLimiter

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    const { Redis } = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const redis = new Redis({ url, token })
    rateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:login',
    })
  } else {
    // In-memory fallback (resets on deploy)
    const attempts = new Map<string, { count: number; resetAt: number }>()
    rateLimiter = {
      limit: async (ip: string) => {
        const now = Date.now()
        const entry = attempts.get(ip)
        if (!entry || entry.resetAt < now) {
          attempts.set(ip, { count: 1, resetAt: now + 60_000 })
          return { success: true }
        }
        if (entry.count >= 10) return { success: false }
        entry.count++
        return { success: true }
      },
    }
  }

  return rateLimiter
}

const { GET, POST: authPost } = toNextJsHandler(auth)

export { GET }

export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.includes('/sign-in')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const limiter = await getRateLimiter()
    const { success } = await limiter.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }
  return authPost(request)
}
