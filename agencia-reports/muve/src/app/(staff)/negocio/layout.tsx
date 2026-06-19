import NegocioNav from './_components/NegocioNav'

export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-12">
      <NegocioNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
