import { webglSupported } from './support.js';

// Genera una miniatura PNG per ogni stampa con un unico contesto WebGL fuori schermo,
// così la galleria non apre dieci contesti. Restituisce null se WebGL non c'è.
export class SnapshotService {
  #stage = null;
  #cache = new Map();
  #size = 720;
  #PrintStage = null;
  #supported = null;

  get supported() {
    if (this.#supported === null) this.#supported = webglSupported();
    return this.#supported;
  }

  /** Carica il 3D solo quando una pagina lo chiede: finché non c'è WebGL o non serve, three.js non si scarica. */
  async load() {
    if (!this.supported || this.#PrintStage) return;
    this.#PrintStage = (await import('./PrintStage.js')).PrintStage;
  }

  /** Il campione di un materiale: tre gradini stampati, visti dall'alto. */
  chip(material) {
    return this.snapshot({ id: `chip-${material.id}`, shape: { kind: 'chip' } }, material, { angle: 0.45, layers: 44 });
  }

  snapshot(work, material, { angle = 0.7, layers } = {}) {
    if (!this.supported || !this.#PrintStage) return null;
    const key = `${work.id}:${material.hex}:${angle}`;
    if (this.#cache.has(key)) return this.#cache.get(key);

    if (!this.#stage) {
      const canvas = document.createElement('canvas');
      this.#stage = new this.#PrintStage({ canvas, alpha: true });
      this.#stage.setSize(this.#size, this.#size, 1);
    }
    const stage = this.#stage;
    stage.clearPrints();
    const print = stage.addPrint({ shape: work.shape, hex: material.hex, layers });
    stage.placePrint(print, { cx: this.#size / 2, cy: this.#size / 2, size: this.#size * 0.74 });
    stage.setPrintState(print, { printed: 1, angle });
    stage.render();
    const url = stage.canvas.toDataURL('image/png');
    this.#cache.set(key, url);
    return url;
  }
}
