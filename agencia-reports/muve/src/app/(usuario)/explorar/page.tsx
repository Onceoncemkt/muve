'use client'

import { useState } from 'react'
import NegocioCard from '@/components/NegocioCard'
import type { Negocio, Ciudad, Categoria } from '@/types'
import { CIUDAD_LABELS, CATEGORIA_LABELS } from '@/types'

const NEGOCIOS_MOCK: Negocio[] = [
  // Tulancingo
  { id: '1',  nombre: 'Mundo Fit',             categoria: 'gimnasio',    ciudad: 'tulancingo', direccion: 'Tulancingo, Hgo.',                   descripcion: 'Gym completo con equipamiento moderno, zona de pesas y cardio.',              imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '2',  nombre: 'Heaven Indoor Cycling', categoria: 'clases',      ciudad: 'tulancingo', direccion: 'Tulancingo, Hgo.',                   descripcion: 'Cycling indoor de alta intensidad con instructores certificados.',           imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '21', nombre: 'Heaven Power Lab',      categoria: 'clases',      ciudad: 'tulancingo', direccion: 'Tulancingo, Hgo.',                   descripcion: 'Entrenamiento funcional y de fuerza con metodología Power Lab.',            imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '22', nombre: 'Mentor Training',       categoria: 'clases',      ciudad: 'tulancingo', direccion: 'Tulancingo, Hgo.',                   descripcion: 'Clases grupales de entrenamiento funcional, HIIT y acondicionamiento.',     imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '23', nombre: 'MOV',                   categoria: 'clases',      ciudad: 'tulancingo', direccion: 'Tulancingo, Hgo.',                   descripcion: 'Estudio boutique de movimiento, yoga y entrenamiento consciente.',          imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '3',  nombre: 'Bellas Manos Spa',      categoria: 'estetica',    ciudad: 'tulancingo', direccion: 'Blvd. Reyes 88, Tulancingo',         descripcion: 'Tratamientos faciales, masajes y uñas.',                                   imagen_url: null, activo: true, visitas_permitidas_por_mes: 4  },
  { id: '4',  nombre: 'Green Bowl',            categoria: 'restaurante', ciudad: 'tulancingo', direccion: 'Plaza Sendero Local 12, Tulancingo', descripcion: 'Ensaladas, bowls saludables y jugos naturales.',                            imagen_url: null, activo: true, visitas_permitidas_por_mes: 12 },
  // Pachuca
  { id: '5',  nombre: "Gold's Gym",            categoria: 'gimnasio',    ciudad: 'pachuca', direccion: 'Pachuca, Hgo.',                       descripcion: 'Cadena internacional con equipamiento completo, pesas y clases grupales.',  imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '6',  nombre: 'Forza',                 categoria: 'clases',      ciudad: 'pachuca', direccion: 'Pachuca, Hgo.',                       descripcion: 'Clases de entrenamiento funcional y fuerza en Pachuca.',                   imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '24', nombre: 'Inside',                categoria: 'clases',      ciudad: 'pachuca', direccion: 'Pachuca, Hgo.',                       descripcion: 'Estudio boutique indoor con cycling, yoga y clases grupales.',              imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '25', nombre: 'Nero',                  categoria: 'clases',      ciudad: 'pachuca', direccion: 'Pachuca, Hgo.',                       descripcion: 'Clases de alto rendimiento: boxing, funcional y cardio intenso.',          imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '7',  nombre: 'Nails & Glow',          categoria: 'estetica',    ciudad: 'pachuca', direccion: 'Plaza Las Américas Local 8, Pachuca', descripcion: 'Servicios de uñas, depilación y lifting de pestañas.',                     imagen_url: null, activo: true, visitas_permitidas_por_mes: 4  },
  { id: '8',  nombre: 'Vital Kitchen',         categoria: 'restaurante', ciudad: 'pachuca', direccion: 'Blvd. Valle de San Javier 200, Pachuca', descripcion: 'Menú saludable con opciones veganas y sin gluten.',                   imagen_url: null, activo: true, visitas_permitidas_por_mes: 12 },
  // Ensenada
  { id: '9',  nombre: 'Pacific Gym',      categoria: 'gimnasio',    ciudad: 'ensenada', direccion: 'Blvd. Costero 300, Ensenada',         descripcion: 'Gym con vista al mar, equipamiento completo.',    imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '10', nombre: 'Pilates Ensenada', categoria: 'clases',      ciudad: 'ensenada', direccion: 'Calle Miramar 45, Ensenada',           descripcion: 'Pilates en aparatos y mat, grupos pequeños.',     imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '11', nombre: 'Sun Spa',          categoria: 'estetica',    ciudad: 'ensenada', direccion: 'Av. Reforma 18, Col. Centro',          descripcion: 'Masajes, faciales y aromaterapia.',               imagen_url: null, activo: true, visitas_permitidas_por_mes: 4  },
  { id: '12', nombre: 'Mar & Verde',      categoria: 'restaurante', ciudad: 'ensenada', direccion: 'Blvd. Teniente Azueta 88, Ensenada', descripcion: 'Mariscos saludables y bowls de acai.',            imagen_url: null, activo: true, visitas_permitidas_por_mes: 12 },
  // Tijuana
  { id: '13', nombre: 'Symmetry Gym',            categoria: 'gimnasio',    ciudad: 'tijuana', direccion: 'Blvd. Agua Caliente, Plaza Galerías Hipódromo, Tijuana', descripcion: 'Gym premium con clases de yoga, spinning, HIIT, pilates y entrenamiento funcional.',              imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '14', nombre: 'Vertical Climb',           categoria: 'clases',      ciudad: 'tijuana', direccion: 'Blvd. Agua Caliente, Tijuana',                            descripcion: 'Estudio boutique fitness con programas Versa y Fuerza, entrenamientos semi personalizados.',  imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '15', nombre: 'Gladiators Gym & Fitness', categoria: 'gimnasio',    ciudad: 'tijuana', direccion: 'C. Real del Mar 10450, Francisco Zarco, Tijuana',         descripcion: 'Cadena de gimnasios con pesas, cardio, clases grupales y entrenamiento personalizado.',      imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '16', nombre: 'Acuario Fitness Center',   categoria: 'clases',      ciudad: 'tijuana', direccion: 'Av. Paseo del Lago 19507, Lago Sur, Tijuana',             descripcion: 'Centro de fitness integral con enfoque médico y nutricional, spinning y clases grupales.',   imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '17', nombre: 'Impact Fitness',            categoria: 'gimnasio',    ciudad: 'tijuana', direccion: 'Tijuana, B.C.',                                           descripcion: 'Gym moderno con yoga, pilates, cardio y clases grupales dinámicas.',                         imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '18', nombre: 'Olympus Gym & Fitness',     categoria: 'gimnasio',    ciudad: 'tijuana', direccion: 'Tijuana, B.C.',                                           descripcion: 'Espacio premium con musculación, cardio, clases grupales y nutrición.',                      imagen_url: null, activo: true, visitas_permitidas_por_mes: 8  },
  { id: '19', nombre: 'Spa del Río',               categoria: 'estetica',    ciudad: 'tijuana', direccion: 'P. del Río 6641, Río Tijuana, Tijuana',                   descripcion: 'Masajes, faciales y tratamientos corporales en zona Río.',                                  imagen_url: null, activo: true, visitas_permitidas_por_mes: 4  },
  { id: '20', nombre: 'Green Bowl TJ',             categoria: 'restaurante', ciudad: 'tijuana', direccion: 'Zona Río, Tijuana',                                       descripcion: 'Bowls saludables, jugos y proteínas. Cocina fit en zona Río.',                              imagen_url: null, activo: true, visitas_permitidas_por_mes: 12 },
]

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const CATEGORIAS: Categoria[] = ['gimnasio', 'estetica', 'clases', 'restaurante']

export default function ExplorarPage() {
  const [ciudadFiltro, setCiudadFiltro] = useState<Ciudad | 'todas'>('todas')
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | 'todas'>('todas')

  const negocios = NEGOCIOS_MOCK.filter(n => {
    const matchCiudad = ciudadFiltro === 'todas' || n.ciudad === ciudadFiltro
    const matchCategoria = categoriaFiltro === 'todas' || n.categoria === categoriaFiltro
    return matchCiudad && matchCategoria
  })

  const btnBase = 'shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors'
  const btnActive = 'bg-[#0A0A0A] text-white'
  const btnInactive = 'border border-[#E5E5E5] bg-white text-[#888] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Explorar</h1>
        <p className="mt-1 text-sm text-[#888]">
          {negocios.length} {negocios.length === 1 ? 'lugar' : 'lugares'} disponibles
        </p>
      </div>

      {/* Filtros */}
      <div className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-white px-4 py-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={() => setCiudadFiltro('todas')} className={`${btnBase} ${ciudadFiltro === 'todas' ? btnActive : btnInactive}`}>
              Todas
            </button>
            {CIUDADES.map(c => (
              <button key={c} onClick={() => setCiudadFiltro(c)} className={`${btnBase} ${ciudadFiltro === c ? btnActive : btnInactive}`}>
                {CIUDAD_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={() => setCategoriaFiltro('todas')} className={`${btnBase} ${categoriaFiltro === 'todas' ? 'bg-[#6B4FE8] text-white' : btnInactive}`}>
              Todo
            </button>
            {CATEGORIAS.map(c => (
              <button key={c} onClick={() => setCategoriaFiltro(c)} className={`${btnBase} ${categoriaFiltro === c ? 'bg-[#6B4FE8] text-white' : btnInactive}`}>
                {CATEGORIA_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4">
        {negocios.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-bold text-[#0A0A0A]">Sin resultados</p>
            <p className="mt-1 text-sm text-[#888]">Prueba con otros filtros.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negocios.map(negocio => (
              <NegocioCard key={negocio.id} negocio={negocio} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
