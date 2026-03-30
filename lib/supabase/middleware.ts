import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              domain: cookieDomain,
              path: '/',
              sameSite: 'lax' as const,
              secure: process.env.NODE_ENV === 'production',
            })
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to centralized auth if not authenticated on protected routes
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.ryurex.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  const protectedRoutes = ['/dashboard', '/profile', '/game', '/pvp', '/game-modes', '/category-menu']
  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (!user && isProtectedRoute) {
    const loginUrl = `${authUrl}/login?redirect=${encodeURIComponent(appUrl + request.nextUrl.pathname)}`
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from login/signup (they should use auth.ryurex.com)
  if (
    user &&
    (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
