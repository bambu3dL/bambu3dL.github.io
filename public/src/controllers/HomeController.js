import { PageController } from './PageController.js';
import { HeroController } from './HeroController.js';
import { renderInto, prefersReducedMotion } from '../core/dom.js';
import { SITE } from '../config.js';
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

    const pairs = allWorks
      .map((work) => ({ work, summary: estimator.summary(work, byId), material: byId.get(work.materialId) }))
      .filter((pair) => pair.summary && pair.material)
      .map((pair) => ({ ...pair, colors: pair.summary.colors }));
    // L'oggetto che si stampa scorrendo lo sceglie l'area riservata; senza scelta, il primo vaso a spirale dell'elenco.
    const hero = pairs.find((pair) => pair.work.id === SITE.home.hero) ?? pairs.find((pair) => pair.work.shape.kind === 'twistVase') ?? pairs[0];
    // Anche i quattro in evidenza: senza scelta (o se sono spariti) i primi dell'elenco.
    const chosen = (SITE.home.featured ?? []).map((id) => pairs.find((pair) => pair.work.id === id)).filter(Boolean);
    const featured = SITE.home.featured && chosen.length ? chosen : pairs.slice(0, LEDGER_COUNT);
    const ledger = featured.map(({ work, material, colors, summary }) => ({
      work,
      material,
      colors,
      estimate: summary.estimate,
      estimateMaterial: summary.material,
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
