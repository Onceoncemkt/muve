import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    // Fija la raíz de Turbopack al directorio del proyecto muve,
    // evita ambigüedad con el package-lock.json del repo raíz
    root: path.resolve(__dirname),
  },
}

export default nextConfig
