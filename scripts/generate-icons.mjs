import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const svgPath = path.join(root, 'public', 'logo.svg')
const svg = fs.readFileSync(svgPath)

async function generatePNG(size, outPath) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`  ${outPath}  (${size}x${size})`)
}

// ICO format: combines multiple PNGs into a single .ico file
function createIco(pngBuffers) {
  const headerSize = 6
  const entrySize = 16
  const count = pngBuffers.length
  let offset = headerSize + count * entrySize
  const entries = []
  const dataChunks = []

  for (const buf of pngBuffers) {
    // Use PNG-based ICO entries (modern approach)
    const w = buf.readUInt32BE(16)  // PNG width from IHDR (big-endian)
    const h = buf.readUInt32BE(20)  // PNG height from IHDR (big-endian)
    entries.push({
      width: w >= 256 ? 0 : w,
      height: h >= 256 ? 0 : h,
      colors: 0,
      reserved: 0,
      planes: 1,
      bpp: 32,
      size: buf.length,
      offset,
    })
    dataChunks.push(buf)
    offset += buf.length
  }

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)     // reserved
  header.writeUInt16LE(1, 2)     // type: ICO
  header.writeUInt16LE(count, 4) // count

  const entryBuf = Buffer.alloc(entrySize * count)
  for (let i = 0; i < count; i++) {
    const e = entries[i]
    const off = i * entrySize
    entryBuf.writeUInt8(e.width, off)
    entryBuf.writeUInt8(e.height, off + 1)
    entryBuf.writeUInt8(e.colors, off + 2)
    entryBuf.writeUInt8(e.reserved, off + 3)
    entryBuf.writeUInt16LE(e.planes, off + 4)
    entryBuf.writeUInt16LE(e.bpp, off + 6)
    entryBuf.writeUInt32LE(e.size, off + 8)
    entryBuf.writeUInt32LE(e.offset, off + 12)
  }

  return Buffer.concat([header, entryBuf, ...dataChunks])
}

async function main() {
  console.log('Generating icons from logo.svg...\n')

  // Ensure src/app dir exists
  const appDir = path.join(root, 'src', 'app')
  if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true })

  // Generate all PNG sizes
  console.log('PNG icons:')
  await generatePNG(32, path.join(appDir, 'icon.png'))
  await generatePNG(180, path.join(appDir, 'apple-icon.png'))
  await generatePNG(192, path.join(appDir, 'icon-192.png'))
  await generatePNG(512, path.join(appDir, 'icon-512.png'))

  // Generate favicon.ico (16x16 + 32x32 combined)
  console.log('\nICO favicon:')
  const png16 = await sharp(svg).resize(16, 16).png().toBuffer()
  const png32 = await sharp(svg).resize(32, 32).png().toBuffer()
  const ico = createIco([png32, png16])
  const icoPath = path.join(appDir, 'favicon.ico')
  fs.writeFileSync(icoPath, ico)
  console.log(`  ${icoPath}  (16x16, 32x32 combined)`)

  console.log('\nDone!')
}

main().catch(err => { console.error(err); process.exit(1) })
