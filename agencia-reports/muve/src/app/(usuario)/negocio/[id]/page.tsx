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
  telefono_contacto: string | null
  email_contacto: string | null
  horario_atencion: string | null
  servicios_incluidos: string | null
  monto_maximo_visita: number | null
  requiere_reserva: boolean | null
}

type BotonEnlace = {
  etiqueta: string
  href: string
}

type ServicioDetalle = {
  id: string
  nombre: string
  precio_normal_mxn: number | null
  descripcion: string | null
  activo: boolean | null
}

const RESTAURANTE_CONFIG_PREFIX = '__MUVET_RESTAURANTE_CONFIG__:'

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

function formatMoneyMxn(monto: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(monto)
}

function extraerTextoBeneficio(serviciosIncluidos: string | null | undefined): string | null {
  if (typeof serviciosIncluidos !== 'string') return null
  const limpio = serviciosIncluidos.trim()
  if (!limpio) return null
  if (!limpio.startsWith(RESTAURANTE_CONFIG_PREFIX)) return limpio

  const payload = limpio.slice(RESTAURANTE_CONFIG_PREFIX.length).trim()
  if (!payload) return null

  try {
    const parsed = JSON.parse(payload) as { servicio?: unknown }
    if (typeof parsed.servicio === 'string' && parsed.servicio.trim()) {
      return parsed.servicio.trim()
    }
  } catch {
    return payload
  }

  return payload
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
    .select('id, nombre, categoria, ciudad, direccion, descripcion, imagen_url, instagram_handle, tiktok_handle, telefono_contacto, email_contacto, horario_atencion, servicios_incluidos, monto_maximo_visita, requiere_reserva')
    .eq('id', id)
    .maybeSingle<NegocioDetalle>()

  if (error || !negocio) notFound()

  const consultaServicios = await supabase
    .from('negocio_servicios')
    .select('id, nombre, precio_normal_mxn, descripcion, activo')
    .eq('negocio_id', id)
    .eq('activo', true)
    .order('created_at', { ascending: true })
    .returns<ServicioDetalle[]>()

  const serviciosDisponibles = consultaServicios.error
    ? []
    : (consultaServicios.data ?? [])
  const botonesEnlaces = construirBotonesEnlaces(negocio)
  const textoBeneficio = extraerTextoBeneficio(negocio.servicios_incluidos)
  const montoMaximoVisita = typeof negocio.monto_maximo_visita === 'number'
    ? Math.max(Math.trunc(negocio.monto_maximo_visita), 0)
    : 0
  const mostrarBeneficios = Boolean(textoBeneficio) || montoMaximoVisita > 0 || serviciosDisponibles.length > 0
  const accionPrincipalLabel = negocio.requiere_reserva === false ? 'Hacer check-in' : 'Reservar'
  const accionPrincipalAyuda = negocio.requiere_reserva === false
    ? 'Presenta tu pase MUVET en sucursal.'
    : 'Reserva desde explorar en el horario disponible.'

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

        <section className="rounded-xl border border-[#E5E5E5] bg-white p-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-[#666]">
            Información completa
          </h2>
          <div className="mt-2 space-y-1 text-sm text-[#444]">
            <p>
              <span className="font-semibold text-[#0A0A0A]">Categoría:</span> {categoriaLabel(negocio.categoria)}
            </p>
            <p>
              <span className="font-semibold text-[#0A0A0A]">Ciudad:</span> {ciudadLabel(negocio.ciudad)}
            </p>
            {negocio.direccion && (
              <p>
                <span className="font-semibold text-[#0A0A0A]">Dirección:</span> {negocio.direccion}
              </p>
            )}
            {negocio.horario_atencion && (
              <p>
                <span className="font-semibold text-[#0A0A0A]">Horario:</span> {negocio.horario_atencion}
              </p>
            )}
            {negocio.telefono_contacto && (
              <p>
                <span className="font-semibold text-[#0A0A0A]">Teléfono:</span> {negocio.telefono_contacto}
              </p>
            )}
            {negocio.email_contacto && (
              <p>
                <span className="font-semibold text-[#0A0A0A]">Email:</span> {negocio.email_contacto}
              </p>
            )}
          </div>
        </section>

        {mostrarBeneficios && (
          <section className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[#666]">
              Beneficios MUVET
            </h2>
            {textoBeneficio && (
              <p className="mt-2 text-sm text-[#444]">{textoBeneficio}</p>
            )}
            {montoMaximoVisita > 0 && (
              <p className="mt-2 text-sm text-[#444]">
                Consumo máximo incluido por visita:{' '}
                <span className="font-semibold text-[#0A0A0A]">{formatMoneyMxn(montoMaximoVisita)}</span>
              </p>
            )}
            {serviciosDisponibles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {serviciosDisponibles.map((servicio) => (
                  <li key={servicio.id} className="flex items-start justify-between gap-2 text-sm text-[#444]">
                    <span className="min-w-0">
                      <span className="block">{servicio.nombre}</span>
                      {servicio.descripcion && (
                        <span className="block text-xs text-[#666]">{servicio.descripcion}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[#666]">
                      {typeof servicio.precio_normal_mxn === 'number' && servicio.precio_normal_mxn > 0
                        ? <span className="line-through">{formatMoneyMxn(servicio.precio_normal_mxn)}</span>
                        : 'Incluido'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
        <p className="text-center text-xs text-[#666]">{accionPrincipalAyuda}</p>
      </main>
    </div>
  )
}
