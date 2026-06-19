import Link from 'next/link'
import { adminDb, cargarCreditosOtorgados } from '@/lib/admin/datos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminConfiguracionPage() {
  const db = adminDb()
  const creditosOtorgados = await cargarCreditosOtorgados(db)

  const ambiente = process.env.NODE_ENV ?? 'desconocido'
  const previewAdmin = process.env.PREVIEW_ADMIN === 'true'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">Configuración</h1>
        <p className="mt-1 text-xs text-white/50">Herramientas administrativas y ajustes del sistema.</p>
      </div>

      {/* Herramientas */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/45">Herramientas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/preregistros"
            className="glass-card rounded-xl p-4 transition-colors hover:border-[#E8FF47]/50"
          >
            <p className="text-sm font-black text-white">Pre-registros</p>
            <p className="mt-1 text-xs text-white/55">
              Lista de pre-registros por ciudad, exportación CSV y notificación de lanzamiento.
            </p>
            <span className="mt-3 inline-flex text-xs font-bold uppercase tracking-wide text-[#E8FF47]">Abrir →</span>
          </Link>
        </div>
      </section>

      {/* Historial de ajustes de créditos */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/45">Historial de ajustes de créditos</h2>
          <p className="mt-1 text-xs text-white/50">
            Últimos créditos extra agregados o retirados manualmente por administración.
          </p>
        </div>
        <div className="glass-card scroll-fina overflow-x-auto rounded-xl">
          <table className="min-w-full border-collapse bg-transparent">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3">Cantidad</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Otorgado por</th>
              </tr>
            </thead>
            <tbody>
              {creditosOtorgados.map((row) => {
                const esRetiro = row.cantidad < 0
                const cantidadLabel = row.cantidad > 0 ? `+${row.cantidad}` : String(row.cantidad)
                return (
                  <tr key={row.id} className="border-b border-white/10 text-sm text-white/90">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{row.users?.nombre ?? 'Usuario no disponible'}</p>
                      <p className="text-xs text-white/55">{row.users?.email ?? row.user_id}</p>
                    </td>
                    <td className={`px-3 py-3 font-black ${esRetiro ? 'text-red-300' : 'text-[#E8FF47]'}`}>
                      {cantidadLabel}
                    </td>
                    <td className="px-3 py-3">{row.motivo}</td>
                    <td className="px-3 py-3 text-white/75">
                      {new Date(row.created_at).toLocaleString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3 text-xs font-bold uppercase text-[#CBBEFF]">
                      {row.otorgado_por ?? 'N/D'}
                    </td>
                  </tr>
                )
              })}
              {creditosOtorgados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/50">
                    No hay ajustes de créditos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Entorno */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/45">Entorno</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/45">Ambiente</p>
            <p className="mt-1 text-sm font-black text-white">{ambiente}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/45">Preview admin</p>
            <p className="mt-1 text-sm font-black text-white">{previewAdmin ? 'Activado' : 'Desactivado'}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
