import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Rol } from '@/types'

type PerfilAcceso = {
  rol: Rol
  negocio_id: string | null
}

async function obtenerPerfilAcceso(userId: string): Promise<PerfilAcceso | null> {
  const db = createServiceClient()
  const consulta = await db
    .from('users')
    .select('rol, negocio_id')
    .eq('id', userId)
    .maybeSingle<PerfilAcceso>()

  if (consulta.error || !consulta.data) return null
  return {
    rol: consulta.data.rol,
    negocio_id: typeof consulta.data.negocio_id === 'string' ? consulta.data.negocio_id : null,
  }
}

type UsuarioRow = {
  id: string
  nombre: string
  plan: string | null
  foto_url: string | null
  lesiones: string | null
  objetivo_entrenamiento: string | null
  nivel_condicion: string | null
  disciplinas: string[] | null
  notas_negocio: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const perfil = await obtenerPerfilAcceso(user.id)
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioIdParam = searchParams.get('negocio_id')
  const negocioIdObjetivo = perfil.rol === 'staff'
    ? perfil.negocio_id
    : (negocioIdParam ?? perfil.negocio_id)

  if (!negocioIdObjetivo) {
    return NextResponse.json({ error: 'Negocio no asignado' }, { status: 400 })
  }

  const { id: usuarioId } = await params
  if (!usuarioId) {
    return NextResponse.json({ error: 'usuario id requerido' }, { status: 400 })
  }

  const db = createServiceClient()

  const horariosResult = await db
    .from('horarios')
    .select('id')
    .eq('negocio_id', negocioIdObjetivo)

  if (horariosResult.error) {
    console.error('[GET /api/negocio/usuarios/[id]/perfil] horarios error:', horariosResult.error.message)
    return NextResponse.json({ error: 'No se pudo verificar acceso al usuario' }, { status: 500 })
  }

  const horarioIds = (horariosResult.data ?? []).map(h => (h as { id: string }).id)

  let tieneReservacionEnNegocio = false
  if (horarioIds.length > 0) {
    const verificacion = await db
      .from('reservaciones')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', usuarioId)
      .in('horario_id', horarioIds)
      .limit(1)

    if (verificacion.error) {
      console.error('[GET /api/negocio/usuarios/[id]/perfil] verificacion error:', verificacion.error.message)
      return NextResponse.json({ error: 'No se pudo verificar acceso al usuario' }, { status: 500 })
    }

    tieneReservacionEnNegocio = (verificacion.count ?? 0) > 0
  }

  const visitasResult = await db
    .from('visitas')
    .select('fecha', { count: 'exact' })
    .eq('user_id', usuarioId)
    .eq('negocio_id', negocioIdObjetivo)
    .order('fecha', { ascending: false })

  const visitas = visitasResult.error ? [] : (visitasResult.data ?? [])
  const totalVisitas = visitasResult.error ? 0 : (visitasResult.count ?? visitas.length)
  const ultimaVisitaFecha = visitas.length > 0 ? (visitas[0] as { fecha: string }).fecha : null

  if (!tieneReservacionEnNegocio && totalVisitas === 0) {
    return NextResponse.json(
      { error: 'Este usuario no tiene actividad en tu negocio' },
      { status: 403 }
    )
  }

  const usuarioResult = await db
    .from('users')
    .select('id, nombre, plan, foto_url, lesiones, objetivo_entrenamiento, nivel_condicion, disciplinas, notas_negocio')
    .eq('id', usuarioId)
    .maybeSingle<UsuarioRow>()

  if (usuarioResult.error || !usuarioResult.data) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const u = usuarioResult.data
  return NextResponse.json({
    usuario: {
      id: u.id,
      nombre: u.nombre,
      plan: u.plan,
      foto_url: u.foto_url,
      lesiones: u.lesiones,
      objetivo_entrenamiento: u.objetivo_entrenamiento,
      nivel_condicion: u.nivel_condicion,
      disciplinas: Array.isArray(u.disciplinas) ? u.disciplinas : [],
      notas_negocio: u.notas_negocio,
      total_visitas_negocio: totalVisitas,
      ultima_visita_negocio: ultimaVisitaFecha,
    },
  })
}
