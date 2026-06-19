import { requireAdmin } from '@/lib/admin/datos'
import AdminSidebar from './_components/AdminSidebar'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminPreviewEnabled } = await requireAdmin()

  return (
    <div className="min-h-screen bg-aurora text-white">
      <AdminSidebar previewLocal={adminPreviewEnabled} />
      <main className="md:ml-60">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-20">{children}</div>
      </main>
    </div>
  )
}
