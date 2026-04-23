import type { Negocio } from '@/types'
import { CATEGORIA_ICONS, CATEGORIA_LABELS } from '@/types'

interface Props {
  negocio: Negocio
}

export default function NegocioCard({ negocio }: Props) {
  return (
    <div className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex h-36 items-center justify-center bg-indigo-50 text-5xl">
        {negocio.imagen_url
          ? <img src={negocio.imagen_url} alt={negocio.nombre} className="h-full w-full object-cover" />
          : CATEGORIA_ICONS[negocio.categoria]
        }
      </div>
      <div className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {CATEGORIA_LABELS[negocio.categoria]}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Hasta {negocio.visitas_permitidas_por_mes} visitas/mes
          </span>
        </div>
        <h3 className="mt-1 font-semibold text-gray-900">{negocio.nombre}</h3>
        {negocio.descripcion && (
          <p className="text-sm text-gray-500 line-clamp-2">{negocio.descripcion}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">📍 {negocio.direccion}</p>
      </div>
    </div>
  )
}
