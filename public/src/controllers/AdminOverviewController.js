import { AdminPage } from './AdminPage.js';
import { html } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { ContactsAdmin } from '../services/ContactsAdmin.js';
import { filamentStats, materialLabel } from '../views/AdminCatalogViews.js';
import { overviewView } from '../views/AdminViews.js';

const LOW_SHARE = 0.2;

function publishState(run) {
  if (!run) return 'unknown';
  if (run.status !== 'completed') return 'running';
  return run.conclusion === 'success' ? 'ok' : 'failed';
}

export class AdminOverviewController extends AdminPage {
  titleKey = 'title.admin';
  section = 'overview';

  async show() {
    this.draw(html`<section class="section admin-section"><p class="muted">${A.common.loading}</p></section>`);
    const [{ materials, spools }, works, run, contacts] = await Promise.all([
      this.catalog.materials(),
      this.catalog.works(),
      this.catalog.publishStatus(),
      this.#contactsSummary(),
    ]);
    const stats = materials.map((material) => ({ material, ...filamentStats(material, spools) }));
    const low = stats
      .filter((item) => item.fraction < LOW_SHARE)
      .map((item) => ({ ...item.material, ...item, label: materialLabel(item.material) }))
      .sort((a, b) => a.fraction - b.fraction);
    this.draw(overviewView({
      repo: this.deps.session.gateway.repo,
      publish: publishState(run),
      publishAt: run ? new Date(run.at).toLocaleString('it', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '',
      counts: {
        materials: materials.length,
        spools: stats.reduce((sum, item) => sum + item.active, 0),
        stockG: stats.reduce((sum, item) => sum + item.stockG, 0),
        works: works.length,
        hidden: works.filter((work) => work.visible === false).length,
      },
      low,
      contacts,
    }));
  }

  /** Solo i numeri: i dati dei clienti non servono qui. Se i contatti non rispondono, la panoramica resta in piedi. */
  async #contactsSummary() {
    if (!this.deps.contacts.available || !this.deps.session.adminKey) return { state: 'notLinked' };
    try {
      const counts = ContactsAdmin.counts(await this.contacts.list());
      return { state: 'ok', news: counts.received, open: counts.open };
    } catch {
      return { state: 'notLinked' };
    }
  }
}
