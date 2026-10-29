import { html } from '../core/html.js';
import { icon } from './components/icons.js';

export function aboutView({ t, i18n }) {
  return html`
    <section class="page-head">
      <h1>${t('about.title')}</h1>
      <p class="lead">${t('about.lead')}</p>
    </section>
    <section class="section prose-section">
      <div class="prose">
        ${i18n.list('about.body').map((paragraph) => html`<p>${paragraph}</p>`)}
      </div>
      <p class="about-tagline">${t('about.tagline')}</p>
    </section>
    <section class="section jingle" aria-labelledby="jingle-title">
      <h2 id="jingle-title">${t('about.jingle.title')}</h2>
      <p class="jingle-lines" lang="it">${i18n.list('about.jingle.lines').map((line) => html`<span>${line}</span>`)}</p>
    </section>
    <section class="section closer" aria-labelledby="about-closer">
      <h2 id="about-closer">${t('home.closer.title')}</h2>
      <p>${t('home.closer.text')}</p>
      <a class="btn btn-primary btn-large" href="/contact">${t('home.hero.cta')}${icon('arrow')}</a>
    </section>`;
}

export function privacyView({ t, i18n }) {
  return html`
    <section class="page-head">
      <h1>${t('privacy.title')}</h1>
      <p class="lead">${t('privacy.lead')}</p>
      <p class="draft-note">${t('privacy.draft')}</p>
    </section>
    <section class="section prose-section">
      <div class="prose">
        ${i18n.list('privacy.sections').map((section) => html`<h2>${section.title}</h2><p>${section.text}</p>`)}
        <p class="muted">${t('privacy.updated')}</p>
      </div>
    </section>`;
}

export function notFoundView({ t }) {
  return html`
    <section class="page-head not-found">
      <h1>${t('notFound.title')}</h1>
      <p class="lead">${t('notFound.text')}</p>
      <a class="btn btn-primary" href="/">${t('notFound.cta')}${icon('arrow')}</a>
    </section>`;
}
