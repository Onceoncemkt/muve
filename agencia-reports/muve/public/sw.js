const CACHE_NAME = 'muvet-v2'
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request))
})
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = typeof data.title === 'string' && data.title ? data.title : 'MUVET'
  const body = typeof data.body === 'string' && data.body ? data.body : 'Tienes una notificación nueva.'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/negocio/dashboard' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/negocio/dashboard'
  event.waitUntil(
    clients.openWindow(targetUrl)
  )
})
