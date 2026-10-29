import { AdminPage, setFlash } from './AdminPage.js';
import { clearFieldErrors, formValues, showFieldErrors } from '../core/forms.js';
import { html } from '../core/html.js';
import { resizeToJpeg } from '../core/image.js';
import { A } from '../i18n/admin.it.js';
import { workFormView, worksListView } from '../views/AdminCatalogViews.js';

export class AdminWorksController extends AdminPage {
  titleKey = 'title.adminWorks';
  section = 'works';
  #photo = null; // { promise, url } della foto scelta nel modulo
  #previewUrl = null;

  async show({ params }) {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const [{ materials }, works] = await Promise.all([this.catalog.materials(), this.catalog.works()]);
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
    this.draw(workFormView({ work, materials, today: new Date().toISOString().slice(0, 10) }));
  }

  onChange(event) {
    const target = event.target;
    if (target.matches('[data-shape-kind]')) {
      this.outlet.querySelectorAll('[data-shape-fields]').forEach((group) => { group.hidden = group.dataset.shapeFields !== target.value; });
    } else if (target.matches('input[name="photo"]')) {
      this.#choosePhoto(target);
    }
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
      await this.catalog.saveWork(values, { id, photo, removePhoto: Boolean(values.removePhoto) });
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
    if (this.#previewUrl) URL.revokeObjectURL(this.#previewUrl);
    super.unmount();
  }
}

