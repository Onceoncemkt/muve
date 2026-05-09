'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Notice = {
  tone: 'success' | 'neutral' | 'default'
  message: string
}

function noticeFromParams(params: URLSearchParams): Notice | null {
  if (params.get('renovado') === 'true') {
    return {
      tone: 'success',
      message: '¡Renovación exitosa! Tu plan se reactivó con créditos nuevos.',
    }
  }
  if (params.get('renovacion_cancelada') === 'true') {
    return {
      tone: 'neutral',
      message: 'Renovación cancelada. Tu plan sigue activo hasta su fecha original.',
    }
  }
  if (params.get('membresia') === 'activada') {
    return {
      tone: 'default',
      message: 'Membresía activada. Bienvenid@ a MUVET.',
    }
  }
  return null
}

export default function DashboardNotices() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [notice, setNotice] = useState<Notice | null>(null)

  const hasManagedParams = useMemo(() => (
    searchParams.get('renovado') === 'true'
    || searchParams.get('renovacion_cancelada') === 'true'
    || searchParams.get('membresia') === 'activada'
  ), [searchParams])

  useEffect(() => {
    const parsed = noticeFromParams(searchParams)
    if (!parsed) return
    setNotice(parsed)

    const params = new URLSearchParams(searchParams.toString())
    params.delete('renovado')
    params.delete('renovacion_cancelada')
    params.delete('membresia')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [searchParams, router, pathname])

  if (!notice && !hasManagedParams) return null
  if (!notice) return null

  const classes = notice.tone === 'success'
    ? 'bg-[#16A34A] text-white'
    : notice.tone === 'neutral'
      ? 'bg-[#374151] text-white'
      : 'bg-[#6B4FE8] text-white'

  return (
    <div className={`${classes} px-4 py-3 text-center text-sm font-bold`}>
      {notice.message}
    </div>
  )
}
