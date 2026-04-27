import Stripe from 'stripe'
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? 'sk_test_missing_key'

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-03-25.dahlia',
})
