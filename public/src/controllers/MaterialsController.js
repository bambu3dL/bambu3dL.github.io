import { PageController } from './PageController.js';
import { renderInto } from '../core/dom.js';
import { materialsView } from '../views/MaterialsView.js';

export class MaterialsController extends PageController {
  titleKey = 'title.materials';
  descriptionKey = 'meta.materials';
  #deps;
  #outlet = null;
  #selectedId = '';
  #data = null;
  #onChange = (event) => {
    if (!event.target.matches('[data-compare]')) return;
    this.#selectedId = event.target.value;
    this.#draw();
    this.#outlet.querySelector('[data-compare]')?.focus();
  };

  constructor(deps) {
    super();
    this.#deps = deps;
  }

  async mount({ outlet, url }) {
    const { works, materials, snapshots } = this.#deps;
    const [allWorks, allMaterials, families] = await Promise.all([works.all(), materials.all(), materials.families(), snapshots.load()]);
    this.#data = { works: allWorks, materials: allMaterials, families };
    this.#outlet = outlet;
    this.#selectedId = allWorks[0]?.id ?? '';
    outlet.addEventListener('change', this.#onChange);
    this.#draw();
    if (url.hash) outlet.querySelector(`#${CSS.escape(url.hash.slice(1))}`)?.scrollIntoView({ block: 'center' });
  }

  #draw() {
    const { i18n, estimator, snapshots } = this.#deps;
    const { works, materials, families } = this.#data;
    const selectedWork = works.find((work) => work.id === this.#selectedId) ?? null;
    const lang = i18n.lang;
    const groups = Object.keys(families).map((family) => ({
      family,
      description: families[family][lang] || families[family].it,
      items: materials
        .filter((material) => material.family === family)
        .map((material) => ({ material, image: snapshots.chip(material), estimate: selectedWork ? estimator.estimate(selectedWork, material) : null })),
    }));
    renderInto(this.#outlet, materialsView({
      t: i18n.t.bind(i18n),
      lang,
      i18n,
      works,
      selectedWork,
      groups,
    }));
  }

  unmount() {
    this.#outlet?.removeEventListener('change', this.#onChange);
  }
}
