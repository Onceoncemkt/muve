import { cookies } from 'next/headers'
import BannerInstalarApp from '@/components/BannerInstalarApp'
import { IMPERSONACION_COOKIE, type ImpersonacionInfo } from '@/lib/impersonacion'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONACION_COOKIE)?.value
  let impersonacion: ImpersonacionInfo | null = null
  if (raw) {
    try {
      impersonacion = JSON.parse(raw) as ImpersonacionInfo
    } catch {
      impersonacion = null
    }
  }

  return (
    <>
      {impersonacion && (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-[#E8FF47] px-4 py-2 text-[#0A0A0A]">
          <span className="text-xs font-black uppercase tracking-wide">
            Estás viendo el panel como {impersonacion.nombre}
          </span>
          <a
            href="/api/admin/impersonar-negocio/salir"
            className="rounded-md bg-[#0A0A0A] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#E8FF47] hover:bg-[#222222]"
          >
            Volver al admin →
          </a>
        </div>
      )}
      <BannerInstalarApp />
      {children}
    </>
  )
}
