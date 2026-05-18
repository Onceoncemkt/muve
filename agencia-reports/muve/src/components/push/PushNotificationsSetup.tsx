'use client'

import { useEffect } from 'react'
const SERVICE_WORKER_VERSION = '2026-04-27-2'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export default function PushNotificationsSetup() {
  useEffect(() => {
    let cancelled = false

    async function setupPush() {
      if (
        typeof window === 'undefined'
        || !('serviceWorker' in navigator)
        || !('PushManager' in window)
        || !('Notification' in window)
      ) {
        return
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY no está configurada')
        return
      }

      try {
        const serviceWorkerUrl = `/sw.js?v=${SERVICE_WORKER_VERSION}`
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          registrations.map((registration) => {
            const activeUrl = registration.active?.scriptURL ?? ''
            const waitingUrl = registration.waiting?.scriptURL ?? ''
            const installingUrl = registration.installing?.scriptURL ?? ''
            const scriptUrl = activeUrl || waitingUrl || installingUrl
            if (scriptUrl.includes('/sw.js') && !scriptUrl.includes(`v=${SERVICE_WORKER_VERSION}`)) {
              return registration.unregister()
            }
            return Promise.resolve(false)
          })
        )

        await navigator.serviceWorker.register(serviceWorkerUrl, {
          scope: '/',
          updateViaCache: 'none',
        })
        const registration = await navigator.serviceWorker.ready
        console.log('[push] Service Worker listo:', registration.scope)

        let permission = Notification.permission
        if (permission === 'default') {
          console.log('[push] Solicitando permiso de notificaciones...')
          permission = await Notification.requestPermission()
        }
        console.log('[push] Estado de permiso:', permission)

        if (permission !== 'granted' || cancelled) return

        const existingSubscription = await registration.pushManager.getSubscription()
        if (existingSubscription) {
          console.log('[push] Suscripción existente encontrada')
        }
        const subscription = existingSubscription ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
        if (!existingSubscription) {
          console.log('[push] Nueva suscripción creada')
        }

        if (cancelled) return

        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          console.error('[push] Error al guardar suscripción en backend:', payload)
          return
        }
        console.log('[push] Suscripción guardada en backend correctamente')
      } catch (error) {
        console.error('[push] Error al configurar notificaciones:', error)
      }
    }

    void setupPush()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
