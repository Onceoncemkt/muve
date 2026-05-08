import Link from 'next/link'
import { esCiudadBC } from '@/lib/planes'
import { CIUDAD_LABELS, CIUDADES_OPERATIVAS, type Ciudad } from '@/types'

type PosicionCiudad = {
  lat: number
  lng: number
  top: string
  left: string
}

const POSICIONES_CIUDAD: Record<Ciudad, PosicionCiudad> = {
  tulancingo: { lat: 20.0833, lng: -98.3667, top: '60%', left: '62%' },
  pachuca: { lat: 20.1011, lng: -98.7591, top: '58%', left: '59%' },
  ensenada: { lat: 31.8667, lng: -116.5964, top: '28%', left: '13%' },
  tijuana: { lat: 32.5149, lng: -117.0382, top: '22%', left: '9%' },
  tecate: { lat: 32.5667, lng: -116.6233, top: '21%', left: '12%' },
}

export default function MapaCiudadesMexico() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#111] to-[#0A0A0A] p-4 sm:p-6">
        <div className="relative mx-auto aspect-[16/10] w-full max-w-4xl">
          <svg
            viewBox="0 0 1000 620"
            className="h-full w-full"
            role="img"
            aria-label="Mapa de México con ciudades operativas de MUVET"
          >
            <path
              d="M84 174 L129 160 L177 166 L222 183 L264 204 L310 212 L355 196 L398 178 L444 174 L489 187 L532 213 L574 234 L618 246 L661 252 L705 272 L748 310 L782 337 L819 363 L852 390 L883 422 L909 457 L918 494 L899 524 L860 546 L813 548 L767 537 L721 528 L675 533 L632 547 L589 560 L547 564 L503 548 L462 525 L426 494 L388 472 L346 462 L303 453 L259 438 L215 414 L178 386 L145 354 L119 318 L98 285 L84 252 Z"
              fill="#1A1A1A"
              stroke="#2E2E2E"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <path
              d="M113 223 L153 244 L188 269 M301 448 L331 423 L365 413 M580 559 L561 530 L549 499 M730 526 L754 489 L778 454 M478 191 L500 225 L532 243"
              fill="none"
              stroke="#242424"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>

          {CIUDADES_OPERATIVAS.map((ciudad) => {
            const posicion = POSICIONES_CIUDAD[ciudad]
            const esZonaBC = esCiudadBC(ciudad)
            const pinClase = esZonaBC
              ? 'bg-[#E8FF47] group-hover:shadow-[0_0_0_6px_rgba(232,255,71,0.18)]'
              : 'bg-[#6B4FE8] group-hover:shadow-[0_0_0_6px_rgba(107,79,232,0.18)]'
            return (
              <Link
                key={ciudad}
                href={`/explorar?ciudad=${ciudad}`}
                className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ top: posicion.top, left: posicion.left }}
                aria-label={`${CIUDAD_LABELS[ciudad]} (${posicion.lat}, ${posicion.lng})`}
                title={`${CIUDAD_LABELS[ciudad]} (${posicion.lat}, ${posicion.lng})`}
              >
                <span className={`relative block h-4 w-4 rounded-full border-2 border-[#0A0A0A] transition duration-200 group-hover:scale-110 ${pinClase}`}>
                  <span className={`absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1 rotate-45 border-r-2 border-b-2 border-[#0A0A0A] ${esZonaBC ? 'bg-[#E8FF47]' : 'bg-[#6B4FE8]'}`} />
                </span>
                <span className="mt-3 block whitespace-nowrap text-center text-[11px] font-semibold tracking-wide text-white/90 drop-shadow-md transition-opacity duration-200 group-hover:opacity-100 sm:text-xs">
                  {CIUDAD_LABELS[ciudad]}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-white/70 sm:text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm bg-[#6B4FE8]" />
          Zona Centro
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm bg-[#E8FF47]" />
          Zona Baja California
        </span>
      </div>
    </div>
  )
}
