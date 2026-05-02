import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ codigo?: string }>

export default async function PreregistroGraciasPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const codigo = params.codigo?.trim() ?? ''
  const db = createServiceClient()

  let storyUrl = ''
  if (codigo) {
    const { data } = await db
      .from('preregistros')
      .select('story_url')
      .eq('codigo_descuento', codigo)
      .maybeSingle<{ story_url: string | null }>()

    storyUrl = data?.story_url ?? ''
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-5 py-8 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8FF47]">MUVET</p>
        <h1 className="mt-4 text-4xl font-black leading-tight">¡Listo! Revisa tu correo 📧</h1>
        <p className="mt-4 text-sm text-white/70">
          Tu código está reservado: <span className="font-black text-[#E8FF47]">{codigo || 'MUVET20-XXXXXX'}</span>
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href={storyUrl || '#'}
            className={`rounded-lg px-4 py-3 text-sm font-black uppercase tracking-wider ${
              storyUrl
                ? 'bg-[#E8FF47] text-[#0A0A0A] hover:bg-[#f1ff89]'
                : 'cursor-not-allowed bg-white/10 text-white/40'
            }`}
          >
            Descargar imagen para stories
          </a>
          <Link
            href="https://muvet.mx"
            className="rounded-lg border border-white/20 px-4 py-3 text-sm font-black uppercase tracking-wider text-white hover:border-[#E8FF47] hover:text-[#E8FF47]"
          >
            Volver a inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
