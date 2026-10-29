// Contratto delle pagine: mount({ outlet, params, url }) / unmount() / titleKey.
// Un controller prende i dati dai repository, li passa alla vista e collega i comportamenti.
export class PageController {
  titleKey = 'title.home';

  /** @param {{outlet: HTMLElement, params: object, url: URL}} context */
  async mount() {}

  unmount() {}
}
