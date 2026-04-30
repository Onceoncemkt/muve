import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIA_LABELS, CIUDAD_LABELS, type Categoria, type Ciudad } from '@/types'

type NegocioDetalle = {
  id: string
  nombre: string
  categoria: string
  ciudad: string
  direccion: string | null
  descripcion: string | null
  imagen_url: string | null
  instagram_handle: string | null
  tiktok_handle: string | null
  requiere_reserva: boolean | null
}

type BotonEnlace = {
  etiqueta: string
  href: string
}

function normalizarHandleSocial(handle: string | null | undefined): string | null {
  if (typeof handle !== 'string') return null
  const limpio = handle.trim().replace(/^@+/, '')
  return limpio.length > 0 ? limpio : null
}

function ciudadLabel(ciudad: string) {
  return CIUDAD_LABELS[ciudad as Ciudad] ?? ciudad
}

function categoriaLabel(categoria: string) {
  return CATEGORIA_LABELS[categoria as Categoria] ?? categoria
}

function construirBotonesEnlaces(negocio: NegocioDetalle): BotonEnlace[] {
  const botones: BotonEnlace[] = []
  const instagramHandle = normalizarHandleSocial(negocio.instagram_handle)
  const tiktokHandle = normalizarHandleSocial(negocio.tiktok_handle)

  if (instagramHandle) {
    botones.push({
      etiqueta: 'Instagram',
      href: `https://instagram.com/${instagramHandle}`,
    })
  }

  if (tiktokHandle) {
    botones.push({
      etiqueta: 'TikTok',
      href: `https://tiktok.com/@${tiktokHandle}`,
    })
  }

  if (typeof negocio.direccion === 'string' && negocio.direccion.trim()) {
    const direccionCompleta = `${negocio.direccion.trim()}, ${negocio.ciudad}`
    botones.push({
      etiqueta: 'Cómo llegar',
      href: `https://maps.google.com/?q=${encodeURIComponent(direccionCompleta)}`,
    })
  }

  return botones
}

export default async function NegocioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: negocio, error } = await supabase
    .from('negocios')
    .select('id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, tiktok_handle, requiere_reserva')
    .eq('id', id)
    .maybeSingle<NegocioDetalle>()

  if (error || !negocio) notFound()

  const botonesEnlaces = construirBotonesEnlaces(negocio)
  const accionPrincipalLabel = negocio.requiere_reserva === false ? 'Hacer check-in' : 'Reservar'

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <header className="bg-[#0A0A0A] px-4 py-6 text-white">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/explorar"
            className="inline-flex rounded-lg border border-[#E5E5E5]/30 px-3 py-2 text-xs font-black uppercase tracking-wider text-[#E8FF47] hover:border-[#E8FF47]"
          >
            ← Explorar
          </Link>
          <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-[#E8FF47]">
            {categoriaLabel(negocio.categoria)} · {ciudadLabel(negocio.ciudad)}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{negocio.nombre}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
          {negocio.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={negocio.imagen_url}
              alt={negocio.nombre}
              className="h-56 w-full object-cover"
            />
          ) : (
            <div className="flex h-56 items-center justify-center bg-[#0A0A0A] text-lg font-black uppercase tracking-widest text-[#E8FF47]">
              Galería pendiente
            </div>
          )}
        </section>

        {negocio.descripcion && (
          <section className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[#666]">
              Descripción
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#444]">{negocio.descripcion}</p>
          </section>
        )}

        {botonesEnlaces.length > 0 && (
          <section className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[#666]">
              Síguenos y visítanos
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {botonesEnlaces.map((boton) => (
                <a
                  key={boton.etiqueta}
                  href={boton.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-black text-[#E8FF47] transition-colors hover:bg-[#222]"
                >
                  {boton.etiqueta}
                </a>
              ))}
            </div>
          </section>
        )}

        <Link
          href="/explorar"
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#0A0A0A] px-4 py-3 text-sm font-black text-[#E8FF47] transition-colors hover:bg-[#222]"
        >
          {accionPrincipalLabel}
        </Link>
      </main>
    </div>
  )
}
