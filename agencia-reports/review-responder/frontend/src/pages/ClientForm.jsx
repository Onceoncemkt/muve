import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const BUSINESS_TYPES = ['Restaurante', 'Café', 'Clínica dental', 'Clínica médica', 'Hotel', 'Spa y bienestar', 'E-commerce', 'Tienda física', 'Agencia de viajes', 'Estudio de belleza', 'Taller mecánico', 'Gimnasio', 'Escuela', 'Inmobiliaria', 'Otro']

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ name: '', business_type: '', brand_personality: '', context: '' })
  const [metaCreds, setMetaCreds] = useState({ meta_page_access_token: '', meta_page_id: '', meta_instagram_account_id: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [metaVerifying, setMetaVerifying] = useState(false)
  const [metaStatus, setMetaStatus] = useState(null)
  const [googleAuthUrl, setGoogleAuthUrl] = useState(null)
  const [googleStatus, setGoogleStatus] = useState(null)
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    fetch(`/api/clients/${id}`).then(r => r.json()).then(data => {
      setForm({ name: data.name, business_type: data.business_type, brand_personality: data.brand_personality, context: data.context || '' })
      const fb = data.credentials?.find(c => c.platform === 'facebook')
      if (fb) setMetaCreds(prev => ({ ...prev, meta_page_id: fb.meta_page_id || '', meta_instagram_account_id: fb.meta_instagram_account_id || '' }))
      const googleCreds = data.credentials?.find(c => c.platform === 'google')
      if (googleCreds?.google_location_name) setGoogleStatus('connected')
    })
  }, [id])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); setErrors(e => ({ ...e, [field]: '' })) }

  function validate() {
    const e = {}
    if (!form.name.trim())              e.name = 'Requerido'
    if (!form.business_type.trim())     e.business_type = 'Requerido'
    if (!form.brand_personality.trim()) e.brand_personality = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function save() {
    if (!validate()) return
    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url    = isEdit ? `/api/clients/${id}` : '/api/clients'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data   = await res.json()
      if (!res.ok) { setErrors({ _: data.error }); return }
      navigate(`/clients/${data.id}`)
    } finally {
      setSaving(false)
    }
  }

  async function verifyMeta() {
    if (!isEdit) return
    setMetaVerifying(true)
    setMetaStatus(null)
    await fetch(`/api/clients/${id}/credentials/meta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaCreds)
    })
    const res = await fetch(`/api/meta/verify/${id}`)
    const data = await res.json()
    setMetaStatus(res.ok ? { ok: true, name: data.pageName } : { ok: false, msg: data.error })
    setMetaVerifying(false)
  }

  async function connectGoogle() {
    if (!isEdit) return
    setLoadingGoogle(true)
    const res = await fetch(`/api/google/auth-url/${id}`)
    const data = await res.json()
    setGoogleAuthUrl(data.url)
    window.open(data.url, '_blank', 'width=600,height=700')
    setLoadingGoogle(false)
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="page-header">
        <h1>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h1>
        <p>Datos de perfil que usa la IA para generar respuestas</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Perfil del cliente</h3>

        <div className="form-group">
          <label>Nombre del negocio *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Café El Rincón" />
          {errors.name && <div className="error-msg">{errors.name}</div>}
        </div>

        <div className="form-group">
          <label>Giro / Tipo de negocio *</label>
          <input list="biz-types" value={form.business_type} onChange={e => set('business_type', e.target.value)} placeholder="Ej. Restaurante" />
          <datalist id="biz-types">{BUSINESS_TYPES.map(t => <option key={t} value={t} />)}</datalist>
          {errors.business_type && <div className="error-msg">{errors.business_type}</div>}
        </div>

        <div className="form-group">
          <label>Personalidad de marca * <span style={{ fontWeight: 400, color: '#9ca3af' }}>(guía principal para la IA)</span></label>
          <textarea
            value={form.brand_personality}
            onChange={e => set('brand_personality', e.target.value)}
            placeholder="Ej. Tono cercano y cálido, tuteo, uso moderado de emojis, siempre en primera persona del plural (nosotros). Evitamos lenguaje corporativo."
            rows={3}
          />
          {errors.brand_personality && <div className="error-msg">{errors.brand_personality}</div>}
        </div>

        <div className="form-group">
          <label>Contexto adicional <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
          <textarea
            value={form.context}
            onChange={e => set('context', e.target.value)}
            placeholder="Ej. Estamos en Colonia Roma, CDMX. Tenemos 3 sucursales. Especialidad: café de origen mexicano. No hacemos envíos."
            rows={3}
          />
        </div>

        {errors._ && <div className="error-msg" style={{ marginBottom: 12 }}>{errors._}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving && <span className="spinner" />}
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </button>
          <button className="btn-ghost" onClick={() => navigate(isEdit ? `/clients/${id}` : '/clients')}>
            Cancelar
          </button>
        </div>
      </div>

      {isEdit && (
        <>
          {/* Google Business Profile */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4, fontSize: 15 }}>🔍 Google Business Profile</h3>
            <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 16 }}>OAuth 2.0 — el cliente autoriza su cuenta de Google una sola vez</p>

            {googleStatus === 'connected' ? (
              <div className="success-msg" style={{ fontSize: 14 }}>✓ Cuenta de Google conectada. <a href="#" style={{ color: '#3b5bdb' }} onClick={e => { e.preventDefault(); navigate(`/clients/${id}`) }}>Ver ubicaciones →</a></div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                  Al hacer clic se abrirá una ventana para que el cliente autorice el acceso a su perfil de Google Business.
                </p>
                <button className="btn-ghost" onClick={connectGoogle} disabled={loadingGoogle}>
                  {loadingGoogle && <span className="spinner" style={{ borderTopColor: '#3b5bdb' }} />}
                  Conectar Google Business
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="card">
            <h3 style={{ marginBottom: 4, fontSize: 15 }}>📘 Facebook + 📸 Instagram</h3>
            <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 16 }}>Page Access Token con permisos: <code style={{ fontSize: 11 }}>pages_manage_engagement, instagram_manage_comments</code></p>

            <div className="form-group">
              <label>Page Access Token</label>
              <input
                type="password"
                value={metaCreds.meta_page_access_token}
                onChange={e => setMetaCreds(p => ({ ...p, meta_page_access_token: e.target.value }))}
                placeholder="EAA..."
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Facebook Page ID</label>
                <input value={metaCreds.meta_page_id} onChange={e => setMetaCreds(p => ({ ...p, meta_page_id: e.target.value }))} placeholder="123456789" />
              </div>
              <div className="form-group">
                <label>Instagram Account ID <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
                <input value={metaCreds.meta_instagram_account_id} onChange={e => setMetaCreds(p => ({ ...p, meta_instagram_account_id: e.target.value }))} placeholder="17841..." />
              </div>
            </div>

            {metaStatus && (
              <div className={metaStatus.ok ? 'success-msg' : 'error-msg'} style={{ marginBottom: 12 }}>
                {metaStatus.ok ? `✓ Token válido — Página: ${metaStatus.name}` : `✗ ${metaStatus.msg}`}
              </div>
            )}

            <button className="btn-ghost" onClick={verifyMeta} disabled={metaVerifying || !metaCreds.meta_page_access_token}>
              {metaVerifying && <span className="spinner" style={{ borderTopColor: '#3b5bdb' }} />}
              Guardar y verificar token
            </button>
          </div>
        </>
      )}
    </div>
  )
}
