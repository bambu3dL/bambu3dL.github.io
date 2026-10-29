import { html } from '../core/html.js';
import { NAV, SITE } from '../config.js';
import { icon } from './components/icons.js';
import { logoMark } from './components/logo.js';

export function headerView({ t, lang, theme, path }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return html`<header class="site-header" data-site-header>
    <a class="brand" href="/" aria-label="${SITE.name} — ${t('nav.home')}">
      ${logoMark()}
      <span class="brand-text"><span class="brand-name">${SITE.name}</span><span class="brand-by">${t('brand.by', { owner: SITE.owner })}</span></span>
    </a>
    <nav class="site-nav" id="site-nav" aria-label="${t('a11y.mainNav')}">
      <ul>
        ${NAV.map((item) => html`<li><a href="${item.path}" ${path === item.path || (item.path !== '/' && path.startsWith(item.path)) ? 'aria-current="page"' : ''}>${t(`nav.${item.key}`)}</a></li>`)}
      </ul>
      <a class="btn btn-primary btn-small nav-cta" href="/contact">${t('nav.quote')}</a>
    </nav>
    <div class="header-tools">
      <div class="lang-switch" role="group" aria-label="${t('a11y.language')}">
        <button type="button" data-lang="it" aria-pressed="${lang === 'it'}">IT</button>
        <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
      </div>
      <button type="button" class="icon-button" data-theme-toggle aria-label="${t(`a11y.themeTo.${nextTheme}`)}">${icon(theme === 'dark' ? 'sun' : 'moon')}</button>
      <button type="button" class="icon-button menu-button" data-menu-toggle aria-expanded="false" aria-controls="site-nav" aria-label="${t('a11y.menu')}">${icon('menu')}</button>
    </div>
  </header>`;
}

export function footerView({ t }) {
  return html`<footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <p class="footer-title">${SITE.name}</p>
        <p>${t('footer.tagline')}</p>
        ${SITE.contactEmail ? html`<p><a href="mailto:${SITE.contactEmail}">${SITE.contactEmail}</a></p>` : ''}
      </div>
      <nav aria-label="${t('a11y.footerNav')}">
        <ul class="footer-links">
          ${NAV.map((item) => html`<li><a href="${item.path}">${t(`nav.${item.key}`)}</a></li>`)}
          <li><a href="/contact">${t('nav.quote')}</a></li>
          <li><a href="/privacy">${t('nav.privacy')}</a></li>
          <li><a class="footer-admin" href="/admin">${icon('lock', { size: 14 })}${t('nav.admin')}</a></li>
        </ul>
      </nav>
    </div>
  </footer>`;
}

export function consentView({ t }) {
  return html`<section class="consent" role="region" aria-labelledby="consent-title">
    <h2 id="consent-title">${t('consent.title')}</h2>
    <p>${t('consent.body')} <a href="/privacy">${t('consent.more')}</a></p>
    <div class="consent-actions">
      <button type="button" class="btn btn-primary btn-small" data-consent="persist">${t('consent.accept')}</button>
      <button type="button" class="btn btn-ghost btn-small" data-consent="session">${t('consent.decline')}</button>
    </div>
  </section>`;
}
