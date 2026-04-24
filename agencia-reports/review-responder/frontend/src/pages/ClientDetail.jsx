import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [client, setClient]               = useState(null)
  const [reviews, setReviews]             = useState([])
  const [googleStatus, setGoogleStatus]   = useState(null)   // { authorized, location_name }
  const [locations, setLocations]               = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [savingLocation, setSavingLocation]     = useState(false)
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [manualLocation, setManualLocation]     = useState('')
  const [showManual, setShowManual]             = useState(false)
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [syncing, setSyncing]             = useState({})
  const [msg, setMsg]                     = useState('')
  const [msgType, setMsgType]             = useState('success') // 'success' | 'error'

  function showMsg(text, type = 'success') {
    setMsg(text)
    setMsgType(type)
  }

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/google/status/${id}`)
      if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
        // Backend not yet updated — fall back to safe default
        const fallback = { authorized: false, location_name: null }
        setGoogleStatus(fallback)
        return fallback
      }
      const data = await res.json()
      setGoogleStatus(data)
      return data
    } catch {
      const fallback = { authorized: false, location_name: null }
      setGoogleStatus(fallback)
      return fallback
    }
  }, [id])

  const fetchReviews = useCallback(async () => {
    const res = await fetch(`/api/reviews?client_id=${id}&limit=10`)
    const data = await res.json()
    setReviews(data.data || [])
  }, [id])

  // Initial load
  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(setClient)
    fetchGoogleStatus()
    fetchReviews()
  }, [id])

  // Handle redirect back from Google OAuth
  useEffect(() => {
    if (searchParams.get('google') === 'connected') {
      fetchGoogleStatus().then(status => {
        if (status.authorized) {
          showMsg('✓ Google conectado correctamente')
          // Auto-load locations so user can pick right away
          loadLocations()
        }
      })
    } else if (searchParams.get('google') === 'error') {
      showMsg(`Error al conectar Google: ${searchParams.get('msg') || 'desconocido'}`, 'error')
    }
  }, [searchParams])

  async function loadLocations() {
    setLoadingLocations(true)
    try {
      const res = await fetch(`/api/google/locations/${id}`)
      const data = await res.json()
      if (!res.ok) {
        const isRateLimit = data.error?.includes('429') || data.detail?.error?.code === 429
        if (isRateLimit) {
          showMsg('Google tiene un límite de peticiones por minuto. Espera 1 minuto e intenta de nuevo, o ingresa el ID de ubicación manualmente.', 'error')
        } else {
          showMsg(`Error al cargar ubicaciones: ${data.error || 'desconocido'}`, 'error')
        }
        setShowManual(true)
        return
      }
      if (!data.length) {
        showMsg('No se encontraron ubicaciones. Ingresa el ID manualmente.', 'error')
        setShowManual(true)
        return
      }
      setLocations(data)
    } catch (e) {
      showMsg(`Error: ${e.message}`, 'error')
      setShowManual(true)
    } finally {
      setLoadingLocations(false)
    }
  }

  async function saveManualLocation() {
    const val = manualLocation.trim()
    if (!val) return
    if (val.startsWith('http') || val.includes('maps')) {
      showMsg('Pega el ID de ubicación, no una URL de Maps. Formato: accounts/123/locations/456', 'error')
      return
    }
    setSavingLocation(true)
    await fetch(`/api/google/locations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_name: manualLocation.trim() })
    })
    setGoogleStatus(s => ({ ...s, location_name: manualLocation.trim() }))
    setShowManual(false)
    setManualLocation('')
    showMsg('Ubicación guardada. Ya puedes sincronizar reseñas.')
    setSavingLocation(false)
  }

  async function connectGoogle() {
    setConnectingGoogle(true)
    try {
      const res = await fetch(`/api/google/auth-url/${id}`)
      const data = await res.json()
      window.open(data.url, '_blank', 'width=600,height=700,noopener')
    } catch {
      showMsg('Error al obtener URL de autorización', 'error')
    } finally {
      setConnectingGoogle(false)
    }
  }

  async function saveLocation() {
    if (!selectedLocation) return
    setSavingLocation(true)
    await fetch(`/api/google/locations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_name: selectedLocation })
    })
    setGoogleStatus(s => ({ ...s, location_name: selectedLocation }))
    setLocations([])
    showMsg('Ubicación guardada. Ya puedes sincronizar reseñas.')
    setSavingLocation(false)
  }

  async function sync(platform) {
    setSyncing(s => ({ ...s, [platform]: true }))
    setMsg('')
    try {
      const url = platform === 'google' ? `/api/google/reviews/${id}` : `/api/meta/fetch/${id}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        showMsg(`Error: ${data.error}${data.detail ? ' — ' + JSON.stringify(data.detail) : ''}`, 'error')
        return
      }
      const count = platform === 'google'
        ? data.new_reviews
        : (data.new_facebook || 0) + (data.new_instagram || 0)
      showMsg(count > 0 ? `✓ ${count} nueva${count !== 1 ? 's' : ''} reseña${count !== 1 ? 's' : ''} obtenida${count !== 1 ? 's' : ''}` : '✓ Sin reseñas nuevas (todo al día)')
      fetchReviews()
    } catch (e) {
      showMsg(`Error: ${e.message}`, 'error')
    } finally {
      setSyncing(s => ({ ...s, [platform]: false }))
    }
  }

  if (!client || !googleStatus) return <p style={{ color: '#9ca3af' }}>Cargando...</p>

  const fbCreds = client.credentials?.find(c => c.platform === 'facebook')

  const PLATFORM_ICONS = { google: '🔍', facebook: '📘', instagram: '📸' }
  const STATUS_LABELS  = { pending: 'Pendiente', approved: 'Aprobada', published: 'Publicada', ignored: 'Ignorada' }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-ghost btn-sm" onClick={() => navigate('/clients')}>← Volver</button>
            <h1>{client.name}</h1>
          </div>
          <p>{client.business_type}</p>
        </div>
        <Link to={`/clients/${id}/edit`}>
          <button className="btn-ghost">Editar</button>
        </Link>
      </div>

      {msg && (
        <div style={{
          background: msgType === 'error' ? '#fef2f2' : '#d1fae5',
          color: msgType === 'error' ? '#991b1b' : '#065f46',
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', opacity: 0.6 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Brand info */}
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Personalidad de marca</h3>
          <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{client.brand_personality}</p>
          {client.context && (
            <>
              <h3 style={{ fontSize: 14, margin: '12px 0 6px' }}>Contexto</h3>
              <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.6 }}>{client.context}</p>
            </>
          )}
        </div>

        {/* Sync panel */}
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Plataformas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ── GOOGLE ── */}
            <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>🔍</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Google Business Profile</span>
                {googleStatus.authorized
                  ? <span style={{ marginLeft: 'auto', fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Conectado</span>
                  : <span style={{ marginLeft: 'auto', fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Sin conectar</span>
                }
              </div>

              {/* Not authorized → show connect button */}
              {!googleStatus.authorized && (
                <button className="btn-primary" onClick={connectGoogle} disabled={connectingGoogle} style={{ width: '100%' }}>
                  {connectingGoogle && <span className="spinner" />}
                  Conectar con Google
                </button>
              )}

              {/* Authorized but no location → pick location */}
              {googleStatus.authorized && !googleStatus.location_name && locations.length === 0 && !showManual && (
                <button className="btn-ghost" onClick={loadLocations} disabled={loadingLocations} style={{ width: '100%', fontSize: 13 }}>
                  {loadingLocations && <span className="spinner" style={{ borderTopColor: '#374151' }} />}
                  {loadingLocations ? 'Cargando ubicaciones...' : 'Seleccionar ubicación del negocio →'}
                </button>
              )}

              {/* Location picker dropdown */}
              {googleStatus.authorized && locations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
                    <option value="">Seleccionar ubicación...</option>
                    {locations.map(l => <option key={l.name} value={l.name}>{l.title || l.name}</option>)}
                  </select>
                  <button className="btn-primary btn-sm" onClick={saveLocation} disabled={savingLocation || !selectedLocation}>
                    {savingLocation && <span className="spinner" />}
                    Guardar ubicación
                  </button>
                </div>
              )}

              {/* Manual location input fallback */}
              {googleStatus.authorized && !googleStatus.location_name && showManual && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 0 }}>
                    ID de ubicación <span style={{ fontWeight: 400 }}>(formato: <code>accounts/123/locations/456</code>)</span>
                  </label>
                  <input
                    value={manualLocation}
                    onChange={e => setManualLocation(e.target.value)}
                    placeholder="accounts/123456789/locations/987654321"
                    style={{ fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-primary btn-sm" onClick={saveManualLocation} disabled={savingLocation || !manualLocation.trim()}>
                      {savingLocation && <span className="spinner" />}
                      Guardar
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => { setShowManual(false); loadLocations() }}>
                      Reintentar lista
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    Encuéntralo en <strong>Google Business Profile API</strong> → tu cuenta → ubicaciones.
                  </p>
                </div>
              )}

              {/* Fully ready → sync button */}
              {googleStatus.authorized && googleStatus.location_name && locations.length === 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ubicación configurada</span>
                    <button onClick={loadLocations} style={{ background: 'none', border: 'none', color: '#3b5bdb', fontSize: 11, cursor: 'pointer', padding: 0 }}>Cambiar</button>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => sync('google')}
                    disabled={syncing.google}
                    style={{ width: '100%' }}
                  >
                    {syncing.google ? <><span className="spinner" />Sincronizando...</> : '↻ Sincronizar reseñas ahora'}
                  </button>
                </div>
              )}
            </div>

            {/* ── META ── */}
            <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>📘</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Facebook + Instagram</span>
                {fbCreds
                  ? <span style={{ marginLeft: 'auto', fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Conectado</span>
                  : <span style={{ marginLeft: 'auto', fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Sin conectar</span>
                }
              </div>
              {fbCreds ? (
                <button className="btn-primary" onClick={() => sync('meta')} disabled={syncing.meta} style={{ width: '100%' }}>
                  {syncing.meta ? <><span className="spinner" />Sincronizando...</> : '↻ Sincronizar comentarios ahora'}
                </button>
              ) : (
                <Link to={`/clients/${id}/edit`}>
                  <button className="btn-ghost" style={{ width: '100%', fontSize: 13 }}>Configurar token de Meta →</button>
                </Link>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Reviews table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15 }}>Últimas reseñas y comentarios</h3>
          <Link to={`/reviews?client_id=${id}`} style={{ color: '#3b5bdb', fontSize: 13 }}>Ver todas →</Link>
        </div>
        {reviews.length === 0 ? (
          <p style={{ padding: 24, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
            Sin reseñas aún. Conecta Google y sincroniza para jalárlas.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plataforma</th>
                <th>Autor</th>
                <th>Contenido</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(r => (
                <tr key={r.id}>
                  <td><span className={`badge badge-${r.platform}`}>{PLATFORM_ICONS[r.platform]} {r.platform}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.author_name}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4b5563' }}>{r.content || '—'}</td>
                  <td><span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td style={{ color: '#9ca3af', fontSize: 12 }}>{new Date(r.fetched_at).toLocaleDateString('es-MX')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
