'use client'

import { QRCodeSVG } from 'qrcode.react'

interface WalletPassCardProps {
  nombre?: string
  plan?: 'BÁSICO' | 'PLUS' | 'TOTAL'
  ciudad?: string
  visitasUsadas?: number
  visitasTotales?: number
  fechaVencimiento?: string
  anoVencimiento?: string
  idSocio?: string
  qrCode?: string
}

export default function WalletPassCard({
  nombre,
  plan,
  ciudad,
  visitasUsadas,
  visitasTotales,
  fechaVencimiento,
  anoVencimiento,
  idSocio,
  qrCode,
}: WalletPassCardProps) {

  const nombreSocio = nombre ?? 'María García'
  const planSocio = plan ?? 'PLUS'
  const ciudadSocio = ciudad ?? 'Tulancingo'
  const visitasTotalesSeguras = Math.max(Math.trunc(visitasTotales ?? 12), 0)
  const visitasUsadasSeguras = Math.max(Math.trunc(visitasUsadas ?? 8), 0)
  const visitasUsadasLimitadas = visitasTotalesSeguras > 0
    ? Math.min(visitasUsadasSeguras, visitasTotalesSeguras)
    : 0
  const visitasRestantes = Math.max(visitasTotalesSeguras - visitasUsadasLimitadas, 0)
  const porcentajeBarra = visitasTotalesSeguras > 0
    ? Math.min((visitasUsadasLimitadas / visitasTotalesSeguras) * 100, 100)
    : 0
  const fechaVencimientoSocio = fechaVencimiento ?? '15 May'
  const anoVencimientoSocio = anoVencimiento ?? '2026'
  const idSocioTexto = idSocio ?? 'MUVET-0001'
  const qrValue = qrCode ?? `MUVET|${idSocioTexto}|${planSocio}|${ciudadSocio}`

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="w-[320px] overflow-hidden rounded-[16px] shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        style={{ fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif" }}
      >
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0A0A0A_0%,#1A1240_100%)] px-5 pb-5 pt-6 before:pointer-events-none before:absolute before:-right-[10px] before:-top-[10px] before:text-[80px] before:font-black before:tracking-[-3px] before:text-[rgba(232,255,71,0.04)] before:content-['MUVET']">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-[10px]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#E8FF47] text-[14px] font-black text-[#0A0A0A]">
                MV
              </div>
              <span className="text-[18px] font-bold text-white">MUVET</span>
            </div>
            <span className="rounded-[20px] border border-[rgba(107,79,232,0.5)] bg-[rgba(107,79,232,0.3)] px-[10px] py-1 text-[10px] font-bold uppercase tracking-[1.5px] text-[#A891FF]">
              Plan {planSocio}
            </span>
          </div>
          <div className="mb-1 text-[22px] font-bold tracking-[-0.3px] text-white">{nombreSocio}</div>
          <div className="text-[12px] tracking-[0.3px] text-[rgba(255,255,255,0.4)]">
            Membresía activa · {ciudadSocio}
          </div>
        </div>

        <div className="bg-[#161616] px-5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-[10px]">
            <div className="rounded-[10px] bg-[#1E1E1E] px-[14px] py-3">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-[1.5px] text-[rgba(255,255,255,0.3)]">
                Visitas restantes
              </div>
              <div className="text-[18px] font-bold text-[#E8FF47]">{visitasRestantes}</div>
              <div className="mt-[2px] text-[10px] text-[rgba(255,255,255,0.3)]">
                de {visitasTotalesSeguras} este ciclo
              </div>
            </div>

            <div className="rounded-[10px] bg-[#1E1E1E] px-[14px] py-3">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-[1.5px] text-[rgba(255,255,255,0.3)]">
                Válido hasta
              </div>
              <div className="text-[15px] font-bold text-white">{fechaVencimientoSocio}</div>
              <div className="mt-[2px] text-[10px] text-[rgba(255,255,255,0.3)]">{anoVencimientoSocio}</div>
            </div>
          </div>

          <div className="mb-4 rounded-[10px] bg-[#1E1E1E] px-[14px] py-3">
            <div className="mb-2 flex justify-between">
              <span className="text-[10px] uppercase tracking-[1px] text-[rgba(255,255,255,0.4)]">
                Visitas usadas
              </span>
              <span className="text-[10px] font-semibold text-[#E8FF47]">
                {visitasUsadasLimitadas} de {visitasTotalesSeguras}
              </span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-[3px] bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-[3px] bg-[linear-gradient(90deg,#6B4FE8,#E8FF47)]"
                style={{ width: `${porcentajeBarra}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-[14px] rounded-[12px] bg-white p-4">
            <QRCodeSVG
              value={qrValue}
              size={80}
              bgColor="#FFFFFF"
              fgColor="#000000"
              className="h-20 w-20 shrink-0"
            />
            <div>
              <div className="mb-[3px] text-[12px] font-bold text-[#0A0A0A]">Tu pase MUVET</div>
              <div className="text-[10px] leading-[1.4] text-[#888888]">
                Muéstralo en recepción para registrar tu visita
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#111111] px-5 py-[10px]">
          <span className="text-[9px] tracking-[0.5px] text-[rgba(255,255,255,0.15)]">
            muvet.mx · Membresía de bienestar
          </span>
          <span className="text-[9px] tracking-[0.5px] text-[rgba(255,255,255,0.15)]">
            ID: {idSocioTexto}
          </span>
        </div>
      </div>
    </div>
  )
}
