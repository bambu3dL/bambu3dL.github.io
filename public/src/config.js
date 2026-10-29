// Impostazioni del sito in un unico posto. I valori marcati "segnaposto" vanno decisi da Lorenzo.
// `name` e `contactEmail` si cambiano dall'area riservata (Impostazioni): finiscono in assets/data/site.json
// e, all'avvio, applySiteSettings li sovrascrive a questi valori di base.
export const SITE = {
  name: 'Stampe3D', // segnaposto: il nome dell'attività è ancora da trovare
  owner: 'Lorenzo & Lorenzo',
  contactEmail: '', // se vuoto, il sito non mostra nessun indirizzo
  persistDays: 180,
  // Scelte della home dall'area riservata: l'oggetto che si stampa scorrendo e quelli in evidenza (null = i primi quattro).
  home: { hero: '', featured: null },
  data: {
    works: '/assets/data/works.json',
    materials: '/assets/data/materials.json',
    spools: '/assets/data/spools.json',
    site: '/assets/data/site.json',
  },
  // Dove vive il sito. Il repository si ricava da "nome.github.io"; con un dominio proprio va scritto qui
  // ("proprietario/nome-repository") oppure nel modulo di accesso. `root` è la cartella pubblicata.
  github: {
    repo: '',
    root: 'public',
  },
  // Modulo di contatto: URL dell'app web di Apps Script (finisce con /exec). Vuoto = invio simulato.
  // È un indirizzo pubblico per natura, non un segreto.
  backend: {
    quoteEndpoint: 'https://script.google.com/macros/s/AKfycbxc_T7qkZ8C3Sywf6fBIfNPGLTNd8z0ceTt7FB1nzFt3OrIvKgiIVXy1k8tJAkPzoU4vA/exec',
  },
};

/** Applica le impostazioni scritte dall'area riservata. Accetta solo i campi previsti, con il tipo giusto. */
export function applySiteSettings(settings) {
  if (typeof settings?.name === 'string' && settings.name.trim()) SITE.name = settings.name.trim().slice(0, 40);
  if (typeof settings?.contactEmail === 'string') SITE.contactEmail = settings.contactEmail.trim().slice(0, 120);
  if (settings?.home && typeof settings.home === 'object') {
    SITE.home = {
      hero: typeof settings.home.hero === 'string' ? settings.home.hero : '',
      featured: Array.isArray(settings.home.featured) ? settings.home.featured.filter((id) => typeof id === 'string').slice(0, 4) : null,
    };
  }
}

export const NAV = Object.freeze([
  { path: '/', key: 'home' },
  { path: '/gallery', key: 'gallery' },
  { path: '/materials', key: 'materials' },
  { path: '/how-it-works', key: 'how' },
  { path: '/about', key: 'about' },
]);
