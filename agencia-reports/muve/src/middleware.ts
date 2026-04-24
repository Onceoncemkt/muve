import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const RUTAS_PROTEGIDAS = ['/dashboard', '/explorar', '/historial', '/validar', '/negocio', '/admin']
const RUTAS_AUTH = ['/login', '/registro']

function startsWithRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function redirectProtegidoValido(pathname: string | null): string | null {
  if (!pathname) return null
  if (!pathname.startsWith('/')) return null
  if (RUTAS_AUTH.some(r => startsWithRoute(pathname, r))) return null
  if (!RUTAS_PROTEGIDAS.some(r => startsWithRoute(pathname, r))) return null
  return pathname
}

// Propaga las cookies de sesión de supabaseResponse al redirect.
// Supabase puede haber refrescado el token durante getUser() — si se pierde
// ese Set-Cookie la sesión queda inválida en el siguiente request.
function redirectWithSession(url: URL, supabaseResponse: NextResponse): NextResponse {
  const res = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach(({ name, value }) =>
    res.cookies.set(name, value)
  )
  return res
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const esRutaProtegida = RUTAS_PROTEGIDAS.some(r => startsWithRoute(pathname, r))
  const esRutaAuth = RUTAS_AUTH.some(r => startsWithRoute(pathname, r))

  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return redirectWithSession(url, supabaseResponse)
  }

  if (esRutaAuth && user) {
    const redirectSolicitado = redirectProtegidoValido(
      request.nextUrl.searchParams.get('redirect')
    )
    const url = request.nextUrl.clone()
    url.pathname = redirectSolicitado ?? '/dashboard'
    url.search = ''
    return redirectWithSession(url, supabaseResponse)
  }
  // Proteger /admin solo para admins
  if (startsWithRoute(pathname, '/admin') && user) {
    const { data: perfil } = await supabase.from('users').select('rol').eq('id', user.id).single()
    if (perfil?.rol !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return redirectWithSession(url, supabaseResponse)
    }
  }
  // Proteger /negocio solo para staff y admin
  if (startsWithRoute(pathname, '/negocio') && user) {
    const { data: perfil } = await supabase.from('users').select('rol').eq('id', user.id).single()
    if (!['staff', 'admin'].includes(perfil?.rol ?? '')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return redirectWithSession(url, supabaseResponse)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
