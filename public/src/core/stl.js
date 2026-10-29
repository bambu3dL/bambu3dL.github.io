// Lettura dei file STL, binari e ASCII. Restituisce i triangoli come numeri in millimetri: 9 valori per triangolo
// (x1 y1 z1 x2 y2 z2 x3 y3 z3), con l'asse Z verso l'alto, come nei programmi di stampa.

export class StlError extends Error {
  constructor(code) {
    super(code);
    this.name = 'StlError';
    this.code = code;
  }
}

function looksAscii(bytes) {
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 1024))).trimStart().toLowerCase();
  return head.startsWith('solid') && head.includes('facet');
}

function parseBinary(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  if (84 + count * 50 > bytes.length) throw new StlError('unreadable');
  const positions = new Float32Array(count * 9);
  for (let triangle = 0; triangle < count; triangle += 1) {
    const base = 84 + triangle * 50 + 12; // salta la normale: la ricalcoliamo noi
    for (let value = 0; value < 9; value += 1) positions[triangle * 9 + value] = view.getFloat32(base + value * 4, true);
  }
  return positions;
}

const VERTEX = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;

function parseAscii(bytes) {
  const text = new TextDecoder().decode(bytes);
  const numbers = [];
  for (const match of text.matchAll(VERTEX)) numbers.push(Number(match[1]), Number(match[2]), Number(match[3]));
  if (numbers.length % 9 !== 0) throw new StlError('unreadable');
  return Float32Array.from(numbers);
}

export function parseStl(bytes) {
  if (bytes.length < 15) throw new StlError('unreadable');
  // Un STL binario può cominciare con "solid" nell'intestazione: se la lunghezza torna con il conteggio, è binario.
  if (bytes.length >= 84) {
    const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true);
    if (84 + count * 50 === bytes.length) return parseBinary(bytes);
  }
  return looksAscii(bytes) ? parseAscii(bytes) : parseBinary(bytes);
}
