import { PageController } from './PageController.js';

// Carica il codice di una pagina solo quando viene aperta: chi non entra nell'area riservata non ne scarica nemmeno una riga.
// `load` restituisce una funzione che costruisce il vero controller (vedi main.js).
export class LazyController extends PageController {
  #load;
  #inner = null;
  #gone = false;

  constructor(load) {
    super();
    this.#load = load;
  }

  async mount(context) {
    const create = await this.#load();
    if (this.#gone) return;
    this.#inner = create();
    // Titolo e meta si conoscono solo ora; il router li legge dopo mount().
    this.titleKey = this.#inner.titleKey;
    this.descriptionKey = this.#inner.descriptionKey;
    this.noindex = this.#inner.noindex;
    await this.#inner.mount(context);
  }

  unmount() {
    this.#gone = true;
    this.#inner?.unmount();
  }
}
