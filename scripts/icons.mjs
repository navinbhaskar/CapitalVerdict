/**
 * Raster app icons from public/favicon.svg (the forest tile with the C and the brass dot):
 * apple-touch-icon.png (180), icon-192.png and icon-512.png. Run after changing the favicon:
 *
 *   npm run icons
 */
import sharp from 'sharp';

const SIZES = [
  ['public/apple-touch-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
];

for (const [file, size] of SIZES) {
  await sharp('public/favicon.svg', { density: Math.ceil((72 * size) / 64) })
    .resize(size, size)
    .flatten({ background: '#0F2A22' })
    .png()
    .toFile(file);
  console.log(`${file}: ${size}×${size}`);
}
