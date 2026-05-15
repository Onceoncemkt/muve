import { readFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const BG = '#6B4FE8'
const BG_DARK = '#4A3DB8'

let cacheAssets: {
  iconPng: Buffer
  icon2xPng: Buffer
  logoPng: Buffer
  logo2xPng: Buffer
  thumbnailPng: Buffer
  thumbnail2xPng: Buffer
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

function svgThumbnail(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BG}"/>
        <stop offset="100%" stop-color="${BG_DARK}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
  </svg>`
}

async function renderSvg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer()
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
  const [iconPng, icon2xPng, logoPng, logo2xPng, thumbnailPng, thumbnail2xPng] = await Promise.all([
    generarIcono(iconSource, 29),
    generarIcono(iconSource, 58),
    generarTransparente(1),
    generarTransparente(1),
    renderSvg(svgThumbnail(90)),
    renderSvg(svgThumbnail(180)),
  ])
  cacheAssets = { iconPng, icon2xPng, logoPng, logo2xPng, thumbnailPng, thumbnail2xPng }
  return cacheAssets
}
