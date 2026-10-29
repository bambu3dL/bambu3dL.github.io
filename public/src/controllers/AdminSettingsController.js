import { AdminPage } from './AdminPage.js';
import { formValues } from '../core/forms.js';
import { html } from '../core/html.js';
import { SITE } from '../config.js';
import { A } from '../i18n/admin.it.js';
import { settingsView } from '../views/AdminViews.js';

export class AdminSettingsController extends AdminPage {
  titleKey = 'title.adminSettings';
  section = 'settings';

  async show() {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const saved = await this.catalog.settings();
    // Il modulo parte da ciò che il sito mostra adesso, anche se il file delle impostazioni non esiste ancora.
    this.draw(settingsView({
      settings: { name: saved.name ?? SITE.name, contactEmail: saved.contactEmail ?? SITE.contactEmail },
      repo: this.deps.session.gateway.repo,
    }));
  }

  async onSubmit(event) {
    const form = event.target;
    if (!form.matches('[data-settings-form]')) return;
    const saved = await this.run(form, () => this.catalog.saveSettings(formValues(form)));
    if (saved) this.flash(A.settings.saved);
  }
}
