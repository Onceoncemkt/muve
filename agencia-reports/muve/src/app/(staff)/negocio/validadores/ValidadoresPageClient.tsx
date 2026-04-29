'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import BotonCerrarSesion from '@/components/BotonCerrarSesion'

type ValidadorRow = {
  id: string
  nombre: string
  activo: boolean
  ultima_actividad: string | null
  created_at: string
}

function formatFecha(fecha: string | null) {
  if (!fecha) return 'Sin actividad'
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return 'Sin actividad'
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ValidadoresPageClient() {
  const [validadores, setValidadores] = useState<ValidadorRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)
  const [pinVisible, setPinVisible] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function cargarValidadores() {
    setCargando(true)
    try {
      const res = await fetch('/api/negocio/validadores', { cache: 'no-store' })
      const data = await res.json().catch(() => ({})) as { validadores?: ValidadorRow[]; error?: string }
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudieron cargar validadores' })
        setValidadores([])
        return
      }
      setValidadores(data.validadores ?? [])
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al cargar validadores' })
      setValidadores([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargarValidadores()
  }, [])

  async function crearValidador() {
    if (nombreNuevo.trim().length < 2) return
    setGuardando(true)
    setMensaje(null)
    setPinVisible(null)
    try {
      const res = await fetch('/api/negocio/validadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNuevo.trim() }),
      })
      const data = await res.json().catch(() => ({})) as { pin?: string; error?: string }
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo crear el validador' })
        return
      }
      setNombreNuevo('')
      setMostrarModal(false)
      setPinVisible(data.pin ?? null)
      setMensaje({ tipo: 'ok', texto: 'Validador creado correctamente' })
      void cargarValidadores()
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al crear validador' })
    } finally {
      setGuardando(false)
    }
  }

  async function regenerarPin(id: string) {
    setGuardando(true)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/validadores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerar_pin: true }),
      })
      const data = await res.json().catch(() => ({})) as { pin?: string; error?: string }
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo regenerar el PIN' })
        return
      }
      setPinVisible(data.pin ?? null)
      setMensaje({ tipo: 'ok', texto: 'PIN regenerado' })
      void cargarValidadores()
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al regenerar PIN' })
    } finally {
      setGuardando(false)
    }
  }

  async function quitarValidador(id: string) {
    if (!confirm('¿Quitar este validador?')) return
    setGuardando(true)
    setMensaje(null)
    try {
      const res = await fetch(`/api/negocio/validadores/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo quitar el validador' })
        return
      }
      setMensaje({ tipo: 'ok', texto: 'Validador removido' })
      void cargarValidadores()
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al quitar validador' })
    } finally {
      setGuardando(false)
    }
  }

  async function copiarPin() {
    if (!pinVisible) return
    try {
      await navigator.clipboard.writeText(pinVisible)
      setMensaje({ tipo: 'ok', texto: 'PIN copiado al portapapeles' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo copiar el PIN' })
    }
  }

  const totalActivos = useMemo(
    () => validadores.filter((v) => v.activo).length,
    [validadores]
  )

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-10">
      <div className="bg-[#0A0A0A] px-4 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/negocio/dashboard"
              className="text-xs font-bold uppercase tracking-widest text-[#E8FF47] transition-colors hover:text-white"
            >
              MUVET
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-white">Validadores</h1>
            <p className="mt-1 text-sm text-white/50">
              Gestiona recepcionistas con PIN de 4 dígitos para `/validar`.
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
              href="/negocio/horarios"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Horarios
            </Link>
            <Link
              href="/negocio/perfil"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-[#E8FF47] hover:text-[#E8FF47]"
            >
              Perfil
            </Link>
            <BotonCerrarSesion />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
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

        {pinVisible && (
          <div className="rounded-xl border border-[#6B4FE8]/30 bg-[#6B4FE8]/10 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#6B4FE8]">
              PIN (solo se muestra esta vez)
            </p>
            <p className="mt-2 text-4xl font-black tracking-[0.2em] text-[#0A0A0A]">{pinVisible}</p>
            <button
              type="button"
              onClick={copiarPin}
              className="mt-3 rounded-lg bg-[#6B4FE8] px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-[#5a3fd6]"
            >
              Copiar
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <p className="text-sm font-bold text-[#0A0A0A]">
            Activos: <span className="text-[#6B4FE8]">{totalActivos}</span>
          </p>
          <button
            type="button"
            onClick={() => setMostrarModal(true)}
            className="rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222]"
          >
            Agregar validador
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
          <div className="grid grid-cols-4 border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-[11px] font-black uppercase tracking-widest text-[#666]">
            <span>Nombre</span>
            <span>Estado</span>
            <span>Última actividad</span>
            <span className="text-right">Acciones</span>
          </div>

          {cargando ? (
            <p className="px-4 py-5 text-sm text-[#666]">Cargando validadores...</p>
          ) : validadores.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[#666]">Aún no hay validadores.</p>
          ) : (
            <ul className="divide-y divide-[#E5E5E5]">
              {validadores.map((v) => (
                <li key={v.id} className="grid grid-cols-4 items-center gap-2 px-4 py-3 text-sm">
                  <span className="font-semibold text-[#0A0A0A]">{v.nombre}</span>
                  <span>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        v.activo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {v.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </span>
                  <span className="text-xs text-[#666]">{formatFecha(v.ultima_actividad)}</span>
                  <span className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={guardando || !v.activo}
                      onClick={() => regenerarPin(v.id)}
                      className="rounded-md border border-[#6B4FE8] px-2.5 py-1 text-[11px] font-bold text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white disabled:opacity-50"
                    >
                      Regenerar PIN
                    </button>
                    <button
                      type="button"
                      disabled={guardando || !v.activo}
                      onClick={() => quitarValidador(v.id)}
                      className="rounded-md border border-red-300 px-2.5 py-1 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-5">
            <h2 className="text-lg font-black text-[#0A0A0A]">Agregar validador</h2>
            <p className="mt-1 text-sm text-[#666]">Ingresa el nombre de la recepcionista o recepcionista.</p>
            <input
              value={nombreNuevo}
              onChange={(event) => setNombreNuevo(event.target.value)}
              placeholder="Nombre"
              className="mt-4 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                className="rounded-lg border border-[#D0D0D0] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#333] transition-colors hover:bg-[#F5F5F5]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={crearValidador}
                disabled={guardando || nombreNuevo.trim().length < 2}
                className="rounded-lg bg-[#6B4FE8] px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
