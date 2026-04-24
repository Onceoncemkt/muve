import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import ClientDetail from './pages/ClientDetail.jsx'
import ClientForm from './pages/ClientForm.jsx'
import Reviews from './pages/Reviews.jsx'

function Sidebar() {
  const linkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    borderRadius: '6px',
    color: isActive ? '#fff' : '#94a3b8',
    background: isActive ? '#3b5bdb' : 'transparent',
    fontWeight: isActive ? 600 : 400,
    fontSize: '14px',
    transition: 'all 0.15s'
  })

  return (
    <aside style={{ width: 220, minHeight: '100vh', background: '#1a1d23', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', padding: '0 8px', marginBottom: '24px' }}>
        <span style={{ fontSize: '20px' }}>★</span> ONCE ONCE REVIEWER
      </div>
      <NavLink to="/dashboard" style={linkStyle}>
        <span>📊</span> Dashboard
      </NavLink>
      <NavLink to="/clients" style={linkStyle}>
        <span>👥</span> Clientes
      </NavLink>
      <NavLink to="/reviews" style={linkStyle}>
        <span>💬</span> Reseñas
      </NavLink>
    </aside>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '32px', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/clients/:id/edit" element={<ClientForm />} />
            <Route path="/reviews" element={<Reviews />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
