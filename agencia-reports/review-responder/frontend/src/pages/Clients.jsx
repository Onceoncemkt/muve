import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setClients(data)
      setLoading(false)
    })
  }, [])

  async function deleteClient(id, name) {
    if (!confirm(`¿Eliminar cliente "${name}" y todas sus reseñas?`)) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients(c => c.filter(x => x.id !== id))
  }

  if (loading) return <p style={{ color: '#9ca3af' }}>Cargando...</p>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Clientes</h1>
          <p>{clients.length} cliente{clients.length !== 1 ? 's' : ''} registrado{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/clients/new">
          <button className="btn-primary">+ Nuevo cliente</button>
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#9ca3af', marginBottom: 16 }}>No hay clientes aún.</p>
          <Link to="/clients/new"><button className="btn-primary">Crear primer cliente</button></Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Giro</th>
                <th>Plataformas</th>
                <th>Pendientes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: '#6b7280' }}>{c.business_type}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {c.google_connected > 0 && <span className="badge badge-google">🔍 Google</span>}
                      {c.meta_connected > 0 && <span className="badge badge-facebook">📘 Facebook</span>}
                      {c.instagram_connected > 0 && <span className="badge badge-instagram">📸 Instagram</span>}
                      {!c.google_connected && !c.meta_connected && (
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>Sin conectar</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {c.pending_count > 0 ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                        {c.pending_count}
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/clients/${c.id}`}><button className="btn-ghost btn-sm">Ver</button></Link>
                      <Link to={`/clients/${c.id}/edit`}><button className="btn-ghost btn-sm">Editar</button></Link>
                      <button className="btn-danger btn-sm" onClick={() => deleteClient(c.id, c.name)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
