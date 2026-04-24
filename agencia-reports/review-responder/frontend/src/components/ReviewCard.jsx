import { useState } from 'react'

const PLATFORM_ICONS  = { google: '🔍', facebook: '📘', instagram: '📸' }
const STATUS_LABELS   = { pending: 'Pendiente', approved: 'Aprobada', published: 'Publicada', ignored: 'Ignorada' }
const STARS = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : null

export default function ReviewCard({ review: initial, onUpdate }) {
  const [review, setReview]       = useState(initial)
  const [expanded, setExpanded]   = useState(false)
  const [response, setResponse]   = useState(initial.ai_suggestion || '')
  const [loading, setLoading]     = useState('')
  const [error, setError]         = useState('')

  function update(updated) { setReview(updated); setResponse(updated.ai_suggestion || ''); onUpdate?.(updated) }

  async function call(path, method = 'POST', body) {
    setError('')
    setLoading(path)
    try {
      const res = await fetch(`/api/reviews/${review.id}/${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      update(data.review || data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  async function approve() {
    setError('')
    setLoading('approve')
    try {
      const res = await fetch(`/api/reviews/${review.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_response: response })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      update(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  const isLong = (review.content || '').length > 200
  const contentPreview = isLong && !expanded ? review.content.slice(0, 200) + '…' : review.content

  return (
    <div className="card" style={{ marginBottom: 12, opacity: review.status === 'ignored' ? 0.6 : 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge badge-${review.platform}`}>{PLATFORM_ICONS[review.platform]} {review.platform}</span>
          {review.star_rating && (
            <span style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 1 }}>{STARS(review.star_rating)}</span>
          )}
          <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
            {review.client_name}
          </span>
        </div>
        <span className={`badge badge-${review.status}`}>{STATUS_LABELS[review.status]}</span>
      </div>

      {/* Author + date */}
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
        <strong style={{ color: '#374151' }}>{review.author_name}</strong>
        {' · '}
        {new Date(review.fetched_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
      </div>

      {/* Content */}
      {review.content ? (
        <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
          {contentPreview}
          {isLong && (
            <button
              style={{ background: 'none', border: 'none', color: '#3b5bdb', cursor: 'pointer', padding: '0 4px', fontSize: 13 }}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? 'ver menos' : 'ver más'}
            </button>
          )}
        </p>
      ) : (
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12, fontStyle: 'italic' }}>(Sin texto)</p>
      )}

      {/* AI Suggestion area */}
      {review.status !== 'published' && review.status !== 'ignored' && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#9ca3af', marginBottom: 0 }}>Respuesta sugerida por IA</label>
            <button
              className="btn-ghost btn-sm"
              onClick={() => call('regenerate')}
              disabled={!!loading}
            >
              {loading === 'regenerate' && <span className="spinner" style={{ borderTopColor: '#374151' }} />}
              ↺ Regenerar
            </button>
          </div>

          {review.ai_suggestion || response ? (
            <textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              rows={3}
              style={{ marginBottom: 10, fontSize: 13 }}
              readOnly={review.status === 'approved'}
            />
          ) : (
            <div style={{ marginBottom: 10 }}>
              <button className="btn-primary btn-sm" onClick={() => call('generate')} disabled={!!loading}>
                {loading === 'generate' && <span className="spinner" />}
                ✨ Generar respuesta con IA
              </button>
            </div>
          )}

          {error && <div className="error-msg" style={{ marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {review.status === 'pending' && response && (
              <>
                <button className="btn-success btn-sm" onClick={approve} disabled={!!loading}>
                  {loading === 'approve' && <span className="spinner" />}
                  ✓ Aprobar
                </button>
                <button className="btn-ghost btn-sm" onClick={() => call('ignore', 'PUT')} disabled={!!loading}>
                  Ignorar
                </button>
              </>
            )}
            {review.status === 'approved' && (
              <>
                <button className="btn-primary btn-sm" onClick={() => call('publish')} disabled={!!loading}>
                  {loading === 'publish' && <span className="spinner" />}
                  Publicar respuesta
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => { setReview(r => ({ ...r, status: 'pending' })) }}
                >
                  Editar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {review.status === 'published' && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Respuesta publicada el {new Date(review.published_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          <p style={{ fontSize: 13, color: '#374151', background: '#f0fdf4', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #22c55e' }}>
            {review.ai_suggestion}
          </p>
        </div>
      )}

      {review.status === 'ignored' && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
          <button className="btn-ghost btn-sm" onClick={() => call('restore', 'PUT')} disabled={!!loading}>
            Restaurar
          </button>
        </div>
      )}
    </div>
  )
}
