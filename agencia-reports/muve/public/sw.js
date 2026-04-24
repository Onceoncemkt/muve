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
