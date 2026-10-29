import { AdminPage, setFlash } from './AdminPage.js';
import { clearFieldErrors, formValues, showFieldErrors } from '../core/forms.js';
import { html, render } from '../core/html.js';
import { bytesToBase64 } from '../core/base64.js';
import { resizeToJpeg } from '../core/image.js';
import { ContactsError } from '../gateways/ContactsGateway.js';
import { A } from '../i18n/admin.it.js';
import { MAX_COLORS, MAX_FEATURED, estimateGrams } from '../models/AdminRules.js';
import { MAX_FILE_BYTES } from '../models/QuoteRequest.js';
import { ModelError, importModel } from '../services/ModelImporter.js';
import { modelPickerView, workFormView, worksListView } from '../views/AdminCatalogViews.js';

const fmt = (value) => new Intl.NumberFormat('it').format(value);
const duration = (seconds) => `${Math.floor(seconds / 3600)} h ${String(Math.round((seconds % 3600) / 60)).padStart(2, '0')} min`;
const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`);
const dateLabel = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('it', { day: 'numeric', month: 'short', year: 'numeric' });
};
const MODEL_FILE = /\.(stl|3mf)$/i;
const slots = Array.from({ length: MAX_COLORS }, (_, index) => index + 1);

export class AdminWorksController extends AdminPage {
  titleKey = 'title.adminWorks';
  section = 'works';
  #photo = null; // { promise, url } della foto scelta nel modulo
  #previewUrl = null;
  #materials = [];
  #model = null; // il modello scelto nel modulo: { base64, packed, stats, file, fromDrive }
  #modelTicket = 0; // un modello scelto dopo l'altro: conta solo l'ultimo
  #gramsAuto = false; // i grammi li ha proposti il modello e nessuno li ha ancora toccati
  #viewer = null;
  #previewSource = null; // da dove rifare l'anteprima se cambia il materiale: { packed } o { url }
  #previewCount = 0;
  #pickerOptions = null; // le richieste che hanno una cartella su Drive, per il selettore
  #pickerReference = '';

  /** Si possono usare i file su Drive solo se lo script è collegato e questo dispositivo ha la chiave. */
  get #driveReady() {
    return Boolean(this.deps.contacts.available && this.deps.session.adminKey);
  }

  async show({ params }) {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const [{ materials }, works] = await Promise.all([this.catalog.materials(), this.catalog.works()]);
    this.#materials = materials;
    if (!params.id) {
      const home = await this.catalog.home();
      this.draw(worksListView({ works, materialsById: new Map(materials.map((item) => [item.id, item])), home }));
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
    this.#pickerOptions = null;
    this.draw(workFormView({ work, materials, today: new Date().toISOString().slice(0, 10), driveReady: this.#driveReady }));
    this.#updateColorsTotal(this.outlet.querySelector('[data-work-form]'));
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
    } else if (target.matches('select[name="colorMaterial_1"]')) {
      this.#refreshForMaterial(target.form);
    } else if (target.matches('[data-picker-target]')) {
      this.#loadPicker(target.value);
    }
  }

  onInput(event) {
    if (!event.target.matches('input[name^="colorGrams_"]')) return;
    // Chi scrive i grammi a mano li vuole così: il modello non li cambia più.
    this.#gramsAuto = false;
    this.#updateColorsTotal(event.target.form);
  }

  /* ---------- Colori ---------- */

  #visibleColorRows(form) {
    return slots.filter((slot) => !form.querySelector(`[data-color-row="${slot}"]`).hidden);
  }

  #readColors(form) {
    return this.#visibleColorRows(form).map((slot) => ({ materialId: form.elements[`colorMaterial_${slot}`].value, grams: form.elements[`colorGrams_${slot}`].value }));
  }

  #updateColorsTotal(form) {
    const target = form?.querySelector('[data-colors-total]');
    if (!target) return;
    const rows = this.#visibleColorRows(form);
    const total = rows.reduce((sum, slot) => sum + (Number(form.elements[`colorGrams_${slot}`].value) || 0), 0);
    target.textContent = rows.length > 1 && total > 0 ? A.works.form.colorsTotal.replace('{grams}', `${fmt(total)} g`) : '';
    form.querySelector('[data-add-color]').hidden = rows.length >= MAX_COLORS;
  }

  #showColorRow(form, slot) {
    form.querySelector(`[data-color-row="${slot}"]`).hidden = false;
    this.#updateColorsTotal(form);
  }

  #addColor(form) {
    const next = slots.find((slot) => form.querySelector(`[data-color-row="${slot}"]`).hidden);
    if (!next) return;
    this.#showColorRow(form, next);
    form.elements[`colorMaterial_${next}`].focus();
  }

  #removeColor(row) {
    const form = row.closest('form');
    const slot = row.dataset.colorRow;
    row.hidden = true;
    form.elements[`colorMaterial_${slot}`].value = '';
    form.elements[`colorGrams_${slot}`].value = '';
    this.#updateColorsTotal(form);
    form.querySelector('[data-add-color]').focus();
  }

  #materialOf(form) {
    return this.#materials.find((item) => item.id === form.elements.colorMaterial_1.value) ?? null;
  }

  /** Cambiando il filo principale cambia il colore dell'anteprima e, se i grammi sono ancora quelli proposti, anche la stima. */
  #refreshForMaterial(form) {
    if (this.#model && this.#gramsAuto && this.#model.stats.sliceFilaments.length < 2 && this.#model.stats.sliceGrams === null) this.#fillGrams(form);
    if (this.#previewSource) this.#showPreview(this.#previewSource);
  }

  /** Propone i grammi dal modello: uno per ogni filamento dello slicer (fino a quattro), oppure una stima dal volume. */
  #fillGrams(form) {
    const { stats } = this.#model;
    if (stats.sliceFilaments.length > 1) {
      const grams = stats.sliceFilaments.slice(0, MAX_COLORS).map((value) => Math.max(1, Math.round(value)));
      grams[MAX_COLORS - 1] += Math.round(stats.sliceFilaments.slice(MAX_COLORS).reduce((sum, value) => sum + value, 0));
      grams.forEach((value, index) => {
        if (index > 0) this.#showColorRow(form, index + 1);
        form.elements[`colorGrams_${index + 1}`].value = String(value);
      });
    } else {
      const proposed = stats.sliceGrams !== null ? Math.round(stats.sliceGrams) : estimateGrams(stats.volumeCm3, this.#materialOf(form)?.family);
      form.elements.colorGrams_1.value = String(Math.max(1, proposed));
    }
    this.#gramsAuto = true;
    this.#updateColorsTotal(form);
  }

  /* ---------- Modello ---------- */

  async #chooseModel(input) {
    this.#modelTicket += 1; // un'eventuale lettura precedente non vale più
    if (!input.files[0]) {
      this.#model = null;
      input.form.querySelector('[data-model-stats]').textContent = '';
      return;
    }
    const ok = await this.#importFile(input.form, input.files[0], { fromDrive: false });
    if (!ok) input.value = '';
  }

  /** Legge un modello (dal computer o dal Drive), compila misure e grammi e mostra l'anteprima. Restituisce false se non si può usare. */
  async #importFile(form, file, { fromDrive }) {
    clearFieldErrors(form);
    const info = form.querySelector('[data-model-stats]');
    const ticket = (this.#modelTicket += 1);
    this.#model = null;
    info.textContent = A.works.model.reading;
    try {
      const { packed, stats } = await importModel(file);
      if (ticket !== this.#modelTicket) return true;
      this.#model = { packed, stats, base64: bytesToBase64(packed), file, fromDrive };
      const [w, d, h] = stats.sizeMm.map((value) => Math.max(1, Math.round(value)));
      form.elements.dimW.value = w;
      form.elements.dimD.value = d;
      form.elements.dimH.value = h;
      const hasGrams = this.#visibleColorRows(form).some((slot) => form.elements[`colorGrams_${slot}`].value);
      if (!hasGrams || this.#gramsAuto || stats.sliceGrams !== null) this.#fillGrams(form);
      info.textContent = [
        fromDrive ? A.works.picker.fromDrive.replace('{name}', file.name) : null,
        A.works.model.stats
          .replace('{out}', fmt(stats.trianglesOut)).replace('{in}', fmt(stats.trianglesIn))
          .replace('{w}', w).replace('{d}', d).replace('{h}', h)
          .replace('{volume}', fmt(Math.round(stats.volumeCm3 * 10) / 10))
          .replace('{size}', sizeLabel(stats.packedBytes)),
        A.works.model.sizeFilled,
        stats.sliceGrams !== null ? A.works.model.gramsSlicer : A.works.model.gramsVolume,
        stats.sliceFilaments.length > 1 ? A.works.model.filaments.replace('{n}', stats.sliceFilaments.length) : null,
        stats.sliceSeconds ? A.works.model.time.replace('{time}', duration(stats.sliceSeconds)) : null,
        A.works.model.orientation,
      ].filter(Boolean).join('\n');
      await this.#showPreview({ packed });
      return true;
    } catch (error) {
      if (ticket !== this.#modelTicket) return true;
      info.textContent = '';
      const code = error instanceof ModelError ? error.code : 'unreadable';
      if (!(error instanceof ModelError)) console.error(error);
      showFieldErrors(form, { model: code }, A.works.model.errors);
      return false;
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

  /* ---------- Scelta di un modello dal Drive ---------- */

  async #togglePicker(button) {
    const panel = button.closest('form').querySelector('[data-drive-picker]');
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) await this.#loadPicker(this.#pickerReference);
  }

  async #loadPicker(reference) {
    const panel = this.outlet.querySelector('[data-drive-picker]');
    if (!panel) return;
    this.#pickerReference = reference;
    render(panel, html`<p class="muted" role="status">${A.works.picker.loading}</p>`);
    let options = this.#pickerOptions ?? [];
    try {
      if (!this.#pickerOptions) {
        const contacts = await this.contacts.list();
        this.#pickerOptions = contacts.filter((contact) => contact.driveUrl).map((contact) => ({ reference: contact.reference, name: contact.name }));
        options = this.#pickerOptions;
      }
      const listing = await this.files.list(reference);
      const files = listing.files
        .filter((file) => MODEL_FILE.test(file.name))
        .map((file) => ({ id: file.id, name: file.name, sizeLabel: sizeLabel(file.size), dateLabel: dateLabel(file.updatedAt) }));
      render(panel, modelPickerView({ options, reference, files }));
    } catch (error) {
      const message = error instanceof ContactsError ? (A.contacts.errors[error.code] ?? A.contacts.errors.server) : A.contacts.errors.server;
      render(panel, modelPickerView({ options, reference, files: [], error: message }));
    }
    panel.querySelector('[data-picker-target]')?.focus();
  }

  async #pickFile(button) {
    const form = button.closest('form');
    const panel = form.querySelector('[data-drive-picker]');
    const info = form.querySelector('[data-model-stats]');
    info.textContent = A.works.picker.downloading;
    let file;
    try {
      file = await this.files.download(button.dataset.pickFile);
    } catch (error) {
      info.textContent = '';
      const message = error instanceof ContactsError ? (A.contacts.errors[error.code] ?? A.contacts.errors.server) : A.contacts.errors.server;
      showFieldErrors(form, { model: 'drive' }, { drive: message });
      return;
    }
    form.elements.modelFile.value = '';
    const ok = await this.#importFile(form, file, { fromDrive: true });
    if (ok) {
      panel.hidden = true;
      form.querySelector('[data-drive-open]').setAttribute('aria-expanded', 'false');
    }
  }

  /* ---------- Foto ---------- */

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

  /* ---------- Salvataggio ---------- */

  async onSubmit(event) {
    const form = event.target;
    if (form.matches('[data-work-form]')) await this.#saveWork(form);
    else if (form.matches('[data-home-form]')) await this.#saveHome(form);
  }

  async #saveHome(form) {
    const values = formValues(form);
    const featured = slots.slice(0, MAX_FEATURED).map((slot) => values[`featured_${slot}`]).filter(Boolean);
    const saved = await this.run(form, () => this.catalog.saveHome({ hero: values.hero, featured }));
    if (!saved) return;
    await this.show(this.context);
    this.flash(A.works.home.saved);
  }

  async #saveWork(form) {
    const values = formValues(form);
    values.shape = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('shape_')).map(([key, value]) => [key.slice(6), value]));
    values.colors = this.#readColors(form);
    const id = form.dataset.id || null;

    let photoFailed = false;
    let driveNote = null; // { text, kind } sul file originale mandato al Drive
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
      driveNote = await this.#sendOriginalToDrive(values.kind);
    });
    if (photoFailed) {
      showFieldErrors(form, { photo: 'bad' }, { bad: A.works.form.photoBad });
      this.flash(A.common.fixErrors, 'error');
      return;
    }

    if (saved) {
      setFlash(driveNote ? `${A.works.form.saved} ${driveNote.text}` : A.works.form.saved, driveNote?.kind ?? 'ok');
      this.navigate('/admin/works');
    }
  }

  /** Il file che hai scelto dal computer va anche sul Drive, nella Libreria. Un problema qui non annulla il salvataggio. */
  async #sendOriginalToDrive(kind) {
    const model = this.#model;
    if (!model || model.fromDrive || kind !== 'model' || !this.#driveReady) return null;
    if (model.file.size > MAX_FILE_BYTES) return { text: A.works.drive.tooBig, kind: 'error' };
    try {
      await this.files.upload({ reference: '', files: [model.file] });
      return { text: A.works.drive.done, kind: 'ok' };
    } catch (error) {
      console.error(error);
      return { text: A.works.drive.failed, kind: 'error' };
    }
  }

  async onClick(event) {
    const target = event.target;
    const move = target.closest('[data-work-move]');
    if (move) {
      const { workMove: id, dir } = move.dataset;
      await this.catalog.moveWork(id, dir);
      await this.show(this.context);
      // Il pulsante che si è premuto è stato ridisegnato: il focus torna sullo stesso (o sull'altro, se ora è in fondo).
      (this.outlet.querySelector(`[data-work-move="${id}"][data-dir="${dir}"]:not([disabled])`) ?? this.outlet.querySelector(`[data-work-move="${id}"]:not([disabled])`))?.focus();
      this.flash(A.works.moved);
      return;
    }
    const quickDelete = target.closest('[data-work-delete]');
    if (quickDelete) {
      if (!this.confirmed(quickDelete)) return;
      await this.catalog.deleteWork(quickDelete.dataset.workDelete);
      await this.show(this.context);
      this.flash(A.works.deleted);
      return;
    }
    const addColor = target.closest('[data-add-color]');
    if (addColor) {
      this.#addColor(addColor.closest('form'));
      return;
    }
    const removeColor = target.closest('[data-remove-color]');
    if (removeColor) {
      this.#removeColor(removeColor.closest('[data-color-row]'));
      return;
    }
    const open = target.closest('[data-drive-open]');
    if (open) {
      await this.#togglePicker(open);
      return;
    }
    const pick = target.closest('[data-pick-file]');
    if (pick) {
      await this.#pickFile(pick);
      return;
    }
    const remove = target.closest('[data-delete]');
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
