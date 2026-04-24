import type { Negocio, Categoria } from '@/types'
import { CATEGORIA_LABELS } from '@/types'

const CATEGORIA_ACCENT: Record<Categoria, string> = {
  gimnasio:    '#6B4FE8',
  clases:      '#E8FF47',
  estetica:    '#0A0A0A',
  restaurante: '#6B4FE8',
}

export default function NegocioCard({ negocio }: { negocio: Negocio }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-white transition-shadow hover:shadow-sm">
      {/* Barra de acento por categoría */}
      <div className="h-1" style={{ backgroundColor: CATEGORIA_ACCENT[negocio.categoria] }} />

      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">
            {CATEGORIA_LABELS[negocio.categoria]}
          </span>
          <span className="shrink-0 text-[10px] text-[#888]">
            {negocio.visitas_permitidas_por_mes} vis/mes
          </span>
        </div>

        <h3 className="mt-1 font-bold leading-tight text-[#0A0A0A]">
          {negocio.nombre}
        </h3>

        {negocio.descripcion && (
          <p className="text-sm leading-snug text-[#888] line-clamp-2">
            {negocio.descripcion}
          </p>
        )}

        <p className="mt-2 text-xs text-[#888]">
          📍 {negocio.direccion}
        </p>
      </div>
    </div>
  )
}
