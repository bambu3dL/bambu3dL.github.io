// Contratto delle pagine: mount({ outlet, params, url }) / unmount() / titleKey.
// Un controller prende i dati dai repository, li passa alla vista e collega i comportamenti.
//
// Per i motori di ricerca e le anteprime ogni pagina dice anche (vedi PageMeta):
//  - descriptionKey: la chiave della descrizione in `meta.*`;
//  - heading / summary: titolo e descrizione già pronti, per le pagine con contenuto proprio (una realizzazione);
//    se presenti vincono sulle chiavi;
//  - noindex: da non indicizzare (area riservata, pagina non trovata).
export class PageController {
  titleKey = 'title.home';
  descriptionKey = 'meta.home';
  heading = null;
  summary = null;
  noindex = false;

  /** @param {{outlet: HTMLElement, params: object, url: URL}} context */
  async mount() {}

  unmount() {}
}
