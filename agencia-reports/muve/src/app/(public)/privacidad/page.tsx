import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso de privacidad | MUVET',
  description: 'Información sobre recopilación, uso y protección de datos personales en MUVET.',
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] px-6 py-10 text-white md:py-14">
      <article className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#111111] p-6 md:p-10">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8FF47]">MUVET</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
            Aviso de privacidad
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            En MUVET protegemos tu información personal y la usamos únicamente para operar tu membresía y mejorar tu experiencia en la plataforma.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">1. Responsable de los datos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li><span className="font-semibold">Nombre:</span> MUVET</li>
              <li>
                <span className="font-semibold">Contacto:</span>{' '}
                <a href="mailto:hola@muvet.mx" className="text-[#E8FF47] underline-offset-2 hover:underline">
                  hola@muvet.mx
                </a>
              </li>
              <li>
                <span className="font-semibold">Sitio web:</span>{' '}
                <a
                  href="https://muvet.mx"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#E8FF47] underline-offset-2 hover:underline"
                >
                  muvet.mx
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">2. Datos que recopilamos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li>Nombre completo</li>
              <li>Correo electrónico</li>
              <li>Número de teléfono</li>
              <li>Ciudad</li>
              <li>Fecha de nacimiento</li>
              <li>Historial de reservaciones y check-ins</li>
              <li>Información de pago (procesada por Stripe, no almacenamos datos de tarjeta)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">3. Uso de los datos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li>Gestionar tu membresía y acceso a la plataforma</li>
              <li>Procesar pagos a través de Stripe</li>
              <li>Enviarte notificaciones sobre tu membresía y reservaciones</li>
              <li>Mejorar nuestros servicios</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">4. Compartición de datos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li>Stripe (procesamiento de pagos)</li>
              <li>Supabase (almacenamiento seguro de datos)</li>
              <li>No vendemos tus datos a terceros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">5. Seguridad</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li>Todos los datos se transmiten cifrados mediante HTTPS</li>
              <li>Almacenamiento seguro en servidores de Supabase</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">6. Tus derechos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li>Acceder, modificar o eliminar tus datos</li>
              <li>Cancelar tu membresía en cualquier momento</li>
              <li>
                Contactar a{' '}
                <a href="mailto:hola@muvet.mx" className="text-[#E8FF47] underline-offset-2 hover:underline">
                  hola@muvet.mx
                </a>{' '}
                para cualquier solicitud
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">7. Cookies</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li>Usamos cookies necesarias para el funcionamiento de la app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#E8FF47]">8. Cambios a este aviso</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
              <li>Notificaremos cambios por correo electrónico</li>
            </ul>
          </section>
        </div>

        <footer className="mt-8 border-t border-white/10 pt-5 text-sm text-white/65">
          <span className="font-semibold text-white/85">Fecha de última actualización:</span> Mayo 2025
        </footer>
      </article>
    </main>
  )
}
