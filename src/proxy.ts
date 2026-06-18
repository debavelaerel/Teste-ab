import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request)
  const { pathname } = request.nextUrl

  // /api/* is excluded from the matcher below — API routes do their own auth
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/r/') ||
    pathname === '/tracker.js'

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/org', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Keep api excluded: API routes handle auth themselves via requireOrgMember
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
