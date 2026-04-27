/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const BG_COLOR = '#E8FF47'
const TEXT_COLOR = '#6B4FE8'

const ICONS = [
  { size: 16, fileName: 'favicon-16x16.png' },
  { size: 32, fileName: 'favicon-32x32.png' },
  { size: 180, fileName: 'apple-touch-icon.png' },
  { size: 192, fileName: 'icon-192.png' },
  { size: 512, fileName: 'icon-512.png' },
]

function buildSvg(size) {
  const fontSize = Math.round(size * 0.54)
  const letterSpacing = (size * 0.02).toFixed(2)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${BG_COLOR}" />
  <text
    x="50%"
    y="50%"
    fill="${TEXT_COLOR}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="800"
    letter-spacing="${letterSpacing}"
    text-anchor="middle"
    dominant-baseline="middle"
  >MV</text>
</svg>`
}

async function generatePng(size, fileName) {
  const outputPath = path.join(PUBLIC_DIR, fileName)
  const svg = buildSvg(size)
  await sharp(Buffer.from(svg, 'utf8')).png().toFile(outputPath)
}

async function generateFaviconIco() {
  const { default: pngToIco } = await import('png-to-ico')
  const icoSizes = [16, 32, 48]
  const sourcePngBuffers = await Promise.all(
    icoSizes.map(async (size) => {
      const svg = buildSvg(size)
      return sharp(Buffer.from(svg, 'utf8')).png().toBuffer()
    })
  )

  const icoBuffer = await pngToIco(sourcePngBuffers)
  const faviconPath = path.join(PUBLIC_DIR, 'favicon.ico')
  await fs.writeFile(faviconPath, icoBuffer)
}

async function main() {
  await Promise.all(ICONS.map(({ size, fileName }) => generatePng(size, fileName)))
  await generateFaviconIco()

  const generatedFiles = ICONS.map(({ fileName }) => `public/${fileName}`)
  generatedFiles.push('public/favicon.ico')
  console.log(`Iconos generados:\n- ${generatedFiles.join('\n- ')}`)
}

main().catch((error) => {
  console.error('Error generando iconos:', error)
  process.exit(1)
})
