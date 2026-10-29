import { AdminPage } from './AdminPage.js';
import { html } from '../core/html.js';
import { materialLabel } from '../views/AdminCatalogViews.js';
import { A } from '../i18n/admin.it.js';
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
    const [{ materials }, works, run] = await Promise.all([this.catalog.materials(), this.catalog.works(), this.catalog.publishStatus()]);
    const low = materials
      .map((item) => ({ ...item, fraction: Math.min(1, item.stockG / Math.max(1, item.spoolG)), label: materialLabel(item) }))
      .filter((item) => item.fraction < LOW_SHARE)
      .sort((a, b) => a.fraction - b.fraction);
    this.draw(overviewView({
      repo: this.deps.session.gateway.repo,
      publish: publishState(run),
      publishAt: run ? new Date(run.at).toLocaleString('it', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '',
      counts: {
        materials: materials.length,
        stockG: materials.reduce((sum, item) => sum + item.stockG, 0),
        works: works.length,
        hidden: works.filter((work) => work.visible === false).length,
      },
      low,
    }));
  }
}
