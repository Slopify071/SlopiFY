/**
 * Regenerates SlopiFY's icon set and the login background from the full-res
 * sources in `assets-src/`.
 *
 * Why this exists: every icon in `public/` used to be the same byte-identical
 * 1024x1024 JPEG (mislabelled `.png`, 206 KiB) — served as a 32x32 favicon, a
 * 56x56 logo, and both PWA icons, and precached by the service worker five
 * times over. This emits correctly-sized variants instead.
 *
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { statSync } from 'node:fs'

const LOGO_SRC = 'assets-src/logo-source.png'
const BG_SRC = 'assets-src/login-bg-source.png'

// 112x112 covers both <img> sites at >=2x DPR: 56x56 (Login) and 34x34 (Sidebar).
const targets = [
  { out: 'public/logo.webp', src: LOGO_SRC, size: 112, format: 'webp', quality: 88 },
  { out: 'public/favicon-32x32.png', src: LOGO_SRC, size: 32, format: 'png' },
  { out: 'public/apple-touch-icon.png', src: LOGO_SRC, size: 180, format: 'png' },
  { out: 'public/pwa-192x192.png', src: LOGO_SRC, size: 192, format: 'png' },
  { out: 'public/pwa-512x512.png', src: LOGO_SRC, size: 512, format: 'png' },
  // Full-viewport `center/cover` background, preloaded — this gates LCP.
  { out: 'public/login-bg.webp', src: BG_SRC, size: 995, format: 'webp', quality: 82 },
]

const kib = (p) => `${(statSync(p).size / 1024).toFixed(1)} KiB`

for (const { out, src, size, format, quality } of targets) {
  const pipeline = sharp(src).resize(size, size, { fit: 'cover', kernel: 'lanczos3' })

  if (format === 'webp') {
    await pipeline.webp({ quality, effort: 6 }).toFile(out)
  } else {
    // palette:true lets small flat-colour icons drop to an indexed PNG
    await pipeline.png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(out)
  }

  console.log(`${out.padEnd(32)} ${size}x${size}`.padEnd(48), kib(out))
}
