import { html } from '../core/html.js';
import { icon } from './components/icons.js';
import { REQUEST_STATUSES } from '../models/RequestStatus.js';

export function howView({ t, i18n }) {
  const steps = i18n.list('how.steps');
  const formats = i18n.list('how.formats');
  return html`
    <section class="page-head">
      <h1>${t('how.title')}</h1>
      <p class="lead">${t('how.lead')}</p>
    </section>

    <section class="section steps steps-long" aria-labelledby="how-steps">
      <h2 id="how-steps" class="sr-only">${t('how.title')}</h2>
      <ol class="steps-line">
        ${steps.map((step, index) => html`<li><span class="step-num" aria-hidden="true">${index + 1}</span><h3>${step.title}</h3><p>${step.text}</p></li>`)}
      </ol>
    </section>

    <section class="section files" aria-labelledby="files-title">
      <div class="two-col">
        <div>
          <h2 id="files-title">${t('how.files.title')}</h2>
          <p>${t('how.files.text')}</p>
        </div>
        <ul class="format-list">
          ${formats.map((format) => html`<li><b>${format.name}</b><span>${format.text}</span></li>`)}
        </ul>
      </div>
    </section>

    <section class="section statuses" aria-labelledby="status-title">
      <h2 id="status-title">${t('how.status.title')}</h2>
      <p class="section-intro">${t('how.status.lead')}</p>
      <ol class="status-line">
        ${REQUEST_STATUSES.map((status) => html`<li><span class="status-dot" aria-hidden="true"></span><h3>${t(`status.${status}.name`)}</h3><p>${t(`status.${status}.text`)}</p></li>`)}
      </ol>
      <p class="muted">${t('how.status.note')}</p>
    </section>

    <section class="section closer" aria-labelledby="how-closer">
      <h2 id="how-closer">${t('home.closer.title')}</h2>
      <p>${t('home.closer.text')}</p>
      <a class="btn btn-primary btn-large" href="/contact">${t('home.hero.cta')}${icon('arrow')}</a>
    </section>`;
}
