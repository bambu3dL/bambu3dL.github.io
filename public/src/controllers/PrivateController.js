import { PageController } from './PageController.js';

// Pagine riservate: dicono ai motori di ricerca di non indicizzarle (il meta tag lo scrive PageMeta).
export class PrivateController extends PageController {
  descriptionKey = 'meta.admin';
  noindex = true;
}
