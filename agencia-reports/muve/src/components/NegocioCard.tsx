import type { Negocio, Categoria } from '@/types'
import { CATEGORIA_LABELS } from '@/types'

const CATEGORIA_ACCENT: Record<Categoria, string> = {
  gimnasio:    '#6B4FE8',
  clases:      '#E8FF47',
  estetica:    '#0A0A0A',
  restaurante: '#6B4FE8',
}

function getInitials(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export default function NegocioCard({ negocio }: { negocio: Negocio }) {
  const accent = CATEGORIA_ACCENT[negocio.categoria]

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-white transition-shadow hover:shadow-sm">
      {/* Imagen o placeholder con iniciales */}
      <div className="relative flex h-28 items-center justify-center overflow-hidden bg-[#6B4FE8]">
        {negocio.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={negocio.imagen_url}
            alt={negocio.nombre}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="select-none text-4xl font-black tracking-tighter text-[#E8FF47]">
            {getInitials(negocio.nombre)}
          </span>
        )}
        {/* Barra de acento por categoría */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: accent }}
        />
      </div>

      <div className="flex flex-col gap-1 p-4">
        {/* Categoría + visitas */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">
            {CATEGORIA_LABELS[negocio.categoria]}
          </span>
          <span className="shrink-0 text-[10px] text-[#888]">
            {negocio.visitas_permitidas_por_mes} vis/mes
          </span>
        </div>

        {/* Nombre */}
        <h3 className="mt-0.5 font-bold leading-tight text-[#0A0A0A]">
          {negocio.nombre}
        </h3>

        {/* Descripción */}
        {negocio.descripcion && (
          <p className="text-sm leading-snug text-[#888] line-clamp-2">
            {negocio.descripcion}
          </p>
        )}

        {/* Instagram */}
        {negocio.instagram_handle && (
          <a
            href={`https://instagram.com/${negocio.instagram_handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-xs font-semibold text-[#6B4FE8] hover:underline"
          >
            @{negocio.instagram_handle}
          </a>
        )}

        {/* Dirección */}
        <p className="mt-1 text-xs text-[#888]">
          📍 {negocio.direccion}
        </p>
      </div>
    </div>
  )
}
