import { PageController } from './PageController.js';
import { HeroController } from './HeroController.js';
import { renderInto, prefersReducedMotion } from '../core/dom.js';
import { homeView } from '../views/HomeView.js';
import { observeReveals } from '../core/reveal.js';

const LEDGER_COUNT = 4;
const MATERIAL_COUNT = 9;

export class HomeController extends PageController {
  titleKey = 'title.home';
  #deps;
  #hero = null;
  #stopReveals = () => {};

  constructor(deps) {
    super();
    this.#deps = deps;
  }

  async mount({ outlet }) {
    const { works, materials, estimator, snapshots, timelapse, i18n } = this.#deps;
    const [allWorks, allMaterials] = await Promise.all([works.all(), materials.all(), snapshots.load()]);
    await snapshots.prepare(allWorks);
    const byId = new Map(allMaterials.map((material) => [material.id, material]));

    const pairs = allWorks.map((work) => ({ work, material: byId.get(work.materialId) })).filter((pair) => pair.material);
    // L'hero stampa un vaso: il primo oggetto a spirale dell'elenco, altrimenti il più recente.
    // Il palco dell'hero ricalca il vaso: se non c'è si preferisce una forma di esempio a un modello vero.
    const hero = pairs.find((pair) => pair.work.shape.kind === 'twistVase') ?? pairs.find((pair) => pair.work.shape.kind !== 'model') ?? pairs[0];
    const ledger = pairs.slice(0, LEDGER_COUNT).map(({ work, material }) => ({
      work,
      material,
      estimate: estimator.estimate(work, material),
      image: snapshots.snapshot(work, material),
    }));

    renderInto(outlet, homeView({
      t: i18n.t.bind(i18n),
      lang: i18n.lang,
      i18n,
      hero,
      ledger,
      materials: allMaterials.slice(0, MATERIAL_COUNT).map((material) => ({ material, image: snapshots.chip(material) })),
    }));

    this.#stopReveals = observeReveals(outlet);
    timelapse.observe(outlet);

    const root = outlet.querySelector('[data-hero]');
    if (root && hero) {
      this.#hero = new HeroController({ root, work: hero.work, material: hero.material, i18n, reducedMotion: prefersReducedMotion() });
      this.#hero.start();
    }
  }

  unmount() {
    this.#hero?.dispose();
    this.#hero = null;
    this.#stopReveals();
    this.#deps.timelapse.stop();
  }
}
