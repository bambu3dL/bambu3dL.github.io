import { AdminPage } from './AdminPage.js';
import { formValues } from '../core/forms.js';
import { html } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { materialLabel, stockView } from '../views/AdminCatalogViews.js';

const fmt = (value) => `${new Intl.NumberFormat('it').format(Math.round(value))} g`;

export class AdminStockController extends AdminPage {
  titleKey = 'title.adminStock';
  section = 'stock';
  #materials = [];

  async show({ url }) {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const [{ materials }, works, log] = await Promise.all([this.catalog.materials(), this.catalog.works(), this.catalog.stockLog()]);
    this.#materials = materials;
    this.draw(stockView({ materials, works, log, picked: url?.searchParams.get('material') ?? '' }));
    this.#updatePreview();
  }

  /** Dice in anticipo quanto filamento toglierà "Ho stampato". */
  #updatePreview() {
    const form = this.outlet.querySelector('[data-printed-form]');
    const target = this.outlet.querySelector('[data-printed-preview]');
    if (!form || !target) return;
    const option = form.elements.workId.selectedOptions[0];
    if (!option) {
      target.textContent = '';
      return;
    }
    const copies = Math.max(1, Math.min(100, Math.floor(Number(form.elements.copies.value)) || 1));
    const material = this.#materials.find((item) => item.id === option.dataset.material);
    target.textContent = A.stock.printed.preview
      .replace('{grams}', fmt(Number(option.dataset.grams) * copies))
      .replace('{material}', material ? materialLabel(material) : '—');
  }

  onChange(event) {
    if (event.target.closest('[data-printed-form]')) this.#updatePreview();
  }

  onClick(event) {
    const pick = event.target.closest('[data-pick]');
    if (!pick) return;
    const form = this.outlet.querySelector('[data-move-form]');
    form.elements.materialId.value = pick.dataset.pick;
    form.scrollIntoView({ block: 'center' });
    form.elements.grams.focus({ preventScroll: true });
  }

  async onSubmit(event) {
    const form = event.target;
    if (form.matches('[data-printed-form]')) {
      let result;
      const values = formValues(form);
      const ok = await this.run(form, async () => { result = await this.catalog.consumeForWork({ workId: values.workId, copies: values.copies }); });
      if (!ok) return;
      const work = form.elements.workId.selectedOptions[0];
      const material = this.#materials.find((item) => item.id === work.dataset.material);
      const grams = Number(work.dataset.grams) * Math.max(1, Math.floor(Number(values.copies)) || 1);
      await this.show(this.context);
      this.flash(A.stock.printed.done.replace('{grams}', fmt(grams)).replace('{material}', material ? materialLabel(material) : '').replace('{after}', fmt(result.after)));
    } else if (form.matches('[data-move-form]')) {
      let result;
      const values = formValues(form);
      const ok = await this.run(form, async () => { result = await this.catalog.adjustStock(values); });
      if (!ok) return;
      const material = this.#materials.find((item) => item.id === values.materialId);
      await this.show(this.context);
      this.flash(A.stock.move.done.replace('{material}', material ? materialLabel(material) : '').replace('{before}', fmt(result.before)).replace('{after}', fmt(result.after)));
    }
  }
}
