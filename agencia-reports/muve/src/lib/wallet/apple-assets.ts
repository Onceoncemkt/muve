import sharp from 'sharp'

const BG = '#6B4FE8'
const BG_DARK = '#4A3DB8'
const FG = '#E8FF47'

let cache: {
  iconPng: Buffer
  icon2xPng: Buffer
  logoPng: Buffer
  logo2xPng: Buffer
  thumbnailPng: Buffer
  thumbnail2xPng: Buffer
} | null = null

function svgLogo(width: number, height: number): string {
  const fontSize = Math.round(height * 0.58)
  const letterSpacing = Math.round(height * 0.04)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${BG}"/>
    <text x="${width / 2}" y="${height / 2}" fill="${FG}"
      font-family="Helvetica, 'Helvetica Neue', Arial, sans-serif"
      font-size="${fontSize}" font-weight="900"
      letter-spacing="${letterSpacing}"
      text-anchor="middle" dominant-baseline="central">MUVET</text>
  </svg>`
}

function svgIcon(size: number): string {
  const fontSize = Math.round(size * 0.7)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    <text x="${size / 2}" y="${size / 2}" fill="${FG}"
      font-family="Helvetica, 'Helvetica Neue', Arial, sans-serif"
      font-size="${fontSize}" font-weight="900"
      text-anchor="middle" dominant-baseline="central">M</text>
  </svg>`
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

export async function obtenerAssetsApplePass() {
  if (cache) return cache
  const [iconPng, icon2xPng, logoPng, logo2xPng, thumbnailPng, thumbnail2xPng] = await Promise.all([
    renderSvg(svgIcon(29)),
    renderSvg(svgIcon(58)),
    renderSvg(svgLogo(160, 50)),
    renderSvg(svgLogo(320, 100)),
    renderSvg(svgThumbnail(90)),
    renderSvg(svgThumbnail(180)),
  ])
  cache = { iconPng, icon2xPng, logoPng, logo2xPng, thumbnailPng, thumbnail2xPng }
  return cache
}
