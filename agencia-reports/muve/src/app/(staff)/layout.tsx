import BannerInstalarApp from '@/components/BannerInstalarApp'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BannerInstalarApp />
      {children}
    </>
  )
}
