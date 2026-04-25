'use client'

import { useState } from 'react'
import type { Ciudad } from '@/types'

interface PriceIds {
  basico: string
  plus: string
  total: string
}

type RegionPrecios = 'centro' | 'bc'
type PlanId = 'basico' | 'plus' | 'total'
type PriceIdsPorRegion = Record<RegionPrecios, PriceIds>

const PRECIOS_POR_REGION: Record<RegionPrecios, Record<PlanId, number>> = {
  centro: {
    basico: 549,
    plus: 1199,
    total: 2199,
  },
  bc: {
    basico: 699,
    plus: 1399,
    total: 2499,
  },
}

const PRECIOS_ANTERIORES_POR_REGION: Record<RegionPrecios, Partial<Record<PlanId, number>>> = {
  centro: {
    basico: 699,
    plus: 1399,
    total: 2499,
  },
  bc: {},
}

const CIUDADES: Array<{ value: Ciudad; label: string }> = [
  { value: 'tulancingo', label: 'Tulancingo' },
  { value: 'pachuca', label: 'Pachuca' },
  { value: 'ensenada', label: 'Ensenada' },
  { value: 'tijuana', label: 'Tijuana' },
]

const PLANES = [
  {
    id: 'basico' as const,
    nombre: 'BÁSICO',
    visitas: 8,
    maxPorLugar: 2,
    features: [
      '8 visitas totales al mes',
      'Máximo 2 visitas por lugar',
      'Gimnasios y clases',
      'Las 4 ciudades',
    ],
    recomendado: false,
  },
  {
    id: 'plus' as const,
    nombre: 'PLUS',
    visitas: 16,
    maxPorLugar: 4,
    features: [
      '16 visitas totales al mes',
      'Máximo 4 visitas por lugar',
      'Gimnasios, clases, estéticas y wellness',
      'Las 4 ciudades',
    ],
    recomendado: true,
  },
  {
    id: 'total' as const,
    nombre: 'TOTAL',
    visitas: 30,
    maxPorLugar: 8,
    features: [
      '30 visitas totales al mes',
      'Máximo 8 visitas por lugar',
      'Gimnasios, clases, estéticas, restaurantes',
      'Las 4 ciudades',
    ],
    recomendado: false,
  },
]

function BotonPlan({
  planId,
  planNombre,
  priceId,
  esRecomendado,
}: {
  planId: string
  planNombre: string
  priceId: string
  esRecomendado: boolean
}) {
  const [cargando, setCargando] = useState(false)

  async function iniciarCheckout() {
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      if (res.status === 401) {
        window.location.href = `/registro?plan=${planId}`
        return
      }
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      window.location.href = data.url
    } catch {
      alert('Error de conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const label = cargando ? 'Redirigiendo...' : `Empezar con ${planNombre}`

  if (esRecomendado) {
    return (
      <button
        onClick={iniciarCheckout}
        disabled={cargando}
        className="mt-8 w-full rounded-lg bg-[#E8FF47] py-3.5 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-white disabled:opacity-50"
      >
        {label}
      </button>
    )
  }

  return (
    <button
      onClick={iniciarCheckout}
      disabled={cargando}
      className="mt-8 w-full rounded-lg border border-[#6B4FE8] bg-white py-3.5 text-sm font-bold text-[#6B4FE8] transition-colors hover:bg-[#6B4FE8] hover:text-white disabled:opacity-50"
    >
      {label}
    </button>
  )
}

function esCiudadBC(ciudad: Ciudad) {
  return ciudad === 'tijuana' || ciudad === 'ensenada'
}

export default function PlanesPrecios({
  priceIds,
  ciudadInicial,
  usuarioAutenticado,
}: {
  priceIds: PriceIdsPorRegion
  ciudadInicial: Ciudad
  usuarioAutenticado: boolean
}) {
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<Ciudad | null>(
    usuarioAutenticado ? ciudadInicial : null
  )

  const ciudadActiva = usuarioAutenticado
    ? ciudadInicial
    : (ciudadSeleccionada ?? 'tulancingo')
  const regionActiva: RegionPrecios = esCiudadBC(ciudadActiva) ? 'bc' : 'centro'
  const priceIdsActivos = priceIds[regionActiva]
  const preciosActivos = PRECIOS_POR_REGION[regionActiva]
  const preciosAnterioresActivos = PRECIOS_ANTERIORES_POR_REGION[regionActiva]
  const mostrarBadgeDesde = !usuarioAutenticado && ciudadSeleccionada === null
  const badgeDesdeTexto = regionActiva === 'bc' ? 'Desde $699' : 'Desde $549'
  return (
    <section id="planes" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-black tracking-tight text-[#0A0A0A]">
            Elige tu plan
          </h2>
          <p className="mt-3 text-sm text-[#888]">
            Pago mensual. Cancela cuando quieras. Sin contratos.
          </p>
          {!usuarioAutenticado && (
            <div className="mx-auto mt-5 max-w-sm rounded-lg border border-[#E5E5E5] bg-white p-3 text-left">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#555]">
                ¿En qué ciudad estás?
              </label>
              <select
                value={ciudadActiva}
                onChange={(event) => setCiudadSeleccionada(event.target.value as Ciudad)}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none focus:border-[#6B4FE8]"
              >
                {CIUDADES.map((ciudad) => (
                  <option key={ciudad.value} value={ciudad.value}>
                    {ciudad.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-[#888]">
            Los precios pueden variar según tu ciudad. Tulancingo y Pachuca desde $549 · Tijuana y Ensenada desde $699
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:items-start">
          {PLANES.map(plan => {
            const priceId = priceIdsActivos[plan.id]
            const precio = preciosActivos[plan.id]
            const precioAnterior = preciosAnterioresActivos[plan.id]
            const esPlusCard = plan.recomendado

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl p-8 ${
                  esPlusCard
                    ? 'bg-[#6B4FE8] shadow-xl md:-mt-4'
                    : 'bg-white ring-1 ring-[#E5E5E5]'
                }`}
              >
                {/* Badge "Más popular" */}
                {plan.recomendado && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-block rounded-full bg-[#E8FF47] px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-[#0A0A0A]">
                      Más popular
                    </span>
                  </div>
                )}
                {mostrarBadgeDesde && (
                  <div className="absolute right-3 top-3">
                    <span className="inline-block rounded-full bg-[#0A0A0A] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#E8FF47]">
                      {badgeDesdeTexto}
                    </span>
                  </div>
                )}

                {/* Nombre */}
                <p className={`text-[11px] font-black uppercase tracking-widest ${esPlusCard ? 'text-white/50' : 'text-[#888]'}`}>
                  MUVET
                </p>
                <p className={`mt-0.5 text-2xl font-black tracking-tight ${esPlusCard ? 'text-white' : 'text-[#0A0A0A]'}`}>
                  {plan.nombre}
                </p>

                {/* Precio */}
                <div className="mt-6">
                  {typeof precioAnterior === 'number' && (
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                        esPlusCard ? 'bg-white/15 text-white/80' : 'bg-[#F0F0F0] text-[#888]'
                      }`}>
                        Precio de lanzamiento
                      </span>
                      <span className={`text-sm font-semibold line-through ${
                        esPlusCard ? 'text-white/40' : 'text-[#CCC]'
                      }`}>
                        ${precioAnterior.toLocaleString('es-MX')}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex items-end gap-1">
                    <span className={`text-4xl font-black leading-none tracking-tight ${esPlusCard ? 'text-white' : 'text-[#0A0A0A]'}`}>
                      ${precio.toLocaleString('es-MX')}
                    </span>
                    <span className={`mb-1 text-sm font-medium ${esPlusCard ? 'text-white/50' : 'text-[#888]'}`}>
                      /mes
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className={`mt-5 flex gap-4 rounded-lg p-3 text-center ${esPlusCard ? 'bg-white/10' : 'bg-[#F7F7F7]'}`}>
                  <div className="flex-1">
                    <p className={`text-xl font-black ${esPlusCard ? 'text-white' : 'text-[#0A0A0A]'}`}>{plan.visitas}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${esPlusCard ? 'text-white/50' : 'text-[#888]'}`}>vis/mes</p>
                  </div>
                  <div className={`w-px ${esPlusCard ? 'bg-white/20' : 'bg-[#E5E5E5]'}`} />
                  <div className="flex-1">
                    <p className={`text-xl font-black ${esPlusCard ? 'text-white' : 'text-[#0A0A0A]'}`}>{plan.maxPorLugar}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${esPlusCard ? 'text-white/50' : 'text-[#888]'}`}>máx/lugar</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="mt-6 flex flex-col gap-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 text-xs font-black ${esPlusCard ? 'text-[#E8FF47]' : 'text-[#6B4FE8]'}`}>
                        ✓
                      </span>
                      <span className={`text-sm ${esPlusCard ? 'text-white/80' : 'text-[#555]'}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <BotonPlan
                  planId={plan.id}
                  planNombre={plan.nombre}
                  priceId={priceId}
                  esRecomendado={plan.recomendado}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
