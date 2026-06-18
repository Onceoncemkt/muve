import AdminReservacionesSection from '@/components/admin/AdminReservacionesSection'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AdminReservacionesPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">Reservaciones</h1>
        <p className="mt-1 text-xs text-white/50">
          Gestiona, reprograma y cambia el estado de las reservaciones de todos los negocios.
        </p>
      </div>
      <AdminReservacionesSection />
    </div>
  )
}
