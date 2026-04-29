'use client'

import { useEffect, useState } from 'react'
import QRScanner from '@/components/QRScanner'

type ValidadorSession = {
  validador_id: string
  negocio_id: string
  nombre: string
  negocio_nombre: string | null
}

type ResultadoValidacion = {
  valido: boolean
  usuario?: string
  negocio?: string
  error?: string
}

type UsuarioBusqueda = {
  id: string
  nombre: string
  email: string
  telefono: string | null
  plan: string | null
  plan_activo: boolean
  creditos_extra: number | null
}

type HistorialItem = {
  id: string
  created_at: string
  exitoso: boolean
  users?: { nombre?: string; plan?: string } | { nombre?: string; plan?: string }[] | null
  validadores?: { nombre?: string } | { nombre?: string }[] | null
}

function obtenerRelacion<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

function formatHora(fechaIso: string) {
  const date = new Date(fechaIso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export default function ValidarPage() {
  const [sesion, setSesion] = useState<ValidadorSession | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [emailNegocio, setEmailNegocio] = useState('')
  const [nombreValidador, setNombreValidador] = useState('')
  const [pin, setPin] = useState('')
  const [enviandoLogin, setEnviandoLogin] = useState(false)
  const [scannerAbierto, setScannerAbierto] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [usuarios, setUsuarios] = useState<UsuarioBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [totalDia, setTotalDia] = useState(0)

  async function cargarSesion() {
    setCargandoSesion(true)
    const res = await fetch('/api/validador/session', { cache: 'no-store' })
    if (!res.ok) {
      setSesion(null)
      setCargandoSesion(false)
      return
    }
    const data = await res.json().catch(() => ({})) as ValidadorSession
    setSesion(data)
    setCargandoSesion(false)
  }

  async function cargarHistorial() {
    const res = await fetch('/api/validar/historial', { cache: 'no-store' })
    if (!res.ok) {
      setHistorial([])
      setTotalDia(0)
      return
    }
    const data = await res.json().catch(() => ({})) as { historial?: HistorialItem[]; total_dia?: number }
    setHistorial(data.historial ?? [])
    setTotalDia(data.total_dia ?? 0)
  }

  useEffect(() => {
    void cargarSesion()
  }, [])

  useEffect(() => {
    if (!sesion) return
    void cargarHistorial()
  }, [sesion])

  useEffect(() => {
    if (!resultado) return
    const id = setTimeout(() => setResultado(null), 3000)
    return () => clearTimeout(id)
  }, [resultado])

  async function loginValidador(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEnviandoLogin(true)
    setResultado(null)
    try {
      const res = await fetch('/api/validador/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_negocio: emailNegocio.trim(),
          pin: pin.trim(),
          nombre_validador: nombreValidador.trim(),
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setResultado({ tipo: 'error', texto: data.error ?? 'No se pudo iniciar sesión' })
        return
      }
      setPin('')
      await cargarSesion()
    } catch {
      setResultado({ tipo: 'error', texto: 'Error de conexión al iniciar sesión' })
    } finally {
      setEnviandoLogin(false)
    }
  }

  async function logoutValidador() {
    await fetch('/api/validador/logout', { method: 'POST' })
    setSesion(null)
    setUsuarios([])
    setHistorial([])
    setTotalDia(0)
    setScannerAbierto(false)
    setResultado(null)
  }

  async function validarToken(token: string) {
    if (!token.trim()) return
    const res = await fetch('/api/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim(), solo_cotizar: false }),
    })
    const data = await res.json().catch(() => ({})) as ResultadoValidacion
    if (!res.ok || !data.valido) {
      setResultado({ tipo: 'error', texto: data.error ?? 'No se pudo validar' })
    } else {
      setResultado({ tipo: 'ok', texto: `Visita confirmada: ${data.usuario ?? 'Usuario'}` })
    }
    void cargarHistorial()
  }

  async function buscarUsuarios(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (busqueda.trim().length < 3) {
      setResultado({ tipo: 'error', texto: 'Escribe al menos 3 caracteres' })
      return
    }
    setBuscando(true)
    try {
      const res = await fetch(`/api/validar/buscar-usuario?q=${encodeURIComponent(busqueda.trim())}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({})) as { usuarios?: UsuarioBusqueda[]; error?: string }
      if (!res.ok) {
        setResultado({ tipo: 'error', texto: data.error ?? 'No se pudo buscar' })
        setUsuarios([])
        return
      }
      setUsuarios(data.usuarios ?? [])
    } catch {
      setResultado({ tipo: 'error', texto: 'Error de conexión en búsqueda' })
      setUsuarios([])
    } finally {
      setBuscando(false)
    }
  }

  async function confirmarManual(userId: string) {
    const res = await fetch('/api/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, solo_cotizar: false }),
    })
    const data = await res.json().catch(() => ({})) as ResultadoValidacion
    if (!res.ok || !data.valido) {
      setResultado({ tipo: 'error', texto: data.error ?? 'No se pudo registrar visita' })
    } else {
      setResultado({ tipo: 'ok', texto: `Visita confirmada: ${data.usuario ?? 'Usuario'}` })
      setUsuarios([])
      setBusqueda('')
    }
    void cargarHistorial()
  }

  if (cargandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <p className="text-sm font-semibold text-[#666]">Cargando...</p>
      </div>
    )
  }

  if (!sesion) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] p-4">
        <div className="mx-auto max-w-md space-y-4">
          <div className="rounded-xl bg-[#0A0A0A] px-5 py-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#E8FF47]">MUVET</p>
            <h1 className="mt-2 text-3xl font-black text-white">Validar visitas</h1>
          </div>

          {resultado && (
            <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${resultado.tipo === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
              {resultado.texto}
            </div>
          )}

          <form onSubmit={loginValidador} className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-5">
            <input
              type="email"
              placeholder="Email del negocio"
              value={emailNegocio}
              onChange={(event) => setEmailNegocio(event.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] px-4 py-4 text-base outline-none focus:border-[#6B4FE8]"
              required
            />
            <input
              type="text"
              placeholder="Tu nombre"
              value={nombreValidador}
              onChange={(event) => setNombreValidador(event.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] px-4 py-4 text-base outline-none focus:border-[#6B4FE8]"
              required
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN de 4 dígitos"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full rounded-lg border border-[#E5E5E5] px-4 py-4 text-2xl font-black tracking-[0.3em] outline-none focus:border-[#6B4FE8]"
              required
            />
            <button
              type="submit"
              disabled={enviandoLogin}
              className="w-full rounded-xl bg-[#E8FF47] px-4 py-4 text-lg font-black text-[#0A0A0A] transition-colors hover:bg-[#dbef45] disabled:opacity-50"
            >
              {enviandoLogin ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl bg-[#6B4FE8] p-5 text-white">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8FF47]">MUVET</p>
              <h1 className="mt-1 text-3xl font-black">Hola {sesion.nombre}</h1>
              <p className="text-sm text-white/85">{sesion.negocio_nombre ?? 'Negocio'}</p>
            </div>
            <button
              type="button"
              onClick={logoutValidador}
              className="rounded-lg border border-white/40 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10"
            >
              Cambiar usuario
            </button>
          </div>
          <p className="mt-4 text-lg font-black text-[#E8FF47]">Total del día: {totalDia} visitas</p>
        </div>

        {resultado && (
          <div className={`rounded-lg px-4 py-3 text-base font-bold ${resultado.tipo === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
            {resultado.texto}
          </div>
        )}

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          <button
            type="button"
            onClick={() => setScannerAbierto((prev) => !prev)}
            className="w-full rounded-2xl bg-[#E8FF47] px-4 py-8 text-3xl font-black text-[#0A0A0A] transition-colors hover:bg-[#dbef45]"
          >
            📷 Escanear QR
          </button>
          {scannerAbierto && (
            <div className="mt-4">
              <QRScanner onScan={(texto) => { setScannerAbierto(false); void validarToken(texto) }} activo={scannerAbierto} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          <p className="mb-3 text-center text-xs font-black uppercase tracking-[0.2em] text-[#666]">─── o búsqueda manual ───</p>
          <form onSubmit={buscarUsuarios} className="flex gap-2">
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Email o teléfono"
              className="flex-1 rounded-lg border border-[#E5E5E5] px-4 py-3 text-base outline-none focus:border-[#6B4FE8]"
            />
            <button
              type="submit"
              disabled={buscando}
              className="rounded-lg bg-[#6B4FE8] px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-[#5a3fd6] disabled:opacity-50"
            >
              Buscar
            </button>
          </form>

          {usuarios.length > 0 && (
            <ul className="mt-3 space-y-2">
              {usuarios.map((usuario) => (
                <li key={usuario.id} className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                  <p className="text-base font-bold text-[#0A0A0A]">{usuario.nombre}</p>
                  <p className="text-xs text-[#666]">{usuario.email} · {usuario.telefono ?? 'sin teléfono'}</p>
                  <button
                    type="button"
                    onClick={() => confirmarManual(usuario.id)}
                    className="mt-2 rounded-lg bg-[#0A0A0A] px-3 py-2 text-xs font-black uppercase tracking-widest text-[#E8FF47] transition-colors hover:bg-[#222]"
                  >
                    Confirmar visita
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          <h2 className="text-lg font-black text-[#0A0A0A]">Últimas validaciones</h2>
          {historial.length === 0 ? (
            <p className="mt-2 text-sm text-[#666]">Sin validaciones hoy.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {historial.map((item) => {
                const usuario = obtenerRelacion(item.users)
                const validador = obtenerRelacion(item.validadores)
                return (
                  <li key={item.id} className="flex items-center justify-between rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2">
                    <div>
                      <p className="text-sm font-bold text-[#0A0A0A]">{usuario?.nombre ?? 'Usuario'}</p>
                      <p className="text-xs text-[#666]">
                        {validador?.nombre ?? sesion.nombre} · {item.exitoso ? 'Éxito' : 'Fallido'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#6B4FE8]">{formatHora(item.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
