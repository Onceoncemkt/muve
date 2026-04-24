'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Negocio } from '@/types'

export default function ExplorarPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    async function cargarNegocios() {
      setCargando(true)

      const supabase = createClient()
      const consulta = await supabase.from('negocios').select('*').eq('activo', true)

      console.log('[explorar] resultado query negocios activos', {
        data: consulta.data,
        error: consulta.error,
      })

      if (!activo) return

      if (consulta.error) {
        setNegocios([])
      } else {
        setNegocios((consulta.data ?? []) as Negocio[])
      }

      setCargando(false)
    }

    void cargarNegocios()

    return () => {
      activo = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">Explorar</h1>
        <p className="mt-1 text-sm text-[#888]">
          {negocios.length} {negocios.length === 1 ? 'lugar' : 'lugares'} disponibles
        </p>
      </div>

      <div className="p-4">
        {cargando ? (
          <p className="mt-8 text-center text-sm text-[#888]">Cargando negocios...</p>
        ) : negocios.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-bold text-[#0A0A0A]">No hay negocios disponibles aún</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {negocios.map((negocio) => (
              <div key={negocio.id} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <h2 className="text-base font-black text-[#0A0A0A]">{negocio.nombre}</h2>
                <div className="mt-2 space-y-1 text-sm text-[#555]">
                  <p>
                    <span className="font-semibold text-[#0A0A0A]">Categoría:</span> {negocio.categoria}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0A0A0A]">Ciudad:</span> {negocio.ciudad}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0A0A0A]">Dirección:</span> {negocio.direccion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
