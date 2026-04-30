import Stripe from 'stripe'
let stripeClient: Stripe | null = null

function crearStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) {
    throw new Error('Falta STRIPE_SECRET_KEY en variables de entorno')
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2026-03-25.dahlia',
  })
}

export function obtenerStripe() {
  if (!stripeClient) {
    stripeClient = crearStripeClient()
  }
  return stripeClient
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = obtenerStripe()
    const value = Reflect.get(client, prop)
    return typeof value === 'function' ? value.bind(client) : value
  },
}) as Stripe
