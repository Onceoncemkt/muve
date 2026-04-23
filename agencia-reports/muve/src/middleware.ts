import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Rol } from '@/types'

const RUTAS_USUARIO = ['/dashboard', '/explorar', '/historial']
const RUTAS_STAFF   = ['/validar']
const RUTAS_ADMIN   = ['/admin']
const RUTAS_AUTH    = ['/login', '/registro']

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

  // Refresca la sesión — no usar getSession() aquí, puede ser falsa
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const esRutaUsuario = RUTAS_USUARIO.some(r => pathname.startsWith(r))
  const esRutaStaff   = RUTAS_STAFF.some(r => pathname.startsWith(r))
  const esRutaAdmin   = RUTAS_ADMIN.some(r => pathname.startsWith(r))
  const esRutaProtegida = esRutaUsuario || esRutaStaff || esRutaAdmin

  // Sin sesión → redirigir a /login
  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Con sesión en rutas de auth → redirigir a /dashboard
  if (user && RUTAS_AUTH.some(r => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Verificar rol para rutas de staff/admin
  if (user && (esRutaStaff || esRutaAdmin)) {
    const { data: perfil } = await supabase
      .from('users')
      .select('rol, plan_activo')
      .eq('id', user.id)
      .single()

    const rol: Rol = perfil?.rol ?? 'usuario'

    if (esRutaAdmin && rol !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    if (esRutaStaff && rol !== 'staff' && rol !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Verificar membresía activa para rutas de usuario
  if (user && esRutaUsuario) {
    const { data: perfil } = await supabase
      .from('users')
      .select('plan_activo')
      .eq('id', user.id)
      .single()

    if (!perfil?.plan_activo) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('sin_membresia', '1')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
