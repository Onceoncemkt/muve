'use client'

import { useMemo, useState } from 'react'
import { CIUDAD_LABELS } from '@/types'
import type { Ciudad, Rol } from '@/types'
import StaffNegocioAsignadoSelect from '@/components/admin/StaffNegocioAsignadoSelect'
import AdminUsuarioRolControl from '@/components/admin/AdminUsuarioRolControl'
import AdminUsuarioPlanToggle from '@/components/admin/AdminUsuarioPlanToggle'
import AdminDarCreditosModal from '@/components/admin/AdminDarCreditosModal'
import AdminInvitarUsuarioModal from '@/components/admin/AdminInvitarUsuarioModal'
import HistorialActividadDrawer from './HistorialActividadDrawer'

type UsuarioRow = {
  id: string
  nombre: string
  email: string
  ciudad: Ciudad
  rol: Rol
  edad: number | null
  plan_activo: boolean
  creditos_extra: number | null
  negocio_id: string | null
}

export default function UsuariosTabla({
  usuarios,
  negocioNombrePorId,
  negociosOpciones,
  negociosParaInvitar,
  usuariosConNegocioIdDisponible,
}: {
  usuarios: UsuarioRow[]
  negocioNombrePorId: Record<string, string>
  negociosOpciones: { id: string; nombre: string; activo: boolean }[]
  negociosParaInvitar: { id: string; nombre: string }[]
  usuariosConNegocioIdDisponible: boolean
}) {
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState<'todos' | Rol>('todos')
  const [historialUser, setHistorialUser] = useState<{ id: string; nombre: string } | null>(null)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => {
      if (rolFiltro !== 'todos' && u.rol !== rolFiltro) return false
      if (!q) return true
      return u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [usuarios, busqueda, rolFiltro])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-[#E8FF47]">Usuarios</h1>
          <p className="mt-1 text-xs text-white/50">Gestión completa de clientes, staff y admins.</p>
        </div>
        <AdminInvitarUsuarioModal negocios={negociosParaInvitar} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="w-full max-w-xs rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
        />
        <select
          value={rolFiltro}
          onChange={(e) => setRolFiltro(e.target.value as 'todos' | Rol)}
          className="rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]"
        >
          <option value="todos">Todos los roles</option>
          <option value="usuario">Usuario</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <span className="text-xs text-white/45">{filtrados.length} de {usuarios.length}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full border-collapse bg-[#111111]">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/50">
              <th className="px-3 py-3">Nombre</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Ciudad</th>
              <th className="px-3 py-3">Rol</th>
              <th className="px-3 py-3">Edad</th>
              <th className="px-3 py-3">Plan activo</th>
              <th className="px-3 py-3">Créditos extra</th>
              <th className="px-3 py-3">Negocio asignado</th>
              <th className="px-3 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((usuario) => {
              const negocioAsignado = usuario.negocio_id
                ? negocioNombrePorId[usuario.negocio_id] ?? 'No disponible'
                : 'Sin asignar'

              return (
                <tr key={usuario.id} className="border-b border-white/10 align-top text-sm text-white/90">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setHistorialUser({ id: usuario.id, nombre: usuario.nombre })}
                      className="text-left font-semibold text-white underline-offset-2 hover:text-[#E8FF47] hover:underline"
                    >
                      {usuario.nombre}
                    </button>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/35">Ver actividad</p>
                  </td>
                  <td className="px-3 py-3 text-white/70">{usuario.email}</td>
                  <td className="px-3 py-3">{CIUDAD_LABELS[usuario.ciudad]}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                        usuario.rol === 'admin'
                          ? 'bg-[#6B4FE8]/25 text-[#CBBEFF]'
                          : usuario.rol === 'staff'
                            ? 'bg-[#E8FF47]/20 text-[#E8FF47]'
                            : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="px-3 py-3">{usuario.edad ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-bold ${
                        usuario.plan_activo ? 'bg-[#E8FF47] text-[#0A0A0A]' : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {usuario.plan_activo ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-bold text-[#E8FF47]">{usuario.creditos_extra ?? 0}</td>
                  <td className="px-3 py-3 text-white/75">{negocioAsignado}</td>
                  <td className="px-3 py-3">
                    <div className="min-w-[16rem] space-y-2">
                      <AdminUsuarioRolControl userId={usuario.id} rolActual={usuario.rol} />
                      <AdminUsuarioPlanToggle userId={usuario.id} planActivo={usuario.plan_activo} />
                      {usuario.rol === 'usuario' && (
                        <AdminDarCreditosModal userId={usuario.id} userNombre={usuario.nombre} />
                      )}
                      {usuario.rol === 'staff' && usuariosConNegocioIdDisponible && (
                        <StaffNegocioAsignadoSelect
                          userId={usuario.id}
                          negocioIdActual={usuario.negocio_id}
                          negocioActualNombre={usuario.negocio_id ? (negocioNombrePorId[usuario.negocio_id] ?? null) : null}
                          opciones={negociosOpciones}
                        />
                      )}
                      {usuario.rol === 'staff' && !usuariosConNegocioIdDisponible && (
                        <p className="text-[11px] font-semibold text-white/45">
                          Asignación de negocio no disponible en este esquema.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-white/50">
                  {usuarios.length === 0 ? 'No hay usuarios registrados.' : 'Sin resultados para la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {historialUser && (
        <HistorialActividadDrawer
          userId={historialUser.id}
          userNombre={historialUser.nombre}
          onClose={() => setHistorialUser(null)}
        />
      )}
    </section>
  )
}
