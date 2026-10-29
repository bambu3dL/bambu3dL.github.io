import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ExtrudeGeometry,
} from '../../assets/vendor/three/three.module.min.js';
import { loadModelGeometry } from './ModelGeometry.js';

// Le geometrie delle stampe: le forme di esempio (generate qui) e i modelli veri caricati dall'area riservata
// (file .s3dm, vedi core/mesh.js). Un modello arriva dalla rete, quindi va caricato prima con preloadShapes().
// Ogni generatore restituisce una geometria con l'asse Y verso l'alto, centrata e normalizzata
// (estensione massima = 1), più `userData` con l'intervallo verticale e se il pezzo è pieno.

const TAU = Math.PI * 2;
const cache = new Map();
const models = new Map(); // forma "model" -> geometria grezza (asse Y verso l'alto) già scaricata, oppure null se non si è potuta caricare

/** Mette a disposizione un modello già in memoria (l'anteprima dell'area riservata, prima di salvarlo). */
export function registerModel(shape, geometry) {
  const key = JSON.stringify(shape);
  cache.delete(key);
  models.set(key, geometry);
}

/**
 * Scarica i modelli veri tra le forme date. Va chiamata (e attesa) prima di disegnarle: buildPrintGeometry è sincrona.
 * Un modello che non si carica non rompe la pagina: al suo posto si disegna un campione piatto.
 */
export async function preloadShapes(shapes) {
  await Promise.all(shapes.filter((shape) => shape?.kind === 'model' && !models.has(JSON.stringify(shape))).map(async (shape) => {
    const key = JSON.stringify(shape);
    try {
      models.set(key, await loadModelGeometry(shape.url));
    } catch (error) {
      console.warn('Modello non caricato', shape.url, error);
      models.set(key, null);
    }
  }));
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Piccolo generatore pseudo-casuale riproducibile, così il portapenne è sempre lo stesso.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Raggio del vaso a una data quota (0..1) e a un dato angolo, prima della normalizzazione. Serve anche a posizionare l'ugello. */
export function vaseRadius({ lobes = 6, twist = 2, radius = 0.34, waist = 0.2 }, y, angle) {
  const belly = 0.55 + 0.45 * Math.sin(Math.PI * (0.14 + 0.82 * y));
  const neck = smoothstep(0.66, 1, y);
  const profile = radius * belly * (1 - neck * (1 - waist * 2.4) * 0.5);
  return profile * (1 + 0.13 * Math.cos(lobes * angle + twist * Math.PI * y));
}

function twistVase({ lobes = 6, twist = 2, radius = 0.34, waist = 0.2 }) {
  const layers = 260;
  const segments = Math.max(96, lobes * 28);
  const positions = [];
  const indices = [];
  for (let layer = 0; layer <= layers; layer += 1) {
    const y = layer / layers;
    for (let seg = 0; seg < segments; seg += 1) {
      const angle = (seg / segments) * TAU;
      const r = vaseRadius({ lobes, twist, radius, waist }, y, angle);
      positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
    }
  }
  for (let layer = 0; layer < layers; layer += 1) {
    for (let seg = 0; seg < segments; seg += 1) {
      const a = layer * segments + seg;
      const b = layer * segments + ((seg + 1) % segments);
      const c = (layer + 1) * segments + seg;
      const d = (layer + 1) * segments + ((seg + 1) % segments);
      indices.push(a, c, b, b, c, d);
    }
  }
  // fondo chiuso: un ventaglio di triangoli al centro del primo anello
  const center = positions.length / 3;
  positions.push(0, 0, 0);
  for (let seg = 0; seg < segments; seg += 1) indices.push(center, seg, (seg + 1) % segments);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, solid: false };
}

function hexShape(radius, hollow) {
  const shape = new Shape();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * TAU;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  if (hollow) {
    const hole = new Path();
    const inner = radius * 0.78;
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * TAU;
      const x = Math.cos(angle) * inner;
      const y = Math.sin(angle) * inner;
      if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

function mergeNonIndexed(parts) {
  const positions = [];
  const normals = [];
  parts.forEach((part) => {
    const flat = part.index ? part.toNonIndexed() : part;
    positions.push(...flat.attributes.position.array);
    normals.push(...flat.attributes.normal.array);
  });
  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return merged;
}

function honeycomb({ rings = 2, baseHeight = 0.6, variance = 0.35 }) {
  const random = seeded(7);
  const radius = 0.5;
  const pitch = radius * 1.732 * 1.02;
  const parts = [];
  for (let q = -rings; q <= rings; q += 1) {
    for (let r = -rings; r <= rings; r += 1) {
      if (Math.abs(q + r) > rings) continue;
      const height = baseHeight + (random() - 0.5) * 2 * variance * 0.5 + (rings - Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))) * 0.05;
      const prism = new ExtrudeGeometry(hexShape(radius * 0.97, true), { depth: height, bevelEnabled: false });
      prism.rotateX(-Math.PI / 2);
      const x = pitch * (q + r / 2);
      const z = pitch * (r * 0.866);
      prism.translate(x, 0, z);
      parts.push(prism);
    }
  }
  return { geometry: mergeNonIndexed(parts), solid: false };
}

function gearShape(teeth, outer, root, hole, windows) {
  const shape = new Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    const points = [
      [a, root],
      [a + step * 0.12, outer],
      [a + step * 0.42, outer],
      [a + step * 0.54, root],
    ];
    points.forEach(([angle, r], index) => {
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0 && index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const bore = new Path();
  bore.absarc(0, 0, hole, 0, TAU, true);
  shape.holes.push(bore);
  for (let i = 0; i < windows; i += 1) {
    const angle = (i / windows) * TAU;
    const window = new Path();
    window.absarc(Math.cos(angle) * root * 0.62, Math.sin(angle) * root * 0.62, root * 0.17, 0, TAU, true);
    shape.holes.push(window);
  }
  return shape;
}

function gear({ teeth = 16, thickness = 0.25, hole = 0.18 }) {
  const outer = 0.5;
  const root = outer - Math.min(0.1, (TAU * outer) / teeth / 3.2);
  const windows = teeth >= 20 ? 6 : 5;
  const geometry = new ExtrudeGeometry(gearShape(teeth, outer, root, hole * 0.5, windows), {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 18,
  });
  geometry.rotateX(-Math.PI / 2);
  return { geometry, solid: true };
}

/** Campione di materiale: tre gradini di spessore diverso, come le tessere di prova dei filamenti. */
function chip() {
  const parts = [0.18, 0.36, 0.54, 0.72].map((height, index) => {
    const box = new BoxGeometry(0.25, height, 0.7);
    box.translate((index - 1.5) * 0.25, height / 2, 0);
    return box;
  });
  return { geometry: mergeNonIndexed(parts), solid: true };
}

const GENERATORS = { twistVase, honeycomb, gear, chip };

/**
 * Il contorno di un oggetto a ogni quota: serve all'ugello dell'hero per seguire il perimetro di qualsiasi forma, non solo del vaso.
 * Si ricava una volta sola dai punti della superficie (vertici, metà spigoli e centro di ogni triangolo) in una tabella
 * quota x angolo con il raggio massimo dall'asse; i vuoti si riempiono con i vicini. Funziona sulla geometria già normalizzata.
 * @returns {(t: number, angle: number) => number} raggio (nelle unità della geometria normalizzata) alla quota t (0..1) e all'angolo dato
 */
export function outlineSampler(geometry) {
  if (geometry.userData.outline) return geometry.userData.outline;
  const SLICES = 96;
  const SECTORS = 72;
  const table = new Float32Array(SLICES * SECTORS);
  const { minY, spanY } = geometry.userData;
  const position = geometry.attributes.position;
  const index = geometry.index?.array;
  const count = (index ? index.length : position.count) / 3;
  const vertex = (n) => (index ? index[n] : n);
  const add = (x, y, z) => {
    const slice = Math.min(SLICES - 1, Math.max(0, Math.floor(((y - minY) / spanY) * SLICES)));
    const sector = Math.min(SECTORS - 1, Math.floor((((Math.atan2(z, x) % TAU) + TAU) % TAU) / TAU * SECTORS));
    const radius = Math.hypot(x, z);
    if (radius > table[slice * SECTORS + sector]) table[slice * SECTORS + sector] = radius;
  };
  for (let t = 0; t < count; t += 1) {
    const a = vertex(t * 3);
    const b = vertex(t * 3 + 1);
    const c = vertex(t * 3 + 2);
    const ax = position.getX(a); const ay = position.getY(a); const az = position.getZ(a);
    const bx = position.getX(b); const by = position.getY(b); const bz = position.getZ(b);
    const cx = position.getX(c); const cy = position.getY(c); const cz = position.getZ(c);
    add(ax, ay, az); add(bx, by, bz); add(cx, cy, cz);
    add((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    add((bx + cx) / 2, (by + cy) / 2, (bz + cz) / 2);
    add((ax + cx) / 2, (ay + cy) / 2, (az + cz) / 2);
    add((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);
  }
  for (let slice = 0; slice < SLICES; slice += 1) {
    const row = table.subarray(slice * SECTORS, (slice + 1) * SECTORS);
    const filled = [...row.keys()].filter((k) => row[k] > 0);
    if (filled.length === 0) continue;
    for (let k = 0; k < SECTORS; k += 1) {
      if (row[k] > 0) continue;
      let before = 1;
      while (row[(k - before + SECTORS) % SECTORS] === 0) before += 1;
      let after = 1;
      while (row[(k + after) % SECTORS] === 0) after += 1;
      const r1 = row[(k - before + SECTORS) % SECTORS];
      const r2 = row[(k + after) % SECTORS];
      row[k] = -(r1 + (r2 - r1) * (before / (before + after))); // negativo: valore ricavato, non usarlo per riempire altri vuoti
    }
    for (let k = 0; k < SECTORS; k += 1) row[k] = Math.abs(row[k]);
  }
  // quote senza nessun punto (pareti perfettamente verticali con pochi triangoli): copiano la vicina
  for (let slice = 1; slice < SLICES; slice += 1) {
    if (table.subarray(slice * SECTORS, (slice + 1) * SECTORS).every((value) => value === 0)) table.copyWithin(slice * SECTORS, (slice - 1) * SECTORS, slice * SECTORS);
  }
  for (let slice = SLICES - 2; slice >= 0; slice -= 1) {
    if (table.subarray(slice * SECTORS, (slice + 1) * SECTORS).every((value) => value === 0)) table.copyWithin(slice * SECTORS, (slice + 1) * SECTORS, (slice + 2) * SECTORS);
  }
  const sampler = (t, angle) => {
    const slice = Math.min(SLICES - 1, Math.max(0, Math.round(t * (SLICES - 1))));
    const sector = ((((angle % TAU) + TAU) % TAU) / TAU) * SECTORS;
    const k = Math.floor(sector);
    const mix = sector - k;
    return table[slice * SECTORS + (k % SECTORS)] * (1 - mix) + table[slice * SECTORS + ((k + 1) % SECTORS)] * mix;
  };
  geometry.userData.outline = sampler;
  return sampler;
}

/** Costruisce (e memorizza) la geometria normalizzata per una forma di esempio. */
export function buildPrintGeometry(shape) {
  const key = JSON.stringify(shape);
  if (cache.has(key)) return cache.get(key);
  let built;
  if (shape.kind === 'model') {
    const model = models.get(key);
    // I modelli veri sono solidi chiusi: dentro il taglio si vede il riempimento.
    built = model ? { geometry: model, solid: true } : chip();
  } else {
    const generator = GENERATORS[shape.kind];
    if (!generator) throw new Error(`Forma sconosciuta: ${shape.kind}`);
    built = generator(shape);
  }
  const { geometry, solid } = built;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
  const extent = Math.max(size.x, size.y, size.z);
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
  geometry.scale(1 / extent, 1 / extent, 1 / extent);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    solid,
    minY: geometry.boundingBox.min.y,
    spanY: geometry.boundingBox.max.y - geometry.boundingBox.min.y,
    // Per riportare un punto della geometria grezza in quella normalizzata: (p - center) / extent.
    center: [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2],
    extent,
  };
  // Un modello non ancora scaricato non si memorizza: quando arriverà (preloadShapes) si userà quello vero.
  if (shape.kind !== 'model' || models.has(key)) cache.set(key, geometry);
  return geometry;
}
