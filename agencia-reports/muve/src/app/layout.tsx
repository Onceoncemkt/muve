import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'MUVET — Membresía de bienestar',
  description: 'Un pase. Todo el bienestar. Gimnasios, clases, estéticas y restaurantes saludables en tu ciudad.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MUVET',
  },
}
export const viewport: Viewport = {
  themeColor: '#E8FF47',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
  (function() {
    var SW_VERSION = '2026-04-27-2';
    var SW_PATH = '/sw.js?v=' + SW_VERSION;
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', function() {
      navigator.serviceWorker.getRegistrations()
        .then(function(registrations) {
          return Promise.all(
            registrations.map(function(registration) {
              var activeUrl = registration.active && registration.active.scriptURL ? registration.active.scriptURL : '';
              var waitingUrl = registration.waiting && registration.waiting.scriptURL ? registration.waiting.scriptURL : '';
              var installingUrl = registration.installing && registration.installing.scriptURL ? registration.installing.scriptURL : '';
              var scriptUrl = activeUrl || waitingUrl || installingUrl;
              if (scriptUrl.indexOf('/sw.js') !== -1 && scriptUrl.indexOf('v=' + SW_VERSION) === -1) {
                return registration.unregister();
              }
              return Promise.resolve(false);
            })
          );
        })
        .catch(function() {
          return undefined;
        })
        .finally(function() {
          navigator.serviceWorker.register(SW_PATH, { scope: '/', updateViaCache: 'none' });
        });
    });
  })();
`,
          }}
        />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
