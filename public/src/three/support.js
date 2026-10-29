// Controllo leggero (nessun import di three.js): serve a decidere se caricare il 3D prima di scaricarlo.
export function webglSupported() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
