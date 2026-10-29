import { AdminPage } from './AdminPage.js';
import { html } from '../core/html.js';
import { ContactsError } from '../gateways/ContactsGateway.js';
import { A } from '../i18n/admin.it.js';
import { filesSetupView, filesView } from '../views/AdminFilesViews.js';

const REFERENCE = /^Q-[A-Z2-9]{5}$/;

// I file su Drive: la Libreria (caricati da noi) e quelli di ogni richiesta. I file dei clienti arrivano solo dal modulo
// del sito; qui si vedono, se ne aggiungono e si mettono nel cestino. Passano da Apps Script con la chiave dei contatti.
export class AdminFilesController extends AdminPage {
  titleKey = 'title.adminFiles';
  section = 'files';
  #reference = '';

  async show({ url }) {
    if (!this.deps.contacts.available) {
      this.draw(filesSetupView({ hasEndpoint: false }));
      return;
    }
    if (!this.deps.session.adminKey) {
      this.draw(filesSetupView({ hasEndpoint: true }));
      return;
    }
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const wanted = url?.searchParams.get('ref') ?? '';
    this.#reference = REFERENCE.test(wanted) ? wanted : '';
    let contacts;
    let listing;
    try {
      contacts = await this.contacts.list();
      try {
        listing = await this.files.list(this.#reference);
      } catch (error) {
        // Richiesta sparita o senza cartella: si ripiega sulla Libreria invece di lasciare una pagina vuota.
        if (!(error instanceof ContactsError && error.code === 'notFound' && this.#reference)) throw error;
        this.#reference = '';
        listing = await this.files.list('');
        this.flash(A.contacts.errors.notFound, 'error');
      }
    } catch (error) {
      if (error instanceof ContactsError && error.code === 'key') {
        this.draw(filesSetupView({ hasEndpoint: true, error: A.contacts.errors.key }));
        return;
      }
      throw error;
    }
    const options = contacts.filter((contact) => contact.driveUrl).map((contact) => ({ reference: contact.reference, name: contact.name }));
    this.draw(filesView({ options, reference: this.#reference, listing }));
  }

  onChange(event) {
    if (!event.target.matches('[data-files-target]')) return;
    const reference = event.target.value;
    this.navigate(reference ? `/admin/files?ref=${encodeURIComponent(reference)}` : '/admin/files');
  }

  async onClick(event) {
    const trash = event.target.closest('[data-file-trash]');
    if (trash && this.confirmed(trash, A.files.list.trashConfirm)) {
      await this.files.trash(trash.dataset.fileTrash);
      await this.show(this.context);
      this.flash(A.files.list.trashed);
    }
  }

  async onSubmit(event) {
    const form = event.target;
    if (!form.matches('[data-upload-form]')) return;
    const input = form.elements.files;
    const status = form.querySelector('[data-upload-status]');
    let saved = [];
    status.textContent = A.files.upload.working;
    const ok = await this.run(form, async () => { saved = await this.files.upload({ reference: this.#reference, files: input.files }); });
    status.textContent = '';
    if (!ok) return;
    await this.show(this.context);
    this.flash(A.files.upload.done.replace('{n}', saved.length));
  }
}
