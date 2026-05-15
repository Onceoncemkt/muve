import { readFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

let cache: {
  iconPng: Buffer
  icon2xPng: Buffer
  logoPng: Buffer
  logo2xPng: Buffer
} | null = null

async function loadSource(): Promise<Buffer> {
  const ruta = path.join(process.cwd(), 'public', 'icon-512.png')
  return readFile(ruta)
}

async function generarPngCuadrado(source: Buffer, size: number): Promise<Buffer> {
  return sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 107, g: 79, b: 232, alpha: 1 } })
    .png()
    .toBuffer()
}

async function generarLogo(source: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(source)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

export async function obtenerAssetsApplePass() {
  if (cache) return cache
  const source = await loadSource()
  const [iconPng, icon2xPng, logoPng, logo2xPng] = await Promise.all([
    generarPngCuadrado(source, 29),
    generarPngCuadrado(source, 58),
    generarLogo(source, 160, 50),
    generarLogo(source, 320, 100),
  ])
  cache = { iconPng, icon2xPng, logoPng, logo2xPng }
  return cache
}
