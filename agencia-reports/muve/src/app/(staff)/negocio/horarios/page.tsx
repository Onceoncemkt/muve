'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'
import { normalizarCategoriaNegocio } from '@/lib/planes'
import type { Categoria, DiaSemana, Rol, ServicioNegocio } from '@/types'
import { CATEGORIA_LABELS, DIA_LABELS, formatHora } from '@/types'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const CATEGORIA_TABS: Categoria[] = ['clases', 'restaurante', 'estetica', 'gimnasio']
const CATEGORIA_TAB_LABELS: Record<Categoria, string> = {
  clases: 'Clases',
  restaurante: 'Restaurante',
  estetica: 'Estética / Wellness',
  gimnasio: 'Gimnasio',
}
const TIPOS_CLASE_OPCIONES = [
  'Cycling',
  'Pilates Reformer',
  'Yoga',
  'HIIT',
  'Funcional',
  'Barre',
  'Otro',
]
const GYM_HOURS_PREFIX = '__MUVET_GYM_HOURS__'
const DIA_INDEX: Record<DiaSemana, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
}

interface NegocioOption {
  id: string
  nombre: string
  ciudad: string | null
  categoria?: Categoria | null
  monto_maximo_visita?: number | null
  servicios_incluidos?: string | null
}

interface HorarioConSpots {
  id: string
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  nombre_coach: string | null
  tipo_clase: string | null
  capacidad_total: number
  activo: boolean
  spots_disponibles: number
  spots_ocupados: number
}

interface CargaNegociosResponse {
  rol?: Rol
  negocios?: NegocioOption[]
  error?: string
}

interface PerfilActual {
  rol: Rol
}

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null
type ModoVista = 'semana' | 'mes'
type HorarioGeneralGym = { apertura: string; cierre: string }
type EdicionHorarioDraft = {
  dia_semana: DiaSemana
  hora_inicio: string
  hora_fin: string
  capacidad_total: number
  nombre_coach: string
  tipo_clase: string
  activo: boolean
}

function hoyISO() {
  const ahora = new Date()
  const year = ahora.getFullYear()
  const month = String(ahora.getMonth() + 1).padStart(2, '0')
  const day = String(ahora.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fechaDesdeISO(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
}

function diaSemanaDesdeFecha(fecha: Date): DiaSemana {
  const dias: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  return dias[fecha.getDay()]
}

function diaSemanaDesdeISO(fecha: string): DiaSemana {
  return diaSemanaDesdeFecha(fechaDesdeISO(fecha))
}

function inicioSemanaLunes(fechaBase: Date) {
  const inicio = new Date(fechaBase)
  const dia = inicio.getDay()
  const offset = dia === 0 ? -6 : 1 - dia
  inicio.setDate(inicio.getDate() + offset)
  inicio.setHours(12, 0, 0, 0)
  return inicio
}

function sumarDias(fecha: Date, dias: number) {
  const resultado = new Date(fecha)
  resultado.setDate(resultado.getDate() + dias)
  return resultado
}

function formatFecha(fecha: Date) {
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFechaAgenda(fecha: Date) {
  const diaSemana = diaSemanaDesdeFecha(fecha)
  return `${DIA_LABELS[diaSemana]} · ${formatFecha(fecha)}`
}

function parseHorarioGeneralGym(raw: string | null | undefined): HorarioGeneralGym {
  if (typeof raw !== 'string') return { apertura: '06:00', cierre: '22:00' }
  const limpio = raw.trim()
  const regex = new RegExp(`^${GYM_HOURS_PREFIX}:([0-2][0-9]:[0-5][0-9])-([0-2][0-9]:[0-5][0-9])$`)
  const match = limpio.match(regex)
  if (!match) return { apertura: '06:00', cierre: '22:00' }
  return {
    apertura: match[1],
    cierre: match[2],
  }
}

function serializarHorarioGeneralGym(horario: HorarioGeneralGym) {
  return `${GYM_HOURS_PREFIX}:${horario.apertura}-${horario.cierre}`
}

export default function NegocioHorariosPage() {
  const [rol, setRol] = useState<Rol>('staff')
  const [negocios, setNegocios] = useState<NegocioOption[]>([])
  const [negocioId, setNegocioId] = useState('')

  const [horarios, setHorarios] = useState<HorarioConSpots[]>([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [modoVista, setModoVista] = useState<ModoVista>('semana')
  const [fechaVista, setFechaVista] = useState(hoyISO())

  const [edicionId, setEdicionId] = useState<string | null>(null)
  const [edicionDraft, setEdicionDraft] = useState<EdicionHorarioDraft | null>(null)

  const [gymDraft, setGymDraft] = useState<HorarioGeneralGym>({ apertura: '06:00', cierre: '22:00' })
  const [guardandoGym, setGuardandoGym] = useState(false)

  const [formClases, setFormClases] = useState({
    fecha: hoyISO(),
    hora_inicio: '07:00',
    hora_fin: '08:00',
    tipo_clase: TIPOS_CLASE_OPCIONES[0],
    nombre_coach: '',
    capacidad_total: 12,
    dias_recurrentes: [] as DiaSemana[],
    activo: true,
  })

  const [formRestaurante, setFormRestaurante] = useState({
    fecha: hoyISO(),
    hora_apertura: '09:00',
    hora_cierre: '18:00',
    servicio_descuento: '',
    capacidad_total: 20,
    activo: true,
  })

  const [formWellness, setFormWellness] = useState({
    fecha: hoyISO(),
    hora_inicio: '10:00',
    hora_fin: '11:00',
    servicio_incluido: '',
    precio_normal_mxn: '',
    capacidad_total: 8,
    activo: true,
  })

  const negocioSeleccionado = negocios.find((negocio) => negocio.id === negocioId) ?? null
  const categoriaNegocio = normalizarCategoriaNegocio(negocioSeleccionado?.categoria)
  const esGimnasio = categoriaNegocio === 'gimnasio'
  const esClases = categoriaNegocio === 'clases'
  const esRestaurante = categoriaNegocio === 'restaurante'
  const esWellness = categoriaNegocio === 'estetica'

  const inputCls = 'w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8] focus:ring-1 focus:ring-[#6B4FE8]/20'

  useEffect(() => {
    let activo = true

    async function cargarInicial() {
      const perfilActual: PerfilActual = { rol: 'staff' }
      const res = await fetch('/api/negocio/negocios', { cache: 'no-store' })
      const payload = (await res.json().catch(() => ({}))) as CargaNegociosResponse
      if (!activo) return

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: payload.error ?? 'No se pudieron cargar negocios' })
        return
      }

      setRol(payload.rol ?? perfilActual.rol)
      const lista = payload.negocios ?? []
      setNegocios(lista)
      const negocioInicial = lista[0] ?? null
      setNegocioId(negocioInicial?.id ?? '')
      setGymDraft(parseHorarioGeneralGym(negocioInicial?.servicios_incluidos))
    }

    void cargarInicial()
    return () => {
      activo = false
    }
  }, [])


  const cargarHorarios = useCallback(async () => {
    if (!negocioId || categoriaNegocio === 'gimnasio') {
      setHorarios([])
      return
    }

    setCargandoHorarios(true)
    try {
      const res = await fetch(`/api/negocio/horarios?negocio_id=${encodeURIComponent(negocioId)}&incluir_inactivos=true`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar horarios' })
        setHorarios([])
      } else {
        setHorarios((data.horarios ?? []) as HorarioConSpots[])
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al consultar horarios' })
      setHorarios([])
    } finally {
      setCargandoHorarios(false)
    }
  }, [categoriaNegocio, negocioId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarHorarios()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [cargarHorarios])

  const horariosOrdenados = useMemo(() => {
    return horarios.slice().sort((a, b) => {
      const porDia = DIA_INDEX[a.dia_semana] - DIA_INDEX[b.dia_semana]
      if (porDia !== 0) return porDia
      return a.hora_inicio.localeCompare(b.hora_inicio)
    })
  }, [horarios])

  const fechaBaseVista = useMemo(() => fechaDesdeISO(fechaVista), [fechaVista])
  const agendaSemanal = useMemo(() => {
    const inicio = inicioSemanaLunes(fechaBaseVista)
    return Array.from({ length: 7 }, (_, index) => {
      const fecha = sumarDias(inicio, index)
      const dia = diaSemanaDesdeFecha(fecha)
      return {
        fecha,
        horarios: horariosOrdenados.filter((horario) => horario.dia_semana === dia),
      }
    })
  }, [fechaBaseVista, horariosOrdenados])

  const calendarioMensual = useMemo(() => {
    const inicioMes = new Date(fechaBaseVista.getFullYear(), fechaBaseVista.getMonth(), 1, 12, 0, 0, 0)
    const finMes = new Date(fechaBaseVista.getFullYear(), fechaBaseVista.getMonth() + 1, 0, 12, 0, 0, 0)
    const offsetInicio = (inicioMes.getDay() + 6) % 7
    const totalDias = finMes.getDate()
    const celdas: Array<Date | null> = []

    for (let i = 0; i < offsetInicio; i += 1) {
      celdas.push(null)
    }
    for (let dia = 1; dia <= totalDias; dia += 1) {
      celdas.push(new Date(fechaBaseVista.getFullYear(), fechaBaseVista.getMonth(), dia, 12, 0, 0, 0))
    }
    while (celdas.length % 7 !== 0) {
      celdas.push(null)
    }
    return celdas
  }, [fechaBaseVista])

  async function sincronizarServicioWellness(nombre: string, precioNormalMxn: number) {
    if (!negocioId) return
    const nombreNormalizado = nombre.trim()
    if (!nombreNormalizado) return

    const resServicios = await fetch(`/api/negocio/servicios?negocio_id=${encodeURIComponent(negocioId)}`, {
      cache: 'no-store',
    })
    const payloadServicios = await resServicios.json().catch(() => ({}))
    const servicios = (payloadServicios.servicios ?? []) as ServicioNegocio[]
    const existente = servicios.find(
      (servicio) => servicio.nombre.trim().toLowerCase() === nombreNormalizado.toLowerCase()
    )

    if (existente) {
      await fetch(`/api/negocio/servicios/${existente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreNormalizado,
          precio_normal_mxn: precioNormalMxn,
          activo: true,
        }),
      })
      return
    }

    await fetch('/api/negocio/servicios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        negocio_id: negocioId,
        nombre: nombreNormalizado,
        precio_normal_mxn: precioNormalMxn,
        descripcion: null,
      }),
    })
  }

  async function crearHorariosPorCategoria() {
    if (!negocioId || !categoriaNegocio) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un negocio' })
      return
    }
    if (categoriaNegocio === 'gimnasio') {
      setMensaje({ tipo: 'error', texto: 'Los gimnasios no requieren horarios reservables' })
      return
    }

    const payloads: Array<Record<string, unknown>> = []
    let precioWellness = 0
    let nombreServicioWellness = ''

    if (categoriaNegocio === 'clases') {
      if (formClases.capacidad_total < 1) {
        setMensaje({ tipo: 'error', texto: 'La capacidad debe ser mayor a 0' })
        return
      }
      if (formClases.hora_inicio >= formClases.hora_fin) {
        setMensaje({ tipo: 'error', texto: 'La hora de fin debe ser mayor a la hora de inicio' })
        return
      }

      const diasObjetivo = formClases.dias_recurrentes.length > 0
        ? formClases.dias_recurrentes
        : [diaSemanaDesdeISO(formClases.fecha)]

      for (const dia of diasObjetivo) {
        payloads.push({
          negocio_id: negocioId,
          dia_semana: dia,
          hora_inicio: formClases.hora_inicio,
          hora_fin: formClases.hora_fin,
          tipo_clase: formClases.tipo_clase,
          nombre_coach: formClases.nombre_coach,
          capacidad_total: formClases.capacidad_total,
          activo: formClases.activo,
        })
      }
    }

    if (categoriaNegocio === 'restaurante') {
      if (!formRestaurante.servicio_descuento.trim()) {
        setMensaje({ tipo: 'error', texto: 'Especifica el servicio o descuento' })
        return
      }
      if (formRestaurante.capacidad_total < 1) {
        setMensaje({ tipo: 'error', texto: 'La capacidad debe ser mayor a 0' })
        return
      }
      if (formRestaurante.hora_apertura >= formRestaurante.hora_cierre) {
        setMensaje({ tipo: 'error', texto: 'La hora de cierre debe ser mayor a la de apertura' })
        return
      }

      payloads.push({
        negocio_id: negocioId,
        dia_semana: diaSemanaDesdeISO(formRestaurante.fecha),
        hora_inicio: formRestaurante.hora_apertura,
        hora_fin: formRestaurante.hora_cierre,
        tipo_clase: formRestaurante.servicio_descuento,
        nombre_coach: null,
        capacidad_total: formRestaurante.capacidad_total,
        activo: formRestaurante.activo,
      })
    }

    if (categoriaNegocio === 'estetica') {
      if (!formWellness.servicio_incluido.trim()) {
        setMensaje({ tipo: 'error', texto: 'Especifica el servicio incluido' })
        return
      }
      const precio = Number.parseInt(formWellness.precio_normal_mxn, 10)
      if (!Number.isFinite(precio) || precio < 0) {
        setMensaje({ tipo: 'error', texto: 'Precio normal inválido' })
        return
      }
      if (formWellness.capacidad_total < 1) {
        setMensaje({ tipo: 'error', texto: 'La capacidad debe ser mayor a 0' })
        return
      }
      if (formWellness.hora_inicio >= formWellness.hora_fin) {
        setMensaje({ tipo: 'error', texto: 'La hora de fin debe ser mayor a la hora de inicio' })
        return
      }

      precioWellness = precio
      nombreServicioWellness = formWellness.servicio_incluido.trim()

      payloads.push({
        negocio_id: negocioId,
        dia_semana: diaSemanaDesdeISO(formWellness.fecha),
        hora_inicio: formWellness.hora_inicio,
        hora_fin: formWellness.hora_fin,
        tipo_clase: formWellness.servicio_incluido,
        nombre_coach: null,
        capacidad_total: formWellness.capacidad_total,
        activo: formWellness.activo,
      })
    }

    if (payloads.length === 0) return

    setGuardando(true)
    setMensaje(null)
    try {
      let creados = 0
      for (const payload of payloads) {
        const res = await fetch('/api/negocio/horarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo crear el horario' })
          return
        }
        creados += 1
      }

      if (categoriaNegocio === 'estetica') {
        await sincronizarServicioWellness(nombreServicioWellness, precioWellness)
      }

      setMensaje({
        tipo: 'ok',
        texto: creados === 1
          ? 'Horario creado correctamente'
          : `Se crearon ${creados} horarios recurrentes`,
      })
      setMostrarForm(false)
      void cargarHorarios()
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al crear horarios' })
    } finally {
      setGuardando(false)
    }
  }

  async function guardarHorarioGeneralGimnasio() {
    if (!negocioId) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un negocio' })
      return
    }
    if (gymDraft.apertura >= gymDraft.cierre) {
      setMensaje({ tipo: 'error', texto: 'La hora de cierre debe ser mayor a la de apertura' })
      return
    }

    setGuardandoGym(true)
    setMensaje(null)
    try {
      const serializado = serializarHorarioGeneralGym(gymDraft)
      const res = await fetch('/api/negocio/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id: negocioId,
          servicios_incluidos: serializado,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar el horario general' })
        return
      }

      setNegocios((prev) => prev.map((negocio) => (
        negocio.id === negocioId
          ? { ...negocio, servicios_incluidos: serializado }
          : negocio
      )))
      setMensaje({ tipo: 'ok', texto: 'Horario general de gimnasio actualizado' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al guardar horario general' })
    } finally {
      setGuardandoGym(false)
    }
  }

  async function guardarEdicionHorario() {
    if (!edicionId || !edicionDraft) return
    if (edicionDraft.capacidad_total < 1) {
      setMensaje({ tipo: 'error', texto: 'La capacidad debe ser mayor a 0' })
      return
    }
    if (edicionDraft.hora_inicio >= edicionDraft.hora_fin) {
      setMensaje({ tipo: 'error', texto: 'La hora de fin debe ser mayor a la hora de inicio' })
      return
    }
    if (!categoriaNegocio) return

    setActualizandoId(edicionId)
    setMensaje(null)
    try {
      const payload: Record<string, unknown> = {
        dia_semana: edicionDraft.dia_semana,
        hora_inicio: edicionDraft.hora_inicio,
        hora_fin: edicionDraft.hora_fin,
        capacidad_total: edicionDraft.capacidad_total,
        activo: edicionDraft.activo,
      }

      if (categoriaNegocio === 'clases') {
        payload.nombre_coach = edicionDraft.nombre_coach
        payload.tipo_clase = edicionDraft.tipo_clase
      } else {
        payload.nombre_coach = null
        payload.tipo_clase = edicionDraft.tipo_clase
      }

      const res = await fetch(`/api/negocio/horarios/${edicionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo actualizar el horario' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Horario actualizado' })
        setEdicionId(null)
        setEdicionDraft(null)
        void cargarHorarios()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al actualizar el horario' })
    } finally {
      setActualizandoId(null)
    }
  }

  async function eliminarHorario(horarioId: string) {
    if (!confirm('¿Eliminar este horario de forma permanente?')) return

    setActualizandoId(horarioId)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/horarios/${horarioId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo eliminar el horario' })
      } else {
        setMensaje({ tipo: 'ok', texto: 'Horario eliminado' })
        if (edicionId === horarioId) {
          setEdicionId(null)
          setEdicionDraft(null)
        }
        void cargarHorarios()
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al eliminar horario' })
    } finally {
      setActualizandoId(null)
    }
  }

  function abrirEdicionHorario(horario: HorarioConSpots) {
    setEdicionId(horario.id)
    setEdicionDraft({
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio.slice(0, 5),
      hora_fin: horario.hora_fin.slice(0, 5),
      capacidad_total: horario.capacidad_total,
      nombre_coach: horario.nombre_coach ?? '',
      tipo_clase: horario.tipo_clase ?? '',
      activo: horario.activo,
    })
  }

  function cambiarCategoriaPorTab(categoria: Categoria) {
    if (categoriaNegocio === categoria) return
    const negocioDeCategoria = negocios.find(
      (negocio) => normalizarCategoriaNegocio(negocio.categoria) === categoria
    )
    if (!negocioDeCategoria) {
      setMensaje({
        tipo: 'error',
        texto: `No tienes negocios en la categoría ${CATEGORIA_LABELS[categoria]}.`,
      })
      return
    }
    setMensaje(null)
    setNegocioId(negocioDeCategoria.id)
    setGymDraft(parseHorarioGeneralGym(negocioDeCategoria.servicios_incluidos))
    setMostrarForm(false)
    setEdicionId(null)
    setEdicionDraft(null)
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/negocio/dashboard"
              className="text-xs font-bold uppercase tracking-widest text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-white">Gestión de horarios</h1>
            <p className="mt-1 text-sm text-white/50">
              Administra horarios por categoría con vista semanal y mensual.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/negocio/dashboard"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Dashboard
            </Link>
            <Link
              href="/negocio/perfil"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Perfil negocio
            </Link>
            <BotonCerrarSesion />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
        <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[#888]">Negocio</label>
            <select
              value={negocioId}
              onChange={(event) => {
                const siguienteNegocioId = event.target.value
                setNegocioId(siguienteNegocioId)
                const negocioSiguiente = negocios.find((negocio) => negocio.id === siguienteNegocioId)
                setGymDraft(parseHorarioGeneralGym(negocioSiguiente?.servicios_incluidos))
                setMensaje(null)
                setMostrarForm(false)
                setEdicionId(null)
                setEdicionDraft(null)
              }}
              className={inputCls}
            >
              <option value="">Selecciona un negocio...</option>
              {negocios.map((negocio) => (
                <option key={negocio.id} value={negocio.id}>
                  {negocio.ciudad
                    ? `${negocio.nombre} — ${negocio.ciudad.charAt(0).toUpperCase() + negocio.ciudad.slice(1)}`
                    : negocio.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[#888]">Pestañas por categoría</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORIA_TABS.map((categoria) => {
                const activa = categoria === categoriaNegocio
                const existeNegocio = negocios.some(
                  (negocio) => normalizarCategoriaNegocio(negocio.categoria) === categoria
                )
                return (
                  <button
                    key={categoria}
                    type="button"
                    onClick={() => cambiarCategoriaPorTab(categoria)}
                    disabled={!existeNegocio}
                    className={`rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                      activa
                        ? 'border-[#6B4FE8] bg-[#6B4FE8] text-white'
                        : existeNegocio
                          ? 'border-[#E5E5E5] bg-white text-[#555] hover:border-[#6B4FE8] hover:text-[#6B4FE8]'
                          : 'cursor-not-allowed border-[#E5E5E5] bg-[#FAFAFA] text-[#B0B0B0]'
                    }`}
                  >
                    {CATEGORIA_TAB_LABELS[categoria]}
                  </button>
                )
              })}
            </div>
          </div>

          {negocioSeleccionado && (
            <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-xs text-[#555]">
              <p>
                <span className="font-bold text-[#0A0A0A]">Categoría:</span>{' '}
                {categoriaNegocio ? CATEGORIA_LABELS[categoriaNegocio] : 'Sin categoría'}
              </p>
            </div>
          )}
        </div>

        {mensaje && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-semibold ${
              mensaje.tipo === 'ok'
                ? 'bg-[#E8FF47]/20 text-[#0A0A0A] ring-1 ring-[#E8FF47]'
                : 'bg-red-50 text-red-700 ring-1 ring-red-200'
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {!negocioId && (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white p-6 text-center text-sm text-[#888]">
            Selecciona un negocio para gestionar horarios.
          </div>
        )}

        {negocioId && esGimnasio && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#0A0A0A]">Operación de gimnasio</h2>
            <p className="mt-2 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-sm text-[#444]">
              Los gimnasios no requieren horarios. Los usuarios llegan directo y escanean su QR.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Apertura general</label>
                <input
                  type="time"
                  value={gymDraft.apertura}
                  onChange={(event) => setGymDraft((prev) => ({ ...prev, apertura: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Cierre general</label>
                <input
                  type="time"
                  value={gymDraft.cierre}
                  onChange={(event) => setGymDraft((prev) => ({ ...prev, cierre: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={guardarHorarioGeneralGimnasio}
                  disabled={guardandoGym}
                  className="w-full rounded-lg bg-[#6B4FE8] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-40"
                >
                  {guardandoGym ? 'Guardando...' : 'Guardar horario general'}
                </button>
              </div>
            </div>
          </div>
        )}

        {negocioId && !esGimnasio && (
          <>
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">
                  {esClases && 'Nuevo horario de clases'}
                  {esRestaurante && 'Nuevo horario de restaurante'}
                  {esWellness && 'Nueva disponibilidad wellness'}
                </h2>
                <button
                  onClick={() => setMostrarForm((prev) => !prev)}
                  className="rounded-lg bg-[#6B4FE8] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#5a3fd6]"
                >
                  {mostrarForm ? 'Cancelar' : '+ Crear horario'}
                </button>
              </div>

              {mostrarForm && (
                <div className="space-y-3 rounded-lg border border-[#6B4FE8]/20 bg-[#6B4FE8]/5 p-3">
                  {esClases && (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Fecha</label>
                          <input
                            type="date"
                            value={formClases.fecha}
                            onChange={(event) => setFormClases((prev) => ({ ...prev, fecha: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora inicio</label>
                          <input
                            type="time"
                            value={formClases.hora_inicio}
                            onChange={(event) => setFormClases((prev) => ({ ...prev, hora_inicio: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora fin</label>
                          <input
                            type="time"
                            value={formClases.hora_fin}
                            onChange={(event) => setFormClases((prev) => ({ ...prev, hora_fin: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Capacidad</label>
                          <input
                            type="number"
                            min={1}
                            value={formClases.capacidad_total}
                            onChange={(event) => setFormClases((prev) => ({ ...prev, capacidad_total: Number(event.target.value) }))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Tipo de clase</label>
                          <select
                            value={formClases.tipo_clase}
                            onChange={(event) => setFormClases((prev) => ({ ...prev, tipo_clase: event.target.value }))}
                            className={inputCls}
                          >
                            {TIPOS_CLASE_OPCIONES.map((tipoClase) => (
                              <option key={tipoClase} value={tipoClase}>
                                {tipoClase}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Coach / instructor</label>
                          <input
                            type="text"
                            value={formClases.nombre_coach}
                            onChange={(event) => setFormClases((prev) => ({ ...prev, nombre_coach: event.target.value }))}
                            placeholder="Ej. Mariana López"
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#888]">
                          Días recurrentes (opcional)
                        </p>
                        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
                          {DIAS.map((dia) => {
                            const checked = formClases.dias_recurrentes.includes(dia)
                            return (
                              <label
                                key={dia}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                                  checked ? 'border-[#6B4FE8] bg-[#6B4FE8]/10 text-[#4d35c8]' : 'border-[#E5E5E5] text-[#666]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setFormClases((prev) => ({
                                      ...prev,
                                      dias_recurrentes: checked
                                        ? prev.dias_recurrentes.filter((d) => d !== dia)
                                        : [...prev.dias_recurrentes, dia],
                                    }))
                                  }}
                                  className="accent-[#6B4FE8]"
                                />
                                {DIA_LABELS[dia]}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#444]">
                        <input
                          type="checkbox"
                          checked={formClases.activo}
                          onChange={(event) => setFormClases((prev) => ({ ...prev, activo: event.target.checked }))}
                          className="accent-[#6B4FE8]"
                        />
                        Activo
                      </label>
                    </>
                  )}

                  {esRestaurante && (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Fecha</label>
                          <input
                            type="date"
                            value={formRestaurante.fecha}
                            onChange={(event) => setFormRestaurante((prev) => ({ ...prev, fecha: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora apertura</label>
                          <input
                            type="time"
                            value={formRestaurante.hora_apertura}
                            onChange={(event) => setFormRestaurante((prev) => ({ ...prev, hora_apertura: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora cierre</label>
                          <input
                            type="time"
                            value={formRestaurante.hora_cierre}
                            onChange={(event) => setFormRestaurante((prev) => ({ ...prev, hora_cierre: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Capacidad</label>
                          <input
                            type="number"
                            min={1}
                            value={formRestaurante.capacidad_total}
                            onChange={(event) => setFormRestaurante((prev) => ({ ...prev, capacidad_total: Number(event.target.value) }))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">
                          Servicio o descuento
                        </label>
                        <input
                          type="text"
                          value={formRestaurante.servicio_descuento}
                          onChange={(event) => setFormRestaurante((prev) => ({ ...prev, servicio_descuento: event.target.value }))}
                          placeholder="Ej. Hasta $100 en consumo"
                          className={inputCls}
                        />
                      </div>
                    </>
                  )}

                  {esWellness && (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Fecha</label>
                          <input
                            type="date"
                            value={formWellness.fecha}
                            onChange={(event) => setFormWellness((prev) => ({ ...prev, fecha: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora inicio</label>
                          <input
                            type="time"
                            value={formWellness.hora_inicio}
                            onChange={(event) => setFormWellness((prev) => ({ ...prev, hora_inicio: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Hora fin</label>
                          <input
                            type="time"
                            value={formWellness.hora_fin}
                            onChange={(event) => setFormWellness((prev) => ({ ...prev, hora_fin: event.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Capacidad</label>
                          <input
                            type="number"
                            min={1}
                            value={formWellness.capacidad_total}
                            onChange={(event) => setFormWellness((prev) => ({ ...prev, capacidad_total: Number(event.target.value) }))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">Servicio incluido</label>
                          <input
                            type="text"
                            value={formWellness.servicio_incluido}
                            onChange={(event) => setFormWellness((prev) => ({ ...prev, servicio_incluido: event.target.value }))}
                            placeholder="Ej. Manicure básica"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-[#888]">
                            Precio normal del servicio (MXN)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={formWellness.precio_normal_mxn}
                            onChange={(event) => setFormWellness((prev) => ({ ...prev, precio_normal_mxn: event.target.value }))}
                            placeholder="Ej. 350"
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    onClick={crearHorariosPorCategoria}
                    disabled={guardando}
                    className="w-full rounded-lg bg-[#0A0A0A] py-2.5 text-sm font-bold text-[#E8FF47] transition-colors hover:bg-[#222] disabled:opacity-40"
                  >
                    {guardando ? 'Guardando...' : 'Guardar horario'}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">Vista de horarios</h2>
                  <p className="mt-1 text-xs text-[#666]">
                    Tabla/calendario con filtro por semana o mes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModoVista('semana')}
                    className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-widest ${
                      modoVista === 'semana'
                        ? 'bg-[#6B4FE8] text-white'
                        : 'border border-[#E5E5E5] bg-white text-[#555]'
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVista('mes')}
                    className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-widest ${
                      modoVista === 'mes'
                        ? 'bg-[#6B4FE8] text-white'
                        : 'border border-[#E5E5E5] bg-white text-[#555]'
                    }`}
                  >
                    Mes
                  </button>
                  <input
                    type="date"
                    value={fechaVista}
                    onChange={(event) => setFechaVista(event.target.value)}
                    className="rounded-md border border-[#E5E5E5] bg-white px-2 py-2 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                  />
                </div>
              </div>

              <div className="mt-4">
                {modoVista === 'semana' ? (
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-[#888]">Agenda semanal</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {agendaSemanal.map(({ fecha, horarios: horariosDia }) => (
                        <div key={fecha.toISOString()} className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                          <p className="text-[11px] font-black uppercase tracking-widest text-[#555]">
                            {formatFechaAgenda(fecha)}
                          </p>
                          {horariosDia.length === 0 ? (
                            <p className="mt-2 text-xs text-[#888]">Sin horarios</p>
                          ) : (
                            <div className="mt-2 space-y-1.5">
                              {horariosDia.map((horario) => (
                                <div key={`${horario.id}-${fecha.toISOString()}`} className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1.5">
                                  <p className="text-xs font-semibold text-[#0A0A0A]">
                                    {formatHora(horario.hora_inicio)} - {formatHora(horario.hora_fin)}
                                  </p>
                                  {horario.tipo_clase && (
                                    <p className="text-[11px] text-[#666]">{horario.tipo_clase}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#888]">Calendario mensual</p>
                    <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-[#888]">
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
                        <div key={dia} className="pb-1">{dia}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {calendarioMensual.map((fecha, index) => {
                        if (!fecha) {
                          return <div key={`empty-${index}`} className="min-h-24 rounded-lg border border-transparent bg-transparent" />
                        }
                        const dia = diaSemanaDesdeFecha(fecha)
                        const horariosDia = horariosOrdenados.filter((horario) => horario.dia_semana === dia)
                        return (
                          <div key={fecha.toISOString()} className="min-h-24 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-2">
                            <p className="text-[11px] font-black text-[#444]">{fecha.getDate()}</p>
                            {horariosDia.length === 0 ? (
                              <p className="mt-1 text-[10px] text-[#999]">Sin horarios</p>
                            ) : (
                              <>
                                <p className="mt-1 text-[10px] font-semibold text-[#6B4FE8]">
                                  {horariosDia.length} horario{horariosDia.length === 1 ? '' : 's'}
                                </p>
                                <div className="mt-1 space-y-1">
                                  {horariosDia.slice(0, 2).map((horario) => (
                                    <p key={`${horario.id}-${fecha.toISOString()}`} className="text-[10px] text-[#555]">
                                      {formatHora(horario.hora_inicio)}
                                    </p>
                                  ))}
                                  {horariosDia.length > 2 && (
                                    <p className="text-[10px] text-[#777]">+{horariosDia.length - 2} más</p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-[#888]">Todos los horarios creados</h3>
                {cargandoHorarios ? (
                  <p className="text-sm text-[#888]">Cargando horarios...</p>
                ) : horariosOrdenados.length === 0 ? (
                  <p className="text-sm text-[#888]">Aún no hay horarios registrados.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E5E5] text-[11px] uppercase tracking-widest text-[#888]">
                          <th className="px-2 py-2 font-black">Día</th>
                          <th className="px-2 py-2 font-black">Inicio</th>
                          <th className="px-2 py-2 font-black">Fin</th>
                          <th className="px-2 py-2 font-black">
                            {esClases ? 'Tipo de clase' : esRestaurante ? 'Servicio / descuento' : 'Servicio incluido'}
                          </th>
                          {esClases && <th className="px-2 py-2 font-black">Coach</th>}
                          <th className="px-2 py-2 font-black">Capacidad</th>
                          <th className="px-2 py-2 font-black">Spots hoy</th>
                          <th className="px-2 py-2 font-black">Estado</th>
                          <th className="px-2 py-2 font-black">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {horariosOrdenados.map((horario) => {
                          const editando = edicionId === horario.id && edicionDraft !== null
                          return (
                            <tr key={horario.id} className="border-b border-[#F0F0F0] align-middle last:border-b-0">
                              <td className="px-2 py-2">
                                {editando ? (
                                  <select
                                    value={edicionDraft.dia_semana}
                                    onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, dia_semana: event.target.value as DiaSemana } : prev)}
                                    className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                                  >
                                    {DIAS.map((dia) => (
                                      <option key={dia} value={dia}>
                                        {DIA_LABELS[dia]}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="font-semibold text-[#0A0A0A]">{DIA_LABELS[horario.dia_semana]}</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                {editando ? (
                                  <input
                                    type="time"
                                    value={edicionDraft.hora_inicio}
                                    onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, hora_inicio: event.target.value } : prev)}
                                    className="w-24 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                                  />
                                ) : (
                                  <span className="text-[#444]">{formatHora(horario.hora_inicio)}</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                {editando ? (
                                  <input
                                    type="time"
                                    value={edicionDraft.hora_fin}
                                    onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, hora_fin: event.target.value } : prev)}
                                    className="w-24 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                                  />
                                ) : (
                                  <span className="text-[#444]">{formatHora(horario.hora_fin)}</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                {editando ? (
                                  esClases ? (
                                    <select
                                      value={edicionDraft.tipo_clase}
                                      onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, tipo_clase: event.target.value } : prev)}
                                      className="w-40 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                                    >
                                      {TIPOS_CLASE_OPCIONES.map((tipoClase) => (
                                        <option key={tipoClase} value={tipoClase}>
                                          {tipoClase}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={edicionDraft.tipo_clase}
                                      onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, tipo_clase: event.target.value } : prev)}
                                      className="w-52 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                                    />
                                  )
                                ) : (
                                  <span className="text-[#444]">{horario.tipo_clase || '—'}</span>
                                )}
                              </td>
                              {esClases && (
                                <td className="px-2 py-2">
                                  {editando ? (
                                    <input
                                      type="text"
                                      value={edicionDraft.nombre_coach}
                                      onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, nombre_coach: event.target.value } : prev)}
                                      className="w-40 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                                    />
                                  ) : (
                                    <span className="text-[#444]">{horario.nombre_coach || '—'}</span>
                                  )}
                                </td>
                              )}
                              <td className="px-2 py-2">
                                {editando ? (
                                  <input
                                    type="number"
                                    min={1}
                                    value={edicionDraft.capacidad_total}
                                    onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, capacidad_total: Number(event.target.value) } : prev)}
                                    className="w-20 rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
                                  />
                                ) : (
                                  <span className="text-[#444]">{horario.capacidad_total}</span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-[#444]">
                                {Math.max(horario.spots_disponibles, 0)} / {horario.capacidad_total}
                              </td>
                              <td className="px-2 py-2">
                                {editando ? (
                                  <label className="inline-flex items-center gap-1 text-xs font-semibold text-[#444]">
                                    <input
                                      type="checkbox"
                                      checked={edicionDraft.activo}
                                      onChange={(event) => setEdicionDraft((prev) => prev ? { ...prev, activo: event.target.checked } : prev)}
                                      className="accent-[#6B4FE8]"
                                    />
                                    Activo
                                  </label>
                                ) : (
                                  <span
                                    className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                                      horario.activo
                                        ? 'bg-[#E8FF47]/30 text-[#0A0A0A]'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {horario.activo ? 'Activo' : 'Inactivo'}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {editando ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void guardarEdicionHorario()}
                                        disabled={actualizandoId === horario.id}
                                        className="rounded-md bg-[#0A0A0A] px-2 py-1 text-[10px] font-bold uppercase text-[#E8FF47] transition-colors hover:bg-[#222] disabled:opacity-40"
                                      >
                                        Guardar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEdicionId(null)
                                          setEdicionDraft(null)
                                        }}
                                        className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-[10px] font-bold uppercase text-[#666] transition-colors hover:border-[#999]"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => abrirEdicionHorario(horario)}
                                        className="rounded-md bg-[#6B4FE8] px-2 py-1 text-[10px] font-bold uppercase text-white transition-colors hover:bg-[#5a3fd6]"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void eliminarHorario(horario.id)}
                                        disabled={actualizandoId === horario.id || rol !== 'admin'}
                                        className="rounded-md bg-red-100 px-2 py-1 text-[10px] font-bold uppercase text-red-700 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Eliminar
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
