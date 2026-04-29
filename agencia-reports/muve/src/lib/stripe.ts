import Stripe from 'stripe'
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()

if (!stripeSecretKey) {
  throw new Error('Falta STRIPE_SECRET_KEY en variables de entorno')
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-03-25.dahlia',
})
