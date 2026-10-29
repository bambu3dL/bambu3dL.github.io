import { Material } from '../models/Material.js';

// Contratto: all(), byId(id), families(). Il magazzino reale (grammi per bobina) arriverà da Firestore.
export class MaterialsRepository {
  async all() { throw new Error('not implemented'); }
  async byId(id) { return (await this.all()).find((material) => material.id === id) ?? null; }
  async families() { throw new Error('not implemented'); }
}

export class JsonMaterialsRepository extends MaterialsRepository {
  #url;
  #cache = null;

  constructor(url) {
    super();
    this.#url = url;
  }

  async #load() {
    if (!this.#cache) {
      const response = await fetch(this.#url, { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) throw new Error(`materials: ${response.status}`);
      const data = await response.json();
      this.#cache = {
        materials: data.materials.map((item) => new Material(item)),
        families: data.families,
      };
    }
    return this.#cache;
  }

  async all() {
    return (await this.#load()).materials;
  }

  async families() {
    return (await this.#load()).families;
  }
}
