// Archive ZIP « stockée » (sans compression) assemblée en flux.
// Les CRC-32 et les tailles sont connus à l'import, donc le Worker ne lit les octets qu'une fois
// et ne les modifie jamais : chaque fichier sort identique à l'original. ZIP64 au-delà de 4 Go.
const U32 = 0xffffffff;

function dosDateTime(ms) {
  const d = new Date(ms || Date.now());
  const y = Math.max(1980, d.getUTCFullYear());
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

class Buf {
  constructor(n) { this.b = new Uint8Array(n); this.v = new DataView(this.b.buffer); this.o = 0; }
  u16(x) { this.v.setUint16(this.o, x, true); this.o += 2; return this; }
  u32(x) { this.v.setUint32(this.o, x >>> 0, true); this.o += 4; return this; }
  u64(x) { this.v.setUint32(this.o, x % 0x100000000, true); this.v.setUint32(this.o + 4, Math.floor(x / 0x100000000), true); this.o += 8; return this; }
  bytes(a) { this.b.set(a, this.o); this.o += a.length; return this; }
}

export function uniqueNames(files) {
  const seen = new Set();
  return files.map(f => {
    let n = f.name, k = 2;
    const dot = n.lastIndexOf(".");
    const base = dot > 0 ? n.slice(0, dot) : n, ext = dot > 0 ? n.slice(dot) : "";
    while (seen.has(n.toLowerCase())) n = `${base} (${k++})${ext}`;
    seen.add(n.toLowerCase());
    return { ...f, name: n };
  });
}

// files : [{ name, size, crc, mtime }] → plan avec en-têtes et longueur totale exacte.
export function planZip(files) {
  const enc = new TextEncoder();
  let offset = 0;
  const entries = files.map(f => {
    const name = enc.encode(f.name);
    const big = f.size >= U32;
    const { time, date } = dosDateTime(f.mtime);
    const extra = big ? 20 : 0;
    const h = new Buf(30 + name.length + extra);
    h.u32(0x04034b50).u16(big ? 45 : 20).u16(0x0800).u16(0).u16(time).u16(date).u32(f.crc >>> 0)
      .u32(big ? U32 : f.size).u32(big ? U32 : f.size).u16(name.length).u16(extra).bytes(name);
    if (big) h.u16(0x0001).u16(16).u64(f.size).u64(f.size);
    const e = { ...f, nameBytes: name, header: h.b, offset, time, date, big };
    offset += h.b.length + f.size;
    return e;
  });
  const cdStart = offset;
  const parts = entries.map(e => {
    const offBig = e.offset >= U32;
    const z = [];
    if (e.big) z.push(e.size, e.size);
    if (offBig) z.push(e.offset);
    const extra = z.length ? 4 + 8 * z.length : 0;
    const c = new Buf(46 + e.nameBytes.length + extra);
    c.u32(0x02014b50).u16(0x032d).u16(z.length ? 45 : 20).u16(0x0800).u16(0).u16(e.time).u16(e.date).u32(e.crc >>> 0)
      .u32(e.big ? U32 : e.size).u32(e.big ? U32 : e.size).u16(e.nameBytes.length).u16(extra).u16(0).u16(0).u16(0)
      .u32((0o100644 << 16) >>> 0).u32(offBig ? U32 : e.offset).bytes(e.nameBytes);
    if (z.length) { c.u16(0x0001).u16(8 * z.length); z.forEach(x => c.u64(x)); }
    return c.b;
  });
  const cdSize = parts.reduce((s, p) => s + p.length, 0);
  const n = entries.length;
  const z64 = n >= 0xffff || cdStart >= U32 || cdSize >= U32;
  const tail = new Buf((z64 ? 56 + 20 : 0) + 22);
  if (z64) {
    const at = cdStart + cdSize;
    tail.u32(0x06064b50).u64(44).u16(0x032d).u16(45).u32(0).u32(0).u64(n).u64(n).u64(cdSize).u64(cdStart);
    tail.u32(0x07064b50).u32(0).u64(at).u32(1);
  }
  tail.u32(0x06054b50).u16(0).u16(0).u16(z64 ? 0xffff : n).u16(z64 ? 0xffff : n)
    .u32(z64 ? U32 : cdSize).u32(z64 ? U32 : cdStart).u16(0);
  const central = new Uint8Array(cdSize + tail.b.length);
  let o = 0; for (const p of parts) { central.set(p, o); o += p.length; }
  central.set(tail.b, o);
  return { entries, central, total: cdStart + central.length };
}

async function writeBytes(writable, bytes) {
  const w = writable.getWriter();
  try { await w.write(bytes); } finally { w.releaseLock(); }
}

// open(entry) → ReadableStream des octets d'origine.
export function streamZip(plan, open) {
  const { readable, writable } = new FixedLengthStream(plan.total);
  const done = (async () => {
    try {
      for (const e of plan.entries) {
        await writeBytes(writable, e.header);
        const body = await open(e);
        await body.pipeTo(writable, { preventClose: true });
      }
      await writeBytes(writable, plan.central);
      await writable.close();
    } catch (err) {
      try { await writable.abort(err); } catch {}
    }
  })();
  return { readable, done };
}
