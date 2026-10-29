import { PageController } from './PageController.js';
import { renderInto } from '../core/dom.js';

// Pagine che sono solo testo: una vista e un titolo, nessun comportamento.
export class StaticController extends PageController {
  #i18n;
  #view;

  constructor({ i18n, view, titleKey, descriptionKey, noindex = false }) {
    super();
    this.#i18n = i18n;
    this.#view = view;
    this.titleKey = titleKey;
    this.descriptionKey = descriptionKey;
    this.noindex = noindex;
  }

  async mount({ outlet }) {
    renderInto(outlet, this.#view({ t: this.#i18n.t.bind(this.#i18n), lang: this.#i18n.lang, i18n: this.#i18n }));
  }
}
