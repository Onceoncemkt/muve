'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RoleRedirectEffect() {
  useEffect(() => {
    const checkRol = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase
        .from('users')
        .select('rol')
        .eq('id', user.id)
        .single()
      if (perfil?.rol === 'admin') {
        window.location.href = '/admin'
        return
      }
      if (perfil?.rol === 'staff') {
        window.location.href = '/negocio/dashboard'
        return
      }
    }
    void checkRol()
  }, [])

  return null
}
