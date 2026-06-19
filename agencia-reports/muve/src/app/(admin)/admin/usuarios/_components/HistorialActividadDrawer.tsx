'use client'

import { useEffect, useState } from 'react'
import { formatHora } from '@/types'

type ItemHistorial = {
  fecha: string
  negocio: string
  tipo: string
  hora: string | null
  estado: string
  escaneado: boolean
  monto: number | null
}

type Respuesta = {
  resumen: { total: number; asistencias: number; noShows: number; porcentajeAsistencia: number | null }
  items: ItemHistorial[]
  page: number
  totalPaginas: number
  totalItems: number
}

function montoMXN(valor: number | null) {
  if (valor == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor)
}

function fechaCorta(fecha: string) {
  const d = new Date(fecha.length <= 10 ? `${fecha}T00:00:00` : fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' })
}

function EstadoBadge({ estado }: { estado: string }) {
  const mapa: Record<string, { label: string; className: string }> = {
    completada: { label: 'Asistió', className: 'bg-green-500/20 text-green-300 ring-1 ring-green-500/40' },
    no_show: { label: 'No asistió', className: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40' },
    cancelada: { label: 'Cancelada', className: 'bg-white/10 text-white/60 ring-1 ring-white/15' },
    confirmada: { label: 'Pendiente', className: 'bg-[#E8FF47]/20 text-[#E8FF47] ring-1 ring-[#E8FF47]/40' },
  }
  const badge = mapa[estado] ?? { label: estado, className: 'bg-white/10 text-white/60' }
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
}

export default function HistorialActividadDrawer({
  userId,
  userNombre,
  onClose,
}: {
  userId: string
  userNombre: string
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reinicia a página 1 cuando cambia el usuario.
  useEffect(() => { setPage(1) }, [userId])

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    fetch(`/api/admin/usuarios/${userId}/historial?page=${page}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar el historial')
        return json as Respuesta
      })
      .then((json) => { if (activo) setData(json) })
      .catch((e) => { if (activo) setError(e.message ?? 'Error de conexión') })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [userId, page])

  const resumen = data?.resumen

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="flex-1 bg-black/60" />
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#111111] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/45">Historial de actividad</p>
            <h2 className="text-lg font-black text-white">{userNombre}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-white/15 px-2.5 py-1 text-sm text-white/70 hover:border-[#6B4FE8] hover:text-white">✕</button>
        </div>

        {/* Resumen */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#151515] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Reservaciones</p>
            <p className="mt-1 text-xl font-black text-white">{resumen?.total ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#151515] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Asistencias</p>
            <p className="mt-1 text-xl font-black text-green-300">{resumen?.asistencias ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#151515] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">No-shows</p>
            <p className="mt-1 text-xl font-black text-red-300">{resumen?.noShows ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#151515] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">% Asistencia</p>
            <p className="mt-1 text-xl font-black text-[#E8FF47]">{resumen?.porcentajeAsistencia == null ? '—' : `${resumen.porcentajeAsistencia}%`}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 ring-1 ring-red-500/30">{error}</div>
        )}

        {cargando && !data && <p className="py-8 text-center text-sm text-white/50">Cargando…</p>}

        {data && (
          <>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full border-collapse bg-[#111111]">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Negocio</th>
                    <th className="px-3 py-2.5">Clase / servicio</th>
                    <th className="px-3 py-2.5">Hora</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={`${item.fecha}-${i}`} className="border-b border-white/10 text-sm text-white/90">
                      <td className="whitespace-nowrap px-3 py-2.5 text-white/75">{fechaCorta(item.fecha)}</td>
                      <td className="px-3 py-2.5 font-semibold">{item.negocio}</td>
                      <td className="px-3 py-2.5 capitalize text-white/75">{item.tipo}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-white/75">{item.hora ? formatHora(item.hora) : '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <EstadoBadge estado={item.estado} />
                          {item.escaneado && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#6B4FE8]">✓ Escaneado</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#E8FF47]">{montoMXN(item.monto)}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-white/50">Este usuario no tiene reservaciones.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data.totalPaginas > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/45">
                  Página {data.page} de {data.totalPaginas} · {data.totalItems} reservaciones
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={data.page <= 1 || cargando}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/80 disabled:opacity-40 enabled:hover:border-[#6B4FE8]"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(data.totalPaginas, p + 1))}
                    disabled={data.page >= data.totalPaginas || cargando}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/80 disabled:opacity-40 enabled:hover:border-[#6B4FE8]"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
