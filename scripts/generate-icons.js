const fs = require('fs');
const path = require('path');

// Generate valid PNG files using raw PNG binary data
// Each icon is a simple gradient square at the correct size

function createSimplePng(size) {
  // We'll create a minimal valid PNG using the Pngjs approach
  // Since we might not have canvas, let's write a raw PNG
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  function createChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(data.length);
    const crcData = Buffer.concat([typeBytes, data]);
    const crc = computeCrc(crcData);
    const crcBuf = Buffer.allocUnsafe(4);
    crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([length, typeBytes, data, crcBuf]);
  }

  // CRC-32 implementation
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();

  function computeCrc(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return crc ^ 0xffffffff;
  }

  // IHDR: width, height, bit depth, color type (2=RGB), compression, filter, interlace
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 2;   // color type: RGB
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // Build raw image data: for each row, filter byte (0) + RGB pixels
  // Draw a blue-to-violet gradient with rounded corners
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const t = x / (size - 1);
      // Gradient: blue #3b82f6 → violet #7c3aed
      const r = Math.round(0x3b + t * (0x7c - 0x3b));
      const g = Math.round(0x82 + t * (0x3a - 0x82));
      const b = Math.round(0xf6 + t * (0xed - 0xf6));

      // Rounded corners: check distance from corner
      const cornerR = size * 0.22;
      let inBounds = true;
      const cx = [cornerR, size - cornerR];
      const cy = [cornerR, size - cornerR];
      // Only check corners
      for (const ccx of cx) {
        for (const ccy of cy) {
          if (x < ccx && y < ccy) { // top-left area
            if (ccx === cornerR && ccy === cornerR) {
              const dx = x - ccx, dy = y - ccy;
              if (dx * dx + dy * dy > cornerR * cornerR) { inBounds = false; }
            }
          }
        }
      }
      const dx1 = x < cornerR ? x - cornerR : 0;
      const dy1 = y < cornerR ? y - cornerR : 0;
      const dx2 = x > size - 1 - cornerR ? x - (size - 1 - cornerR) : 0;
      const dy2 = y > size - 1 - cornerR ? y - (size - 1 - cornerR) : 0;
      const dx = dx1 || dx2, dy = dy1 || dy2;
      if (dx !== 0 && dy !== 0 && dx * dx + dy * dy > cornerR * cornerR) {
        // Outside rounded corner — white/transparent → just write white
        row[1 + x * 3] = 255;
        row[2 + x * 3] = 255;
        row[3 + x * 3] = 255;
      } else {
        row[1 + x * 3] = r;
        row[2 + x * 3] = g;
        row[3 + x * 3] = b;
      }
    }
    rawRows.push(row);
  }

  const raw = Buffer.concat(rawRows);

  // IDAT: zlib compress the raw data
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = createChunk('IDAT', compressed);

  // IEND
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, 'public', 'icons');

for (const size of sizes) {
  const png = createSimplePng(size);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ icon${size}.png — ${png.length} bytes`);
}

console.log('All icons generated.');
