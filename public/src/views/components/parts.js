import { html } from '../../core/html.js';

/** Barra del filamento: quanto resta e, in tratteggio, quanto ne prenderebbe l'oggetto. */
export function stockGauge({ remaining, after }) {
  const pct = (value) => `${Math.round(value * 100)}%`;
  return html`<span class="gauge" data-fill="${pct(remaining)}" data-fill-after="${pct(after)}" aria-hidden="true"><span class="gauge-used"></span></span>`;
}

/**
 * Anteprima di una stampa, completa. Al passaggio del mouse si ricostruisce a time lapse (TimelapseService):
 * i dati per farlo viaggiano negli attributi data-*.
 */
export function workThumb({ work, material, image, lang }) {
  return html`<span class="thumb" data-timelapse data-shape="${JSON.stringify(work.shape)}" data-hex="${material.hex}">
    <span class="thumb-plate" aria-hidden="true"></span>
    ${image
      ? html`<img src="${image}" width="720" height="720" alt="${work.title(lang)}">`
      : html`<span class="thumb-fallback" aria-hidden="true"></span>`}
    <span class="thumb-live" aria-hidden="true"></span>
  </span>`;
}

export function swatch(material) {
  return html`<span class="swatch" data-hex="${material.hex}" aria-hidden="true"></span>`;
}

/** Le pastiglie di tutti i colori di un oggetto, una accanto all'altra. */
export function colorStrip(colors) {
  return html`<span class="swatches">${colors.map(({ material }) => swatch(material))}</span>`;
}

/** Il nome del filo, o "3 colori" se l'oggetto ne ha più di uno. */
export function colorName({ colors, lang, t }) {
  return colors.length > 1 ? t('work.multiColor', { n: colors.length }) : colors[0].material.label(lang);
}

/** Campione stampato di un materiale: tre gradini di spessore, con nome e grammi. */
export function materialTile({ material, image, lang, i18n, caption = '', estimate = null }) {
  const after = estimate ? Math.max(0, material.remainingFraction - estimate.shareOfSpool) : material.remainingFraction;
  return html`<figure class="material" id="${material.id}" data-hex="${material.hex}">
    <span class="material-art">
      ${image ? html`<img src="${image}" width="720" height="720" alt="">` : html`<span class="thumb-fallback" aria-hidden="true"></span>`}
    </span>
    <figcaption>
      <b>${material.name(lang)}</b>
      <span>${material.family} · ${i18n.grams(material.stockG)}</span>
      ${stockGauge({ remaining: material.remainingFraction, after })}
      ${caption}
    </figcaption>
  </figure>`;
}

/** Riga di confronto: stima per l'oggetto contro il residuo, a parole e a barra. */
export function estimateSummary({ t, i18n, estimate, material }) {
  return html`<span class="estimate">
    <span class="estimate-figures">
      <span><b>${i18n.grams(estimate.needG)}</b> ${t('common.estimated')}</span>
      <span><b>${i18n.grams(estimate.stockG)}</b> ${t('common.inStock')}</span>
    </span>
    ${stockGauge({ remaining: material.remainingFraction, after: Math.max(0, material.remainingFraction - estimate.shareOfSpool) })}
    <span class="estimate-verdict ${estimate.enough ? 'is-ok' : 'is-low'}">${estimate.enough ? t('common.enough') : t('common.toOrder')}</span>
  </span>`;
}

/** Versione corta della stima per la vetrina: una riga e la barra. Il dettaglio sta nella scheda dell'oggetto. */
export function estimateCompact({ t, i18n, estimate, material }) {
  return html`<span class="estimate estimate-compact">
    <span class="estimate-figures">
      <span><b>${i18n.grams(estimate.needG)}</b> ${t('common.estimated')}</span>
      <span class="estimate-verdict ${estimate.enough ? 'is-ok' : 'is-low'}">${estimate.enough ? t('common.enough') : t('common.toOrder')}</span>
    </span>
    ${stockGauge({ remaining: material.remainingFraction, after: Math.max(0, material.remainingFraction - estimate.shareOfSpool) })}
  </span>`;
}
