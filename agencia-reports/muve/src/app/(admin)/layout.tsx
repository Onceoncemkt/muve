import BannerInstalarApp from '@/components/BannerInstalarApp'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BannerInstalarApp />
      {children}
    </>
  )
}
