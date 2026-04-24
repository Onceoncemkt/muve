import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Rol } from '@/types'

const RUTAS_USUARIO = ['/dashboard', '/explorar', '/historial']
const RUTAS_STAFF   = ['/validar', '/negocio']
const RUTAS_ADMIN   = ['/admin']
const RUTAS_AUTH    = ['/login', '/registro']

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

  const esRutaUsuario   = RUTAS_USUARIO.some(r => pathname.startsWith(r))
  const esRutaStaff     = RUTAS_STAFF.some(r => pathname.startsWith(r))
  const esRutaAdmin     = RUTAS_ADMIN.some(r => pathname.startsWith(r))
  const esRutaProtegida = esRutaUsuario || esRutaStaff || esRutaAdmin

  // Sin sesión → /login
  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return redirectWithSession(url, supabaseResponse)
  }

  // Con sesión en ruta de auth → /dashboard
  if (user && RUTAS_AUTH.some(r => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return redirectWithSession(url, supabaseResponse)
  }

  // Verificar rol para rutas de staff/admin
  if (user && (esRutaStaff || esRutaAdmin)) {
    const { data: perfil } = await supabase
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single()

    const rol: Rol = perfil?.rol ?? 'usuario'

    if (esRutaAdmin && rol !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return redirectWithSession(url, supabaseResponse)
    }

    if (esRutaStaff && rol !== 'staff' && rol !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return redirectWithSession(url, supabaseResponse)
    }
  }

  // El estado de membresía (plan_activo) NO se verifica en el middleware:
  // - los redirects de Stripe llegan a /dashboard antes de que el webhook active el plan
  // - los recién registrados no tienen plan aún pero deben ver el dashboard
  // - el dashboard page maneja el estado sin_membresia con un banner de suscripción
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
