// Generates the PNG icons and the share image from public/favicon.svg: `pnpm icons`
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const INK = '#111111';
const MUTED = '#5e5e5e';
const FONT = 'Helvetica Neue';
const svg = await readFile('public/favicon.svg');

// favicon.ico: a 32 px PNG in an ICO container (ICO files may hold PNG data directly)
const png32 = await sharp(svg).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // one image
ico.writeUInt8(32, 6); // width
ico.writeUInt8(32, 7); // height
ico.writeUInt16LE(1, 10); // colour planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png32.length, 14);
ico.writeUInt32LE(22, 18); // image data offset
await writeFile('public/favicon.ico', Buffer.concat([ico, png32]));

// Apple touch icon: full square, iOS rounds the corners itself
await sharp(svg).resize(180, 180).flatten({ background: INK }).png().toFile('public/apple-touch-icon.png');

// App icons for the manifest. The letter already sits inside the maskable safe zone, so filling the corners is enough
await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(svg).resize(512, 512).flatten({ background: INK }).png().toFile('public/icon-maskable.png');

// Share image for links (Open Graph), 1200×630
function text(markup: string, size: number) {
  return sharp({ text: { text: markup, font: `${FONT} ${size}`, dpi: 72, rgba: true } }).png().toBuffer();
}
const title = await text(`<span foreground="${INK}" weight="heavy" letter_spacing="-2048">Kinoprogram for Oslo</span>`, 96);
const subtitle = await text(`<span foreground="${MUTED}">Alle kinoene i Oslo på én side</span>`, 40);
const icon = await sharp(svg).resize(112, 112).png().toBuffer();

await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#ffffff' } })
  .composite([
    { input: icon, left: 80, top: 80 },
    { input: title, left: 80, top: 330 },
    { input: subtitle, left: 82, top: 470 },
  ])
  .png()
  .toFile('public/og.png');

console.log('public/favicon.ico, public/apple-touch-icon.png, public/icon-*.png, public/og.png');
