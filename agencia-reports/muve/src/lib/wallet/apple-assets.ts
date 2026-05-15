import { readFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { APPLE_LOGO_PNG_BASE64, APPLE_LOGO_2X_PNG_BASE64 } from './apple-logo-data'

const BG = '#6B4FE8'
const BG_DARK = '#4A3DB8'

let cacheAssets: {
  iconPng: Buffer
  icon2xPng: Buffer
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

// Para regenerar el logo (transparente, MUVET amarillo bold, fontSize 32/64):
//   node --experimental-strip-types -e "
//     import('sharp').then(async ({ default: sharp }) => {
//       async function gen(w,h,f) {
//         const svg = \`<svg xmlns='http://www.w3.org/2000/svg' width='\${w}' height='\${h}'>
//           <text x='\${w/2}' y='\${h/2}' fill='#E8FF47' font-family='Helvetica, sans-serif'
//                 font-size='\${f}' font-weight='900' letter-spacing='\${Math.round(f*0.05)}'
//                 text-anchor='middle' dominant-baseline='central'>MUVET</text>
//         </svg>\`;
//         return (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
//       }
//       console.log(await gen(160,50,32));
//       console.log(await gen(320,100,64));
//     });
//   "
// Y pegar los strings en apple-logo-data.ts.
export async function obtenerAssetsApplePass() {
  if (!cacheAssets) {
    const iconSource = await loadIconSource()
    const [iconPng, icon2xPng, thumbnailPng, thumbnail2xPng] = await Promise.all([
      generarIcono(iconSource, 29),
      generarIcono(iconSource, 58),
      renderSvg(svgThumbnail(90)),
      renderSvg(svgThumbnail(180)),
    ])
    cacheAssets = { iconPng, icon2xPng, thumbnailPng, thumbnail2xPng }
  }

  return {
    ...cacheAssets,
    logoPng: Buffer.from(APPLE_LOGO_PNG_BASE64, 'base64'),
    logo2xPng: Buffer.from(APPLE_LOGO_2X_PNG_BASE64, 'base64'),
  }
}
