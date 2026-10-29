import { html, safeHex } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { stockGauge } from './components/parts.js';

const SECTIONS = Object.freeze([
  ['overview', '/admin'],
  ['contacts', '/admin/contacts'],
  ['materials', '/admin/materials'],
  ['stock', '/admin/stock'],
  ['works', '/admin/works'],
  ['settings', '/admin/settings'],
]);

/** Segnaposto del messaggio d'errore di un campo; lo riempie showFieldErrors (core/forms.js). */
export function errorSlot(name) {
  return html`<p class="field-error" id="${name}-error" data-error-for="${name}" hidden></p>`;
}

const grams = (value) => `${new Intl.NumberFormat('it').format(Math.round(value))} g`;

/** Cornice comune: schede delle sezioni, uscita e riga dei messaggi. `body` è il contenuto della sezione. */
export function adminLayout({ section, body }) {
  return html`
    <div class="admin-bar">
      <nav class="admin-tabs" aria-label="${A.nav.label}">
        <ul>
          ${SECTIONS.map(([key, href]) => html`<li><a href="${href}" ${section === key ? 'aria-current="page"' : ''}>${A.nav[key]}</a></li>`)}
        </ul>
      </nav>
      <button class="btn btn-ghost btn-small" type="button" data-signout>${A.nav.signOut}</button>
    </div>
    <p class="admin-flash" data-flash role="status" hidden></p>
    ${body}`;
}

/** `mode` è 'setup' (primo collegamento di questo dispositivo) oppure 'unlock' (token già salvato). */
export function loginView({ mode, repoGuess }) {
  const setup = mode === 'setup';
  return html`
    <section class="page-head">
      <h1>${A.login.title}</h1>
      <p class="lead">${setup ? A.login.setupLead : A.login.unlockLead}</p>
    </section>
    <section class="section login">
      <form class="login-form" data-login-form data-mode="${mode}" novalidate>
        ${setup ? html`
          <div class="field">
            <label for="login-repo">${A.login.repo}</label>
            <input id="login-repo" name="repo" type="text" value="${repoGuess}" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="login-repo-hint">
            <p class="field-hint" id="login-repo-hint">${A.login.repoHint}</p>
          </div>
          <div class="field">
            <label for="login-token">${A.login.token}</label>
            <input id="login-token" name="token" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="login-token-hint">
            <p class="field-hint" id="login-token-hint">${A.login.tokenHint}</p>
          </div>
          <div class="field">
            <label for="login-key">${A.login.contactsKey}</label>
            <input id="login-key" name="adminKey" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="login-key-hint">
            <p class="field-hint" id="login-key-hint">${A.login.contactsKeyHint}</p>
          </div>
          <div class="field">
            <label for="login-new">${A.login.newPassword}</label>
            <input id="login-new" name="passphrase" type="password" autocomplete="new-password" aria-describedby="login-new-hint">
            <p class="field-hint" id="login-new-hint">${A.login.newPasswordHint}</p>
          </div>
          <div class="field">
            <label for="login-repeat">${A.login.repeatPassword}</label>
            <input id="login-repeat" name="repeat" type="password" autocomplete="new-password">
          </div>` : html`
          <div class="field">
            <label for="login-password">${A.login.password}</label>
            <input id="login-password" name="passphrase" type="password" autocomplete="current-password">
          </div>`}
        <label class="check"><input type="checkbox" data-reveal><span>${A.login.show}</span></label>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" data-submit>${setup ? A.login.setupSubmit : A.login.unlockSubmit}</button>
          <p class="form-status" data-form-status role="status"></p>
        </div>
      </form>
      ${setup ? '' : html`
        <div class="login-forget">
          <button class="btn btn-ghost btn-small" type="button" data-forget>${A.login.forget}</button>
          <p class="muted" data-forget-note hidden>${A.login.forgetNote}</p>
        </div>`}
      <p class="login-back"><a href="/">${A.login.back}</a></p>
    </section>`;
}

const PUBLISH_LABEL = {
  running: A.overview.publish.running,
  ok: A.overview.publish.ok,
  failed: A.overview.publish.failed,
  unknown: A.overview.publish.unknown,
};

/** `contacts`: { state: 'ok' | 'notLinked', news, open } — i dati dei clienti non entrano mai qui, solo i numeri. */
export function overviewView({ repo, publish, publishAt, counts, low, contacts }) {
  return html`
    <section class="page-head">
      <h1>${A.overview.title}</h1>
      <p class="lead">${A.overview.lead}</p>
    </section>

    <section class="section admin-section">
      <div class="admin-cards">
        <article class="admin-card">
          <h2>${A.overview.contacts.title}</h2>
          ${contacts.state === 'ok' ? html`
            <p class="admin-figure">${contacts.news}</p>
            <p class="muted">${A.overview.contacts.news} · ${contacts.open} ${A.overview.contacts.open}</p>
            <p><a href="/admin/contacts">${A.overview.contacts.go}</a></p>` : html`
            <p class="muted">${A.overview.contacts.notLinked}</p>
            <p><a href="/admin/contacts">${A.overview.contacts.link}</a></p>`}
        </article>
        <article class="admin-card">
          <h2>${A.overview.counts.materials}</h2>
          <p class="admin-figure">${counts.materials}</p>
          <p class="muted">${counts.spools} ${A.overview.counts.spools} · ${grams(counts.stockG)}</p>
        </article>
        <article class="admin-card">
          <h2>${A.overview.counts.works}</h2>
          <p class="admin-figure">${counts.works}</p>
          <p class="muted">${counts.hidden} ${A.overview.counts.hidden}</p>
        </article>
        <article class="admin-card">
          <h2>${A.overview.publish.title}</h2>
          <p class="admin-state is-${publish}">${PUBLISH_LABEL[publish]}</p>
          ${publishAt ? html`<p class="muted">${A.overview.publish.last}: ${publishAt}</p>` : ''}
          <p><a href="https://github.com/${repo}/actions" target="_blank" rel="noopener" data-external>${A.overview.publish.actions}</a></p>
        </article>
      </div>
    </section>

    <section class="section admin-section">
      <h2>${A.overview.low.title}</h2>
      ${low.length === 0 ? html`<p class="muted">${A.overview.low.empty}</p>` : html`
        <ul class="admin-rows">
          ${low.map((item) => html`<li class="admin-row" data-hex="${safeHex(item.hex)}">
            <span class="swatch" data-hex="${safeHex(item.hex)}" aria-hidden="true"></span>
            <span class="admin-row-main"><b>${item.label}</b><span class="muted">${A.overview.low.left.replace('{grams}', grams(item.stockG)).replace('{spool}', grams(item.capacityG))}</span></span>
            ${stockGauge({ remaining: item.fraction, after: item.fraction })}
            <a class="btn btn-ghost btn-small" href="/admin/stock?material=${item.id}">${A.stock.list.adjust}</a>
          </li>`)}
        </ul>`}
    </section>

    <section class="section admin-section">
      <h2>${A.overview.shortcuts}</h2>
      <ul class="admin-links">
        <li><a href="/admin/contacts">${A.overview.go.contacts}</a></li>
        <li><a href="/admin/materials">${A.overview.go.materials}</a></li>
        <li><a href="/admin/stock">${A.overview.go.stock}</a></li>
        <li><a href="/admin/works">${A.overview.go.works}</a></li>
        <li><a href="/admin/settings">${A.overview.go.settings}</a></li>
        <li><a href="/">${A.overview.siteLink}</a></li>
      </ul>
      <p class="muted">${A.overview.repo}: ${repo}</p>
    </section>`;
}

export function settingsView({ settings, repo }) {
  return html`
    <section class="page-head">
      <h1>${A.settings.title}</h1>
      <p class="lead">${A.settings.lead}</p>
    </section>
    <section class="section admin-section">
      <form class="admin-form" data-settings-form novalidate>
        <div class="field">
          <label for="s-name">${A.settings.name}</label>
          <input id="s-name" name="name" type="text" value="${settings.name}" maxlength="40" aria-describedby="name-error">
          ${errorSlot('name')}
        </div>
        <div class="field">
          <label for="s-email">${A.settings.email}</label>
          <input id="s-email" name="contactEmail" type="email" value="${settings.contactEmail}" autocomplete="off" aria-describedby="s-email-hint contactEmail-error">
          <p class="field-hint" id="s-email-hint">${A.settings.emailHint}</p>
          ${errorSlot('contactEmail')}
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" data-submit>${A.common.save}</button>
        </div>
      </form>
    </section>
    <section class="section admin-section">
      <h2>${A.settings.device.title}</h2>
      <p>${A.settings.device.repo}: <b>${repo}</b></p>
      <p><a href="https://github.com/${repo}/commits" target="_blank" rel="noopener" data-external>${A.settings.device.history}</a></p>
      <p class="muted">${A.settings.device.historyNote}</p>
    </section>`;
}
