'use client'

import { useEffect, useState } from 'react'

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

export default function StaffPushNotificationBanner() {
  const [soportado, setSoportado] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function suscribirYGuardar() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      setError('Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.')
      return
    }

    const reg = await navigator.serviceWorker.ready
    const existente = await reg.pushManager.getSubscription()
    const sub = existente ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'No se pudo guardar la suscripción')
    }
  }

  async function activarNotificaciones() {
    setProcesando(true)
    setError(null)

    try {
      let permisoActual = Notification.permission
      if (permisoActual === 'default') {
        permisoActual = await Notification.requestPermission()
      }
      setPermission(permisoActual)

      if (permisoActual !== 'granted') {
        setError('Permiso no otorgado para notificaciones.')
        return
      }

      await suscribirYGuardar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar notificaciones')
    } finally {
      setProcesando(false)
    }
  }

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || !('Notification' in window)
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
    ) {
      setSoportado(false)
      return
    }

    setPermission(Notification.permission)

    if (Notification.permission === 'granted') {
      void suscribirYGuardar().catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al validar suscripción push')
      })
    }
  }, [])

  if (!soportado) return null
  if (permission !== 'default') return null

  return (
    <div className="rounded-xl border border-[#E8FF47] bg-[#0A0A0A] p-4">
      <p className="text-sm font-bold text-white">
        Activa las notificaciones para recibir alertas de reservaciones
      </p>
      {error && (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      )}
      <button
        type="button"
        onClick={() => { void activarNotificaciones() }}
        disabled={procesando}
        className="mt-3 rounded-lg bg-[#E8FF47] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0A0A0A] transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {procesando ? 'Activando...' : 'Activar notificaciones'}
      </button>
    </div>
  )
}
