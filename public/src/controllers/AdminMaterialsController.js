import { AdminPage, setFlash } from './AdminPage.js';
import { formValues } from '../core/forms.js';
import { html } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { ValidationError } from '../models/AdminRules.js';
import { materialFormView, materialsListView } from '../views/AdminCatalogViews.js';

export class AdminMaterialsController extends AdminPage {
  titleKey = 'title.adminMaterials';
  section = 'materials';
  #families = {};

  async show({ params }) {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const { materials, families } = await this.catalog.materials();
    this.#families = families;
    if (!params.id) {
      this.draw(materialsListView({ materials, families }));
      return;
    }
    const material = params.id === 'new' ? null : materials.find((item) => item.id === params.id);
    if (material === undefined) {
      setFlash(A.common.fieldErrors.missing, 'error');
      this.navigate('/admin/materials');
      return;
    }
    this.draw(materialFormView({ material, families }));
  }

  async onSubmit(event) {
    const form = event.target;
    if (form.matches('[data-material-form]')) {
      const id = form.dataset.id || null;
      const saved = await this.run(form, () => this.catalog.saveMaterial(formValues(form), { id }));
      if (saved) {
        setFlash(A.materials.form.saved);
        this.navigate('/admin/materials');
      }
    } else if (form.matches('[data-family-form]')) {
      const saved = await this.run(form, () => this.catalog.saveFamily(formValues(form)));
      if (saved) {
        await this.show(this.context);
        this.flash(A.materials.families.saved);
      }
    }
  }

  async onClick(event) {
    const edit = event.target.closest('[data-family-edit]');
    if (edit) {
      const code = edit.dataset.familyEdit;
      const form = this.outlet.querySelector('[data-family-form]');
      form.elements.code.value = code;
      form.elements.it.value = this.#families[code]?.it ?? '';
      form.elements.en.value = this.#families[code]?.en ?? '';
      form.elements.it.focus();
      return;
    }
    const removeFamily = event.target.closest('[data-family-delete]');
    if (removeFamily && this.confirmed(removeFamily)) {
      await this.#remove(() => this.catalog.deleteFamily(removeFamily.dataset.familyDelete), A.materials.families.deleted, false);
      return;
    }
    const remove = event.target.closest('[data-delete]');
    if (remove && this.confirmed(remove)) {
      const id = remove.closest('form').dataset.id;
      await this.#remove(() => this.catalog.deleteMaterial(id), A.materials.form.deleted, true);
    }
  }

  async #remove(action, message, leave) {
    try {
      await action();
    } catch (error) {
      if (error instanceof ValidationError && error.detail.works) {
        this.flash(A.materials.form.inUse.replace('{works}', error.detail.works.join(', ')), 'error');
        return;
      }
      throw error;
    }
    if (leave) {
      setFlash(message);
      this.navigate('/admin/materials');
      return;
    }
    await this.show(this.context);
    this.flash(message);
  }
}
