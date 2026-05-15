import { readFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

let cacheAssets: {
  iconPng: Buffer
  icon2xPng: Buffer
  logoPng: Buffer
  logo2xPng: Buffer
} | null = null

async function loadIconSource(): Promise<Buffer> {
  const ruta = path.join(process.cwd(), 'public', 'icon-512.png')
  return readFile(ruta)
}

async function generarIcono(source: Buffer, size: number): Promise<Buffer> {
  return sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 107, g: 79, b: 232, alpha: 1 } })
    .png()
    .toBuffer()
}

async function generarTransparente(size: number): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer()
}

export async function obtenerAssetsApplePass() {
  if (cacheAssets) return cacheAssets
  const iconSource = await loadIconSource()
  const [iconPng, icon2xPng, logoPng, logo2xPng] = await Promise.all([
    generarIcono(iconSource, 29),
    generarIcono(iconSource, 58),
    generarTransparente(1),
    generarTransparente(1),
  ])
  cacheAssets = { iconPng, icon2xPng, logoPng, logo2xPng }
  return cacheAssets
}
