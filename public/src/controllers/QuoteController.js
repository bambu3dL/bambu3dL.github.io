import { PageController } from './PageController.js';
import { announce, applyDynamicStyles, renderInto } from '../core/dom.js';
import { render } from '../core/html.js';
import { asideChip, quoteSuccessView, quoteView } from '../views/QuoteView.js';

export class QuoteController extends PageController {
  titleKey = 'title.quote';
  #deps;
  #outlet = null;
  #form = null;
  #materials = [];
  #works = [];

  constructor(deps) {
    super();
    this.#deps = deps;
  }

  async mount({ outlet, url }) {
    const { works, materials, i18n } = this.#deps;
    this.#outlet = outlet;
    [this.#works, this.#materials] = await Promise.all([works.all(), materials.all()]);

    const workId = url.searchParams.get('work') ?? '';
    const work = this.#works.find((item) => item.id === workId) ?? null;
    const materialParam = url.searchParams.get('material');
    const materialId = materialParam === 'other' ? 'other' : (work?.materialId ?? '');

    renderInto(outlet, quoteView({
      t: i18n.t.bind(i18n),
      lang: i18n.lang,
      i18n,
      materials: this.#materials,
      prefill: { mode: 'idea', materialId },
      work,
    }));
    this.#form = outlet.querySelector('[data-quote-form]');
    this.#form.addEventListener('submit', this.#onSubmit);
    this.#form.addEventListener('change', this.#onChange);
    this.#syncMode();
    this.#syncMaterial();
  }

  #t(key, vars) {
    return this.#deps.i18n.t(key, vars);
  }

  #syncMode() {
    const mode = this.#form.elements.mode.value;
    this.#form.querySelector('[data-mode-only="file"]').hidden = mode !== 'file';
    this.#form.querySelector('[data-mode-hint="idea"]').hidden = mode !== 'idea';
    this.#form.querySelector('[data-mode-hint="file"]').hidden = mode !== 'file';
  }

  #syncMaterial() {
    const { i18n } = this.#deps;
    const id = this.#form.elements.materialId.value;
    this.#form.querySelector('[data-custom]').hidden = id !== 'other';
    const material = this.#materials.find((item) => item.id === id) ?? null;
    const target = this.#outlet.querySelector('[data-aside-chip]');
    render(target, asideChip({ material, other: id === 'other', t: i18n.t.bind(i18n), lang: i18n.lang, i18n }));
    applyDynamicStyles(target);
  }

  #syncFiles() {
    const list = this.#form.querySelector('[data-file-list]');
    list.replaceChildren(...Array.from(this.#form.elements.files.files).map((file) => {
      const item = document.createElement('li');
      item.textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
      return item;
    }));
  }

  #onChange = (event) => {
    if (event.target.name === 'mode') this.#syncMode();
    if (event.target.name === 'materialId') this.#syncMaterial();
    if (event.target.name === 'files') this.#syncFiles();
  };

  #clearErrors() {
    this.#form.querySelectorAll('[data-error-for]').forEach((node) => {
      node.hidden = true;
      node.textContent = '';
    });
    this.#form.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
  }

  #showErrors(errors) {
    let first = null;
    Object.entries(errors).forEach(([name, code]) => {
      const message = this.#form.querySelector(`[data-error-for="${name}"]`);
      const input = this.#form.elements[name];
      if (message) {
        message.textContent = this.#t(`quote.errors.${code}`);
        message.hidden = false;
      }
      if (input && input.setAttribute) {
        input.setAttribute('aria-invalid', 'true');
        first ??= input;
      }
    });
    first?.focus();
  }

  #onSubmit = async (event) => {
    event.preventDefault();
    const form = this.#form;
    const submit = form.querySelector('[data-submit]');
    const status = form.querySelector('[data-form-status]');
    this.#clearErrors();
    status.textContent = '';

    const data = new FormData(form);
    const { lang } = this.#deps.i18n;
    const material = this.#materials.find((item) => item.id === data.get('materialId'));
    const work = this.#works.find((item) => item.id === data.get('workId'));
    const fields = {
      mode: data.get('mode'),
      name: data.get('name'),
      email: data.get('email'),
      description: data.get('description'),
      materialId: data.get('materialId'),
      materialLabel: material?.label(lang) ?? '',
      customMaterial: data.get('customMaterial'),
      quantity: data.get('quantity'),
      deadline: data.get('deadline'),
      workId: data.get('workId'),
      workTitle: work?.title(lang) ?? '',
      lang,
      files: data.get('mode') === 'file' ? Array.from(form.elements.files.files) : [],
      privacyAccepted: form.elements.privacyAccepted.checked,
      honeypot: data.get('company'),
    };

    submit.disabled = true;
    status.setAttribute('role', 'status');
    status.textContent = this.#t('quote.sending');
    const result = await this.#deps.quotes.submit(fields);
    submit.disabled = false;

    if (!result.ok) {
      // Un errore va annunciato subito: lo stato diventa un avviso.
      status.setAttribute('role', 'alert');
      status.textContent = result.failed ? this.#t('quote.failed') : this.#t('quote.fixErrors');
      this.#showErrors(result.errors ?? {});
      return;
    }
    renderInto(this.#outlet, quoteSuccessView({ t: this.#deps.i18n.t.bind(this.#deps.i18n), result }));
    this.#outlet.querySelector('[data-done]')?.focus();
    announce(this.#t('quote.done.title'));
  };

  unmount() {
    this.#form?.removeEventListener('submit', this.#onSubmit);
    this.#form?.removeEventListener('change', this.#onChange);
  }
}
