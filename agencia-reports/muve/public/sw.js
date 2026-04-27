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
self.addEventListener('push', event => {
  if (!event.data) return

  const data = event.data.json()
  const title = typeof data.title === 'string' ? data.title : 'MUVET'
  const body = typeof data.body === 'string' ? data.body : 'Tienes una notificación nueva.'
  const url = typeof data.url === 'string' ? data.url : '/dashboard'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const rawUrl = event.notification?.data?.url || '/dashboard'
  const targetUrl = new URL(rawUrl, self.location.origin).toString()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client && client.url === targetUrl) {
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
