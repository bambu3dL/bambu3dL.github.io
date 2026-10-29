import { BufferGeometry, Float32BufferAttribute } from '../../assets/vendor/three/three.module.min.js';
import { creasedNormals, unpackMesh } from '../core/mesh.js';

// Dal modello compatto (.s3dm) alla geometria di three.js. Il file ha Z verso l'alto (come nel piatto di stampa),
// three.js ha Y verso l'alto: (x, y, z) diventa (x, z, -y), una rotazione di 90° che non specchia il pezzo.

/** @param {{ positions: Float32Array, indices: Uint32Array }} mesh il risultato di unpackMesh */
export function modelGeometryFrom(mesh) {
  const { positions, normals } = creasedNormals(mesh);
  for (const array of [positions, normals]) {
    for (let i = 0; i < array.length; i += 3) {
      const y = array[i + 1];
      array[i + 1] = array[i + 2];
      array[i + 2] = -y;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}

export async function loadModelGeometry(url) {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`modello: ${response.status}`);
  return modelGeometryFrom(await unpackMesh(new Uint8Array(await response.arrayBuffer())));
}
