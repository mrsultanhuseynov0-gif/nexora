'use strict';

/** Generate minimal solid PNG icons for PWA (no external deps). */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pngRGB(size, r, g, b) {
  const row = Buffer.alloc(1 + size * 3);
  const raw = Buffer.alloc((1 + size * 3) * size);
  for (let y = 0; y < size; y++) {
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const i = 1 + x * 3;
      // NEXORA mark: dark border + red center
      const edge = x < size * 0.12 || y < size * 0.12 || x > size * 0.88 || y > size * 0.88;
      const inner = x > size * 0.2 && x < size * 0.8 && y > size * 0.2 && y < size * 0.8;
      if (edge) {
        row[i] = 10; row[i + 1] = 10; row[i + 2] = 10;
      } else if (inner) {
        row[i] = r; row[i + 1] = g; row[i + 2] = b;
      } else {
        row[i] = 20; row[i + 1] = 20; row[i + 2] = 20;
      }
    }
    row.copy(raw, y * row.length);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const outDir = path.join(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), pngRGB(192, 255, 0, 0));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), pngRGB(512, 255, 0, 0));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), pngRGB(180, 255, 0, 0));
console.log('Icons written to', outDir);
