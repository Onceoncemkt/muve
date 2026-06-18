import { CIUDAD_LABELS } from '@/types'
import AdminInvitarNegocioForm from '@/components/admin/AdminInvitarNegocioForm'
import {
  CATEGORIAS,
  CATEGORIA_FORM_LABELS,
  CIUDADES,
  NIVELES,
  NIVEL_LABELS,
  ZONAS,
  ZONA_LABELS,
} from '@/lib/admin/datos'

const NEXT = '/admin/negocios'

export default function FormCrearNegocio({
  negociosParaInvitar,
}: {
  negociosParaInvitar: { id: string; nombre: string }[]
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black uppercase tracking-wider text-[#E8FF47]">Agregar negocio nuevo</h3>
        <p className="mt-1 text-xs text-white/50">Da de alta un estudio, gym, estética, restaurante o clínica.</p>
      </div>
      <form method="POST" encType="multipart/form-data" action="/api/admin/negocios" className="space-y-3">
        <input type="hidden" name="next" value={NEXT} />
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Nombre</label>
          <input type="text" name="nombre" required className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">URL del logo</label>
          <input type="url" name="logo_url" placeholder="https://..." className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]" />
          <p className="mt-1 text-[10px] text-white/45">URL pública del logo (subir a Supabase Storage primero).</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Categorías</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATEGORIAS.map((categoria) => (
                <label key={categoria} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white/85">
                  <input type="checkbox" name="categorias" value={categoria} className="h-4 w-4 accent-[#6B4FE8]" />
                  {CATEGORIA_FORM_LABELS[categoria]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-white/45">Selecciona al menos una categoría.</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Ciudad</label>
            <select name="ciudad" required defaultValue="" className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]">
              <option value="" disabled>Selecciona</option>
              {CIUDADES.map((ciudad) => (<option key={ciudad} value={ciudad}>{CIUDAD_LABELS[ciudad]}</option>))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Zona</label>
          <select name="zona" required defaultValue="zona1" className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]">
            {ZONAS.map((zona) => (<option key={zona} value={zona}>{ZONA_LABELS[zona]}</option>))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Nivel</label>
          <select name="nivel" required defaultValue="basico" className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]">
            {NIVELES.map((nivel) => (<option key={nivel} value={nivel}>{NIVEL_LABELS[nivel]}</option>))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Dirección</label>
          <input type="text" name="direccion" required className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Descripción</label>
          <textarea name="descripcion" rows={3} className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Instagram</label>
          <input type="text" name="instagram_handle" placeholder="usuario" className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Foto del negocio</label>
          <input type="file" name="foto_negocio" accept="image/*" className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#6B4FE8] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:tracking-wide file:text-white hover:file:bg-[#5b40cd]" />
        </div>
        <div>
          <input id="nuevo-mostrar-landing" type="checkbox" name="mostrar_en_landing" value="true" className="h-4 w-4 accent-[#6B4FE8]" />
          <label htmlFor="nuevo-mostrar-landing" className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-3 py-1.5 text-sm text-white/80">
            Mostrar en landing de pre-registro
          </label>
          <p className="mt-1 text-[10px] text-white/45">Activa esto para que el logo aparezca en /preregistro.</p>
        </div>
        <div>
          <input id="nuevo-requiere-reserva" type="checkbox" name="requiere_reserva" value="true" defaultChecked className="peer h-4 w-4 accent-[#6B4FE8]" />
          <label htmlFor="nuevo-requiere-reserva" className="ml-2 inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-[#151515] px-3 py-1.5 text-sm text-white/80">
            Requiere reserva
          </label>
          <div className="mt-2 hidden peer-checked:block">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-white/45">Capacidad por clase</label>
            <input type="number" name="capacidad_default" min={1} defaultValue={10} className="w-full rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-[#6B4FE8]" />
          </div>
        </div>
        <button type="submit" className="w-full rounded-md bg-[#E8FF47] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[#0A0A0A] hover:bg-[#f1ff89]">
          Agregar negocio
        </button>
      </form>

      <div className="border-t border-white/10 pt-4">
        <AdminInvitarNegocioForm negocios={negociosParaInvitar} />
      </div>
    </div>
  )
}
