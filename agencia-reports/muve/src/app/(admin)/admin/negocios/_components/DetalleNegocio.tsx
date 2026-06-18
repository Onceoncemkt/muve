import { CIUDAD_LABELS } from '@/types'
import type { NivelNegocio } from '@/types'
import { normalizarCategoriasNegocio, tarifaNegocioPorCheckin } from '@/lib/planes'
import type { StripeConnectStatus } from '@/lib/stripe-connect'
import NegocioStaffAsignarSelect from '@/components/admin/NegocioStaffAsignarSelect'
import {
  CATEGORIAS,
  CATEGORIA_FORM_LABELS,
  CATEGORIA_TARIFA_LABELS,
  CIUDADES,
  NIVELES,
  NIVEL_LABELS,
  ZONAS,
  ZONA_LABELS,
  formatearMonto,
  type NegocioAdmin,
} from '@/lib/admin/datos'

const NEXT = '/admin/negocios'

export default function DetalleNegocio({
  negocio,
  stripeStatus,
  staffAsignado,
  staffParaAsignar,
}: {
  negocio: NegocioAdmin
  stripeStatus: StripeConnectStatus
  staffAsignado: { id: string; nombre: string }[]
  staffParaAsignar: { id: string; nombre: string; email: string; negocioNombreActual: string | null }[]
}) {
  const planActual = (negocio.plan_negocio ?? 'basico') as NivelNegocio
  const categoriasNegocio = normalizarCategoriasNegocio(negocio.categorias, negocio.categoria)
  const categoriasRaw = (negocio.categorias ?? []) as string[]
  const tieneGym = categoriasRaw.includes('gym') || categoriasRaw.includes('gimnasio')
  const tieneClases = categoriasRaw.includes('clases')
  const creditos = tieneGym
    ? (tieneClases
      ? [{ label: 'Gym', creditos: '0.5' }, { label: 'Clases', creditos: '1' }]
      : [{ label: 'Gym', creditos: '0.5' }])
    : [{ label: CATEGORIA_TARIFA_LABELS[negocio.categoria], creditos: '1' }]
  const categoriasCosto = categoriasNegocio.length > 0 ? categoriasNegocio : [negocio.categoria]
  const tarifasPorCategoria = categoriasCosto.map((categoria) => {
    const monto = tarifaNegocioPorCheckin({
      categoria,
      planNegocio: planActual,
      zona: negocio.zona ?? 'zona1',
      ciudad: negocio.ciudad,
    })
    return `${CATEGORIA_TARIFA_LABELS[categoria]} ${formatearMonto(monto)}`
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-white">{negocio.nombre}</h3>
        <p className="mt-0.5 text-xs text-white/45">{negocio.direccion}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {categoriasNegocio.map((categoria) => (
          <span key={`${negocio.id}-${categoria}`} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65 ring-1 ring-white/10">
            {CATEGORIA_FORM_LABELS[categoria]}
          </span>
        ))}
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65 ring-1 ring-white/10">
          {CIUDAD_LABELS[negocio.ciudad]}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold tracking-[1px] text-white">
          {NIVEL_LABELS[planActual]}
        </span>
        {stripeStatus === 'active' && (
          <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-300 ring-1 ring-green-500/40">Stripe activo</span>
        )}
        {stripeStatus === 'pending' && (
          <span className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200 ring-1 ring-yellow-500/40">Stripe pendiente</span>
        )}
        {stripeStatus === 'no_account' && (
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50 ring-1 ring-white/10">Stripe sin conectar</span>
        )}
        {!negocio.activo && (
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55 ring-1 ring-white/15">Inactivo</span>
        )}
      </div>

      {/* Créditos por visita */}
      <div style={{ background: '#1A1A1A', border: '0.5px solid #2A2A2A', borderRadius: '6px', padding: '8px 10px' }}>
        {creditos.map((c) => (
          <div key={`${negocio.id}-credito-${c.label}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{ color: '#E8FF47', fontWeight: 700, fontSize: '13px' }}>{c.creditos}</span>
            <span style={{ color: '#555', fontSize: '11px' }}>
              crédito{c.creditos !== '1' ? 's' : ''} por visita · {c.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-white/45">{tarifasPorCategoria.join(' · ')}</p>

      {staffAsignado.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {staffAsignado.map((staff) => (
            <span key={staff.id} className="rounded-md bg-[#E8FF47]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E8FF47]">
              {staff.nombre}
            </span>
          ))}
        </div>
      )}

      {/* Editar */}
      <details className="rounded-lg border border-white/10 bg-[#0A0A0A] p-3">
        <summary className="cursor-pointer list-none rounded-md border border-[#6B4FE8] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#CBBEFF] hover:bg-[#6B4FE8]/20">
          Editar
        </summary>
        <form method="POST" encType="multipart/form-data" action={`/api/admin/negocios/${negocio.id}`} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="next" value={NEXT} />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Nombre</label>
            <input type="text" name="nombre" required defaultValue={negocio.nombre} className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">URL del logo</label>
            <input type="url" name="logo_url" defaultValue={negocio.logo_url ?? ''} placeholder="https://..." className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]" />
            <p className="mt-1 text-[10px] text-white/45">URL pública del logo para la landing.</p>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Categorías</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATEGORIAS.map((categoria) => {
                const checked = categoriasNegocio.includes(categoria)
                const inputId = `edit-cat-${negocio.id}-${categoria}`
                return (
                  <label key={categoria} htmlFor={inputId} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#151515] px-2.5 py-2 text-xs text-white/85">
                    <input id={inputId} type="checkbox" name="categorias" value={categoria} defaultChecked={checked} className="h-4 w-4 accent-[#6B4FE8]" />
                    {CATEGORIA_FORM_LABELS[categoria]}
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Zona</label>
            <select name="zona" required defaultValue={negocio.zona ?? 'zona1'} className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]">
              {ZONAS.map((zona) => (<option key={zona} value={zona}>{ZONA_LABELS[zona]}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Plan (tarifa)</label>
            <select name="plan_negocio" required defaultValue={planActual} className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]">
              {NIVELES.map((plan) => (<option key={plan} value={plan}>{NIVEL_LABELS[plan]}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Ciudad</label>
            <select name="ciudad" required defaultValue={negocio.ciudad} className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]">
              {CIUDADES.map((ciudad) => (<option key={ciudad} value={ciudad}>{CIUDAD_LABELS[ciudad]}</option>))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Dirección</label>
            <input type="text" name="direccion" required defaultValue={negocio.direccion} className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Descripción</label>
            <textarea name="descripcion" defaultValue={negocio.descripcion ?? ''} rows={2} className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Instagram</label>
            <input type="text" name="instagram_handle" defaultValue={negocio.instagram_handle ?? ''} placeholder="usuario" className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Foto del negocio</label>
            {negocio.imagen_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={negocio.imagen_url} alt={negocio.nombre} className="mb-2 h-28 w-full rounded-md border border-white/10 object-cover" />
            ) : (
              <p className="mb-2 text-[10px] text-white/45">Sin foto actual</p>
            )}
            <input type="file" name="foto_negocio" accept="image/*" className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-[11px] text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#6B4FE8] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-wide file:text-white hover:file:bg-[#5b40cd]" />
          </div>
          <div className="sm:col-span-2">
            <input id={`mostrar-landing-${negocio.id}`} type="checkbox" name="mostrar_en_landing" value="true" defaultChecked={negocio.mostrar_en_landing} className="h-4 w-4 accent-[#6B4FE8]" />
            <label htmlFor={`mostrar-landing-${negocio.id}`} className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-2.5 py-1.5 text-xs text-white/80">
              Mostrar en landing de pre-registro
            </label>
            <p className="mt-1 text-[10px] text-white/45">Activa esto para que el logo aparezca en /preregistro.</p>
          </div>
          <div className="sm:col-span-2">
            <input id={`requiere-reserva-${negocio.id}`} type="checkbox" name="requiere_reserva" value="true" defaultChecked={negocio.requiere_reserva} className="peer h-4 w-4 accent-[#6B4FE8]" />
            <label htmlFor={`requiere-reserva-${negocio.id}`} className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-2.5 py-1.5 text-xs text-white/80">
              Requiere reserva
            </label>
            <div className="mt-2 hidden peer-checked:block">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/45">Capacidad por clase</label>
              <input type="number" name="capacidad_default" min={1} defaultValue={negocio.capacidad_default ?? 10} className="w-full rounded-md border border-white/15 bg-[#151515] px-2.5 py-2 text-xs text-white outline-none focus:border-[#6B4FE8]" />
            </div>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <button type="submit" className="rounded-md bg-[#6B4FE8] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#5b40cd]">
              Guardar cambios
            </button>
          </div>
        </form>
      </details>

      {/* Acciones Stripe / activo */}
      <div className="space-y-2">
        <form method="POST" action={`/api/admin/negocios/${negocio.id}/stripe-connect`}>
          <input type="hidden" name="next" value={NEXT} />
          <button type="submit" className="w-full rounded-md bg-[#0A0A0A] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#E8FF47] ring-1 ring-white/10 hover:bg-[#222222]">
            {negocio.stripe_account_id ? 'Reconectar Stripe' : 'Conectar cuenta Stripe'}
          </button>
        </form>
        <form method="POST" action={`/api/admin/negocios/${negocio.id}/toggle-activo`}>
          <input type="hidden" name="next" value={NEXT} />
          <button
            type="submit"
            className={`w-full rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
              negocio.activo ? 'bg-[#6B4FE8] text-white hover:bg-[#5b40cd]' : 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#d8f03f]'
            }`}
          >
            {negocio.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
        </form>
      </div>

      {/* Asignar staff */}
      <div className="border-t border-white/10 pt-3">
        <NegocioStaffAsignarSelect negocioId={negocio.id} opciones={staffParaAsignar} />
      </div>
    </div>
  )
}
