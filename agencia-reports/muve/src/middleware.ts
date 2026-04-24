import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Rol } from '@/types'

const RUTAS_DASHBOARD = ['/dashboard']
const RUTAS_USUARIO = ['/explorar', '/historial']
const RUTAS_STAFF = ['/validar', '/negocio']
const RUTAS_ADMIN = ['/admin']
const RUTAS_AUTH = ['/login', '/registro']

function startsWithRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function panelPorRol(rol: Rol): string {
  if (rol === 'staff') return '/negocio/dashboard'
  if (rol === 'admin') return '/admin'
  return '/dashboard'
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

  const esRutaDashboard = RUTAS_DASHBOARD.some(r => startsWithRoute(pathname, r))
  const esRutaUsuario = RUTAS_USUARIO.some(r => startsWithRoute(pathname, r))
  const esRutaStaff = RUTAS_STAFF.some(r => startsWithRoute(pathname, r))
  const esRutaAdmin = RUTAS_ADMIN.some(r => startsWithRoute(pathname, r))
  const esRutaAuth = RUTAS_AUTH.some(r => startsWithRoute(pathname, r))
  const esRutaProtegida = esRutaDashboard || esRutaUsuario || esRutaStaff || esRutaAdmin

  // Sin sesión en ruta protegida → /login
  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return redirectWithSession(url, supabaseResponse)
  }

  if (!user) return supabaseResponse

  // Leer rol para redirecciones por panel correcto
  const { data: perfil } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single()
  const rol: Rol = perfil?.rol ?? 'usuario'
  const panelCorrecto = panelPorRol(rol)

  // Con sesión en ruta auth → panel correcto por rol
  if (esRutaAuth) {
    const url = request.nextUrl.clone()
    url.pathname = panelCorrecto
    return redirectWithSession(url, supabaseResponse)
  }

  // /admin/* solo admin
  if (esRutaAdmin && rol !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = panelCorrecto
    return redirectWithSession(url, supabaseResponse)
  }

  // /negocio/* y /validar solo staff/admin
  if (esRutaStaff && rol !== 'staff' && rol !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = panelCorrecto
    return redirectWithSession(url, supabaseResponse)
  }

  // /dashboard/* solo usuario/admin
  if (esRutaDashboard && rol !== 'usuario' && rol !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = panelCorrecto
    return redirectWithSession(url, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
