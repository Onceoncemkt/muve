'use client'

import { useEffect, useMemo, useState } from 'react'
import { CIUDAD_LABELS, type Ciudad, type EstadoPreregistro } from '@/types'

type PreregistroItem = {
  id: string
  email: string
  nombre: string | null
  ciudad: string
  codigo_descuento: string
  estado: EstadoPreregistro
  created_at: string
}

type StatsPayload = {
  total: number
  porCiudad: Array<{ ciudad: Ciudad; label: string; total: number }>
  porEstado: Array<{ estado: EstadoPreregistro; total: number }>
}

const CIUDADES: Array<'todas' | Ciudad> = ['todas', 'tulancingo', 'pachuca', 'ensenada', 'tijuana']
const ESTADOS: Array<'todos' | EstadoPreregistro> = ['todos', 'pendiente', 'convertido', 'cancelado']

function badgeEstado(estado: EstadoPreregistro) {
  if (estado === 'convertido') return 'bg-[#E8FF47]/20 text-[#E8FF47]'
  if (estado === 'cancelado') return 'bg-red-200/20 text-red-300'
  return 'bg-[#6B4FE8]/20 text-[#CBBEFF]'
}

export default function AdminPreregistrosClient() {
  const [items, setItems] = useState<PreregistroItem[]>([])
  const [stats, setStats] = useState<StatsPayload>({ total: 0, porCiudad: [], porEstado: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ciudad, setCiudad] = useState<'todas' | Ciudad>('todas')
  const [estado, setEstado] = useState<'todos' | EstadoPreregistro>('todos')
  const [query, setQuery] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (ciudad !== 'todas') params.set('ciudad', ciudad)
    if (estado !== 'todos') params.set('estado', estado)
    if (query.trim()) params.set('q', query.trim())
    return params.toString()
  }, [ciudad, estado, query])

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/preregistros${queryString ? `?${queryString}` : ''}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!activo) return
          setError(data?.error ?? 'No se pudieron cargar los preregistros')
          setItems([])
          setStats({ total: 0, porCiudad: [], porEstado: [] })
          return
        }
        if (!activo) return
        setItems((data.items ?? []) as PreregistroItem[])
        setStats((data.stats ?? { total: 0, porCiudad: [], porEstado: [] }) as StatsPayload)
      } catch {
        if (!activo) return
        setError('Error de conexión al cargar preregistros')
      } finally {
        if (activo) setCargando(false)
      }
    }
    void cargar()
    return () => { activo = false }
  }, [queryString])

  const csvHref = `/api/admin/preregistros?${queryString ? `${queryString}&` : ''}format=csv`

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#E8FF47]">Total preregistros</p>
          <p className="mt-2 text-3xl font-black text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#E8FF47]">Por ciudad</p>
          <div className="mt-2 space-y-1 text-sm text-white/80">
            {stats.porCiudad.map((row) => (
              <p key={row.ciudad}>{row.label}: <span className="font-black text-white">{row.total}</span></p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#E8FF47]">Por estado</p>
          <div className="mt-2 space-y-1 text-sm text-white/80">
            {stats.porEstado.map((row) => (
              <p key={row.estado}>{row.estado}: <span className="font-black text-white">{row.total}</span></p>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por email"
            className="rounded-lg border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          />
          <select
            value={ciudad}
            onChange={(event) => setCiudad(event.target.value as 'todas' | Ciudad)}
            className="rounded-lg border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          >
            {CIUDADES.map((item) => (
              <option key={item} value={item}>
                {item === 'todas' ? 'Todas las ciudades' : CIUDAD_LABELS[item]}
              </option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value as 'todos' | EstadoPreregistro)}
            className="rounded-lg border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
          >
            {ESTADOS.map((item) => (
              <option key={item} value={item}>
                {item === 'todos' ? 'Todos los estados' : item}
              </option>
            ))}
          </select>
          <a
            href={csvHref}
            className="inline-flex items-center justify-center rounded-lg bg-[#E8FF47] px-3 py-2 text-sm font-black uppercase tracking-wider text-[#0A0A0A] hover:bg-[#f1ff89]"
          >
            Exportar CSV
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full border-collapse bg-[#111111]">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Nombre</th>
              <th className="px-3 py-3">Ciudad</th>
              <th className="px-3 py-3">Código</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Fecha de registro</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-sm text-white/60">Cargando preregistros...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-sm font-semibold text-red-300">{error}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-sm text-white/60">Sin preregistros para los filtros seleccionados.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-white/10 text-sm text-white/90">
                  <td className="px-3 py-3">{item.email}</td>
                  <td className="px-3 py-3">{item.nombre ?? '—'}</td>
                  <td className="px-3 py-3">{CIUDAD_LABELS[(item.ciudad as Ciudad)] ?? item.ciudad}</td>
                  <td className="px-3 py-3 font-black text-[#E8FF47]">{item.codigo_descuento}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${badgeEstado(item.estado)}`}>
                      {item.estado}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-white/70">
                    {new Date(item.created_at).toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
