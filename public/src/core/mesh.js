// Maglie triangolari per il sito: misura, saldatura dei vertici, riduzione, formato compatto (.s3dm) e normali.
// Funzioni pure, senza DOM e senza three.js, così si provano da sole. Le coordinate sono in millimetri, con Z verso l'alto
// (come nei programmi di stampa); il passaggio all'asse Y verso l'alto lo fa chi disegna (three/ModelGeometry.js).

export const MESH_LIMITS = Object.freeze({
  maxTriangles: 150_000, // abbastanza per un pezzo ricco di dettagli, leggero per un telefono
  maxPackedBytes: 6 * 1024 * 1024, // il file nel repository pubblico
  maxExtentMm: 2000,
});

const GRID = 65535;
const MAGIC = [0x53, 0x33, 0x44, 0x4d]; // "S3DM"
const VERSION = 1;
const HEADER_BYTES = 40;
const FLAG_DEFLATE = 1;
const FLAG_INDEX16 = 2;

export class MeshError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MeshError';
    this.code = code;
  }
}

/** Ingombro e volume (mm³) di `positions` (9 numeri per triangolo). Lancia se ci sono numeri non validi. */
export function measure(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  for (let at = 0; at < positions.length; at += 9) {
    for (let corner = 0; corner < 3; corner += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = positions[at + corner * 3 + axis];
        if (!Number.isFinite(value)) throw new MeshError('invalid');
        if (value < min[axis]) min[axis] = value;
        if (value > max[axis]) max[axis] = value;
      }
    }
    // Volume con segno del tetraedro (origine, v1, v2, v3): sommati, dànno il volume del solido chiuso.
    const ax = positions[at];
    const ay = positions[at + 1];
    const az = positions[at + 2];
    const bx = positions[at + 3];
    const by = positions[at + 4];
    const bz = positions[at + 5];
    const cx = positions[at + 6];
    const cy = positions[at + 7];
    const cz = positions[at + 8];
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  if (positions.length === 0) throw new MeshError('empty');
  return { min, max, volumeMm3: Math.abs(volume) };
}

/**
 * Salda i vertici uguali e, se i triangoli sono troppi, li riduce raggruppando i vertici vicini (vertex clustering).
 * I vertici finiscono su una griglia a 16 bit per asse dentro l'ingombro: precisione di circa extent/65535.
 * @returns {{ min, max, vertices: Uint16Array, indices: Uint32Array, trianglesIn: number }}
 */
export function reduceMesh(positions, { min, max }, { maxTriangles = MESH_LIMITS.maxTriangles } = {}) {
  const trianglesIn = positions.length / 9;
  const span = [0, 1, 2].map((axis) => max[axis] - min[axis]);
  const quantize = (value, axis) => (span[axis] > 0 ? Math.round(((value - min[axis]) / span[axis]) * GRID) : 0);

  // 1. saldatura: un vertice per ogni punto della griglia
  const lookup = new Map();
  let vertices = new Uint16Array(Math.min(positions.length, 3 * 3 * 4096));
  let vertexCount = 0;
  const indices = new Uint32Array(trianglesIn * 3);
  let triangleCount = 0;
  const corner = new Uint32Array(3);
  for (let t = 0; t < trianglesIn; t += 1) {
    for (let c = 0; c < 3; c += 1) {
      const qx = quantize(positions[t * 9 + c * 3], 0);
      const qy = quantize(positions[t * 9 + c * 3 + 1], 1);
      const qz = quantize(positions[t * 9 + c * 3 + 2], 2);
      const key = qx + qy * 65536 + qz * 4294967296;
      let index = lookup.get(key);
      if (index === undefined) {
        index = vertexCount;
        lookup.set(key, index);
        if ((vertexCount + 1) * 3 > vertices.length) {
          const bigger = new Uint16Array(vertices.length * 2);
          bigger.set(vertices);
          vertices = bigger;
        }
        vertices[vertexCount * 3] = qx;
        vertices[vertexCount * 3 + 1] = qy;
        vertices[vertexCount * 3 + 2] = qz;
        vertexCount += 1;
      }
      corner[c] = index;
    }
    if (corner[0] === corner[1] || corner[1] === corner[2] || corner[0] === corner[2]) continue; // triangolo degenere
    indices.set(corner, triangleCount * 3);
    triangleCount += 1;
  }
  if (triangleCount === 0) throw new MeshError('empty');
  let result = { vertices: vertices.slice(0, vertexCount * 3), indices: indices.slice(0, triangleCount * 3) };

  // 2. riduzione: celle di griglia sempre più grandi finché i triangoli rientrano
  for (let shift = 1; result.indices.length / 3 > maxTriangles && shift <= 15; shift += 1) result = cluster(result, shift);
  if (result.indices.length / 3 > maxTriangles) throw new MeshError('heavy');
  return { min, max, ...result, trianglesIn };
}

function cluster({ vertices, indices }, shift) {
  const count = vertices.length / 3;
  const cells = new Map();
  const remap = new Uint32Array(count);
  const sums = [];
  for (let v = 0; v < count; v += 1) {
    const key = (vertices[v * 3] >> shift) + (vertices[v * 3 + 1] >> shift) * 65536 + (vertices[v * 3 + 2] >> shift) * 4294967296;
    let cell = cells.get(key);
    if (cell === undefined) {
      cell = sums.length / 4;
      cells.set(key, cell);
      sums.push(0, 0, 0, 0);
    }
    remap[v] = cell;
    sums[cell * 4] += vertices[v * 3];
    sums[cell * 4 + 1] += vertices[v * 3 + 1];
    sums[cell * 4 + 2] += vertices[v * 3 + 2];
    sums[cell * 4 + 3] += 1;
  }
  const merged = new Uint16Array(sums.length / 4 * 3);
  for (let cell = 0; cell < sums.length / 4; cell += 1) {
    for (let axis = 0; axis < 3; axis += 1) merged[cell * 3 + axis] = Math.round(sums[cell * 4 + axis] / sums[cell * 4 + 3]);
  }
  const kept = new Uint32Array(indices.length);
  let triangles = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]];
    const b = remap[indices[t + 1]];
    const c = remap[indices[t + 2]];
    if (a === b || b === c || a === c) continue;
    kept[triangles * 3] = a;
    kept[triangles * 3 + 1] = b;
    kept[triangles * 3 + 2] = c;
    triangles += 1;
  }
  return { vertices: merged, indices: kept.slice(0, triangles * 3) };
}

async function transform(bytes, StreamClass, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new StreamClass(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Il file .s3dm: intestazione di 40 byte, poi vertici a 16 bit e indici, il tutto compresso con deflate se il browser sa farlo. */
export async function packMesh({ min, max, vertices, indices }) {
  const vertexCount = vertices.length / 3;
  const small = vertexCount < 65536;
  const body = new Uint8Array(vertices.length * 2 + indices.length * (small ? 2 : 4));
  const view = new DataView(body.buffer);
  vertices.forEach((value, i) => view.setUint16(i * 2, value, true));
  const base = vertices.length * 2;
  indices.forEach((value, i) => (small ? view.setUint16(base + i * 2, value, true) : view.setUint32(base + i * 4, value, true)));

  let payload = body;
  let flags = small ? FLAG_INDEX16 : 0;
  if (typeof CompressionStream === 'function') {
    payload = await transform(body, CompressionStream, 'deflate');
    flags |= FLAG_DEFLATE;
  }
  const out = new Uint8Array(HEADER_BYTES + payload.length);
  const head = new DataView(out.buffer);
  out.set(MAGIC, 0);
  head.setUint8(4, VERSION);
  head.setUint8(5, flags);
  head.setUint32(8, vertexCount, true);
  head.setUint32(12, indices.length / 3, true);
  [...min, ...max].forEach((value, i) => head.setFloat32(16 + i * 4, value, true));
  out.set(payload, HEADER_BYTES);
  return out;
}

/** Il contrario di packMesh. Restituisce vertici in millimetri (Float32, 3 per vertice) e gli indici dei triangoli. */
export async function unpackMesh(bytes) {
  if (bytes.length < HEADER_BYTES || MAGIC.some((value, i) => bytes[i] !== value)) throw new MeshError('format');
  const head = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (head.getUint8(4) !== VERSION) throw new MeshError('version');
  const flags = head.getUint8(5);
  const vertexCount = head.getUint32(8, true);
  const triangleCount = head.getUint32(12, true);
  const min = [0, 1, 2].map((i) => head.getFloat32(16 + i * 4, true));
  const max = [0, 1, 2].map((i) => head.getFloat32(28 + i * 4, true));
  let payload = bytes.subarray(HEADER_BYTES);
  if (flags & FLAG_DEFLATE) payload = await transform(payload, DecompressionStream, 'deflate');

  const index16 = Boolean(flags & FLAG_INDEX16);
  if (payload.length !== vertexCount * 6 + triangleCount * 3 * (index16 ? 2 : 4)) throw new MeshError('format');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < positions.length; i += 1) {
    const axis = i % 3;
    positions[i] = min[axis] + (view.getUint16(i * 2, true) / GRID) * (max[axis] - min[axis]);
  }
  const base = vertexCount * 6;
  const indices = new Uint32Array(triangleCount * 3);
  for (let i = 0; i < indices.length; i += 1) {
    indices[i] = index16 ? view.getUint16(base + i * 2, true) : view.getUint32(base + i * 4, true);
    if (indices[i] >= vertexCount) throw new MeshError('format');
  }
  return { min, max, positions, indices };
}

/**
 * Posizioni e normali "a spigolo": ogni angolo di triangolo riceve la media delle normali dei triangoli vicini che non
 * si discostano più di `creaseDeg`. Le superfici curve restano lisce, gli spigoli vivi restano vivi.
 * @returns {{ positions: Float32Array, normals: Float32Array }} non indicizzati: 9 numeri per triangolo
 */
export function creasedNormals({ positions, indices }, creaseDeg = 50) {
  const triangles = indices.length / 3;
  const faces = new Float32Array(triangles * 3);
  for (let t = 0; t < triangles; t += 1) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    faces[t * 3] = uy * vz - uz * vy; // lunghezza = doppia area: pesa i triangoli grandi di più
    faces[t * 3 + 1] = uz * vx - ux * vz;
    faces[t * 3 + 2] = ux * vy - uy * vx;
  }

  // triangoli che toccano ciascun vertice, in forma compatta (CSR)
  const vertexCount = positions.length / 3;
  const start = new Uint32Array(vertexCount + 1);
  for (let i = 0; i < indices.length; i += 1) start[indices[i] + 1] += 1;
  for (let v = 0; v < vertexCount; v += 1) start[v + 1] += start[v];
  const fill = start.slice(0, vertexCount);
  const around = new Uint32Array(indices.length);
  for (let t = 0; t < triangles; t += 1) {
    for (let c = 0; c < 3; c += 1) around[fill[indices[t * 3 + c]]++] = t;
  }

  const limit = Math.cos((creaseDeg * Math.PI) / 180);
  const outPositions = new Float32Array(triangles * 9);
  const outNormals = new Float32Array(triangles * 9);
  const length = (t) => Math.hypot(faces[t * 3], faces[t * 3 + 1], faces[t * 3 + 2]);
  for (let t = 0; t < triangles; t += 1) {
    const own = length(t) || 1;
    for (let c = 0; c < 3; c += 1) {
      const vertex = indices[t * 3 + c];
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (let k = start[vertex]; k < start[vertex + 1]; k += 1) {
        const other = around[k];
        const size = length(other) || 1;
        const dot = (faces[t * 3] * faces[other * 3] + faces[t * 3 + 1] * faces[other * 3 + 1] + faces[t * 3 + 2] * faces[other * 3 + 2]) / (own * size);
        if (dot >= limit) {
          nx += faces[other * 3];
          ny += faces[other * 3 + 1];
          nz += faces[other * 3 + 2];
        }
      }
      const norm = Math.hypot(nx, ny, nz) || 1;
      const at = t * 9 + c * 3;
      outPositions[at] = positions[vertex * 3];
      outPositions[at + 1] = positions[vertex * 3 + 1];
      outPositions[at + 2] = positions[vertex * 3 + 2];
      outNormals[at] = nx / norm;
      outNormals[at + 1] = ny / norm;
      outNormals[at + 2] = nz / norm;
    }
  }
  return { positions: outPositions, normals: outNormals };
}
