'use client'

import { useState } from 'react'
import NegocioCard from '@/components/NegocioCard'
import type { Negocio, Ciudad, Categoria } from '@/types'
import { CIUDAD_LABELS, CATEGORIA_LABELS, CATEGORIA_ICONS } from '@/types'

// Datos mock — reemplazar con fetch de Supabase cuando tengas el proyecto configurado
const NEGOCIOS_MOCK: Negocio[] = [
  // Tulancingo
  { id: '1', nombre: 'Iron Gym Tulancingo', categoria: 'gimnasio', ciudad: 'tulancingo', direccion: 'Av. Hidalgo 42, Tulancingo', descripcion: 'Gym completo con pesas libres, máquinas cardio y clases grupales.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 8 },
  { id: '2', nombre: 'Yoga Zen', categoria: 'clases', ciudad: 'tulancingo', direccion: 'Calle Morelos 15, Col. Centro', descripcion: 'Clases de yoga y meditación para todos los niveles.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 8 },
  { id: '3', nombre: 'Bellas Manos Spa', categoria: 'estetica', ciudad: 'tulancingo', direccion: 'Blvd. Reyes 88, Tulancingo', descripcion: 'Tratamientos faciales, masajes y uñas.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 4 },
  { id: '4', nombre: 'Green Bowl', categoria: 'restaurante', ciudad: 'tulancingo', direccion: 'Plaza Sendero Local 12, Tulancingo', descripcion: 'Ensaladas, bowls saludables y jugos naturales.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 12 },
  // Pachuca
  { id: '5', nombre: 'Titan Fitness', categoria: 'gimnasio', ciudad: 'pachuca', direccion: 'Blvd. Colosio 120, Pachuca', descripcion: 'Gym de alto rendimiento con zona CrossFit y pesas.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 8 },
  { id: '6', nombre: 'Cycling Pachuca', categoria: 'clases', ciudad: 'pachuca', direccion: 'Av. Revolución 55, Col. Centro', descripcion: 'Clases de cycling indoor con instructores certificados.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 8 },
  { id: '7', nombre: 'Nails & Glow', categoria: 'estetica', ciudad: 'pachuca', direccion: 'Plaza Las Américas Local 8, Pachuca', descripcion: 'Servicios de uñas, depilación y lifting de pestañas.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 4 },
  { id: '8', nombre: 'Vital Kitchen', categoria: 'restaurante', ciudad: 'pachuca', direccion: 'Blvd. Valle de San Javier 200, Pachuca', descripcion: 'Menú saludable con opciones veganas y sin gluten.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 12 },
  // Ensenada
  { id: '9', nombre: 'Pacific Gym', categoria: 'gimnasio', ciudad: 'ensenada', direccion: 'Blvd. Costero 300, Ensenada', descripcion: 'Gym con vista al mar, equipamiento completo.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 8 },
  { id: '10', nombre: 'Pilates Ensenada', categoria: 'clases', ciudad: 'ensenada', direccion: 'Calle Miramar 45, Ensenada', descripcion: 'Pilates en aparatos y mat, grupos pequeños.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 8 },
  { id: '11', nombre: 'Sun Spa', categoria: 'estetica', ciudad: 'ensenada', direccion: 'Av. Reforma 18, Col. Centro', descripcion: 'Masajes, faciales y aromaterapia.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 4 },
  { id: '12', nombre: 'Mar & Verde', categoria: 'restaurante', ciudad: 'ensenada', direccion: 'Blvd. Teniente Azueta 88, Ensenada', descripcion: 'Mariscos saludables y bowls de açaí.', imagen_url: null, activo: true, visitas_permitidas_por_mes: 12 },
]

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada']
const CATEGORIAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']

export default function ExplorarPage() {
  const [ciudadFiltro, setCiudadFiltro] = useState<Ciudad | 'todas'>('todas')
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | 'todas'>('todas')

  const negocios = NEGOCIOS_MOCK.filter(n => {
    const matchCiudad = ciudadFiltro === 'todas' || n.ciudad === ciudadFiltro
    const matchCategoria = categoriaFiltro === 'todas' || n.categoria === categoriaFiltro
    return matchCiudad && matchCategoria
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Explorar negocios</h1>
        <p className="mt-1 text-sm text-gray-500">
          {negocios.length} {negocios.length === 1 ? 'lugar' : 'lugares'} disponibles con tu membresía
        </p>
      </div>

      {/* Filtros */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="flex flex-col gap-3">
          {/* Ciudad */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCiudadFiltro('todas')}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                ciudadFiltro === 'todas'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas las ciudades
            </button>
            {CIUDADES.map(c => (
              <button
                key={c}
                onClick={() => setCiudadFiltro(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  ciudadFiltro === c
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CIUDAD_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Categoría */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCategoriaFiltro('todas')}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                categoriaFiltro === 'todas'
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todo
            </button>
            {CATEGORIAS.map(c => (
              <button
                key={c}
                onClick={() => setCategoriaFiltro(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  categoriaFiltro === c
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CATEGORIA_ICONS[c]} {CATEGORIA_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de negocios */}
      <div className="p-4">
        {negocios.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-4xl">🔍</p>
            <p className="font-medium text-gray-700">Sin resultados</p>
            <p className="text-sm text-gray-400">Prueba con otros filtros.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {negocios.map(negocio => (
              <NegocioCard key={negocio.id} negocio={negocio} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
