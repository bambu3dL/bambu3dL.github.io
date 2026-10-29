import { PageController } from './PageController.js';
import { renderInto } from '../core/dom.js';
import { galleryView } from '../views/GalleryView.js';

export class GalleryController extends PageController {
  titleKey = 'title.gallery';
  descriptionKey = 'meta.gallery';
  #deps;
  #outlet = null;
  #family = 'all';
  #rows = [];
  #families = [];
  #onClick = (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    this.#family = chip.dataset.filter;
    this.#draw();
    this.#outlet.querySelector(`[data-filter="${this.#family}"]`)?.focus();
  };

  constructor(deps) {
    super();
    this.#deps = deps;
  }

  async mount({ outlet }) {
    const { works, materials, snapshots } = this.#deps;
    const [allWorks, allMaterials] = await Promise.all([works.all(), materials.all(), snapshots.load()]);
    const byId = new Map(allMaterials.map((material) => [material.id, material]));
    this.#rows = allWorks
      .map((work) => ({ work, material: byId.get(work.materialId) }))
      .filter((row) => row.material)
      .map((row) => ({ ...row, image: snapshots.snapshot(row.work, row.material) }));
    this.#families = [...new Set(this.#rows.map((row) => row.material.family))];
    this.#outlet = outlet;
    outlet.addEventListener('click', this.#onClick);
    this.#draw();
  }

  #draw() {
    const { i18n } = this.#deps;
    const rows = this.#family === 'all' ? this.#rows : this.#rows.filter((row) => row.material.family === this.#family);
    renderInto(this.#outlet, galleryView({
      t: i18n.t.bind(i18n),
      lang: i18n.lang,
      i18n,
      rows,
      families: this.#families,
      activeFamily: this.#family,
    }));
    this.#deps.timelapse.observe(this.#outlet);
  }

  unmount() {
    this.#outlet?.removeEventListener('click', this.#onClick);
    this.#deps.timelapse.stop();
  }
}
