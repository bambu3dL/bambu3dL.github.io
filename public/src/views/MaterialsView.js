import { html } from '../core/html.js';
import { icon } from './components/icons.js';
import { materialTile } from './components/parts.js';

function verdict({ estimate, t, i18n, hasWork }) {
  if (!hasWork) return '';
  return html`<span class="wall-verdict ${estimate.enough ? 'is-ok' : 'is-low'}">${estimate.enough
    ? t('materials.wall.enough', { grams: i18n.grams(estimate.needG), after: i18n.grams(estimate.afterG) })
    : t('materials.wall.low', { grams: i18n.grams(estimate.needG) })}</span>`;
}

function machine({ t, i18n, key }) {
  return html`<article class="machine">
    <h3>${t(`materials.gear.${key}.name`)}</h3>
    <p>${t(`materials.gear.${key}.text`)}</p>
    <dl class="spec">
      ${i18n.list(`materials.gear.${key}.specs`).map((row) => html`<div><dt>${row.label}</dt><dd>${row.value}</dd></div>`)}
    </dl>
  </article>`;
}

export function materialsView({ t, lang, i18n, works, selectedWork, groups }) {
  return html`
    <section class="page-head">
      <h1>${t('materials.title')}</h1>
      <p class="lead">${t('materials.lead')}</p>
    </section>

    <section class="section services" aria-labelledby="services-title">
      <h2 id="services-title">${t('materials.services.title')}</h2>
      <div class="services-grid">
        <div class="service">
          ${icon('idea', { size: 28 })}
          <h3>${t('materials.services.idea.title')}</h3>
          <p>${t('materials.services.idea.text')}</p>
        </div>
        <div class="service">
          ${icon('file', { size: 28 })}
          <h3>${t('materials.services.file.title')}</h3>
          <p>${t('materials.services.file.text')}</p>
          <p class="muted">${t('materials.services.file.formats')}</p>
        </div>
      </div>
    </section>

    <section class="section gear" aria-labelledby="gear-title">
      <div class="section-head">
        <h2 id="gear-title">${t('materials.gear.title')}</h2>
        <p>${t('materials.gear.lead')}</p>
      </div>
      <div class="gear-grid">
        ${machine({ t, i18n, key: 'printer' })}
        ${machine({ t, i18n, key: 'ams' })}
      </div>
      <p class="muted gear-note">${t('materials.gear.note')}</p>
    </section>

    <section class="section wall" aria-labelledby="wall-title">
      <div class="section-head">
        <h2 id="wall-title">${t('materials.wall.title')}</h2>
        <p>${t('materials.wall.lead')}</p>
      </div>
      <div class="compare">
        <label for="compare-work">${t('materials.wall.compare')}</label>
        <select id="compare-work" data-compare>
          <option value="">${t('materials.wall.none')}</option>
          ${works.map((work) => html`<option value="${work.id}" ${selectedWork?.id === work.id ? 'selected' : ''}>${work.title(lang)} — ${i18n.grams(work.estimatedG)}</option>`)}
        </select>
      </div>
      <div data-wall>
        ${groups.map((group) => html`<div class="wall-group">
          <div class="wall-group-head"><h3>${group.family}</h3><p>${group.description}</p></div>
          <ul class="wall-row">
            ${group.items.map(({ material, estimate, image }) => html`<li>${materialTile({ material, image, lang, i18n, estimate: selectedWork ? estimate : null, caption: verdict({ estimate, t, i18n, hasWork: Boolean(selectedWork) }) })}</li>`)}
          </ul>
        </div>`)}
      </div>
    </section>

    <section class="section custom-material" aria-labelledby="custom-title">
      <h2 id="custom-title">${t('materials.custom.title')}</h2>
      <p>${t('materials.custom.text')}</p>
      <a class="btn btn-primary" href="/contact?material=other">${t('materials.custom.cta')}${icon('arrow')}</a>
    </section>`;
}
