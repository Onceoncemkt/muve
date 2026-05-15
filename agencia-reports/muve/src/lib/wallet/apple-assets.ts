import sharp from 'sharp'

let cacheAssets: {
  iconPng: Buffer
  icon2xPng: Buffer
} | null = null

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
  const [iconPng, icon2xPng] = await Promise.all([
    generarTransparente(29),
    generarTransparente(58),
  ])
  cacheAssets = { iconPng, icon2xPng }
  return cacheAssets
}
