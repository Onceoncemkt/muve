import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Negocio, ServicioNegocio } from '@/types'

type ServicioFila = {
  id: string
  negocio_id: string
  nombre: string
  precio_normal_mxn: number | null
  descripcion: string | null
  activo: boolean | null
}

function faltaRelacion(error: { message?: string } | null | undefined, relation: string) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(relation.toLowerCase()) && message.includes('does not exist')
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
  const consulta = await supabase.from('negocios').select('*').eq('activo', true)

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
    const consultaServicios = await supabase
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
    const serviciosTabla = serviciosPorNegocio.get(negocio.id) ?? []
    const serviciosDisponibles = serviciosTabla.length > 0
      ? serviciosTabla
      : parseServiciosTexto(negocio.id, negocio.servicios_incluidos)

    return {
      ...negocio,
      monto_maximo_visita: typeof negocio.monto_maximo_visita === 'number'
        ? Math.max(Math.trunc(negocio.monto_maximo_visita), 0)
        : 0,
      servicios_disponibles: serviciosDisponibles,
    }
  })

  return NextResponse.json({ negocios: negociosConServicios })
}
