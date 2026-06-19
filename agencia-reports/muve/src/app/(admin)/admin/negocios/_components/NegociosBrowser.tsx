'use client'

import { useMemo, useState } from 'react'

type StripeEstado = 'active' | 'pending' | 'no_account'

export type PanelNegocio = {
  id: string
  nombre: string
  direccion: string
  ciudadLabel: string
  categoriaLabel: string
  planLabel: string
  stripeEstado: StripeEstado
  activo: boolean
  detalle: React.ReactNode
}

function StripeBadge({ estado }: { estado: StripeEstado }) {
  if (estado === 'active') return <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-300 ring-1 ring-green-500/40">Activo</span>
  if (estado === 'pending') return <span className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200 ring-1 ring-yellow-500/40">Pendiente</span>
  return <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50 ring-1 ring-white/10">Sin conectar</span>
}

export default function NegociosBrowser({
  paneles,
  formularioNuevo,
}: {
  paneles: PanelNegocio[]
  formularioNuevo: React.ReactNode
}) {
  const [busqueda, setBusqueda] = useState('')
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return paneles
    return paneles.filter((p) =>
      p.nombre.toLowerCase().includes(q)
      || p.ciudadLabel.toLowerCase().includes(q)
      || p.categoriaLabel.toLowerCase().includes(q)
      || p.direccion.toLowerCase().includes(q)
    )
  }, [paneles, busqueda])

  const seleccionado = paneles.find((p) => p.id === seleccionId) ?? null
  const drawerAbierto = mostrarNuevo || Boolean(seleccionado)

  const cerrar = () => {
    setSeleccionId(null)
    setMostrarNuevo(false)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">Negocios</h1>
          <p className="mt-1 text-xs text-white/50">
            {paneles.length} registrados · solo los activos se muestran en /explorar
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSeleccionId(null); setMostrarNuevo(true) }}
          className="rounded-md bg-[#E8FF47] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0A0A0A] hover:bg-[#f1ff89]"
        >
          + Nuevo negocio
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar negocio por nombre, ciudad o categoría…"
          className="w-full max-w-md rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
        />
        <span className="text-xs text-white/45">{filtrados.length} de {paneles.length}</span>
      </div>

      <div className="glass-card scroll-fina overflow-x-auto rounded-xl">
        <table className="min-w-full border-collapse bg-transparent">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
              <th className="px-3 py-3">Nombre</th>
              <th className="px-3 py-3">Ciudad</th>
              <th className="px-3 py-3">Categoría</th>
              <th className="px-3 py-3">Plan</th>
              <th className="px-3 py-3">Stripe</th>
              <th className="px-3 py-3">Activo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr
                key={p.id}
                onClick={() => { setMostrarNuevo(false); setSeleccionId(p.id) }}
                className={`cursor-pointer border-b border-white/10 text-sm text-white/90 transition-colors hover:bg-white/5 ${
                  seleccionId === p.id ? 'bg-[#6B4FE8]/10' : ''
                }`}
              >
                <td className="px-3 py-3">
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="truncate text-xs text-white/45">{p.direccion}</p>
                </td>
                <td className="px-3 py-3 text-white/75">{p.ciudadLabel}</td>
                <td className="px-3 py-3 text-white/75">{p.categoriaLabel}</td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold tracking-[1px] text-white">{p.planLabel}</span>
                </td>
                <td className="px-3 py-3"><StripeBadge estado={p.stripeEstado} /></td>
                <td className="px-3 py-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${p.activo ? 'bg-[#E8FF47] text-[#0A0A0A]' : 'bg-white/10 text-white/70'}`}>
                    {p.activo ? 'Sí' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-white/50">
                  {paneles.length === 0 ? 'No hay negocios registrados.' : 'Sin resultados para la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer lateral */}
      {drawerAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Cerrar" onClick={cerrar} className="flex-1 bg-black/60" />
          <div className="h-full w-full max-w-lg glass-panel scroll-fina glass-in overflow-y-auto border-l border-white/10 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/45">
                {mostrarNuevo ? 'Nuevo negocio' : 'Detalle del negocio'}
              </p>
              <button type="button" onClick={cerrar} className="rounded-md border border-white/15 px-2.5 py-1 text-sm text-white/70 hover:border-[#6B4FE8] hover:text-white">
                ✕
              </button>
            </div>
            {mostrarNuevo ? formularioNuevo : seleccionado?.detalle}
          </div>
        </div>
      )}
    </section>
  )
}
