const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let crc = -1;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePurplePng(size, outPath) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // RGB
  // bytes 10,11,12 = 0 (compress, filter, interlace)

  // Build raw rows: filter byte (0) + RGB per pixel
  // Purple = 124,58,237; draw a crude M shape in white = 255,255,255
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte
    for (let x = 0; x < size; x++) {
      const cx = size / 2, cy = size / 2;
      const mw = size * 0.5, mh = size * 0.6;
      const x0 = cx - mw/2, x1 = cx + mw/2;
      const y0 = cy - mh/2, y1 = cy + mh/2;
      const sw = Math.max(2, size/20);
      let white = false;
      // Left bar
      if (x >= x0 && x <= x0+sw && y >= y0 && y <= y1) white = true;
      // Right bar
      if (x >= x1-sw && x <= x1 && y >= y0 && y <= y1) white = true;
      // Left diagonal (top-left down to centre-bottom of M)
      const halfH = mh / 2;
      const tL = (y - y0) / halfH;
      if (tL >= 0 && tL <= 1) {
        const lx = x0 + tL * (cx - x0);
        if (Math.abs(x - lx) <= sw) white = true;
      }
      // Right diagonal
      const lxR = x1 - tL * (x1 - cx);
      if (tL >= 0 && tL <= 1 && Math.abs(x - lxR) <= sw) white = true;

      row.push(white ? 255 : 124, white ? 255 : 58, white ? 255 : 237);
    }
    rows.push(Buffer.from(row));
  }

  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw);

  const png = Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}

writePurplePng(192, 'public/icon-192x192.png');
writePurplePng(512, 'public/icon-512x512.png');
console.log('PWA icons generated.');
