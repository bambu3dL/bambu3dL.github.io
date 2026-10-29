import { PrivateController } from './PrivateController.js';
import { renderInto } from '../core/dom.js';
import { clearFieldErrors, showFieldErrors } from '../core/forms.js';
import { html } from '../core/html.js';
import { ContactsError } from '../gateways/ContactsGateway.js';
import { ContentError } from '../gateways/ContentGateway.js';
import { A } from '../i18n/admin.it.js';
import { ValidationError } from '../models/AdminRules.js';
import { CatalogAdmin } from '../services/CatalogAdmin.js';
import { adminLayout } from '../views/AdminViews.js';

// Un messaggio che deve sopravvivere al cambio di pagina (ad esempio "Salvato" dopo il ritorno all'elenco).
let pending = null;
export const setFlash = (message, kind = 'ok') => { pending = { message, kind }; };
export const takeFlash = () => { const value = pending; pending = null; return value; };

/**
 * Base delle pagine dell'area riservata: guardia d'accesso, cornice comune, messaggi, errori e conferme.
 * Una sezione estende questa classe e implementa show(context) (+ onSubmit/onClick/onChange se serve).
 */
export class AdminPage extends PrivateController {
  titleKey = 'title.admin';
  section = 'overview';
  deps;
  outlet = null;
  catalog = null;
  context = null;
  #armed = new WeakMap();
  #gone = false; // la pagina è già stata lasciata: un caricamento in ritardo non deve più toccare lo schermo

  constructor(deps) {
    super();
    this.deps = deps;
  }

  async mount(context) {
    await super.mount();
    const { session, navigate } = this.deps;
    if (!session.unlocked) {
      navigate('/admin/login', { replace: true });
      return;
    }
    this.context = context;
    this.outlet = context.outlet;
    this.catalog = new CatalogAdmin(session.gateway);
    this.outlet.addEventListener('click', this.#onClick);
    this.outlet.addEventListener('submit', this.#onSubmit);
    this.outlet.addEventListener('change', this.#onChange);
    try {
      await this.show(context);
    } catch (error) {
      this.#fail(error);
    }
    if (this.#gone) return;
    const flash = takeFlash();
    if (flash) this.flash(flash.message, flash.kind);
  }

  /** @abstract */
  async show() {}

  /** Disegna il contenuto della sezione dentro la cornice comune. */
  draw(body) {
    if (this.#gone) return;
    renderInto(this.outlet, adminLayout({ section: this.section, body }));
  }

  flash(message, kind = 'ok') {
    const node = this.#gone ? null : this.outlet?.querySelector('[data-flash]');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    node.className = `admin-flash is-${kind}`;
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    if (kind === 'error') node.scrollIntoView({ block: 'nearest' });
  }

  navigate(path) {
    return this.deps.navigate(path);
  }

  /**
   * Esegue un salvataggio: azzera gli errori, blocca il pulsante, e traduce ogni fallimento in messaggi
   * (campi sbagliati accanto ai campi, il resto nella riga in alto). Restituisce true se è andato a buon fine.
   */
  async run(form, action) {
    const submit = form.querySelector('[data-submit]');
    clearFieldErrors(form);
    if (submit) submit.disabled = true;
    this.flash(A.common.saving, 'info');
    try {
      await action();
      return true;
    } catch (error) {
      this.#report(error, form);
      return false;
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  }

  /** Pulsanti distruttivi in due tempi: il primo clic chiede conferma (per 4 secondi), il secondo esegue. */
  confirmed(button, label = A.common.deleteConfirm) {
    if (this.#armed.has(button)) {
      window.clearTimeout(this.#armed.get(button).timer);
      button.textContent = this.#armed.get(button).text;
      this.#armed.delete(button);
      return true;
    }
    const text = button.textContent;
    button.textContent = label;
    const timer = window.setTimeout(() => {
      button.textContent = text;
      this.#armed.delete(button);
    }, 4000);
    this.#armed.set(button, { text, timer });
    return false;
  }

  #report(error, form = null) {
    if (error instanceof ValidationError) {
      const known = form ? Object.keys(error.errors).filter((name) => form.querySelector(`[data-error-for="${name}"]`)) : [];
      if (known.length) showFieldErrors(form, error.errors, A.common.fieldErrors);
      this.flash(known.length ? A.common.fixErrors : (A.common.fieldErrors[Object.values(error.errors)[0]] ?? A.common.fixErrors), 'error');
      return;
    }
    if (error instanceof ContactsError) {
      this.flash(A.contacts.errors[error.code] ?? A.contacts.errors.server, 'error');
      return;
    }
    const code = error instanceof ContentError ? error.code : 'unknown';
    if (code === 'auth') {
      setFlash(A.common.errors.auth, 'error');
      this.deps.session.lock();
      this.deps.navigate('/admin/login');
      return;
    }
    if (!(error instanceof ContentError)) console.error(error);
    this.flash(A.common.errors[code] ?? A.common.errors.unknown, 'error');
  }

  #message(error) {
    if (error instanceof ContactsError) return A.contacts.errors[error.code] ?? A.contacts.errors.server;
    if (error instanceof ContentError) return A.common.errors[error.code] ?? A.common.errors.unknown;
    return A.common.errors.unknown;
  }

  /** Le richieste dei clienti, tramite la chiave di questo dispositivo. Per sapere se si può, vedi deps.contacts.available. */
  get contacts() {
    return this.deps.contacts.open(this.deps.session.adminKey);
  }

  #fail(error) {
    this.draw(html`<section class="section admin-section"><p class="admin-state is-failed">${this.#message(error)}</p></section>`);
    if (error instanceof ContentError && error.code === 'auth') this.#report(error);
    else if (!(error instanceof ContentError)) console.error(error);
  }

  #onClick = async (event) => {
    if (event.target.closest('[data-signout]')) {
      this.deps.session.lock();
      this.deps.navigate('/admin/login');
      return;
    }
    await this.#guarded(() => this.onClick(event));
  };

  #onSubmit = async (event) => {
    event.preventDefault();
    await this.#guarded(() => this.onSubmit(event));
  };

  #onChange = async (event) => {
    await this.#guarded(() => this.onChange(event));
  };

  async #guarded(work) {
    try {
      await work();
    } catch (error) {
      this.#report(error);
    }
  }

  onClick() {}
  onSubmit() {}
  onChange() {}

  unmount() {
    this.#gone = true;
    this.outlet?.removeEventListener('click', this.#onClick);
    this.outlet?.removeEventListener('submit', this.#onSubmit);
    this.outlet?.removeEventListener('change', this.#onChange);
    super.unmount();
  }
}
