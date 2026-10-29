// Composition root: l'unico file che conosce le implementazioni concrete e le collega.
// Tutto il resto dipende da contratti (repository, gateway) e riceve ciò che gli serve dall'esterno.
import { SITE, applySiteSettings } from './config.js';
import { Router } from './core/Router.js';
import { PreferenceStore } from './core/PreferenceStore.js';
import { announce } from './core/dom.js';
import { I18nService } from './i18n/I18nService.js';
import it from './i18n/it.js';
import en from './i18n/en.js';
import { JsonWorksRepository } from './repositories/WorksRepository.js';
import { JsonMaterialsRepository } from './repositories/MaterialsRepository.js';
import { SimulatedQuoteGateway } from './gateways/SimulatedQuoteGateway.js';
import { AppsScriptQuoteGateway } from './gateways/AppsScriptQuoteGateway.js';
import { GitHubContentGateway } from './gateways/GitHubContentGateway.js';
import { AppsScriptContactsGateway } from './gateways/AppsScriptContactsGateway.js';
import { ContactsAdmin } from './services/ContactsAdmin.js';
import { AdminSession } from './services/AdminSession.js';
import { TokenVault } from './services/TokenVault.js';
import { QuoteService } from './services/QuoteService.js';
import { StockEstimator } from './services/StockEstimator.js';
import { ThemeService } from './services/ThemeService.js';
import { SnapshotService } from './three/SnapshotService.js';
import { TimelapseService } from './three/TimelapseService.js';
import { ShellController } from './controllers/ShellController.js';
import { HomeController } from './controllers/HomeController.js';
import { GalleryController } from './controllers/GalleryController.js';
import { WorkController } from './controllers/WorkController.js';
import { MaterialsController } from './controllers/MaterialsController.js';
import { QuoteController } from './controllers/QuoteController.js';
import { StaticController } from './controllers/StaticController.js';
import { LazyController } from './controllers/LazyController.js';
import { howView } from './views/HowView.js';
import { aboutView, notFoundView, privacyView } from './views/TextPagesView.js';

// Nome e contatti scelti dall'area riservata. Se il file manca o non si legge, restano i valori di base.
try {
  const response = await fetch(SITE.data.site, { cache: 'no-cache' });
  if (response.ok) applySiteSettings(await response.json());
} catch { /* il sito parte comunque */ }

const store = new PreferenceStore({ persistDays: SITE.persistDays });
const i18n = new I18nService(store, { it, en });
const theme = new ThemeService(store);
const router = new Router();

const deps = {
  i18n,
  store,
  theme,
  works: new JsonWorksRepository(SITE.data.works),
  materials: new JsonMaterialsRepository(SITE.data.materials, SITE.data.spools),
  estimator: new StockEstimator(),
  snapshots: new SnapshotService(),
  timelapse: new TimelapseService({ reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches }),
  // Con l'indirizzo di Apps Script configurato i messaggi partono davvero; altrimenti restano simulati.
  quotes: new QuoteService(
    SITE.backend.quoteEndpoint
      ? new AppsScriptQuoteGateway({ endpoint: SITE.backend.quoteEndpoint })
      : new SimulatedQuoteGateway(),
  ),
  session: new AdminSession({
    vault: new TokenVault(),
    createGateway: ({ repo, token }) => new GitHubContentGateway({ repo, token, root: SITE.github.root }),
  }),
  // Le richieste dei clienti: stanno dietro Apps Script, aperte con la chiave di questo dispositivo.
  contacts: {
    available: Boolean(SITE.backend.quoteEndpoint),
    open: (key) => new ContactsAdmin(new AppsScriptContactsGateway({ endpoint: SITE.backend.quoteEndpoint, key })),
  },
  navigate: (path, options) => router.navigate(path, options),
};

// Le pagine dell'area riservata si scaricano solo quando si aprono (vedi LazyController).
const restricted = (name) => () => new LazyController(async () => {
  const module = await import(`./controllers/${name}.js`);
  return () => new module[name](deps);
});

router
  .add('/', () => new HomeController(deps))
  .add('/gallery', () => new GalleryController(deps))
  .add('/gallery/:id', () => new WorkController(deps))
  .add('/materials', () => new MaterialsController(deps))
  .add('/how-it-works', () => new StaticController({ i18n, view: howView, titleKey: 'title.how' }))
  .add('/contact', () => new QuoteController(deps))
  .add('/quote', () => new QuoteController(deps)) // indirizzo di prima, ancora valido
  .add('/about', () => new StaticController({ i18n, view: aboutView, titleKey: 'title.about' }))
  .add('/privacy', () => new StaticController({ i18n, view: privacyView, titleKey: 'title.privacy' }))
  .add('/admin/login', restricted('LoginController'))
  .add('/admin', restricted('AdminOverviewController'))
  .add('/admin/contacts', restricted('AdminContactsController'))
  .add('/admin/contacts/:ref', restricted('AdminContactsController'))
  .add('/admin/materials', restricted('AdminMaterialsController'))
  .add('/admin/materials/:id', restricted('AdminMaterialsController'))
  .add('/admin/works', restricted('AdminWorksController'))
  .add('/admin/works/:id', restricted('AdminWorksController'))
  .add('/admin/stock', restricted('AdminStockController'))
  .add('/admin/settings', restricted('AdminSettingsController'))
  .setNotFound(() => new StaticController({ i18n, view: notFoundView, titleKey: 'title.notFound' }));

deps.timelapse.attach();

const shell = new ShellController({ i18n, store, theme });
const outlet = document.getElementById('main');
let current = null;
let navigation = 0;

router.onChange(async ({ factory, params, url, scroll }) => {
  const ticket = (navigation += 1);
  current?.unmount();
  current = factory();
  shell.update(url.pathname.replace(/\/+$/, '') || '/');
  outlet.setAttribute('aria-busy', 'true');
  try {
    await current.mount({ outlet, params, url });
  } catch (error) {
    console.error(error);
    outlet.textContent = i18n.t('common.loadError');
  }
  if (ticket !== navigation) return;
  outlet.removeAttribute('aria-busy');
  document.title = `${i18n.t(current.titleKey)} · ${SITE.name}`;
  if (scroll) {
    window.scrollTo(0, 0);
    outlet.focus({ preventScroll: true });
    announce(document.title);
  }
});

// Cambio lingua: ridisegna la pagina corrente (i testi stanno nelle viste, non nel DOM).
i18n.onChange(() => router.refresh());

router.start();
