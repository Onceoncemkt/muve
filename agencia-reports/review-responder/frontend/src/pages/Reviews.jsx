import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReviewCard from '../components/ReviewCard.jsx'

const PLATFORMS = ['', 'google', 'facebook', 'instagram']
const STATUSES  = ['', 'pending', 'approved', 'published', 'ignored']
const STATUS_LABELS = { '': 'Todos los estados', pending: 'Pendiente', approved: 'Aprobada', published: 'Publicada', ignored: 'Ignorada' }
const PLATFORM_LABELS = { '': 'Todas las plataformas', google: '🔍 Google', facebook: '📘 Facebook', instagram: '📸 Instagram' }

export default function Reviews() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviews, setReviews]     = useState([])
  const [clients, setClients]     = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected]   = useState(new Set())
  const [page, setPage]           = useState(1)

  const clientId = searchParams.get('client_id') || ''
  const status   = searchParams.get('status') || ''
  const platform = searchParams.get('platform') || ''
  const search   = searchParams.get('search') || ''
  const LIMIT    = 20

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients)
  }, [])

  const fetchReviews = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (clientId) params.set('client_id', clientId)
    if (status)   params.set('status', status)
    if (platform) params.set('platform', platform)
    if (search)   params.set('search', search)
    params.set('page', p)
    params.set('limit', LIMIT)

    const res = await fetch(`/api/reviews?${params}`)
    const data = await res.json()
    setReviews(data.data || [])
    setTotal(data.total || 0)
    setPage(p)
    setLoading(false)
    setSelected(new Set())
  }, [clientId, status, platform, search])

  useEffect(() => { fetchReviews(1) }, [fetchReviews])

  function setFilter(key, val) {
    const p = new URLSearchParams(searchParams)
    if (val) p.set(key, val); else p.delete(key)
    setSearchParams(p)
  }

  function toggleSelect(id) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleAll() {
    const pendingIds = reviews.filter(r => r.status === 'pending').map(r => r.id)
    if (selected.size === pendingIds.length) setSelected(new Set())
    else setSelected(new Set(pendingIds))
  }

  async function generateSelected() {
    if (selected.size === 0) return
    setGenerating(true)
    await Promise.all([...selected].map(id =>
      fetch(`/api/reviews/${id}/generate`, { method: 'POST' })
    ))
    setGenerating(false)
    fetchReviews(page)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div>
      <div className="page-header">
        <h1>Reseñas y Comentarios</h1>
        <p>{total} elemento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <select value={clientId} onChange={e => setFilter('client_id', e.target.value)}>
            <option value="">Todos los clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={status} onChange={e => setFilter('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          <select value={platform} onChange={e => setFilter('platform', e.target.value)}>
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>

          <input
            placeholder="Buscar en contenido..."
            value={search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>
      </div>

      {/* Bulk actions */}
      {reviews.some(r => r.status === 'pending') && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <button className="btn-ghost btn-sm" onClick={toggleAll}>
            {selected.size === reviews.filter(r => r.status === 'pending').length ? 'Deseleccionar todos' : 'Seleccionar pendientes'}
          </button>
          {selected.size > 0 && (
            <button className="btn-primary btn-sm" onClick={generateSelected} disabled={generating}>
              {generating && <span className="spinner" />}
              ✨ Generar IA para {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Cargando...</p>
      ) : reviews.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#9ca3af' }}>No hay reseñas con los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          {reviews.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {r.status === 'pending' && (
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  style={{ marginTop: 20, width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                />
              )}
              <div style={{ flex: 1 }}>
                <ReviewCard review={r} onUpdate={updated => {
                  setReviews(list => list.map(x => x.id === updated.id ? updated : x))
                }} />
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn-ghost btn-sm" onClick={() => fetchReviews(page - 1)} disabled={page === 1}>← Anterior</button>
              <span style={{ padding: '6px 12px', fontSize: 13, color: '#6b7280' }}>Página {page} de {totalPages}</span>
              <button className="btn-ghost btn-sm" onClick={() => fetchReviews(page + 1)} disabled={page === totalPages}>Siguiente →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
