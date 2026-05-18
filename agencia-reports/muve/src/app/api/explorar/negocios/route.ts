import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Negocio, ServicioNegocio } from '@/types'
import { MAX_VISITAS_POR_LUGAR, normalizarCategoriaNegocio, normalizarCategoriasNegocio, normalizarPlan } from '@/lib/planes'
import { resolverVentanaCiclo } from '@/lib/ciclos'

type ServicioFila = {
  id: string
  negocio_id: string
  nombre: string
  precio_normal_mxn: number | null
  descripcion: string | null
  activo: boolean | null
}
type PerfilUsuarioLimites = {
  plan: string | null
  plan_activo: boolean | null
  fecha_inicio_ciclo: string | null
  fecha_fin_plan: string | null
}
type ReservacionConNegocio = {
  horarios: { negocio_id: string | null } | Array<{ negocio_id: string | null }> | null
}
async function consultarNegocios(cliente: ReturnType<typeof createServiceClient>) {
  let consulta = await cliente
    .from('negocios')
    .select('*')
    .or('activo.eq.true,activo.is.null')
  if (faltaColumna(consulta.error, 'activo')) {
    consulta = await cliente.from('negocios').select('*')
  }
  return consulta
}

function faltaRelacion(error: { message?: string } | null | undefined, relation: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relation.toLowerCase()) && message.includes('does not exist')
}
function faltaColumna(error: { message?: string } | null | undefined, column: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('column') && message.includes(column.toLowerCase()) && message.includes('does not exist')
}

function parseServiciosTexto(negocioId: string, serviciosIncluidos: string | null | undefined): ServicioNegocio[] {
  if (!serviciosIncluidos || !serviciosIncluidos.trim()) return []
  return serviciosIncluidos
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map((nombre, index) => ({
      id: `texto-${negocioId}-${index}`,
      negocio_id: negocioId,
      nombre,
      precio_normal_mxn: 0,
      descripcion: null,
      activo: true,
    }))
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let clienteLectura = supabase

  let consulta = await consultarNegocios(supabase as unknown as ReturnType<typeof createServiceClient>)
  const negociosPrimeraConsulta = (consulta.data ?? []) as Negocio[]

  if (consulta.error || negociosPrimeraConsulta.length === 0) {
    const serviceClient = createServiceClient()
    const consultaService = await consultarNegocios(serviceClient)
    const negociosService = (consultaService.data ?? []) as Negocio[]

    if (!consultaService.error && (consulta.error || negociosService.length > 0)) {
      consulta = consultaService
      clienteLectura = serviceClient
      if (negociosService.length > 0 && negociosPrimeraConsulta.length === 0) {
        console.warn('[GET /api/explorar/negocios] fallback service role por resultado vacío de cliente normal')
      }
    } else if (consulta.error && consultaService.error) {
      return NextResponse.json(
        { error: consultaService.error.message || consulta.error.message, negocios: [] },
        { status: 500 }
      )
    }
  }
  if (consulta.error) {
    return NextResponse.json(
      { error: consulta.error.message, negocios: [] },
      { status: 500 }
    )
  }
  const negocios = (consulta.data ?? []) as Negocio[]
  const negocioIds = negocios.map(negocio => negocio.id)
  const serviciosPorNegocio = new Map<string, ServicioNegocio[]>()

  if (negocioIds.length > 0) {
    const consultaServicios = await clienteLectura
      .from('negocio_servicios')
      .select('id, negocio_id, nombre, precio_normal_mxn, descripcion, activo')
      .in('negocio_id', negocioIds)
      .eq('activo', true)
      .order('created_at', { ascending: true })
      .returns<ServicioFila[]>()

    if (!consultaServicios.error) {
      for (const servicio of consultaServicios.data ?? []) {
        const negocioServicios = serviciosPorNegocio.get(servicio.negocio_id) ?? []
        negocioServicios.push({
          id: servicio.id,
          negocio_id: servicio.negocio_id,
          nombre: servicio.nombre,
          precio_normal_mxn: typeof servicio.precio_normal_mxn === 'number'
            ? Math.max(Math.trunc(servicio.precio_normal_mxn), 0)
            : 0,
          descripcion: servicio.descripcion ?? null,
          activo: true,
        })
        serviciosPorNegocio.set(servicio.negocio_id, negocioServicios)
      }
    } else if (!faltaRelacion(consultaServicios.error, 'negocio_servicios')) {
      console.error('[GET /api/explorar/negocios] error consultando negocio_servicios:', consultaServicios.error)
    }
  }

  const negociosConServicios = negocios.map((negocio) => {
    const categoriaNormalizada = normalizarCategoriaNegocio(negocio.categoria)
    const nivelNormalizado = negocio.nivel === 'plus' || negocio.nivel === 'total'
      ? negocio.nivel
      : negocio.plan_requerido === 'plus' || negocio.plan_requerido === 'total'
        ? negocio.plan_requerido
        : 'basico'
    const serviciosTabla = serviciosPorNegocio.get(negocio.id) ?? []
    const serviciosDisponibles = serviciosTabla.length > 0
      ? serviciosTabla
      : parseServiciosTexto(negocio.id, negocio.servicios_incluidos)

    return {
      ...negocio,
      categoria: categoriaNormalizada ?? negocio.categoria,
      categorias: normalizarCategoriasNegocio((negocio as { categorias?: unknown }).categorias, negocio.categoria),
      nivel: nivelNormalizado,
      monto_maximo_visita: typeof negocio.monto_maximo_visita === 'number'
        ? Math.max(Math.trunc(negocio.monto_maximo_visita), 0)
        : 0,
      servicios_disponibles: serviciosDisponibles,
    }
  })
  let visitasRestantesPorNegocio: Record<string, number> = {}
  if (user) {
    const serviceClient = createServiceClient()
    const { data: perfilUsuario } = await serviceClient
      .from('users')
      .select('plan, plan_activo, fecha_inicio_ciclo, fecha_fin_plan')
      .eq('id', user.id)
      .maybeSingle<PerfilUsuarioLimites>()

    const plan = normalizarPlan(perfilUsuario?.plan ?? null)
    const planActivo = Boolean(perfilUsuario?.plan_activo)
    if (plan && planActivo) {
      const limitePorLugar = MAX_VISITAS_POR_LUGAR[plan]
      const ciclo = resolverVentanaCiclo({
        fechaInicioCiclo: perfilUsuario?.fecha_inicio_ciclo ?? null,
        fechaFinPlan: perfilUsuario?.fecha_fin_plan ?? null,
      })
      const { data: reservacionesCiclo } = await serviceClient
        .from('reservaciones')
        .select('horarios!inner(negocio_id)')
        .eq('user_id', user.id)
        .in('estado', ['confirmada', 'completada'])
        .gte('fecha', ciclo.inicio.toISOString().slice(0, 10))
        .lt('fecha', ciclo.fin.toISOString().slice(0, 10))
        .returns<ReservacionConNegocio[]>()

      const visitasPorNegocio = new Map<string, number>()
      for (const reservacion of reservacionesCiclo ?? []) {
        const horario = Array.isArray(reservacion.horarios) ? reservacion.horarios[0] : reservacion.horarios
        const negocioId = horario?.negocio_id
        if (!negocioId) continue
        visitasPorNegocio.set(negocioId, (visitasPorNegocio.get(negocioId) ?? 0) + 1)
      }

      for (const negocio of negociosConServicios) {
        const usadasAqui = visitasPorNegocio.get(negocio.id) ?? 0
        visitasRestantesPorNegocio[negocio.id] = Math.max(limitePorLugar - usadasAqui, 0)
      }
    }
  }
  return NextResponse.json({ negocios: negociosConServicios, visitas_restantes_por_negocio: visitasRestantesPorNegocio })
}
