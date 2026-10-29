// Una realizzazione in vetrina. `shape` descrive la geometria di esempio finché non ci sono modelli reali.
export class Work {
  constructor({ id, date, shape, materialId, estimatedG, dimensionsMm, title, summary, photo = '', visible = true }) {
    this.id = id;
    this.date = new Date(date);
    this.shape = shape;
    this.materialId = materialId;
    this.estimatedG = Math.max(0, Number(estimatedG) || 0);
    this.dimensionsMm = dimensionsMm || [];
    this.titles = title;
    this.summaries = summary;
    this.photo = typeof photo === 'string' && photo.startsWith('assets/uploads/') ? `/${photo}` : '';
    this.visible = visible !== false;
  }

  title(lang) {
    return this.titles[lang] || this.titles.it;
  }

  summary(lang) {
    return this.summaries[lang] || this.summaries.it;
  }
}
