import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CIUDAD_LABELS, type Ciudad, type EstadoPreregistro, type Rol } from '@/types'

type PreregistroRow = {
  id: string
  email: string
  ciudad: string
  nombre: string | null
  codigo_descuento: string
  estado: EstadoPreregistro
  created_at: string
}

const CIUDADES: Ciudad[] = ['tulancingo', 'pachuca', 'ensenada', 'tijuana']
const ESTADOS: EstadoPreregistro[] = ['pendiente', 'convertido', 'cancelado']

function csvEscape(value: unknown) {
  const texto = String(value ?? '')
  if (texto.includes(',') || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replaceAll('"', '""')}"`
  }
  return texto
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: perfil } = await db
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single<{ rol: Rol }>()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const ciudadFiltro = searchParams.get('ciudad')?.toLowerCase() ?? ''
  const estadoFiltro = searchParams.get('estado')?.toLowerCase() ?? ''
  const busqueda = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const formato = searchParams.get('format')?.toLowerCase() ?? 'json'

  let query = db
    .from('preregistros')
    .select('id, email, ciudad, nombre, codigo_descuento, estado, created_at')
    .order('created_at', { ascending: false })

  if (CIUDADES.includes(ciudadFiltro as Ciudad)) {
    query = query.eq('ciudad', ciudadFiltro)
  }
  if (ESTADOS.includes(estadoFiltro as EstadoPreregistro)) {
    query = query.eq('estado', estadoFiltro)
  }
  if (busqueda) {
    query = query.ilike('email', `%${busqueda}%`)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (data ?? []) as PreregistroRow[]

  const total = items.length
  const porCiudad = CIUDADES.map((ciudad) => ({
    ciudad,
    label: CIUDAD_LABELS[ciudad],
    total: items.filter((item) => item.ciudad === ciudad).length,
  }))
  const porEstado = ESTADOS.map((estado) => ({
    estado,
    total: items.filter((item) => item.estado === estado).length,
  }))

  if (formato === 'csv') {
    const header = 'email,nombre,ciudad,codigo_descuento,estado,created_at'
    const body = items
      .map((item) => [
        csvEscape(item.email),
        csvEscape(item.nombre ?? ''),
        csvEscape(item.ciudad),
        csvEscape(item.codigo_descuento),
        csvEscape(item.estado),
        csvEscape(item.created_at),
      ].join(','))
      .join('\n')

    return new NextResponse(`${header}\n${body}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="preregistros.csv"',
      },
    })
  }

  return NextResponse.json({
    items,
    stats: {
      total,
      porCiudad,
      porEstado,
    },
  })
}
