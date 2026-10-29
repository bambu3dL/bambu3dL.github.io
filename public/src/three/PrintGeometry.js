import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ExtrudeGeometry,
} from '../../assets/vendor/three/three.module.min.js';

// Generatori di forme di esempio: servono finché non ci sono modelli STL/3MF reali.
// Ogni generatore restituisce una geometria con l'asse Y verso l'alto, centrata e normalizzata
// (estensione massima = 1), più `userData` con l'intervallo verticale e se il pezzo è pieno.

const TAU = Math.PI * 2;
const cache = new Map();

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

/** Costruisce (e memorizza) la geometria normalizzata per una forma di esempio. */
export function buildPrintGeometry(shape) {
  const key = JSON.stringify(shape);
  if (cache.has(key)) return cache.get(key);
  const generator = GENERATORS[shape.kind];
  if (!generator) throw new Error(`Forma sconosciuta: ${shape.kind}`);
  const { geometry, solid } = generator(shape);
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
  cache.set(key, geometry);
  return geometry;
}
