const path = require('path')
const sharp = require('sharp')

function svgIcon(size) {
  const fontSize = size === 192 ? 54 : 140
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="100%" height="100%" fill="#E8FF47" />
      <text
        x="50%"
        y="50%"
        fill="#6B4FE8"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="800"
        letter-spacing="1.5"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        MUVET
      </text>
    </svg>
  `
}

async function generarIcono(size, filename) {
  const output = path.join(__dirname, '..', 'public', filename)
  await sharp(Buffer.from(svgIcon(size))).png().toFile(output)
}

async function main() {
  await generarIcono(192, 'icon-192.png')
  await generarIcono(512, 'icon-512.png')
  console.log('Iconos generados: public/icon-192.png, public/icon-512.png')
}

main().catch((error) => {
  console.error('Error generando iconos PWA:', error)
  process.exit(1)
})
