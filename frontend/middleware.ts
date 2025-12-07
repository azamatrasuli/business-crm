import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check for auth status cookie (set by frontend after successful login)
  // Note: The actual JWT is in HttpOnly cookie (access_token) which JS can't read
  // We use auth_status as a marker that the user should be authenticated
  const authStatus = request.cookies.get('auth_status')?.value
  
  // Also check for the legacy token cookie for backwards compatibility
  const legacyToken = request.cookies.get('token')?.value
  
  // User is considered authenticated if they have either marker
  const isAuthenticated = authStatus === 'authenticated' || !!legacyToken

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/auth', '/public', '/reset-password', '/forgot-password', '/api']
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Redirect to login if not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to home if authenticated and trying to access login
  if (isAuthenticated && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
