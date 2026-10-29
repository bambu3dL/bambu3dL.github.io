import { MESH_LIMITS, MeshError, measure, packMesh, reduceMesh } from '../core/mesh.js';
import { parseStl } from '../core/stl.js';
import { parse3mf } from '../core/threeMf.js';

// Dal file di un modello (STL o 3MF) al file compatto da pubblicare, più i dati che servono alla scheda dell'oggetto:
// ingombro, volume e, se il 3MF è stato affettato, i grammi dello slicer. Gira nel browser: il file originale non esce dal PC.

export const MODEL_EXTENSIONS = Object.freeze(['stl', '3mf']);
export const MAX_MODEL_FILE_BYTES = 120 * 1024 * 1024;

/** code: 'type' | 'size' | 'unreadable' | 'empty' | 'invalid' | 'big' | 'heavy' */
export class ModelError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ModelError';
    this.code = code;
  }
}

const extensionOf = (name) => String(name).slice(String(name).lastIndexOf('.') + 1).toLowerCase();

/**
 * @param {Uint8Array} bytes contenuto del file
 * @param {string} name nome del file (serve per riconoscere il formato)
 * @returns {Promise<{ packed: Uint8Array, stats: object }>}
 */
export async function importModelBytes(bytes, name) {
  const kind = extensionOf(name);
  if (!MODEL_EXTENSIONS.includes(kind)) throw new ModelError('type');
  if (bytes.length > MAX_MODEL_FILE_BYTES) throw new ModelError('size');

  let positions;
  let slice = null;
  try {
    if (kind === 'stl') {
      positions = parseStl(bytes);
    } else {
      ({ positions, slice } = await parse3mf(bytes));
    }
  } catch (error) {
    if (error?.code === 'empty') throw new ModelError('empty');
    throw new ModelError('unreadable');
  }

  let bounds;
  try {
    bounds = measure(positions);
  } catch (error) {
    throw new ModelError(error instanceof MeshError ? error.code : 'unreadable');
  }
  const size = bounds.max.map((value, axis) => value - bounds.min[axis]);
  if (size.some((value) => value > MESH_LIMITS.maxExtentMm)) throw new ModelError('big');

  // Se il file compresso resta troppo grande, si riprova con meno triangoli.
  let maxTriangles = MESH_LIMITS.maxTriangles;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let reduced;
    try {
      reduced = reduceMesh(positions, bounds, { maxTriangles });
    } catch (error) {
      throw new ModelError(error instanceof MeshError ? error.code : 'unreadable');
    }
    const packed = await packMesh(reduced);
    if (packed.length <= MESH_LIMITS.maxPackedBytes) {
      return {
        packed,
        stats: {
          source: kind,
          trianglesIn: reduced.trianglesIn,
          trianglesOut: reduced.indices.length / 3,
          sizeMm: size,
          volumeCm3: bounds.volumeMm3 / 1000,
          sliceGrams: slice?.grams ?? null,
          sliceFilaments: slice?.filaments ?? [], // i grammi di ogni filamento, nell'ordine dello slicer
          sliceSeconds: slice?.seconds ?? null,
          packedBytes: packed.length,
        },
      };
    }
    maxTriangles = Math.floor(maxTriangles / 2);
  }
  throw new ModelError('heavy');
}

/** Come importModelBytes, partendo da un File del browser. */
export async function importModel(file) {
  if (!MODEL_EXTENSIONS.includes(extensionOf(file.name))) throw new ModelError('type');
  if (file.size > MAX_MODEL_FILE_BYTES) throw new ModelError('size');
  return importModelBytes(new Uint8Array(await file.arrayBuffer()), file.name);
}
