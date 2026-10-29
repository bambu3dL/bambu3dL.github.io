// Lettore minimo di archivi ZIP, quanto basta per i file 3MF: legge l'elenco dalla directory centrale e sa
// estrarre le voci non compresse (metodo 0) o compresse con deflate (metodo 8). Niente ZIP64, niente cifratura.

const MAX_ENTRY_BYTES = 400 * 1024 * 1024; // una voce che si espande oltre questo limite non è un modello: è un abuso

export class ZipError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ZipError';
    this.code = code;
  }
}

const decoder = new TextDecoder();

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError('format');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || offset === 0xffffffff) throw new ZipError('zip64');

  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new ZipError('format');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.set(name, { flags, method, compressed, size, local });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return {
    has: (name) => entries.has(name),
    names: () => [...entries.keys()],
    async read(name) {
      const entry = entries.get(name);
      if (!entry) throw new ZipError('missing');
      if (entry.flags & 1) throw new ZipError('encrypted');
      if (entry.size > MAX_ENTRY_BYTES) throw new ZipError('size');
      const at = entry.local;
      if (view.getUint32(at, true) !== 0x04034b50) throw new ZipError('format');
      const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
      const data = bytes.subarray(start, start + entry.compressed);
      if (entry.method === 0) return data.slice();
      if (entry.method === 8) return inflateRaw(data);
      throw new ZipError('method');
    },
  };
}
