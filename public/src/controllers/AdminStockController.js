import { AdminPage } from './AdminPage.js';
import { formValues } from '../core/forms.js';
import { html } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { materialLabel, stockView } from '../views/AdminCatalogViews.js';

const fmt = (value) => `${new Intl.NumberFormat('it').format(Math.round(value))} g`;

// Le bobine: i pezzi fisici di ogni filo. Qui si aggiungono, si regolano, si chiudono e si scalano con "ho stampato".
export class AdminStockController extends AdminPage {
  titleKey = 'title.adminStock';
  section = 'stock';
  #materials = [];
  #spools = [];

  async show({ url }) {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const [{ materials, spools }, works, log] = await Promise.all([this.catalog.materials(), this.catalog.works(), this.catalog.stockLog()]);
    this.#materials = materials;
    this.#spools = spools;
    // "?material=" arriva dai link della panoramica: si apre il movimento sulla bobina in uso più vecchia di quel filo.
    const wanted = url?.searchParams.get('material') ?? '';
    const pickedSpool = spools.find((spool) => spool.materialId === wanted && spool.status !== 'finished')?.id ?? '';
    this.draw(stockView({ materials, spools, works, log, pickedSpool }));
    this.#updatePreview();
  }

  #label(materialId) {
    const material = this.#materials.find((item) => item.id === materialId);
    return material ? materialLabel(material) : materialId;
  }

  /** Dice in anticipo quanto filamento toglierà "Ho stampato". */
  #updatePreview() {
    const form = this.outlet.querySelector('[data-printed-form]');
    const target = this.outlet.querySelector('[data-printed-preview]');
    if (!form || !target) return;
    const option = form.elements.workId?.selectedOptions[0];
    if (!option) {
      target.textContent = '';
      return;
    }
    const copies = Math.max(1, Math.min(100, Math.floor(Number(form.elements.copies.value)) || 1));
    const colors = JSON.parse(option.dataset.colors);
    target.textContent = colors.length === 1
      ? A.stock.printed.preview.replace('{grams}', fmt(colors[0].grams * copies)).replace('{material}', this.#label(colors[0].materialId))
      : A.stock.printed.previewMulti.replace('{list}', colors.map((color) => `${fmt(color.grams * copies)} di ${this.#label(color.materialId)}`).join(', '));
  }

  /** Dice in anticipo quanto resterebbe del filo dopo i grammi scritti. */
  #updateUsedPreview() {
    const form = this.outlet.querySelector('[data-used-form]');
    const target = this.outlet.querySelector('[data-used-preview]');
    if (!form || !target) return;
    const option = form.elements.materialId?.selectedOptions[0];
    const value = Math.round(Number(form.elements.grams.value));
    if (!option || form.elements.grams.value === '' || !Number.isFinite(value) || value < 1) {
      target.textContent = '';
      return;
    }
    const stock = Number(option.dataset.stock);
    target.textContent = A.stock.used.left.replace('{grams}', fmt(stock)).replace('{after}', fmt(Math.max(0, stock - value)));
  }

  onInput(event) {
    if (event.target.closest('[data-used-form]')) this.#updateUsedPreview();
  }

  onChange(event) {
    if (event.target.closest('[data-printed-form]')) this.#updatePreview();
    if (event.target.closest('[data-used-form]')) this.#updateUsedPreview();
    if (event.target.matches('#a-material')) {
      // Il peso proposto per una bobina nuova è quello nominale del filo scelto.
      const form = event.target.form;
      form.elements.netG.value = event.target.selectedOptions[0].dataset.spool;
    }
  }

  async onClick(event) {
    const pick = event.target.closest('[data-pick]');
    if (pick) {
      const form = this.outlet.querySelector('[data-move-form]');
      form.elements.spoolId.value = pick.dataset.pick;
      form.scrollIntoView({ block: 'center' });
      form.elements.grams.focus({ preventScroll: true });
      return;
    }
    const status = event.target.closest('[data-spool-status]');
    if (status) {
      await this.catalog.setSpoolStatus(status.dataset.spoolStatus, status.dataset.to);
      await this.show(this.context);
      this.flash(status.dataset.to === 'finished' ? A.stock.list.finishedDone : A.stock.list.reopenedDone);
      return;
    }
    const remove = event.target.closest('[data-spool-delete]');
    if (remove && this.confirmed(remove)) {
      await this.catalog.deleteSpool(remove.dataset.spoolDelete);
      await this.show(this.context);
      this.flash(A.stock.list.deletedDone);
    }
  }

  async onSubmit(event) {
    const form = event.target;
    if (form.matches('[data-printed-form]')) await this.#printed(form);
    else if (form.matches('[data-used-form]')) await this.#used(form);
    else if (form.matches('[data-add-spool-form]')) await this.#addSpool(form);
    else if (form.matches('[data-move-form]')) await this.#move(form);
  }

  async #printed(form) {
    const values = formValues(form);
    const colors = JSON.parse(form.elements.workId.selectedOptions[0].dataset.colors);
    let result;
    const ok = await this.run(form, async () => { result = await this.catalog.consumeForWork({ workId: values.workId, copies: values.copies }); });
    if (!ok) return;
    await this.show(this.context);
    if (colors.length > 1) {
      const list = result.byColor.map((item) => `${fmt(item.result.takenG)} di ${this.#label(item.materialId)}`).join(', ');
      this.flash((result.shortfallG > 0 ? A.stock.printed.shortMulti.replace('{short}', fmt(result.shortfallG)) : A.stock.printed.doneMulti).replace('{list}', list), result.shortfallG > 0 ? 'error' : 'ok');
      return;
    }
    const label = this.#label(colors[0].materialId);
    this.flash(result.shortfallG > 0
      ? A.stock.printed.short.replace('{taken}', fmt(result.takenG)).replace('{material}', label).replace('{grams}', fmt(result.requestedG)).replace('{short}', fmt(result.shortfallG))
      : A.stock.printed.done.replace('{grams}', fmt(result.takenG)).replace('{material}', label).replace('{after}', fmt(result.afterG)),
    result.shortfallG > 0 ? 'error' : 'ok');
  }

  async #used(form) {
    const values = formValues(form);
    let result;
    const ok = await this.run(form, async () => { result = await this.catalog.consumeGrams({ materialId: values.materialId, grams: values.grams, reason: values.reason }); });
    if (!ok) return;
    await this.show(this.context);
    const label = this.#label(values.materialId);
    this.flash(result.shortfallG > 0
      ? A.stock.printed.short.replace('{taken}', fmt(result.takenG)).replace('{material}', label).replace('{grams}', fmt(result.requestedG)).replace('{short}', fmt(result.shortfallG))
      : A.stock.printed.done.replace('{grams}', fmt(result.takenG)).replace('{material}', label).replace('{after}', fmt(result.afterG)),
    result.shortfallG > 0 ? 'error' : 'ok');
  }

  async #addSpool(form) {
    const values = formValues(form);
    const ok = await this.run(form, () => this.catalog.addSpool({ materialId: values.materialId, netG: values.netG, remainingG: values.remainingG }));
    if (!ok) return;
    await this.show(this.context);
    this.flash(A.stock.add.done.replace('{material}', this.#label(values.materialId)));
  }

  async #move(form) {
    const values = formValues(form);
    const spool = this.#spools.find((item) => item.id === values.spoolId);
    let result;
    const ok = await this.run(form, async () => { result = await this.catalog.adjustSpool(values); });
    if (!ok) return;
    await this.show(this.context);
    this.flash(A.stock.move.done
      .replace('{spool}', `${spool ? this.#label(spool.materialId) : values.spoolId} · ${A.stock.list.spool.replace('{n}', values.spoolId.split('-').pop())}`)
      .replace('{before}', fmt(result.before))
      .replace('{after}', fmt(result.after)));
  }
}
