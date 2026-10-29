import { html } from '../core/html.js';
import { icon } from './components/icons.js';
import { estimateSummary, swatch, workThumb } from './components/parts.js';

export function galleryView({ t, lang, i18n, rows, families, activeFamily }) {
  const filters = ['all', ...families];
  return html`
    <section class="page-head">
      <h1>${t('gallery.title')}</h1>
      <p class="lead">${t('gallery.lead')}</p>
      <div class="filters" role="group" aria-label="${t('gallery.filter')}">
        ${filters.map((family) => html`<button type="button" class="chip" data-filter="${family}" aria-pressed="${family === activeFamily}">${family === 'all' ? t('gallery.all') : family}</button>`)}
      </div>
    </section>
    <section class="section gallery-section" aria-live="polite">
      ${rows.length === 0 ? html`<p class="empty">${t('gallery.empty')}</p>` : ''}
      <ul class="shelf-grid">
        ${rows.map(({ work, material, image }) => html`<li class="shelf-item" data-timelapse-host data-hex="${material.hex}">
          <a class="shelf-link" href="/gallery/${work.id}">
            ${workThumb({ work, material, image, lang })}
            <span class="shelf-meta">
              <span class="shelf-title">${work.title(lang)}</span>
              <span class="shelf-material">${swatch(material)}${material.label(lang)}</span>
            </span>
          </a>
        </li>`)}
      </ul>
    </section>`;
}

export function workView({ t, lang, i18n, work, material, estimate, image, alternatives, webgl }) {
  const [w, d, h] = work.dimensionsMm;
  return html`
    <article class="work" data-hex="${material.hex}">
      <a class="back-link" href="/gallery">${icon('arrow', { size: 18 })}${t('work.back')}</a>
      <div class="work-grid">
        <div class="work-stage">
          <div class="work-frame">
            <div class="viewer" data-viewer tabindex="0" role="img" aria-label="${t('work.viewerLabel', { title: work.title(lang) })}">
              ${webgl ? '' : (image ? html`<img src="${image}" alt="">` : html`<span class="thumb-fallback" aria-hidden="true"></span>`)}
            </div>
          </div>
          <p class="viewer-hint">${webgl ? t('work.viewerHint') : t('work.noWebgl')}</p>
          ${work.photo ? html`<figure class="work-photo"><img src="${work.photo}" alt="${t('work.photoAlt', { title: work.title(lang) })}" loading="lazy"><figcaption>${t('work.photoCaption')}</figcaption></figure>` : ''}
        </div>
        <div class="work-info">
          <h1>${work.title(lang)}</h1>
          <p class="lead">${work.summary(lang)}</p>
          <dl class="spec">
            <div><dt>${t('work.material')}</dt><dd>${swatch(material)}${material.label(lang)}</dd></div>
            ${work.dimensionsMm.length === 3 ? html`<div><dt>${t('work.size')}</dt><dd>${w} × ${d} × ${h} mm</dd></div>` : ''}
            <div><dt>${t('work.weight')}</dt><dd>${i18n.grams(work.estimatedG)} ${t('common.estimated')}</dd></div>
          </dl>
          <div class="work-stock">
            <h2>${t('work.stockTitle')}</h2>
            ${estimateSummary({ t, i18n, estimate, material })}
            <p class="muted">${t('work.stockNote')}</p>
          </div>
          <div class="work-actions">
            <a class="btn btn-primary btn-large" href="/contact?work=${work.id}">${t('work.cta')}${icon('arrow')}</a>
          </div>
        </div>
      </div>
      <section class="section" aria-labelledby="alt-title">
        <h2 id="alt-title">${t('work.alternatives')}</h2>
        <ul class="alt-list">
          ${alternatives.map(({ material: other, estimate: est }) => html`<li>
            ${swatch(other)}
            <span class="alt-name">${other.label(lang)}</span>
            <span class="alt-stock">${i18n.grams(est.stockG)}</span>
            <span class="estimate-verdict ${est.enough ? 'is-ok' : 'is-low'}">${est.enough ? t('common.enough') : t('common.toOrder')}</span>
          </li>`)}
        </ul>
      </section>
    </article>`;
}
