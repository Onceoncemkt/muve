'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CATEGORIA_LABELS,
  CIUDAD_LABELS,
  DIA_LABELS,
  formatHora,
  proximaFecha,
  type DiaSemana,
  type Negocio,
  type PlanMembresia,
  type ServicioNegocio,
} from '@/types'
import {
  CREDITOS_POR_PLAN,
  MAX_VISITAS_POR_LUGAR,
  normalizarCategoriaNegocio,
  normalizarPlan,
  puedeReservarConPlan,
} from '@/lib/planes'
import { parseConfiguracionRestaurante } from '@/lib/restaurante-config'

type EstadoPlanUsuario = {
  authenticated: boolean
  plan_activo: boolean
  plan: PlanMembresia | null
  creditos_extra: number
  creditos_disponibles: number
  limite_creditos_ciclo: number
  max_creditos_por_lugar: number
  creditos_usados_ciclo: number
  creditos_restantes_ciclo: number
}

type HorarioExplorar = {
  id: string
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  nombre_coach: string | null
  tipo_clase: string | null
  spots_disponibles?: number
}

type MensajeAccion = { tipo: 'ok' | 'error'; texto: string } | null

const ORDEN_DIAS: Record<DiaSemana, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
}

async function obtenerEstadoPlanUsuario(): Promise<EstadoPlanUsuario> {
  try {
    const res = await fetch('/api/usuario/plan', { cache: 'no-store' })
    if (!res.ok) {
      return {
        authenticated: false,
        plan_activo: false,
        plan: null,
        creditos_extra: 0,
        creditos_disponibles: 0,
        limite_creditos_ciclo: 0,
        max_creditos_por_lugar: 0,
        creditos_usados_ciclo: 0,
        creditos_restantes_ciclo: 0,
      }
    }

    const data = await res.json()
    const plan = normalizarPlan(data.plan)
    const authenticated = Boolean(data.authenticated)
    const planActivo = Boolean(data.plan_activo) || Boolean(plan)
    const creditosExtra = Number.isFinite(data.creditos_extra) ? Number(data.creditos_extra) : 0
    const creditosTotalesPlan = plan ? CREDITOS_POR_PLAN[plan] : 0
    const maxPorLugarPlan = plan ? MAX_VISITAS_POR_LUGAR[plan] : 0
    const creditosUsados = Number.isFinite(data.creditos_usados_ciclo ?? data.creditos_usados ?? data.visitas_usadas_mes)
      ? Number(data.creditos_usados_ciclo ?? data.creditos_usados ?? data.visitas_usadas_mes)
      : 0
    const creditosDisponibles = Number.isFinite(data.creditos_disponibles ?? data.visitas_disponibles)
      ? Number(data.creditos_disponibles ?? data.visitas_disponibles)
      : (creditosTotalesPlan + creditosExtra)
    const creditosRestantes = Number.isFinite(data.creditos_restantes_ciclo ?? data.visitas_restantes_mes)
      ? Number(data.creditos_restantes_ciclo ?? data.visitas_restantes_mes)
      : Math.max(creditosDisponibles - creditosUsados, 0)
    const limiteCreditosCiclo = Number.isFinite(data.limite_creditos_ciclo ?? data.limite_visitas_mensuales)
      ? Number(data.limite_creditos_ciclo ?? data.limite_visitas_mensuales)
      : creditosTotalesPlan
    return {
      authenticated,
      plan_activo: planActivo,
      plan,
      creditos_extra: creditosExtra,
      creditos_disponibles: creditosDisponibles,
      limite_creditos_ciclo: limiteCreditosCiclo,
      max_creditos_por_lugar: Number.isFinite(data.max_creditos_por_lugar ?? data.max_visitas_por_lugar)
        ? Number(data.max_creditos_por_lugar ?? data.max_visitas_por_lugar)
        : maxPorLugarPlan,
      creditos_usados_ciclo: creditosUsados,
      creditos_restantes_ciclo: creditosRestantes,
    }
  } catch {
    return {
      authenticated: false,
      plan_activo: false,
      plan: null,
      creditos_extra: 0,
      creditos_disponibles: 0,
      limite_creditos_ciclo: 0,
      max_creditos_por_lugar: 0,
      creditos_usados_ciclo: 0,
      creditos_restantes_ciclo: 0,
    }
  }
}

function planRequeridoNegocio(negocio: Negocio): PlanMembresia {
  if (negocio.nivel === 'plus' || negocio.nivel === 'total') return negocio.nivel
  return 'basico'
}

function formatearFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function inicialesNegocio(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(fragmento => fragmento[0]?.toUpperCase() ?? '')
    .join('')
}

function serviciosWellnessVisibles(negocio: Negocio): ServicioNegocio[] {
  return Array.isArray(negocio.servicios_disponibles)
    ? negocio.servicios_disponibles.filter((servicio) => servicio?.activo !== false)
    : []
}

function serviciosWellnessReservables(negocio: Negocio): ServicioNegocio[] {
  return serviciosWellnessVisibles(negocio)
    .filter((servicio) => typeof servicio.id === 'string' && !servicio.id.startsWith('texto-'))
}

function enlaceMapaNegocio(negocio: Negocio) {
  const query = encodeURIComponent(`${negocio.nombre} ${negocio.direccion}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function enlaceMapaEmbed(negocio: Negocio) {
  const query = encodeURIComponent(`${negocio.nombre} ${negocio.direccion}`)
  return `https://www.google.com/maps?q=${query}&output=embed`
}

export default function NegocioDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const negocioId = useMemo(() => {
    if (!params?.id) return null
    return Array.isArray(params.id) ? (params.id[0] ?? null) : params.id
  }, [params])

  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [planActivo, setPlanActivo] = useState(false)
  const [planUsuario, setPlanUsuario] = useState<PlanMembresia | null>(null)
  const [menuReservasAbierto, setMenuReservasAbierto] = useState(false)
  const [horarios, setHorarios] = useState<HorarioExplorar[]>([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [errorHorarios, setErrorHorarios] = useState<string | null>(null)
  const [mensajeAccion, setMensajeAccion] = useState<MensajeAccion>(null)
  const [reservandoHorarioId, setReservandoHorarioId] = useState<string | null>(null)
  const [servicioSeleccionadoId, setServicioSeleccionadoId] = useState<string>('')

  useEffect(() => {
    let activo = true
    if (!negocioId) {
      setErrorCarga('Negocio inválido')
      setCargando(false)
      return () => {
        activo = false
      }
    }

    async function cargarDetalle() {
      setCargando(true)
      setErrorCarga(null)
      try {
        const [estadoPlan, respuestaNegocios] = await Promise.all([
          obtenerEstadoPlanUsuario(),
          fetch('/api/explorar/negocios', { cache: 'no-store' }),
        ])
        const payloadNegocios = await respuestaNegocios
          .json()
          .catch(() => ({ negocios: [], error: 'Respuesta inválida' }))

        if (!activo) return
        setPlanActivo(estadoPlan.plan_activo)
        setPlanUsuario(estadoPlan.plan)

        if (!respuestaNegocios.ok) {
          setNegocio(null)
          setErrorCarga(payloadNegocios.error ?? 'No se pudo cargar el negocio')
          return
        }

        const encontrado = ((payloadNegocios.negocios ?? []) as Negocio[])
          .find((item) => item.id === negocioId)

        if (!encontrado) {
          setNegocio(null)
          setErrorCarga('Este negocio no está disponible')
          return
        }

        setNegocio(encontrado)
        if (normalizarCategoriaNegocio(encontrado.categoria) === 'estetica') {
          const reservables = serviciosWellnessReservables(encontrado)
          setServicioSeleccionadoId(reservables[0]?.id ?? '')
        } else {
          setServicioSeleccionadoId('')
        }
      } catch {
        if (!activo) return
        setNegocio(null)
        setErrorCarga('Error de conexión al cargar el negocio')
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargarDetalle()
    return () => {
      activo = false
    }
  }, [negocioId])

  const cargarHorarios = useCallback(async () => {
    if (!negocio) return
    setCargandoHorarios(true)
    setErrorHorarios(null)
    try {
      const res = await fetch(`/api/negocio/horarios?negocio_id=${encodeURIComponent(negocio.id)}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setHorarios([])
        setErrorHorarios(data.error ?? 'No se pudieron cargar horarios')
        return
      }

      const horariosOrdenados = ((data.horarios ?? []) as HorarioExplorar[])
        .slice()
        .sort((a, b) => {
          const diferenciaDia = ORDEN_DIAS[a.dia_semana] - ORDEN_DIAS[b.dia_semana]
          if (diferenciaDia !== 0) return diferenciaDia
          return a.hora_inicio.localeCompare(b.hora_inicio)
        })
      setHorarios(horariosOrdenados)
    } catch {
      setHorarios([])
      setErrorHorarios('Error de conexión al cargar horarios')
    } finally {
      setCargandoHorarios(false)
    }
  }, [negocio])

  const reservarHorario = useCallback(async (horario: HorarioExplorar) => {
    if (!negocio) return
    const categoriaNegocio = normalizarCategoriaNegocio(negocio.categoria)
    const payload: { horario_id: string; fecha: string; servicio_id?: string } = {
      horario_id: horario.id,
      fecha: formatearFechaISO(proximaFecha(horario.dia_semana)),
    }

    if (categoriaNegocio === 'estetica') {
      if (!servicioSeleccionadoId) {
        setMensajeAccion({ tipo: 'error', texto: 'Selecciona un servicio antes de reservar' })
        return
      }
      payload.servicio_id = servicioSeleccionadoId
    }

    setReservandoHorarioId(horario.id)
    setMensajeAccion(null)
    try {
      const res = await fetch('/api/reservaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensajeAccion({ tipo: 'error', texto: data.error ?? 'No se pudo crear la reservación' })
        return
      }

      setMensajeAccion({
        tipo: 'ok',
        texto: `Reservación confirmada para ${DIA_LABELS[horario.dia_semana]} ${formatHora(horario.hora_inicio)}`,
      })
      void cargarHorarios()
    } catch {
      setMensajeAccion({ tipo: 'error', texto: 'Error de conexión al crear la reservación' })
    } finally {
      setReservandoHorarioId(null)
    }
  }, [cargarHorarios, negocio, servicioSeleccionadoId])

  const planEfectivo = planActivo ? (planUsuario ?? 'basico') : null
  const categoriaNegocio = normalizarCategoriaNegocio(negocio?.categoria)
  const esWellness = categoriaNegocio === 'estetica'
  const esCheckinDirecto = categoriaNegocio === 'gimnasio' || categoriaNegocio === 'restaurante'
  const planRequerido = negocio ? planRequeridoNegocio(negocio) : 'basico'
  const bloqueadoPorMembresia = !planEfectivo
  const puedeUsarBeneficio = Boolean(
    negocio
    && !bloqueadoPorMembresia
    && planEfectivo
    && puedeReservarConPlan(planEfectivo, planRequerido)
  )
  const serviciosWellness = negocio && esWellness ? serviciosWellnessVisibles(negocio) : []
  const serviciosWellnessDisponiblesReservables = negocio && esWellness ? serviciosWellnessReservables(negocio) : []
  const configRestaurante = parseConfiguracionRestaurante(negocio?.servicios_incluidos)

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] px-4 py-10">
        <p className="text-center text-sm text-[#666]">Cargando detalle del negocio...</p>
      </div>
    )
  }

  if (!negocio || errorCarga) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-black text-red-800">No se pudo cargar el negocio</p>
          <p className="mt-1 text-xs text-red-700">{errorCarga ?? 'Intenta más tarde'}</p>
          <Link
            href="/explorar"
            className="mt-3 inline-flex rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
          >
            Volver a explorar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-white px-4 py-5 shadow-sm">
        <Link
          href="/explorar"
          className="inline-flex items-center rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
        >
          ← Volver
        </Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-[#0A0A0A]">{negocio.nombre}</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6B4FE8]">
          {categoriaNegocio ? CATEGORIA_LABELS[categoriaNegocio] : 'Sin categoría'} · {CIUDAD_LABELS[negocio.ciudad]}
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#888]">Galería</h2>
            <div className="mt-2 overflow-hidden rounded-lg border border-[#E5E5E5]">
              {negocio.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={negocio.imagen_url} alt={negocio.nombre} className="h-72 w-full object-cover" />
              ) : (
                <div className="flex h-72 w-full items-center justify-center bg-[#6B4FE8] text-5xl font-black tracking-tight text-[#E8FF47]">
                  {inicialesNegocio(negocio.nombre)}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#888]">Descripción</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#444]">
              {negocio.descripcion?.trim() || 'Este negocio aún no cargó una descripción detallada.'}
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#888]">Horario</h2>
            {negocio.horario_atencion ? (
              <p className="mt-2 text-sm text-[#444]">{negocio.horario_atencion}</p>
            ) : (
              <p className="mt-2 text-sm text-[#666]">Este negocio aún no publicó un horario de atención.</p>
            )}
            {!negocio.requiere_reserva && categoriaNegocio === 'restaurante' && (
              <p className="mt-2 rounded-lg bg-[#F3F4F6] px-3 py-2 text-xs font-semibold text-[#444]">
                Llega cuando quieras en horario de servicio
              </p>
            )}
          </div>

          {categoriaNegocio === 'restaurante' && (
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#888]">Oferta MUVET</h2>
              <p className="mt-2 text-sm font-semibold text-[#0A0A0A]">
                {configRestaurante.servicio || 'Beneficio disponible al hacer check-in'}
              </p>
              {configRestaurante.fecha_oferta && (
                <p className="mt-1 text-xs text-[#666]">Vigente para fecha: {configRestaurante.fecha_oferta}</p>
              )}
            </div>
          )}

          {!esCheckinDirecto && (
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <button
                type="button"
                onClick={() => {
                  if (bloqueadoPorMembresia) {
                    router.push('/planes')
                    return
                  }
                  const siguiente = !menuReservasAbierto
                  setMenuReservasAbierto(siguiente)
                  setMensajeAccion(null)
                  if (siguiente) void cargarHorarios()
                }}
                disabled={!puedeUsarBeneficio && !bloqueadoPorMembresia}
                className={`w-full rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  puedeUsarBeneficio
                    ? 'bg-[#0A0A0A] text-[#E8FF47] hover:bg-[#222]'
                    : bloqueadoPorMembresia
                      ? 'border border-[#E5E5E5] bg-[#F7F7F7] text-[#888]'
                      : 'cursor-not-allowed border border-[#E5E5E5] bg-[#F7F7F7] text-[#888]'
                }`}
              >
                {!puedeUsarBeneficio
                  ? bloqueadoPorMembresia
                    ? '🔒 Activar plan'
                    : planRequerido === 'plus'
                      ? 'Requiere Plus'
                      : 'Requiere Total'
                  : menuReservasAbierto
                    ? 'Ocultar disponibilidad'
                    : 'Reservar'}
              </button>

              {menuReservasAbierto && puedeUsarBeneficio && (
                <div className="mt-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#555]">
                    {esWellness ? 'Disponibilidad de agenda' : 'Horarios disponibles'}
                  </p>
                  {esWellness && (
                    <div className="mt-2 rounded-md border border-[#E5E5E5] bg-white p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
                        Servicio a reservar
                      </p>
                      {serviciosWellnessDisponiblesReservables.length === 0 ? (
                        <p className="mt-1 text-xs text-red-700">
                          Este negocio aún no configuró servicios reservables.
                        </p>
                      ) : (
                        <select
                          value={servicioSeleccionadoId}
                          onChange={(event) => {
                            setServicioSeleccionadoId(event.target.value)
                            setMensajeAccion(null)
                          }}
                          className="mt-2 w-full rounded-md border border-[#E5E5E5] bg-white px-2 py-2 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                        >
                          <option value="">Selecciona un servicio...</option>
                          {serviciosWellnessDisponiblesReservables.map((servicio) => (
                            <option key={servicio.id} value={servicio.id}>
                              {servicio.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {mensajeAccion && (
                    <div className={`mt-2 rounded-md px-3 py-2 text-xs font-semibold ${
                      mensajeAccion.tipo === 'ok'
                        ? 'bg-[#E8FF47]/40 text-[#0A0A0A]'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {mensajeAccion.texto}
                    </div>
                  )}

                  {cargandoHorarios ? (
                    <p className="mt-2 text-xs text-[#666]">Cargando horarios...</p>
                  ) : errorHorarios ? (
                    <p className="mt-2 text-xs font-semibold text-red-800">{errorHorarios}</p>
                  ) : horarios.length === 0 ? (
                    <p className="mt-2 text-xs text-[#666]">No hay horarios disponibles.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {horarios.map((horario) => {
                        const reservando = reservandoHorarioId === horario.id
                        const fechaProxima = proximaFecha(horario.dia_semana).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                        })
                        const spotsDisponibles = typeof horario.spots_disponibles === 'number'
                          ? Math.max(horario.spots_disponibles, 0)
                          : null
                        const requiereServicioWellness = esWellness
                        const puedeReservarHorario = !requiereServicioWellness || Boolean(servicioSeleccionadoId)
                        return (
                          <button
                            key={horario.id}
                            type="button"
                            onClick={() => void reservarHorario(horario)}
                            disabled={reservando || !puedeReservarHorario}
                            className="flex w-full items-center justify-between rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-left transition-colors hover:border-[#6B4FE8] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="flex flex-col">
                              <span className="text-sm font-semibold text-[#0A0A0A]">
                                {DIA_LABELS[horario.dia_semana]} · {formatHora(horario.hora_inicio)} - {formatHora(horario.hora_fin)}
                              </span>
                              <span className="text-xs text-[#666]">Próxima fecha: {fechaProxima}</span>
                              {!esWellness && horario.nombre_coach && (
                                <span className="text-xs text-[#666]">Coach: {horario.nombre_coach}</span>
                              )}
                              {!esWellness && horario.tipo_clase && (
                                <span className="text-xs text-[#666]">Tipo de clase: {horario.tipo_clase}</span>
                              )}
                              <span className="text-xs text-[#666]">
                                Spots disponibles: {spotsDisponibles !== null ? spotsDisponibles : 'N/D'}
                              </span>
                            </span>
                            <span className="ml-3 shrink-0 text-xs font-bold text-[#6B4FE8]">
                              {reservando
                                ? 'Reservando...'
                                : !puedeReservarHorario
                                  ? 'Selecciona servicio'
                                  : 'Reservar'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#888]">Visita</h2>
            <button
              type="button"
              onClick={() => {
                if (!puedeUsarBeneficio) {
                  router.push('/planes')
                  return
                }
                if (esCheckinDirecto) {
                  router.push('/dashboard')
                } else {
                  setMenuReservasAbierto(true)
                  void cargarHorarios()
                }
              }}
              className={`mt-2 w-full rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                puedeUsarBeneficio
                  ? 'bg-[#0A0A0A] text-[#E8FF47] hover:bg-[#222]'
                  : 'border border-[#E5E5E5] bg-[#F7F7F7] text-[#888]'
              }`}
            >
              {!puedeUsarBeneficio
                ? bloqueadoPorMembresia
                  ? '🔒 Activar plan'
                  : planRequerido === 'plus'
                    ? 'Requiere Plus'
                    : 'Requiere Total'
                : esCheckinDirecto
                  ? 'Hacer check-in'
                  : 'Reservar'}
            </button>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#888]">Ubicación</h2>
            <p className="mt-2 text-sm text-[#444]">{negocio.direccion}</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-[#E5E5E5]">
              <iframe
                title={`Mapa de ${negocio.nombre}`}
                src={enlaceMapaEmbed(negocio)}
                className="h-52 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={enlaceMapaNegocio(negocio)}
              className="mt-2 inline-flex rounded-lg border border-[#0A0A0A] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-[#E8FF47]"
            >
              Abrir en Google Maps
            </a>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#888]">Contacto</h2>
            <div className="mt-2 space-y-1 text-sm text-[#444]">
              {negocio.telefono_contacto && <p>Teléfono: {negocio.telefono_contacto}</p>}
              {negocio.email_contacto && <p>Email: {negocio.email_contacto}</p>}
              {negocio.horario_atencion && <p>Horario: {negocio.horario_atencion}</p>}
              {negocio.instagram_handle && <p>Instagram: @{negocio.instagram_handle.replace(/^@+/, '')}</p>}
              {negocio.tiktok_handle && <p>TikTok: @{negocio.tiktok_handle.replace(/^@+/, '')}</p>}
              {!negocio.telefono_contacto && !negocio.email_contacto && !negocio.horario_atencion && (
                <p>Sin datos de contacto adicionales.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
