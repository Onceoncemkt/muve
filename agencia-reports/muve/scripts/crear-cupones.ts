// Crea los cupones de pre-registro MUVET en Stripe (20% off, 1 uso por código).
//
// Correr UNA vez con:
//   node --experimental-strip-types --env-file=.env.local scripts/crear-cupones.ts
//
// Es idempotente: si un código ya existe en Stripe lo salta, así que volver a
// correrlo no duplica nada ni truena.

import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  console.error('Falta STRIPE_SECRET_KEY en el entorno')
  process.exit(1)
}
const stripe = new Stripe(secretKey)

const codigos = [
  'MUVET20-I9KLIP', 'MUVET20-MT543W', 'MUVET20-EKZUDR', 'MUVET20-6WQCY1',
  'MUVET20-RN8ORA', 'MUVET20-4L4C89', 'MUVET20-Y1QJXN', 'MUVET20-WGZ05C',
  'MUVET20-PY369Y', 'MUVET20-0JUTP3', 'MUVET20-6X9MLQ', 'MUVET20-XG5LSU',
  'MUVET20-WZALSP', 'MUVET20-9LG69A', 'MUVET20-MBZZ9D', 'MUVET20-C08YHG',
  'MUVET20-I8ZPTG', 'MUVET20-JCLFV7', 'MUVET20-ZFIVH7', 'MUVET20-BBK2Y4',
  'MUVET20-9GSMEP', 'MUVET20-3DV62J', 'MUVET20-2GLN7V', 'MUVET20-9G2P0R',
  'MUVET20-T4VHEK', 'MUVET20-93FPRY', 'MUVET20-8HML8C', 'MUVET20-OH32FA',
  'MUVET20-SVZCL9', 'MUVET20-FBJ6XZ', 'MUVET20-EE9XVL', 'MUVET20-EMMNKW',
  'MUVET20-B5MS2J', 'MUVET20-3ZXHR4', 'MUVET20-NAZ81Z', 'MUVET20-ASJ493',
  'MUVET20-28D4P4', 'MUVET20-T1DO4P', 'MUVET20-2TQKAF', 'MUVET20-PVR2X8',
  'MUVET20-NR99TA', 'MUVET20-JBEPK6', 'MUVET20-643UVH', 'MUVET20-MMGA31',
  'MUVET20-MXD2CB', 'MUVET20-VT1XMV', 'MUVET20-D120YU', 'MUVET20-DVTIKG',
  'MUVET20-6QBXOP', 'MUVET20-J0XTDE', 'MUVET20-51RZOS', 'MUVET20-TEXRBY',
  'MUVET20-S8U4JM', 'MUVET20-0XOLKQ', 'MUVET20-61SDBC', 'MUVET20-4QSR8G',
  'MUVET20-IQJTK3', 'MUVET20-C1PZ6D', 'MUVET20-Z5J7F2',
]

const codigosUnicos = Array.from(new Set(codigos))
const NOMBRE_CUPON = 'Pre-registro MUVET 20%'

async function obtenerOcrearCupon(): Promise<string> {
  // Reutiliza un cupón existente con el mismo nombre para no duplicar en re-runs.
  const existentes = await stripe.coupons.list({ limit: 100 })
  const cuponExistente = existentes.data.find((c) => c.name === NOMBRE_CUPON && c.valid)
  if (cuponExistente) {
    console.log('Cupón existente reutilizado:', cuponExistente.id)
    return cuponExistente.id
  }
  const cupon = await stripe.coupons.create({
    percent_off: 20,
    duration: 'forever',
    name: NOMBRE_CUPON,
    max_redemptions: codigosUnicos.length,
  })
  console.log('Cupón base creado:', cupon.id, '— max_redemptions:', codigosUnicos.length)
  return cupon.id
}

async function main() {
  console.log(`Procesando ${codigosUnicos.length} códigos...`)
  const couponId = await obtenerOcrearCupon()

  let creados = 0
  let saltados = 0
  for (const codigo of codigosUnicos) {
    const existente = await stripe.promotionCodes.list({ code: codigo, limit: 1 })
    if (existente.data.length > 0) {
      console.log('Ya existe, salto:', codigo)
      saltados += 1
      continue
    }
    await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: couponId },
      code: codigo,
      max_redemptions: 1,
    })
    console.log('Creado:', codigo)
    creados += 1
  }

  console.log(`\nListo ✅  creados: ${creados}, ya existían: ${saltados}, total: ${codigosUnicos.length}`)
}

main().catch((error) => {
  console.error('Error creando cupones:', error)
  process.exit(1)
})
