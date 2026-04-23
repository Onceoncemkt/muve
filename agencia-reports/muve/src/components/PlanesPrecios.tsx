'use client'

import { useState } from 'react'

interface PriceIds {
  basico: string
  plus: string
  total: string
}

const PLANES = [
  {
    id: 'basico' as const,
    nombre: 'BÁSICO',
    precio: 549,
    precioAnterior: 699,
    visitas: 8,
    maxPorLugar: 2,
    features: [
      '8 visitas totales al mes',
      'Máximo 2 visitas por lugar',
      'Acceso a gimnasios y clases',
      'Las 3 ciudades',
    ],
    recomendado: false,
  },
  {
    id: 'plus' as const,
    nombre: 'PLUS',
    precio: 1199,
    precioAnterior: 1399,
    visitas: 16,
    maxPorLugar: 4,
    features: [
      '16 visitas totales al mes',
      'Máximo 4 visitas por lugar',
      'Gimnasios, clases, estéticas y wellness',
      'Las 3 ciudades',
    ],
    recomendado: true,
  },
  {
    id: 'total' as const,
    nombre: 'TOTAL',
    precio: 2199,
    precioAnterior: 2499,
    visitas: 30,
    maxPorLugar: 8,
    features: [
      '30 visitas totales al mes',
      'Máximo 8 visitas por lugar',
      'Todo: gimnasios, clases, estéticas, restaurantes',
      'Las 3 ciudades',
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
      if (data.error) {
        alert(data.error)
        return
      }
      window.location.href = data.url
    } catch {
      alert('Error de conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  if (esRecomendado) {
    return (
      <button
        onClick={iniciarCheckout}
        disabled={cargando}
        className="mt-8 w-full rounded-xl bg-white py-3.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50"
      >
        {cargando ? 'Redirigiendo...' : `Empezar con ${planNombre}`}
      </button>
    )
  }

  return (
    <button
      onClick={iniciarCheckout}
      disabled={cargando}
      className="mt-8 w-full rounded-xl border border-indigo-200 bg-white py-3.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50"
    >
      {cargando ? 'Redirigiendo...' : `Empezar con ${planNombre}`}
    </button>
  )
}

export default function PlanesPrecios({ priceIds }: { priceIds: PriceIds }) {
  return (
    <section id="planes" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">
            Elige tu plan
          </h2>
          <p className="mt-3 text-gray-500">
            Pago mensual. Cancela cuando quieras. Sin contratos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
          {PLANES.map(plan => {
            const priceId = priceIds[plan.id]
            const esPlusCard = plan.recomendado

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl p-8 ${
                  esPlusCard
                    ? 'bg-indigo-600 shadow-xl shadow-indigo-200 md:-mt-4'
                    : 'bg-white ring-1 ring-gray-200'
                }`}
              >
                {/* Badge */}
                {plan.recomendado && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-block rounded-full bg-amber-400 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-zinc-900">
                      Más popular
                    </span>
                  </div>
                )}

                {/* Nombre */}
                <p className={`text-[11px] font-black uppercase tracking-widest ${esPlusCard ? 'text-indigo-200' : 'text-indigo-500'}`}>
                  MUVE
                </p>
                <p className={`mt-0.5 text-2xl font-black tracking-tight ${esPlusCard ? 'text-white' : 'text-gray-900'}`}>
                  {plan.nombre}
                </p>

                {/* Precio */}
                <div className="mt-6">
                  {/* Badge + precio tachado */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      esPlusCard ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                    }`}>
                      Precio de lanzamiento
                    </span>
                    <span className={`text-sm font-semibold line-through ${
                      esPlusCard ? 'text-indigo-300' : 'text-gray-400'
                    }`}>
                      ${plan.precioAnterior.toLocaleString('es-MX')}
                    </span>
                  </div>
                  {/* Precio actual */}
                  <div className="mt-1.5 flex items-end gap-1">
                    <span className={`text-4xl font-black leading-none tracking-tight ${esPlusCard ? 'text-white' : 'text-gray-900'}`}>
                      ${plan.precio.toLocaleString('es-MX')}
                    </span>
                    <span className={`mb-1 text-sm font-medium ${esPlusCard ? 'text-indigo-200' : 'text-gray-400'}`}>
                      /mes
                    </span>
                  </div>
                </div>

                {/* Stats rápidos */}
                <div className={`mt-4 flex gap-4 rounded-xl p-3 text-center text-sm ${esPlusCard ? 'bg-indigo-700/50' : 'bg-gray-50'}`}>
                  <div className="flex-1">
                    <p className={`text-xl font-black ${esPlusCard ? 'text-white' : 'text-gray-900'}`}>{plan.visitas}</p>
                    <p className={`text-[11px] leading-tight ${esPlusCard ? 'text-indigo-200' : 'text-gray-400'}`}>visitas/mes</p>
                  </div>
                  <div className={`w-px ${esPlusCard ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                  <div className="flex-1">
                    <p className={`text-xl font-black ${esPlusCard ? 'text-white' : 'text-gray-900'}`}>{plan.maxPorLugar}</p>
                    <p className={`text-[11px] leading-tight ${esPlusCard ? 'text-indigo-200' : 'text-gray-400'}`}>máx/lugar</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="mt-6 flex flex-col gap-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${esPlusCard ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                        ✓
      </span>
                      <span className={`text-sm ${esPlusCard ? 'text-indigo-50' : 'text-gray-600'}`}>{f}</span>
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
