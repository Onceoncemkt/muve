'use client'

import { useState, useTransition } from 'react'
import type { NivelNegocio } from '@/types'

const PLAN_LABELS: Record<NivelNegocio, string> = {
  basico: 'Básico',
  plus: 'Plus',
  total: 'Total',
}

const BADGE_CLASS: Record<NivelNegocio, string> = {
  basico: 'bg-[#7A7A7A] text-white',
  plus: 'bg-[#6B4FE8] text-white',
  total: 'bg-[#E8FF47] text-[#0A0A0A]',
}

export default function NegocioPlanBadgeControl({
  negocioId,
  initialPlan,
}: {
  negocioId: string
  initialPlan: NivelNegocio
}) {
  const [plan, setPlan] = useState<NivelNegocio>(initialPlan)
  const [isPending, startTransition] = useTransition()

  function actualizarPlan(value: string) {
    const planNuevo: NivelNegocio = value === 'plus' || value === 'total' ? value : 'basico'
    setPlan(planNuevo)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('plan_negocio', planNuevo)
      formData.set('next', '/admin')
      await fetch(`/api/admin/negocios/${negocioId}/plan`, {
        method: 'POST',
        body: formData,
      }).catch(() => null)
    })
  }

  return (
    <div className="mt-2 flex w-full flex-wrap items-center gap-2">
      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_CLASS[plan]}`}>
        {PLAN_LABELS[plan]}
      </span>
      <label
        htmlFor={`plan-negocio-${negocioId}`}
        className="text-[10px] font-bold uppercase tracking-widest text-white/45"
      >
        Cambiar plan
      </label>
      <select
        id={`plan-negocio-${negocioId}`}
        name="plan_negocio"
        value={plan}
        onChange={(event) => actualizarPlan(event.target.value)}
        disabled={isPending}
        className="rounded-md border border-white/15 bg-[#0A0A0A] px-2 py-1 text-xs text-white outline-none focus:border-[#6B4FE8] disabled:opacity-60"
      >
        <option value="basico">Básico</option>
        <option value="plus">Plus</option>
        <option value="total">Total</option>
      </select>
    </div>
  )
}
