import { Work } from '../models/Work.js';

// Contratto: all(), byId(id), latest(n). Chi consuma non sa da dove arrivano i dati.
export class WorksRepository {
  async all() { throw new Error('not implemented'); }
  async byId(id) { return (await this.all()).find((work) => work.id === id) ?? null; }
  async latest(count) { return (await this.all()).slice(0, count); }
}

// Adattatore sul JSON statico. Quando i dati passeranno a Firestore basterà un'altra classe con lo stesso contratto.
export class JsonWorksRepository extends WorksRepository {
  #url;
  #cache = null;

  constructor(url) {
    super();
    this.#url = url;
  }

  async all() {
    if (!this.#cache) {
      const response = await fetch(this.#url, { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) throw new Error(`works: ${response.status}`);
      const data = await response.json();
      this.#cache = data.works.map((item) => new Work(item)).filter((work) => work.visible).sort((a, b) => b.date - a.date);
    }
    return this.#cache;
  }
}
