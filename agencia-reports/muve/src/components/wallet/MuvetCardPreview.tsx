import { QRCodeSVG } from 'qrcode.react'

type Props = {
  socio: {
    nombre: string
    plan: 'BÁSICO' | 'PLUS' | 'TOTAL'
    ciudad: string
    visitasUsadas: number
    visitasTotales: number
    fechaVencimiento: string
    idSocio: string
    qrCode: string
  }
}

function porcentajeUsado(visitasUsadas: number, visitasTotales: number) {
  if (visitasTotales <= 0) return 0
  return Math.min(Math.round((visitasUsadas / visitasTotales) * 100), 100)
}

export default function MuvetCardPreview({ socio }: Props) {
  const {
    nombre,
    plan,
    ciudad,
    visitasUsadas,
    visitasTotales,
    fechaVencimiento,
    idSocio,
    qrCode,
  } = socio
  const progreso = porcentajeUsado(visitasUsadas, visitasTotales)
  const visitasRestantes = Math.max(visitasTotales - visitasUsadas, 0)

  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 font-sans text-white shadow-[0_18px_45px_-28px_rgba(0,0,0,0.75)]">
      <div className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 rounded-full bg-[#6B4FE8]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 -left-10 h-48 w-48 rounded-full bg-[#E8FF47]/15 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8FF47] text-sm font-black text-[#0A0A0A]">
            MV
          </div>
          <span className="text-base font-black tracking-wide text-white">MUVET</span>
        </div>
        <span className="rounded-full bg-[#6B4FE8] px-3 py-1 text-[11px] font-black tracking-wider text-white">
          {plan}
        </span>
      </div>

      <h3 className="mt-4 text-2xl font-black leading-tight">{nombre}</h3>
      <p className="mt-1 text-sm font-medium text-white/75">Membresía activa · {ciudad}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Créditos restantes</p>
          <p className="mt-1 text-lg font-black text-[#E8FF47]">{visitasRestantes}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Válido hasta</p>
          <p className="mt-1 text-sm font-bold text-white">{fechaVencimiento}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-white/70">Progreso de créditos</span>
          <span className="text-white">{visitasUsadas}/{visitasTotales}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#E8FF47] transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="rounded-xl border border-[#E8FF47]/20 bg-white p-2">
          <QRCodeSVG value={qrCode} size={96} level="M" bgColor="#FFFFFF" fgColor="#0A0A0A" />
        </div>
        <p className="text-right text-[11px] font-semibold text-white/70">
          muvet.mx · ID: {idSocio}
        </p>
      </div>
    </article>
  )
}
