// Confronto tra il materiale stimato per un oggetto e il residuo della bobina.
export class StockEstimator {
  /** @returns {{needG:number, stockG:number, afterG:number, enough:boolean, shareOfSpool:number, shareOfStock:number}} */
  estimate(work, material) {
    const needG = work.estimatedG;
    const stockG = material.stockG;
    return {
      needG,
      stockG,
      afterG: Math.max(0, stockG - needG),
      enough: stockG >= needG,
      shareOfSpool: Math.min(1, needG / material.spoolG),
      shareOfStock: stockG > 0 ? Math.min(1, needG / stockG) : 1,
    };
  }
}
