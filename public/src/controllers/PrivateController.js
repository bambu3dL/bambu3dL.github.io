import { PageController } from './PageController.js';

// Pagine riservate: finché sono aperte dicono ai motori di ricerca di non indicizzarle.
// Chi estende deve chiamare super.mount() e super.unmount().
export class PrivateController extends PageController {
  #meta = null;

  async mount() {
    this.#meta = document.createElement('meta');
    this.#meta.name = 'robots';
    this.#meta.content = 'noindex, nofollow';
    document.head.append(this.#meta);
  }

  unmount() {
    this.#meta?.remove();
    this.#meta = null;
  }
}
