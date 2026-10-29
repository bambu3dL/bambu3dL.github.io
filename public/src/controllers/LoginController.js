import { PrivateController } from './PrivateController.js';
import { takeFlash } from './AdminPage.js';
import { renderInto } from '../core/dom.js';
import { SITE } from '../config.js';
import { A } from '../i18n/admin.it.js';
import { detectRepo } from '../services/AdminSession.js';
import { loginView } from '../views/AdminViews.js';

const MIN_PASSWORD = 10;

// Accesso all'area riservata. Un dispositivo nuovo si collega al repository (token + una password a scelta);
// da lì in poi basta la password, che apre il token cifrato salvato sul dispositivo.
export class LoginController extends PrivateController {
  titleKey = 'title.login';
  #deps;
  #outlet = null;
  #form = null;

  constructor(deps) {
    super();
    this.#deps = deps;
  }

  async mount({ outlet }) {
    await super.mount();
    const { session, navigate } = this.#deps;
    if (session.unlocked) {
      navigate('/admin', { replace: true });
      return;
    }
    this.#outlet = outlet;
    this.#draw();
  }

  #draw() {
    const { session } = this.#deps;
    renderInto(this.#outlet, loginView({
      mode: session.hasVault ? 'unlock' : 'setup',
      repoGuess: SITE.github.repo || detectRepo(window.location.hostname),
    }));
    this.#form = this.#outlet.querySelector('[data-login-form]');
    this.#outlet.addEventListener('submit', this.#onSubmit);
    this.#outlet.addEventListener('change', this.#onChange);
    this.#outlet.addEventListener('click', this.#onClick);
    const flash = takeFlash();
    if (flash) this.#say(flash.message, 'error');
  }

  #say(message, kind = 'info') {
    const status = this.#form.querySelector('[data-form-status]');
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    status.textContent = message;
  }

  #onChange = (event) => {
    if (!event.target.matches('[data-reveal]')) return;
    this.#form.querySelectorAll('input[name="token"], input[name="passphrase"], input[name="repeat"]').forEach((input) => {
      input.type = event.target.checked ? 'text' : 'password';
    });
  };

  #onClick = (event) => {
    const forget = event.target.closest('[data-forget]');
    if (!forget) return;
    const note = this.#outlet.querySelector('[data-forget-note]');
    if (note.hidden) {
      note.hidden = false;
      forget.textContent = A.login.forgetConfirm;
      return;
    }
    this.#deps.session.forget();
    this.#detach();
    this.#draw();
  };

  #onSubmit = async (event) => {
    event.preventDefault();
    const { session, navigate } = this.#deps;
    const form = this.#form;
    const setup = form.dataset.mode === 'setup';
    const get = (name) => String(form.elements[name]?.value ?? '');
    const submit = form.querySelector('[data-submit]');

    if (setup) {
      if (!get('repo').trim() || !get('token').trim() || !get('passphrase')) return this.#say(A.login.missing, 'error');
      if (get('passphrase').length < MIN_PASSWORD) return this.#say(A.login.errors.weak, 'error');
      if (get('passphrase') !== get('repeat')) return this.#say(A.login.errors.mismatch, 'error');
    } else if (!get('passphrase')) {
      return this.#say(A.login.missing, 'error');
    }

    submit.disabled = true;
    this.#say(A.login.working);
    try {
      if (setup) await session.setup({ repo: get('repo'), token: get('token'), passphrase: get('passphrase') });
      else await session.unlock(get('passphrase'));
      navigate('/admin');
    } catch (error) {
      submit.disabled = false;
      this.#say(A.login.errors[error.code] ?? A.login.errors.unknown, 'error');
      form.elements.passphrase.value = '';
      if (!setup) form.elements.passphrase.focus();
    }
  };

  #detach() {
    this.#outlet?.removeEventListener('submit', this.#onSubmit);
    this.#outlet?.removeEventListener('change', this.#onChange);
    this.#outlet?.removeEventListener('click', this.#onClick);
  }

  unmount() {
    this.#detach();
    super.unmount();
  }
}
