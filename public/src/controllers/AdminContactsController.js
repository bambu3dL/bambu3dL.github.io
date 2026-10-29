import { AdminPage, setFlash } from './AdminPage.js';
import { formValues } from '../core/forms.js';
import { html } from '../core/html.js';
import { ContactsError } from '../gateways/ContactsGateway.js';
import { A } from '../i18n/admin.it.js';
import { AdminError } from '../services/AdminSession.js';
import { ContactsAdmin } from '../services/ContactsAdmin.js';
import { contactDetailView, contactsListView, contactsSetupView } from '../views/AdminContactsViews.js';

// Le richieste dei clienti. I dati personali passano da qui solo in memoria: arrivano da Apps Script con la chiave,
// non vengono salvati da nessuna parte e non toccano mai il repository pubblico.
export class AdminContactsController extends AdminPage {
  titleKey = 'title.adminContacts';
  section = 'contacts';
  #filter = 'all';
  #contacts = [];

  async show({ params }) {
    if (!this.deps.contacts.available) {
      this.draw(contactsSetupView({ hasEndpoint: false }));
      return;
    }
    if (!this.deps.session.adminKey) {
      this.draw(contactsSetupView({ hasEndpoint: true }));
      return;
    }
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    try {
      this.#contacts = await this.contacts.list();
    } catch (error) {
      if (error instanceof ContactsError && error.code === 'key') {
        this.draw(contactsSetupView({ hasEndpoint: true, error: A.contacts.errors.key }));
        return;
      }
      throw error;
    }
    if (!params.ref) {
      this.#drawList();
      return;
    }
    const contact = this.#contacts.find((item) => item.reference === params.ref);
    if (!contact) {
      setFlash(A.contacts.errors.notFound, 'error');
      this.navigate('/admin/contacts');
      return;
    }
    this.draw(contactDetailView({ contact }));
  }

  #drawList() {
    this.draw(contactsListView({ contacts: this.#contacts, counts: ContactsAdmin.counts(this.#contacts), filter: this.#filter }));
  }

  onChange(event) {
    if (!event.target.matches('[data-contact-filter]')) return;
    this.#filter = event.target.value;
    this.#drawList();
    this.outlet.querySelector('[data-contact-filter]')?.focus();
  }

  async onClick(event) {
    if (event.target.closest('[data-contacts-reload]')) {
      await this.show(this.context);
      return;
    }
    const remove = event.target.closest('[data-delete]');
    if (remove && this.confirmed(remove)) {
      await this.contacts.remove(remove.closest('form').dataset.reference);
      setFlash(A.contacts.detail.deleted);
      this.navigate('/admin/contacts');
    }
  }

  async onSubmit(event) {
    const form = event.target;
    if (form.matches('[data-key-form]')) await this.#saveKey(form);
    else if (form.matches('[data-contact-form]')) await this.#saveContact(form);
  }

  async #saveKey(form) {
    const { adminKey, passphrase } = formValues(form);
    if (!adminKey.trim() || !passphrase) {
      this.flash(A.contacts.setup.missing, 'error');
      return;
    }
    let wrongPassword = false;
    const saved = await this.run(form, async () => {
      try {
        await this.deps.session.saveAdminKey(adminKey, passphrase);
      } catch (error) {
        if (!(error instanceof AdminError && error.code === 'password')) throw error;
        wrongPassword = true;
      }
    });
    if (wrongPassword) {
      this.flash(A.contacts.setup.wrongPassword, 'error');
      return;
    }
    if (saved) await this.show(this.context);
  }

  async #saveContact(form) {
    const values = formValues(form);
    const saved = await this.run(form, () => this.contacts.update(form.dataset.reference, { status: values.status, note: values.note }));
    if (saved) {
      setFlash(A.contacts.detail.saved);
      this.navigate('/admin/contacts');
    }
  }
}
