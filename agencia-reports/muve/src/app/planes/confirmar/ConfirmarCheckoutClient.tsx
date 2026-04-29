'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PlanMembresia } from '@/types'

function normalizarCodigoDescuento(value: string | null | undefined) {
  if (!value) return ''
  return value.trim().toUpperCase()
}

export default function ConfirmarCheckoutClient({
  planId,
  ciudadLabel,
  ciudadValue,
  zonaLabel,
  planLabel,
  creditos,
  precioMensual,
  backHref,
  codigoDescuento = null,
}: {
  planId: PlanMembresia
  ciudadLabel: string
  ciudadValue: 'tulancingo' | 'pachuca' | 'ensenada' | 'tijuana'
  zonaLabel: 'zona1' | 'zona2'
  planLabel: string
  creditos: number
  precioMensual: number
  backHref: string
  codigoDescuento?: string | null
}) {
  const [cargando, setCargando] = useState(false)

  async function continuarAlPago() {
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          plan: planId,
          ciudad: ciudadValue,
          codigo_descuento: normalizarCodigoDescuento(codigoDescuento) || undefined,
        }),
      })
      if (res.status === 401) {
        window.location.href = `/registro?plan=${planId}`
        return
      }
      const data = await res.json().catch(() => null) as { error?: string; url?: string } | null
      if (!res.ok || data?.error || !data?.url) {
        alert(data?.error ?? 'No se pudo iniciar el checkout. Intenta de nuevo.')
        return
      }
      window.location.href = data.url
    } catch {
      alert('Error de conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm sm:p-8">
      <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A] sm:text-3xl">
        Confirma tu plan antes de continuar
      </h1>

      <div className="mt-6 space-y-3 border-y border-[#EFEFEF] py-5 text-base sm:text-lg">
        <p className="flex items-center justify-between gap-3">
          <span className="text-[#666]">Plan:</span>
          <span className="font-bold text-[#0A0A0A]">{planLabel}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-[#666]">Ciudad:</span>
          <span className="font-bold text-[#0A0A0A]">{ciudadLabel}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-[#666]">Zona:</span>
          <span className="font-bold uppercase text-[#6B4FE8]">{zonaLabel}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-[#666]">Créditos:</span>
          <span className="font-bold text-[#0A0A0A]">{creditos}</span>
        </p>
        <p className="flex items-end justify-between gap-3">
          <span className="text-[#666]">Precio:</span>
          <span className="text-2xl font-black tracking-tight text-[#0A0A0A] sm:text-3xl">
            ${precioMensual.toLocaleString('es-MX')} MXN/mes
          </span>
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-[#E8FF47] bg-[#FFFEE3] p-4 text-sm leading-relaxed text-[#2E2E2E] sm:text-base">
        <p className="font-semibold">⚠️ Verifica que tu ciudad sea correcta.</p>
        <p className="mt-1">
          El precio depende de tu zona. Una vez realizado el pago, el cambio de ciudad puede tener costos adicionales.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="text-sm font-semibold text-[#6B4FE8] underline-offset-4 hover:underline"
        >
          ← Cambiar ciudad o plan
        </Link>
        <button
          onClick={continuarAlPago}
          disabled={cargando}
          className="w-full rounded-lg bg-[#0A0A0A] px-5 py-3 text-sm font-bold text-[#E8FF47] transition-colors hover:bg-black disabled:opacity-60 sm:w-auto"
        >
          {cargando ? 'Redirigiendo...' : 'Continuar al pago →'}
        </button>
      </div>
    </div>
  )
}
