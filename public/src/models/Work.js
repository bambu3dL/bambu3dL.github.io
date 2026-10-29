// Un modello vero si legge solo dalla cartella dei modelli del sito: il percorso arriva dai dati, non lo si segue alla cieca.
const MODEL_PATH = /^assets\/models\/[\w.-]+\.s3dm$/;
function safeShape(shape) {
  if (shape?.kind !== 'model') return shape;
  return MODEL_PATH.test(String(shape.url)) ? { kind: 'model', url: `/${shape.url}` } : { kind: 'chip' };
}

// I colori di un oggetto (fino a quattro, il primo è il principale): [{ materialId, grams }]. I vecchi record hanno un filo solo.
function normalizeColors(colors, materialId, estimatedG) {
  const valid = Array.isArray(colors)
    ? colors.filter((color) => color && typeof color.materialId === 'string' && color.materialId).slice(0, 4)
        .map((color) => ({ materialId: color.materialId, grams: Math.max(0, Number(color.grams) || 0) }))
    : [];
  return valid.length ? valid : [{ materialId, grams: Math.max(0, Number(estimatedG) || 0) }];
}

// Una realizzazione in vetrina. `shape` è una forma di esempio oppure { kind: 'model', url } per un modello vero (STL/3MF ridotto).
export class Work {
  constructor({ id, date, shape, materialId, estimatedG, colors, dimensionsMm, title, summary, photo = '', visible = true }) {
    this.id = id;
    this.date = new Date(date);
    this.shape = safeShape(shape);
    this.colors = normalizeColors(colors, materialId, estimatedG);
    this.materialId = this.colors[0].materialId; // il colore principale: quello del 3D e delle miniature
    this.estimatedG = this.colors.reduce((sum, color) => sum + color.grams, 0);
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
