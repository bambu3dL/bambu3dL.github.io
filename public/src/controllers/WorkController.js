import { PageController } from './PageController.js';
import { renderInto, prefersReducedMotion } from '../core/dom.js';
import { workView } from '../views/GalleryView.js';
import { notFoundView } from '../views/TextPagesView.js';
import { webglSupported } from '../three/support.js';

export class WorkController extends PageController {
  titleKey = 'title.gallery';
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
    const material = work ? allMaterials.find((item) => item.id === work.materialId) : null;
    if (!work || !material) {
      renderInto(outlet, notFoundView({ t }));
      return;
    }

    const webgl = webglSupported();
    renderInto(outlet, workView({
      t,
      lang: i18n.lang,
      i18n,
      work,
      material,
      estimate: estimator.estimate(work, material),
      image: snapshots.snapshot(work, material),
      alternatives: allMaterials
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
