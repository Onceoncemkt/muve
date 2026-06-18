import { adminDb, cargarUsuarios, cargarNegocios, derivarRelaciones } from '@/lib/admin/datos'
import UsuariosTabla from './_components/UsuariosTabla'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminUsuariosPage() {
  const db = adminDb()
  const [{ usuarios, usuariosConNegocioIdDisponible }, negociosAfiliados] = await Promise.all([
    cargarUsuarios(db),
    cargarNegocios(db),
  ])
  const { negociosOpciones } = derivarRelaciones(usuarios, negociosAfiliados)

  const negocioNombrePorId: Record<string, string> = {}
  for (const negocio of negociosAfiliados) negocioNombrePorId[negocio.id] = negocio.nombre

  return (
    <UsuariosTabla
      usuarios={usuarios.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        ciudad: u.ciudad,
        rol: u.rol,
        edad: u.edad,
        plan_activo: u.plan_activo,
        creditos_extra: u.creditos_extra,
        negocio_id: u.negocio_id,
      }))}
      negocioNombrePorId={negocioNombrePorId}
      negociosOpciones={negociosOpciones}
      negociosParaInvitar={negociosAfiliados.map((n) => ({ id: n.id, nombre: n.nombre }))}
      usuariosConNegocioIdDisponible={usuariosConNegocioIdDisponible}
    />
  )
}
