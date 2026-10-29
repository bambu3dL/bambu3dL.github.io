import { PageController } from './PageController.js';
import { renderInto, prefersReducedMotion } from '../core/dom.js';
import { workView } from '../views/GalleryView.js';
import { notFoundView } from '../views/TextPagesView.js';
import { webglSupported } from '../three/support.js';

export class WorkController extends PageController {
  titleKey = 'title.gallery';
  descriptionKey = 'meta.gallery';
  #deps;
  #viewer = null;

  constructor(deps) {
    super();
    this.#deps = deps;
  }

  async mount({ outlet, params }) {
    const { works, materials, estimator, snapshots, i18n } = this.#deps;
    const t = i18n.t.bind(i18n);
    const [work, allMaterials] = await Promise.all([works.byId(params.id), materials.all(), snapshots.load()]);
    if (work) await snapshots.prepare([work]);
    const material = work ? allMaterials.find((item) => item.id === work.materialId) : null;
    if (!work || !material) {
      renderInto(outlet, notFoundView({ t }));
      this.titleKey = 'title.notFound';
      this.descriptionKey = 'meta.notFound';
      this.noindex = true;
      return;
    }
    // Ogni realizzazione ha il suo titolo e la sua descrizione, per i risultati di ricerca e le anteprime.
    this.heading = work.title(i18n.lang);
    this.summary = work.summary(i18n.lang);

    const summary = estimator.summary(work, new Map(allMaterials.map((item) => [item.id, item])));
    const webgl = webglSupported();
    renderInto(outlet, workView({
      t,
      lang: i18n.lang,
      i18n,
      work,
      material,
      estimate: summary.estimate,
      colors: summary.colors,
      image: snapshots.snapshot(work, material),
      // "In altri materiali" sostituisce l'oggetto intero con un solo filo: ha senso solo per gli oggetti di un colore.
      alternatives: work.colors.length > 1 ? [] : allMaterials
        .filter((other) => other.id !== material.id)
        .map((other) => ({ material: other, estimate: estimator.estimate(work, other) })),
      webgl,
    }));

    const container = outlet.querySelector('[data-viewer]');
    if (container && webgl) {
      const { ObjectViewer } = await import('../three/ObjectViewer.js');
      this.#viewer = new ObjectViewer(container, { work, material, reducedMotion: prefersReducedMotion() });
      this.#viewer.start();
    }
  }

  unmount() {
    this.#viewer?.dispose();
    this.#viewer = null;
  }
}
