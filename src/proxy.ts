import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request)
  const { pathname } = request.nextUrl

  // Public routes: /login, /r/*, /api/*, /tracker.js
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/api/') ||
    pathname === '/tracker.js'

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
