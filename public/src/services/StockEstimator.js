// Confronto tra il materiale stimato per un oggetto e il residuo della bobina.
export class StockEstimator {
  /** @returns {{needG:number, stockG:number, afterG:number, enough:boolean, shareOfSpool:number, shareOfStock:number}} */
  estimate(work, material) {
    return this.estimateGrams(work.estimatedG, material);
  }

  /**
   * L'oggetto colore per colore. `colors` ha un elemento per colore con il suo filo e la sua stima; `estimate` e `material`
   * sono quelli da mostrare in una riga sola: i grammi totali e il filo che scarseggia di più (se tutti bastano, quello più usato).
   * @param {Map<string, object>} materialsById
   */
  summary(work, materialsById) {
    const colors = work.colors
      .map(({ materialId, grams }) => ({ material: materialsById.get(materialId), grams }))
      .filter((color) => color.material)
      .map((color) => ({ ...color, estimate: this.estimateGrams(color.grams, color.material) }));
    if (colors.length === 0) return null;
    const limiting = colors.find((color) => !color.estimate.enough)
      ?? colors.reduce((best, color) => (color.estimate.shareOfStock > best.estimate.shareOfStock ? color : best));
    return {
      colors,
      material: limiting.material,
      estimate: { ...limiting.estimate, needG: work.estimatedG, enough: colors.every((color) => color.estimate.enough) },
    };
  }

  estimateGrams(needG, material) {
    const stockG = material.stockG;
    return {
      needG,
      stockG,
      afterG: Math.max(0, stockG - needG),
      enough: stockG >= needG,
      shareOfSpool: Math.min(1, needG / material.capacityG),
      shareOfStock: stockG > 0 ? Math.min(1, needG / stockG) : 1,
    };
  }
}
