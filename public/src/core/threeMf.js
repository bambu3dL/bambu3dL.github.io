import { readZip } from './zip.js';

// Lettura dei file 3MF (un archivio ZIP con la geometria in XML). Restituisce i triangoli in millimetri, con l'asse Z
// verso l'alto, 9 valori per triangolo, già posizionati come nel piatto di stampa: le trasformazioni degli oggetti sono applicate.
// Gestisce i 3MF semplici (mesh dentro 3dmodel.model) e quelli di Bambu Studio / Orca (componenti in file separati, "p:path").
// Se il file è stato "affettato" (sliced) dallo slicer, legge anche i grammi e il tempo di stampa stimati.

export class ThreeMfError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ThreeMfError';
    this.code = code;
  }
}

const UNIT_MM = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
const SKIPPED_TYPES = new Set(['support', 'solidsupport', 'surface']);
const MAX_DEPTH = 8;
const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
// Un piccolo lettore di tag: il 3MF è XML regolare e i file sono grandi, quindi niente DOM.
const TAG = /<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)>/g;

const local = (name) => name.slice(name.indexOf(':') + 1);

function attributes(text) {
  const result = {};
  for (const match of text.matchAll(ATTRIBUTE)) result[local(match[1]) === 'path' ? 'path' : match[1]] = match[2] ?? match[3];
  return result;
}

/** Il 4x4 (righe) della trasformazione 3MF: 12 numeri "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32". */
function matrixFrom(text) {
  const v = String(text ?? '').trim().split(/\s+/).map(Number);
  if (v.length !== 12 || v.some((n) => !Number.isFinite(n))) return null;
  return [v[0], v[1], v[2], 0, v[3], v[4], v[5], 0, v[6], v[7], v[8], 0, v[9], v[10], v[11], 1];
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Prima `a`, poi `b` (convenzione 3MF: i punti sono vettori riga). */
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      for (let k = 0; k < 4; k += 1) out[row * 4 + col] += a[row * 4 + k] * b[k * 4 + col];
    }
  }
  return out;
}

/** Legge un file .model: oggetti (mesh o componenti), elementi del build e unità. */
function parseModel(xml) {
  const objects = new Map();
  const items = [];
  let unit = 1;
  let current = null;
  for (const match of xml.matchAll(TAG)) {
    const [, closing, rawName, rawAttributes] = match;
    const name = local(rawName);
    if (closing) {
      if (name === 'object') current = null;
      continue;
    }
    const attrs = attributes(rawAttributes);
    if (name === 'model') unit = UNIT_MM[attrs.unit] ?? 1;
    else if (name === 'object') {
      current = { id: attrs.id, type: attrs.type ?? 'model', vertices: [], triangles: [], components: [] };
      objects.set(attrs.id, current);
      if (match[4]) current = null;
    } else if (current && name === 'vertex') current.vertices.push(Number(attrs.x), Number(attrs.y), Number(attrs.z));
    else if (current && name === 'triangle') current.triangles.push(Number(attrs.v1), Number(attrs.v2), Number(attrs.v3));
    else if (current && name === 'component') current.components.push({ id: attrs.objectid, path: attrs.path, transform: matrixFrom(attrs.transform) });
    else if (name === 'item') items.push({ id: attrs.objectid, path: attrs.path, transform: matrixFrom(attrs.transform) });
  }
  return { objects, items, unit };
}

async function rootModelPath(zip) {
  if (zip.has('_rels/.rels')) {
    const rels = new TextDecoder().decode(await zip.read('_rels/.rels'));
    for (const match of rels.matchAll(TAG)) {
      const attrs = attributes(match[3]);
      if (/\/3dmodel$/i.test(attrs.Type ?? '') && attrs.Target) return attrs.Target.replace(/^\//, '');
    }
  }
  return '3D/3dmodel.model';
}

/** Grammi e secondi che lo slicer ha scritto nel file, se il 3MF è stato affettato. Prende solo la prima piastra. */
async function sliceInfo(zip) {
  if (!zip.has('Metadata/slice_info.config')) return null;
  const text = new TextDecoder().decode(await zip.read('Metadata/slice_info.config'));
  const plate = /<plate>([\s\S]*?)<\/plate>/.exec(text)?.[1] ?? text;
  const filaments = [...plate.matchAll(/<filament\b[^>]*\bused_g="([\d.]+)"/g)].map((match) => Number(match[1])).filter((value) => value > 0);
  const grams = filaments.reduce((sum, value) => sum + value, 0);
  const seconds = Number(/key="prediction"\s+value="(\d+)"/.exec(plate)?.[1]);
  return grams > 0 || seconds > 0 ? { grams: grams > 0 ? grams : null, filaments, seconds: seconds > 0 ? seconds : null } : null;
}

export async function parse3mf(bytes) {
  let zip;
  try {
    zip = readZip(bytes);
  } catch {
    throw new ThreeMfError('unreadable');
  }
  const rootPath = await rootModelPath(zip);
  if (!zip.has(rootPath)) throw new ThreeMfError('unreadable');
  const root = parseModel(new TextDecoder().decode(await zip.read(rootPath)));

  const extra = new Map(); // altri file .model citati dai componenti (Bambu Studio, Orca)
  const modelFor = async (path) => {
    if (!path) return root;
    const clean = path.replace(/^\//, '');
    if (!extra.has(clean)) {
      if (!zip.has(clean)) throw new ThreeMfError('unreadable');
      extra.set(clean, parseModel(new TextDecoder().decode(await zip.read(clean))));
    }
    return extra.get(clean);
  };

  const chunks = []; // un blocco di numeri per oggetto: un unico array enorme di numeri JS peserebbe troppo
  const emit = async (model, id, matrix, depth) => {
    if (depth > MAX_DEPTH) throw new ThreeMfError('unreadable');
    const object = model.objects.get(id);
    if (!object || SKIPPED_TYPES.has(object.type)) return;
    const { vertices, triangles: indices } = object;
    const out = new Float32Array(indices.length * 3);
    for (let t = 0; t < indices.length; t += 1) {
      const at = indices[t] * 3;
      const x = vertices[at];
      const y = vertices[at + 1];
      const z = vertices[at + 2];
      if (x === undefined || y === undefined || z === undefined) throw new ThreeMfError('unreadable');
      out[t * 3] = (x * matrix[0] + y * matrix[4] + z * matrix[8] + matrix[12]) * model.unit;
      out[t * 3 + 1] = (x * matrix[1] + y * matrix[5] + z * matrix[9] + matrix[13]) * model.unit;
      out[t * 3 + 2] = (x * matrix[2] + y * matrix[6] + z * matrix[10] + matrix[14]) * model.unit;
    }
    if (out.length) chunks.push(out);
    for (const component of object.components) {
      await emit(await modelFor(component.path), component.id, multiply(component.transform ?? IDENTITY, matrix), depth + 1);
    }
  };

  const items = root.items.length ? root.items : [...root.objects.keys()].map((id) => ({ id, path: undefined, transform: null }));
  for (const item of items) await emit(await modelFor(item.path), item.id, item.transform ?? IDENTITY, 0);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (total === 0) throw new ThreeMfError('empty');
  const positions = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    positions.set(chunk, offset);
    offset += chunk.length;
  }
  return { positions, slice: await sliceInfo(zip) };
}
