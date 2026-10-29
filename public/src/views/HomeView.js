import { html } from '../core/html.js';
import { icon } from './components/icons.js';
import { colorName, colorStrip, estimateCompact, materialTile, workThumb } from './components/parts.js';

const LAYER_MM = 0.2;

function titleWords(text) {
  return text.split(' ').map((word, index) => html`${index ? ' ' : ''}<span class="w"><span class="wi">${word}</span></span>`);
}

function showcaseItem({ row, t, lang, i18n }) {
  const { work, material, colors, estimateMaterial, estimate, image } = row;
  return html`<li class="showcase-item" data-reveal data-timelapse-host data-hex="${material.hex}">
    <a class="showcase-thumb" href="/gallery/${work.id}" tabindex="-1" aria-hidden="true">${workThumb({ work, material, image, lang })}</a>
    <div class="showcase-body">
      <div class="showcase-head">
        <h3><a href="/gallery/${work.id}">${work.title(lang)}</a></h3>
      </div>
      <p>${work.summary(lang)}</p>
      <p class="showcase-material">${colorStrip(colors)}<span>${colorName({ colors, lang, t })}</span></p>
      ${estimateCompact({ t, i18n, estimate, material: estimateMaterial })}
      <a class="btn btn-ghost btn-small" href="/contact?work=${work.id}">${t('home.shelf.cta')}</a>
    </div>
  </li>`;
}

export function homeView({ t, lang, i18n, hero, ledger, materials }) {
  const steps = i18n.list('how.steps');
  // Senza opere visibili (ad esempio finché non ne ha aggiunte l'area riservata) la home resta in piedi senza il 3D.
  const layersTotal = hero ? new Intl.NumberFormat(lang).format(Math.round((hero.work.dimensionsMm[2] || 200) / LAYER_MM)) : '';
  return html`
    <section class="hero ${hero ? '' : 'is-flat'}" data-hero aria-labelledby="hero-title">
      <div class="hero-pin">
        <canvas class="hero-canvas" data-hero-canvas aria-hidden="true"></canvas>
        <div class="hero-vignette" aria-hidden="true"></div>
        <div class="hero-copy" data-hero-copy>
          <h1 id="hero-title" class="hero-title" aria-label="${t('home.hero.title')}"><span aria-hidden="true">${titleWords(t('home.hero.title'))}</span></h1>
          <p class="lead">${t('home.hero.lead')}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/contact">${t('home.hero.cta')}${icon('arrow')}</a>
            <a class="btn btn-ghost" href="/gallery">${t('home.hero.secondary')}</a>
          </div>
        </div>
        <div class="hero-finale" data-hero-finale>
          <p>${t('home.finale.title')}</p>
          <a class="btn btn-primary btn-large" href="/contact">${t('home.hero.cta')}${icon('arrow')}</a>
        </div>
        ${hero ? html`<dl class="hero-hud" data-hero-hud aria-hidden="true">
          <div><dt>${t('home.hud.layer')}</dt><dd><span data-hud-layer>0</span> / ${layersTotal}</dd></div>
          <div><dt>${t('home.hud.grams')}</dt><dd data-hud-grams>0 g</dd></div>
          <div class="hud-material"><dt>${t('home.hud.material')}</dt><dd>${colorName({ colors: hero.colors, lang, t })}</dd></div>
          <span class="hud-bar" data-hud-bar></span>
        </dl>
        <p class="hero-hint"><span>${t('home.hero.hint')}</span></p>` : ''}
      </div>
    </section>

    ${ledger.length === 0 ? '' : html`<section class="section shelf" aria-labelledby="shelf-title">
      <div class="section-head">
        <h2 id="shelf-title">${t('home.shelf.title')}</h2>
        <p>${t('home.shelf.lead')}</p>
      </div>
      <ul class="showcase">
        ${ledger.map((row) => showcaseItem({ row, t, lang, i18n }))}
      </ul>
      <p class="section-foot"><a class="text-link" href="/gallery">${t('home.shelf.all')}${icon('arrow', { size: 18 })}</a></p>
    </section>`}

    <section class="section steps" aria-labelledby="steps-title">
      <div class="section-head">
        <h2 id="steps-title">${t('home.steps.title')}</h2>
        <p>${t('home.steps.lead')}</p>
      </div>
      <ol class="steps-line">
        ${steps.map((step, index) => html`<li data-reveal><span class="step-num" aria-hidden="true">${index + 1}</span><h3>${step.title}</h3><p>${step.text}</p></li>`)}
      </ol>
    </section>

    ${materials.length === 0 ? '' : html`<section class="section materials-strip" aria-labelledby="rack-title">
      <div class="section-head">
        <h2 id="rack-title">${t('home.rack.title')}</h2>
        <p>${t('home.rack.lead')}</p>
      </div>
      <ul class="material-row">
        ${materials.map(({ material, image }) => html`<li data-reveal><a href="/materials#${material.id}" aria-label="${material.label(lang)}, ${i18n.grams(material.stockG)}">${materialTile({ material, image, lang, i18n })}</a></li>`)}
      </ul>
      <p class="section-foot"><a class="text-link" href="/materials">${t('home.rack.all')}${icon('arrow', { size: 18 })}</a></p>
    </section>`}

    <section class="section closer" aria-labelledby="closer-title">
      <h2 id="closer-title">${t('home.closer.title')}</h2>
      <p>${t('home.closer.text')}</p>
      <a class="btn btn-primary btn-large" href="/contact">${t('home.hero.cta')}${icon('arrow')}</a>
    </section>`;
}
