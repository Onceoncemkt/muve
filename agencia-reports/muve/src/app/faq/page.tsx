import Link from 'next/link'

type FaqSection = {
  title: string
  questions: Array<{ q: string; a: string }>
}

const FAQ: FaqSection[] = [
  {
    title: '¿CÓMO FUNCIONA?',
    questions: [
      { q: '¿Qué es MUVET?', a: 'MUVET es una membresía que te da acceso a diferentes negocios para entrenar, recuperarte y mantenerte activo en una sola app.' },
      { q: '¿Cómo uso mis créditos?', a: 'Cada reservación confirmada usa créditos de tu ciclo. El consumo depende del tipo de servicio y de las reglas de tu plan.' },
      { q: '¿Qué incluye cada plan?', a: 'Cada plan incluye una cantidad de créditos por ciclo y acceso a diferentes tipos de negocios según el nivel del plan.' },
      { q: '¿Cómo reservo una clase?', a: 'Desde Explorar selecciona un negocio, elige horario y confirma tu reservación. Recibirás confirmación en la app.' },
      { q: '¿Cómo funciona el pase/QR?', a: 'Tu pase digital en Wallet se valida en el negocio para registrar tu visita y descontar los créditos correspondientes.' },
    ],
  },
  {
    title: 'CRÉDITOS Y PLAN',
    questions: [
      { q: '¿Cuántos créditos tengo?', a: 'Puedes verlo en tu dashboard en el bloque de progreso de ciclo y créditos restantes.' },
      { q: '¿Los créditos se acumulan al siguiente mes?', a: 'No. Los créditos se reinician al finalizar cada ciclo activo.' },
      { q: '¿Qué pasa si no uso todos mis créditos?', a: 'Los créditos no utilizados se pierden al cierre del ciclo actual.' },
      { q: '¿Puedo cambiar de plan?', a: 'Sí. Puedes gestionar cambios desde la sección de membresía o portal de pagos cuando esté habilitado para tu cuenta.' },
    ],
  },
  {
    title: 'RESERVACIONES',
    questions: [
      { q: '¿Con cuánta anticipación puedo reservar?', a: 'Depende de la disponibilidad de cada negocio y horario publicado en la app.' },
      { q: '¿Cómo cancelo una reservación?', a: 'En tu dashboard, dentro de Mis reservaciones, puedes cancelar una reservación con la anticipación permitida.' },
      { q: '¿Qué pasa si no me presento? (no-show)', a: 'Se marca como no-show y el crédito se descuenta automáticamente.' },
      { q: '¿Qué pasa si acumulo 3 no-shows?', a: 'Tu acceso a nuevas reservaciones se suspende por 7 días.' },
      { q: '¿Puedo hacer reservaciones en cualquier ciudad?', a: 'Sí, siempre que haya negocios y disponibilidad en la ciudad donde quieras reservar.' },
    ],
  },
  {
    title: 'PAGOS Y MEMBRESÍA',
    questions: [
      { q: '¿Cuándo se cobra mi membresía?', a: 'El cobro se realiza de acuerdo con la fecha de renovación de tu suscripción activa.' },
      { q: '¿Cómo cancelo mi membresía?', a: 'Puedes hacerlo desde la gestión de membresía en tu dashboard cuando esté disponible para tu cuenta.' },
      { q: '¿Hay reembolsos?', a: 'Los reembolsos se evalúan según términos de servicio y políticas vigentes al momento del cobro.' },
      { q: '¿Los precios son de lanzamiento?', a: 'Las promociones de lanzamiento pueden cambiar; revisa siempre la información visible al momento de contratar.' },
    ],
  },
  {
    title: 'NEGOCIOS',
    questions: [
      { q: '¿Qué negocios están disponibles?', a: 'En la sección Explorar puedes ver los negocios activos por ciudad y categoría.' },
      { q: '¿Puedo ir sin reservación?', a: 'Depende del negocio y categoría. Algunos requieren reservación obligatoria y otros permiten acceso directo.' },
      { q: '¿Qué es el plan Básico, Plus y Total?', a: 'Son niveles de membresía con distinto alcance de acceso y créditos por ciclo.' },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-20">
      <div className="bg-white px-4 py-6 shadow-sm">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
        >
          ← Regresar
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-[#0A0A0A]">FAQ</h1>
        <p className="mt-1 text-sm text-[#888]">Preguntas frecuentes de MUVET</p>
      </div>

      <div className="mx-auto mt-4 w-full max-w-3xl space-y-4 px-4">
        {FAQ.map((section) => (
          <section key={section.title} className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B4FE8]">{section.title}</h2>
            <div className="mt-3 space-y-3">
              {section.questions.map((item) => (
                <div key={item.q} className="rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-3">
                  <p className="text-sm font-bold text-[#0A0A0A]">{item.q}</p>
                  <p className="mt-1 text-sm text-[#555]">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
