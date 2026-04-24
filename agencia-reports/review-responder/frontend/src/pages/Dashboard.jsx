import { useEffect, useState } from 'react'

const PLATFORM_ICONS = { google: '🔍', facebook: '📘', instagram: '📸' }
const STATUS_COLORS  = { pending: '#f59e0b', approved: '#22c55e', published: '#3b5bdb', ignored: '#9ca3af' }

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [logs, setLogs]   = useState([])
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [s, l] = await Promise.all([
      fetch('/api/reviews/stats').then(r => r.json()),
      fetch('/api/cron/logs').then(r => r.json())
    ])
    setStats(s)
    setLogs(l)
  }

  async function runSync() {
    setSyncing(true)
    setMsg('')
    try {
      await fetch('/api/cron/run', { method: 'POST' })
      setMsg('Sincronización completada')
      fetchData()
    } catch {
      setMsg('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const totalsMap = {}
  if (stats) stats.totals.forEach(t => { totalsMap[t.status] = t.count })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Resumen general de reseñas y comentarios</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {msg && <span style={{ fontSize: 12, color: '#22c55e' }}>{msg}</span>}
          <button className="btn-primary" onClick={runSync} disabled={syncing}>
            {syncing && <span className="spinner" />}
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Pendientes</div>
          <div className="value" style={{ color: '#f59e0b' }}>{totalsMap.pending || 0}</div>
          <div className="sub">Esperan revisión</div>
        </div>
        <div className="stat-card">
          <div className="label">Aprobadas</div>
          <div className="value" style={{ color: '#22c55e' }}>{totalsMap.approved || 0}</div>
          <div className="sub">Listas para publicar</div>
        </div>
        <div className="stat-card">
          <div className="label">Publicadas</div>
          <div className="value" style={{ color: '#3b5bdb' }}>{totalsMap.published || 0}</div>
          <div className="sub">Respondidas</div>
        </div>
        <div className="stat-card">
          <div className="label">Ignoradas</div>
          <div className="value" style={{ color: '#9ca3af' }}>{totalsMap.ignored || 0}</div>
          <div className="sub">Sin acción</div>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <h3 style={{ marginBottom: 14, fontSize: 15 }}>Por plataforma</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['google', 'facebook', 'instagram'].map(platform => {
                const rows = stats.by_platform.filter(r => r.platform === platform)
                const total = rows.reduce((s, r) => s + r.count, 0)
                return (
                  <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{PLATFORM_ICONS[platform]}</span>
                    <span style={{ textTransform: 'capitalize', minWidth: 80 }}>{platform}</span>
                    <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((total / Math.max(Object.values(totalsMap).reduce((a,b) => a+b, 0), 1)) * 100, 100)}%`, background: '#3b5bdb', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 24 }}>{total}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 14, fontSize: 15 }}>Últimas sincronizaciones</h3>
            {logs.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin registros aún</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: '#6b7280' }}>{new Date(log.run_at).toLocaleString('es-MX')}</span>
                    <span style={{ fontWeight: 600, color: log.new_items > 0 ? '#3b5bdb' : '#9ca3af' }}>+{log.new_items} nuevos</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
