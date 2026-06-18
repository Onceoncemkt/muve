import { CIUDAD_LABELS } from '@/types'
import { normalizarCategoriasNegocio } from '@/lib/planes'
import {
  adminDb,
  cargarUsuarios,
  cargarNegocios,
  derivarRelaciones,
  cargarStripeStatus,
  CATEGORIA_FORM_LABELS,
  NIVEL_LABELS,
} from '@/lib/admin/datos'
import type { NivelNegocio } from '@/types'
import DetalleNegocio from './_components/DetalleNegocio'
import FormCrearNegocio from './_components/FormCrearNegocio'
import NegociosBrowser, { type PanelNegocio } from './_components/NegociosBrowser'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminNegociosPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio_status?: string; negocio_msg?: string }>
}) {
  const params = await searchParams
  const negocioStatus = params.negocio_status === 'ok' || params.negocio_status === 'error' ? params.negocio_status : null
  const negocioMsg = params.negocio_msg?.trim() ?? ''

  const db = adminDb()
  const [{ usuarios }, negociosAfiliados] = await Promise.all([cargarUsuarios(db), cargarNegocios(db)])
  const { staffPorNegocio, staffParaAsignar } = derivarRelaciones(usuarios, negociosAfiliados)
  const stripeStatusPorNegocio = await cargarStripeStatus(negociosAfiliados)

  const negociosParaInvitar = negociosAfiliados.map((n) => ({ id: n.id, nombre: n.nombre }))

  const paneles: PanelNegocio[] = negociosAfiliados.map((negocio) => {
    const stripeEstado = stripeStatusPorNegocio.get(negocio.id) ?? 'no_account'
    const staffAsignado = (staffPorNegocio.get(negocio.id) ?? []).map((s) => ({ id: s.id, nombre: s.nombre }))
    const categoriasNegocio = normalizarCategoriasNegocio(negocio.categorias, negocio.categoria)
    const categoriaLabel = (categoriasNegocio.length > 0 ? categoriasNegocio : [negocio.categoria])
      .map((c) => CATEGORIA_FORM_LABELS[c])
      .join(' · ')
    const planLabel = NIVEL_LABELS[(negocio.plan_negocio ?? 'basico') as NivelNegocio]

    return {
      id: negocio.id,
      nombre: negocio.nombre,
      direccion: negocio.direccion,
      ciudadLabel: CIUDAD_LABELS[negocio.ciudad],
      categoriaLabel,
      planLabel,
      stripeEstado,
      activo: negocio.activo,
      detalle: (
        <DetalleNegocio
          negocio={negocio}
          stripeStatus={stripeEstado}
          staffAsignado={staffAsignado}
          staffParaAsignar={staffParaAsignar}
        />
      ),
    }
  })

  return (
    <div className="space-y-4">
      {negocioStatus && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-semibold ${
            negocioStatus === 'ok'
              ? 'bg-[#E8FF47]/20 text-[#E8FF47] ring-1 ring-[#E8FF47]/40'
              : 'bg-[#6B4FE8]/20 text-[#CBBEFF] ring-1 ring-[#6B4FE8]/40'
          }`}
        >
          {negocioMsg || (negocioStatus === 'ok' ? 'Operación realizada.' : 'No se pudo completar la operación.')}
        </div>
      )}

      <NegociosBrowser paneles={paneles} formularioNuevo={<FormCrearNegocio negociosParaInvitar={negociosParaInvitar} />} />
    </div>
  )
}
