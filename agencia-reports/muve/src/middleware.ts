import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Rol } from '@/types'

const RUTAS_USUARIO = ['/dashboard', '/explorar', '/historial']
const RUTAS_STAFF   = ['/validar']
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

  // Verificar membresía activa para rutas de usuario
  if (user && esRutaUsuario) {
    const { data: perfil, error } = await supabase
      .from('users')
      .select('plan_activo')
      .eq('id', user.id)
      .single()

    // Bloquear solo cuando plan_activo es EXPLÍCITAMENTE false.
    // Si la query falla (RLS no configurado, perfil no existe aún, error de red),
    // error es non-null y no redirigimos — la página maneja ese caso.
    if (!error && perfil?.plan_activo === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('sin_membresia', '1')
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
