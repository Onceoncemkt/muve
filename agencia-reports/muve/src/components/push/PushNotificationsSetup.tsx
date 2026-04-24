'use client'

import { useEffect } from 'react'

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
      if (!vapidPublicKey) return

      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        let permission = Notification.permission
        if (permission === 'default') {
          permission = await Notification.requestPermission()
        }

        if (permission !== 'granted' || cancelled) return

        const existingSubscription = await registration.pushManager.getSubscription()
        const subscription = existingSubscription ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        if (cancelled) return

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        })
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
