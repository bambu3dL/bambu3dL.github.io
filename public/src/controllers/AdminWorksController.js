import { AdminPage, setFlash } from './AdminPage.js';
import { clearFieldErrors, formValues, showFieldErrors } from '../core/forms.js';
import { html } from '../core/html.js';
import { bytesToBase64 } from '../core/base64.js';
import { resizeToJpeg } from '../core/image.js';
import { A } from '../i18n/admin.it.js';
import { estimateGrams } from '../models/AdminRules.js';
import { ModelError, importModel } from '../services/ModelImporter.js';
import { workFormView, worksListView } from '../views/AdminCatalogViews.js';

const fmt = (value) => new Intl.NumberFormat('it').format(value);
const duration = (seconds) => `${Math.floor(seconds / 3600)} h ${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')} min`;

export class AdminWorksController extends AdminPage {
  titleKey = 'title.adminWorks';
  section = 'works';
  #photo = null; // { promise, url } della foto scelta nel modulo
  #previewUrl = null;
  #materials = [];
  #model = null; // il modello scelto nel modulo: { base64, packed, stats }
  #modelTicket = 0; // un modello scelto dopo l'altro: conta solo l'ultimo
  #gramsAuto = false; // i grammi li ha proposti il modello e nessuno li ha ancora toccati
  #viewer = null;
  #previewSource = null; // da dove rifare l'anteprima se cambia il materiale: { packed } o { url }
  #previewCount = 0;

  async show({ params }) {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const [{ materials }, works] = await Promise.all([this.catalog.materials(), this.catalog.works()]);
    this.#materials = materials;
    if (!params.id) {
      this.draw(worksListView({ works, materialsById: new Map(materials.map((item) => [item.id, item])) }));
      return;
    }
    const work = params.id === 'new' ? null : works.find((item) => item.id === params.id);
    if (work === undefined) {
      setFlash(A.common.fieldErrors.missing, 'error');
      this.navigate('/admin/works');
      return;
    }
    this.#disposeViewer();
    this.#model = null;
    this.#gramsAuto = false;
    this.draw(workFormView({ work, materials, today: new Date().toISOString().slice(0, 10) }));
    // Un oggetto che ha già un modello lo mostra subito nell'anteprima.
    if (work?.shape?.kind === 'model' && work.shape.url) await this.#showPreview({ url: `/${work.shape.url}` });
  }

  onChange(event) {
    const target = event.target;
    if (target.matches('[data-shape-kind]')) {
      this.outlet.querySelectorAll('[data-shape-fields]').forEach((group) => { group.hidden = group.dataset.shapeFields !== target.value; });
    } else if (target.matches('input[name="photo"]')) {
      this.#choosePhoto(target);
    } else if (target.matches('input[name="modelFile"]')) {
      this.#chooseModel(target);
    } else if (target.matches('select[name="materialId"]')) {
      this.#refreshForMaterial(target.form);
    }
  }

  onInput(event) {
    // Chi scrive i grammi a mano li vuole così: il modello non li cambia più.
    if (event.target.matches('input[name="estimatedG"]')) this.#gramsAuto = false;
  }

  #materialOf(form) {
    return this.#materials.find((item) => item.id === form.elements.materialId.value) ?? null;
  }

  /** Cambiando filo cambia il colore dell'anteprima e, se i grammi sono ancora quelli proposti, anche la stima. */
  #refreshForMaterial(form) {
    if (this.#model && this.#gramsAuto && this.#model.stats.sliceGrams === null) this.#fillGrams(form);
    if (this.#previewSource) this.#showPreview(this.#previewSource);
  }

  #fillGrams(form) {
    const { stats } = this.#model;
    const material = this.#materialOf(form);
    const grams = stats.sliceGrams !== null ? Math.round(stats.sliceGrams) : estimateGrams(stats.volumeCm3, material?.family);
    form.elements.estimatedG.value = String(Math.max(1, grams));
    this.#gramsAuto = true;
  }

  async #chooseModel(input) {
    const form = input.form;
    clearFieldErrors(form);
    const info = form.querySelector('[data-model-stats]');
    const ticket = (this.#modelTicket += 1);
    this.#model = null;
    const file = input.files[0];
    if (!file) {
      info.textContent = '';
      return;
    }
    info.textContent = A.works.model.reading;
    try {
      const { packed, stats } = await importModel(file);
      if (ticket !== this.#modelTicket) return;
      this.#model = { packed, stats, base64: bytesToBase64(packed) };
      const [w, d, h] = stats.sizeMm.map((value) => Math.max(1, Math.round(value)));
      form.elements.dimW.value = w;
      form.elements.dimD.value = d;
      form.elements.dimH.value = h;
      if (!form.elements.estimatedG.value || this.#gramsAuto || stats.sliceGrams !== null) this.#fillGrams(form);
      const size = stats.packedBytes >= 1048576 ? `${(stats.packedBytes / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(stats.packedBytes / 1024))} kB`;
      info.textContent = [
        A.works.model.stats
          .replace('{out}', fmt(stats.trianglesOut)).replace('{in}', fmt(stats.trianglesIn))
          .replace('{w}', w).replace('{d}', d).replace('{h}', h)
          .replace('{volume}', fmt(Math.round(stats.volumeCm3 * 10) / 10))
          .replace('{size}', size),
        A.works.model.sizeFilled,
        stats.sliceGrams !== null ? A.works.model.gramsSlicer : A.works.model.gramsVolume,
        stats.sliceSeconds ? A.works.model.time.replace('{time}', duration(stats.sliceSeconds)) : null,
        A.works.model.orientation,
      ].filter(Boolean).join('\n');
      await this.#showPreview({ packed });
    } catch (error) {
      if (ticket !== this.#modelTicket) return;
      info.textContent = '';
      const code = error instanceof ModelError ? error.code : 'unreadable';
      if (!(error instanceof ModelError)) console.error(error);
      showFieldErrors(form, { model: code }, A.works.model.errors);
      input.value = '';
    }
  }

  /** L'anteprima 3D del modello, dallo stesso file che verrà pubblicato (o da quello già online). */
  async #showPreview(source) {
    const frame = this.outlet?.querySelector('[data-model-frame]');
    const container = this.outlet?.querySelector('[data-model-viewer]');
    if (!frame || !container) return;
    this.#previewSource = source;
    this.#disposeViewer();
    try {
      const [{ webglSupported }, { registerModel, preloadShapes }] = await Promise.all([import('../three/support.js'), import('../three/PrintGeometry.js')]);
      if (!webglSupported()) return;
      let shape;
      if (source.packed) {
        const [{ unpackMesh }, { modelGeometryFrom }] = await Promise.all([import('../core/mesh.js'), import('../three/ModelGeometry.js')]);
        shape = { kind: 'model', url: `preview:${(this.#previewCount += 1)}` };
        registerModel(shape, modelGeometryFrom(await unpackMesh(source.packed)));
      } else {
        shape = { kind: 'model', url: source.url };
        await preloadShapes([shape]);
      }
      const { ObjectViewer } = await import('../three/ObjectViewer.js');
      if (this.#previewSource !== source || !frame.isConnected) return;
      const hex = this.#materialOf(frame.closest('form'))?.hex ?? '#e5372b';
      frame.hidden = false;
      this.#viewer = new ObjectViewer(container, { work: { shape }, material: { hex }, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
      this.#viewer.start();
    } catch (error) {
      console.error(error); // l'anteprima è un aiuto: se manca, si può salvare lo stesso
    }
  }

  #disposeViewer() {
    this.#viewer?.dispose();
    this.#viewer = null;
  }

  #choosePhoto(input) {
    const form = input.form;
    clearFieldErrors(form);
    const preview = form.querySelector('[data-photo-preview]');
    if (this.#previewUrl) URL.revokeObjectURL(this.#previewUrl);
    this.#previewUrl = null;
    this.#photo = null;
    preview.replaceChildren();
    preview.hidden = true;
    const file = input.files[0];
    if (!file) return;

    this.#previewUrl = URL.createObjectURL(file);
    const image = document.createElement('img');
    image.className = 'admin-photo';
    image.alt = '';
    image.src = this.#previewUrl;
    preview.append(image);
    preview.hidden = false;
    // Si ridimensiona subito: al salvataggio la foto è già pronta (o si aspetta che finisca).
    this.#photo = { promise: resizeToJpeg(file) };
    this.#photo.promise.catch(() => {});
  }

  async onSubmit(event) {
    const form = event.target;
    if (form.matches('[data-work-form]')) await this.#saveWork(form);
  }

  async #saveWork(form) {
    const values = formValues(form);
    values.shape = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('shape_')).map(([key, value]) => [key.slice(6), value]));
    const id = form.dataset.id || null;

    let photoFailed = false;
    const saved = await this.run(form, async () => {
      let photo = null;
      if (this.#photo) {
        try {
          photo = await this.#photo.promise;
        } catch {
          photoFailed = true;
          return;
        }
      }
      await this.catalog.saveWork(values, { id, photo, removePhoto: Boolean(values.removePhoto), model: this.#model ? { base64: this.#model.base64 } : null });
    });
    if (photoFailed) {
      showFieldErrors(form, { photo: 'bad' }, { bad: A.works.form.photoBad });
      this.flash(A.common.fixErrors, 'error');
      return;
    }

    if (saved) {
      setFlash(A.works.form.saved);
      this.navigate('/admin/works');
    }
  }

  async onClick(event) {
    const remove = event.target.closest('[data-delete]');
    if (!remove || !this.confirmed(remove)) return;
    await this.catalog.deleteWork(remove.closest('form').dataset.id);
    setFlash(A.works.form.deleted);
    this.navigate('/admin/works');
  }

  unmount() {
    this.#modelTicket += 1;
    this.#disposeViewer();
    if (this.#previewUrl) URL.revokeObjectURL(this.#previewUrl);
    super.unmount();
  }
}

