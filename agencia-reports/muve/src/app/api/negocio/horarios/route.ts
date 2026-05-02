import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { DiaSemana } from '@/types'

const DIA_INDEX: Record<DiaSemana, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
}
function diaSemanaDesdeFecha(fecha: string): DiaSemana | null {
  const dias: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return dias[date.getDay()]
}

function esDiaSemana(value: unknown): value is DiaSemana {
  return (
    value === 'lunes'
    || value === 'martes'
    || value === 'miercoles'
    || value === 'jueves'
    || value === 'viernes'
    || value === 'sabado'
    || value === 'domingo'
  )
}

function normalizarTextoOpcional(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const limpio = value.trim()
  return limpio.length > 0 ? limpio : null
}

function fechaIsoYmd(value: Date) {
  return value.toISOString().slice(0, 10)
}

function siguienteFechaParaHorario(diaSemana: DiaSemana, horaInicio: string, ahora: Date) {
  const fechaBase = new Date(ahora)
  fechaBase.setHours(0, 0, 0, 0)

  const diaActual = ahora.getDay()
  const diaObjetivo = DIA_INDEX[diaSemana]
  const diff = (diaObjetivo - diaActual + 7) % 7

  const candidata = new Date(fechaBase)
  candidata.setDate(candidata.getDate() + diff)

  const [horaTexto, minutoTexto = '0'] = horaInicio.split(':')
  const hora = Number.parseInt(horaTexto ?? '', 10)
  const minuto = Number.parseInt(minutoTexto ?? '', 10)
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) {
    return null
  }

  candidata.setHours(hora, minuto, 0, 0)
  if (candidata.getTime() <= ahora.getTime()) {
    candidata.setDate(candidata.getDate() + 7)
  }
  return candidata
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/negocio/horarios?negocio_id=xxx[&fecha=YYYY-MM-DD][&incluir_inactivos=true]
// Con fecha: filtra por día de semana y devuelve spots para esa fecha.
// Sin fecha: devuelve todos los horarios activos del negocio.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const negocio_id = searchParams.get('negocio_id')
  const fechaParam = searchParams.get('fecha')
  const incluirInactivos = searchParams.get('incluir_inactivos') === 'true'
  const soloFuturos = searchParams.get('solo_futuros') === 'true'
  const fecha = fechaParam ?? new Date().toISOString().split('T')[0]

  if (!negocio_id) {
    return NextResponse.json({ error: 'negocio_id requerido' }, { status: 400 })
  }


  const db = admin()
  const diaSemana = diaSemanaDesdeFecha(fecha)
  if (!diaSemana) {
    return NextResponse.json({ error: 'fecha inválida' }, { status: 400 })
  }

  let query = db
    .from('horarios')
    .select('*')
    .eq('negocio_id', negocio_id)

  if (!incluirInactivos) {
    query = query.eq('activo', true)
  }

  // Si se envía fecha explícita, filtrar por el día de semana correspondiente
  // (útil para reservar desde /explorar). Si no, devolver todos los horarios activos.
  if (fechaParam) {
    query = query.eq('dia_semana', diaSemana)
  }

  const { data: horarios, error } = await query
    .order('dia_semana')
    .order('hora_inicio')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!fechaParam && soloFuturos) {
    const ahora = new Date()
    const horariosConSpots = await Promise.all(
      (horarios ?? []).map(async h => {
        if (!esDiaSemana(h.dia_semana) || typeof h.hora_inicio !== 'string') return null
        const fechaProxima = siguienteFechaParaHorario(h.dia_semana, h.hora_inicio, ahora)
        if (!fechaProxima) return null
        const fechaProximaYmd = fechaIsoYmd(fechaProxima)

        const { count } = await db
          .from('reservaciones')
          .select('id', { count: 'exact', head: true })
          .eq('horario_id', h.id)
          .eq('fecha', fechaProximaYmd)
          .eq('estado', 'confirmada')

        return {
          ...h,
          fecha_proxima: fechaProximaYmd,
          spots_disponibles: h.capacidad_total - (count ?? 0),
          spots_ocupados: count ?? 0,
        }
      })
    )

    const futuros = horariosConSpots
      .filter((horario): horario is NonNullable<typeof horario> => Boolean(horario))
      .filter((horario) => {
        if (typeof horario.fecha_proxima !== 'string') return false
        const inicio = new Date(`${horario.fecha_proxima}T${horario.hora_inicio}`)
        return !Number.isNaN(inicio.getTime()) && inicio.getTime() > ahora.getTime()
      })
      .sort((a, b) => {
        const keyA = `${a.fecha_proxima}T${a.hora_inicio}`
        const keyB = `${b.fecha_proxima}T${b.hora_inicio}`
        return keyA.localeCompare(keyB)
      })

    return NextResponse.json({ horarios: futuros })
  }

  // Para cada horario, contar reservaciones confirmadas en la fecha dada
  const horariosConSpots = await Promise.all(
    (horarios ?? []).map(async h => {
      const { count } = await db
        .from('reservaciones')
        .select('id', { count: 'exact', head: true })
        .eq('horario_id', h.id)
        .eq('fecha', fecha)
        .eq('estado', 'confirmada')

      return {
        ...h,
        spots_disponibles: h.capacidad_total - (count ?? 0),
        spots_ocupados: count ?? 0,
      }
    })
  )

  return NextResponse.json({ horarios: horariosConSpots })
}

// POST /api/negocio/horarios — crear horario (solo staff/admin)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = admin()

  const { data: perfil } = await db
    .from('users').select('rol').eq('id', user.id).single()
  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { negocio_id, dia_semana, fecha, hora_inicio, hora_fin, capacidad_total, nombre_coach, tipo_clase, activo } = body as {
    negocio_id?: string
    dia_semana?: DiaSemana | string
    fecha?: string
    hora_inicio?: string
    hora_fin?: string
    capacidad_total?: number | string
    nombre_coach?: string | null
    tipo_clase?: string | null
    activo?: boolean
  }

  const diaSemanaFinal = esDiaSemana(dia_semana)
    ? dia_semana
    : (typeof fecha === 'string' ? diaSemanaDesdeFecha(fecha) : null)

  if (!negocio_id || !diaSemanaFinal || !hora_inicio || !hora_fin) {
    return NextResponse.json({ error: 'negocio_id, dia_semana/fecha, hora_inicio y hora_fin son requeridos' }, { status: 400 })
  }
  if (hora_inicio >= hora_fin) {
    return NextResponse.json({ error: 'hora_fin debe ser mayor a hora_inicio' }, { status: 400 })
  }

  let capacidadFinal: number | null = null
  if (typeof capacidad_total === 'number' && Number.isFinite(capacidad_total)) {
    capacidadFinal = Math.trunc(capacidad_total)
  } else if (typeof capacidad_total === 'string' && capacidad_total.trim().length > 0) {
    const parsed = Number.parseInt(capacidad_total, 10)
    if (Number.isFinite(parsed)) capacidadFinal = parsed
  }

  if (capacidadFinal !== null && capacidadFinal < 1) {
    return NextResponse.json({ error: 'capacidad_total debe ser mayor a 0' }, { status: 400 })
  }

  if (capacidadFinal === null) {
    const { data: negocio } = await db
      .from('negocios')
      .select('capacidad_default')
      .eq('id', negocio_id)
      .maybeSingle<{ capacidad_default: number | null }>()
    capacidadFinal = negocio?.capacidad_default && negocio.capacidad_default > 0
      ? negocio.capacidad_default
      : 10
  }

  const nombreCoachNormalizado = normalizarTextoOpcional(nombre_coach)
  const tipoClaseNormalizado = normalizarTextoOpcional(tipo_clase)

  const { data: nuevo, error } = await db
    .from('horarios')
    .insert({
      negocio_id,
      dia_semana: diaSemanaFinal,
      hora_inicio,
      hora_fin,
      capacidad_total: capacidadFinal,
      nombre_coach: nombreCoachNormalizado,
      tipo_clase: tipoClaseNormalizado,
      activo: typeof activo === 'boolean' ? activo : true,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[POST /api/negocio/horarios]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ horario: nuevo }, { status: 201 })
}
