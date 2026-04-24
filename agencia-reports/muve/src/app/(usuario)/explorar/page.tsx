'use client'

import { useEffect, useMemo, useState } from 'react'
import { CATEGORIA_LABELS, type Negocio, type PlanMembresia } from '@/types'
import {
  CATEGORIAS_VISIBLES_POR_PLAN,
  PLAN_LABELS,
  normalizarPlan,
  puedeReservarConPlan,
} from '@/lib/planes'

type EstadoPlanUsuario = {
  plan_activo: boolean
  plan: PlanMembresia | null
}

async function obtenerEstadoPlanUsuario(): Promise<EstadoPlanUsuario> {
  try {
    const res = await fetch('/api/usuario/plan', { cache: 'no-store' })
    if (!res.ok) return { plan_activo: false, plan: null }

    const data = await res.json()
    return {
      plan_activo: Boolean(data.plan_activo),
      plan: normalizarPlan(data.plan),
    }
  } catch {
    return { plan_activo: false, plan: null }
  }
}

function planRequeridoNegocio(negocio: Negocio): PlanMembresia {
  return normalizarPlan(negocio.plan_requerido ?? null) ?? 'basico'
}

export default function ExplorarPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [cargando, setCargando] = useState(true)
  const [planActivo, setPlanActivo] = useState(false)
  const [planUsuario, setPlanUsuario] = useState<PlanMembresia | null>(null)

  useEffect(() => {
    let activo = true

    async function cargarNegociosYPlan() {
      setCargando(true)

      const [respuestaNegocios, estadoPlan] = await Promise.all([
        fetch('/api/explorar/negocios', { cache: 'no-store' }),
        obtenerEstadoPlanUsuario(),
      ])

      const payloadNegocios = await respuestaNegocios.json().catch(() => ({ negocios: [], error: 'Respuesta inválida' }))

      console.log('[explorar] resultado query negocios activos', {
        data: payloadNegocios.negocios ?? [],
        error: payloadNegocios.error ?? null,
      })

      if (!activo) return

      setPlanActivo(estadoPlan.plan_activo)
      setPlanUsuario(estadoPlan.plan)

      if (!respuestaNegocios.ok) {
        setNegocios([])
      } else {
        setNegocios((payloadNegocios.negocios ?? []) as Negocio[])
      }

      setCargando(false)
    }

    void cargarNegociosYPlan()

    return () => {
      activo = false
    }
  }, [])

  const planEfectivo = planActivo ? (planUsuario ?? 'basico') : null

  const negociosFiltrados = useMemo(() => {
    if (!planEfectivo) return negocios

    const categoriasPermitidas = new Set(CATEGORIAS_VISIBLES_POR_PLAN[planEfectivo])
    return negocios.filter((negocio) => categoriasPermitidas.has(negocio.categoria))
  }, [negocios, planEfectivo])

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Explorar</h1>
        <p className="mt-1 text-sm text-[#888]">
          {negociosFiltrados.length} {negociosFiltrados.length === 1 ? 'lugar' : 'lugares'} disponibles
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6B4FE8]">
          {planEfectivo ? `Plan ${PLAN_LABELS[planEfectivo]}` : 'Sin membresía activa'}
        </p>
      </div>

      <div className="p-4">
        {cargando ? (
          <p className="mt-8 text-center text-sm text-[#888]">Cargando negocios...</p>
        ) : negociosFiltrados.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-bold text-[#0A0A0A]">No hay negocios disponibles aún</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negociosFiltrados.map((negocio) => {
              const planRequerido = planRequeridoNegocio(negocio)
              const puedeReservar = planEfectivo
                ? puedeReservarConPlan(planEfectivo, planRequerido)
                : false

              return (
                <div key={negocio.id} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-black text-[#0A0A0A]">{negocio.nombre}</h2>
                    <span className="shrink-0 rounded-full bg-[#6B4FE8]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#6B4FE8]">
                      {PLAN_LABELS[planRequerido]}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-sm text-[#555]">
                    <p>
                      <span className="font-semibold text-[#0A0A0A]">Categoría:</span> {CATEGORIA_LABELS[negocio.categoria]}
                    </p>
                    <p>
                      <span className="font-semibold text-[#0A0A0A]">Ciudad:</span> {negocio.ciudad}
                    </p>
                    <p>
                      <span className="font-semibold text-[#0A0A0A]">Dirección:</span> {negocio.direccion}
                    </p>
                  </div>

                  <button
                    disabled={!puedeReservar}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                      puedeReservar
                        ? 'bg-[#0A0A0A] text-[#E8FF47] hover:bg-[#222]'
                        : 'cursor-not-allowed border border-[#E5E5E5] bg-[#F7F7F7] text-[#888]'
                    }`}
                  >
                    {puedeReservar ? 'Reservar' : 'Requiere membresía'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
