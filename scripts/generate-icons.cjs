const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function computeCrc(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(computeCrc(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function generatePng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 2; // 8-bit RGB
  ihdrData[10] = ihdrData[11] = ihdrData[12] = 0;

  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  const cr = size * 0.22; // corner radius

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (1 + size * 3);
    raw[rowOffset] = 0; // filter: None

    for (let x = 0; x < size; x++) {
      const pixOffset = rowOffset + 1 + x * 3;
      const t = x / Math.max(size - 1, 1);

      // Gradient blue→violet
      const r = Math.round(0x3b + t * (0x7c - 0x3b));
      const g = Math.round(0x82 + t * (0x3a - 0x82));
      const b = Math.round(0xf6 + t * (0xed - 0xf6));

      // Rounded corner check
      const dx = x < cr ? x - cr : x > size - 1 - cr ? x - (size - 1 - cr) : 0;
      const dy = y < cr ? y - cr : y > size - 1 - cr ? y - (size - 1 - cr) : 0;
      const outside = dx !== 0 && dy !== 0 && dx * dx + dy * dy > cr * cr;

      raw[pixOffset]     = outside ? 255 : r;
      raw[pixOffset + 1] = outside ? 255 : g;
      raw[pixOffset + 2] = outside ? 255 : b;
    }
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
for (const size of [16, 32, 48, 128]) {
  const png = generatePng(size);
  const out = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`icon${size}.png — ${png.length} bytes`);
}
console.log('Done.');
