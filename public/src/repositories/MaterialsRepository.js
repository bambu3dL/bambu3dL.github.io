import { Material } from '../models/Material.js';

// Contratto: all(), byId(id), families(). I fili stanno in un file, le bobine fisiche in un altro.
export class MaterialsRepository {
  async all() { throw new Error('not implemented'); }
  async byId(id) { return (await this.all()).find((material) => material.id === id) ?? null; }
  async families() { throw new Error('not implemented'); }
}

export class JsonMaterialsRepository extends MaterialsRepository {
  #url;
  #spoolsUrl;
  #cache = null;

  constructor(url, spoolsUrl) {
    super();
    this.#url = url;
    this.#spoolsUrl = spoolsUrl;
  }

  /** Le bobine mancanti non sono un errore: il sito mostra i fili senza residuo. */
  async #loadSpools() {
    try {
      const response = await fetch(this.#spoolsUrl, { credentials: 'same-origin', cache: 'no-cache' });
      return response.ok ? ((await response.json()).spools ?? []) : [];
    } catch {
      return [];
    }
  }

  async #load() {
    if (!this.#cache) {
      const response = await fetch(this.#url, { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) throw new Error(`materials: ${response.status}`);
      const [data, spools] = await Promise.all([response.json(), this.#loadSpools()]);
      this.#cache = {
        materials: data.materials.map((item) => new Material({ ...item, spools: spools.filter((spool) => spool.materialId === item.id) })),
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
