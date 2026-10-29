import { html } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { CONTACT_STATUSES } from '../models/AdminRules.js';
import { errorSlot } from './AdminViews.js';

const when = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('it', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const shortWhen = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('it', { day: 'numeric', month: 'short' });
};

// I dati arrivano da un foglio scritto da Apps Script: i collegamenti si accettano solo nella forma attesa.
const driveLink = (url) => (/^https:\/\/(drive|docs)\.google\.com\//.test(String(url)) ? url : '');
const mailLink = (email, reference) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))
  ? `mailto:${email}?subject=${encodeURIComponent(`Re: ${reference}`)}`
  : '');
const statusClass = (status) => (CONTACT_STATUSES.includes(status) ? status : 'received');

export function statusPill(status) {
  return html`<span class="admin-status is-${statusClass(status)}">${A.contacts.statuses[statusClass(status)]}</span>`;
}

/** Il collegamento dei contatti a questo dispositivo: manca l'indirizzo di Apps Script oppure manca la chiave. */
export function contactsSetupView({ hasEndpoint, error = '' }) {
  return html`
    <section class="page-head">
      <h1>${A.contacts.title}</h1>
      <p class="lead">${A.contacts.lead}</p>
    </section>
    <section class="section admin-section">
      ${hasEndpoint ? html`
        <form class="admin-form" data-key-form novalidate>
          <h2>${A.contacts.setup.title}</h2>
          <p class="muted">${A.contacts.setup.lead}</p>
          ${error ? html`<p class="admin-state is-failed" role="alert">${error}</p>` : ''}
          <div class="field">
            <label for="k-key">${A.contacts.setup.key}</label>
            <input id="k-key" name="adminKey" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="k-key-hint">
            <p class="field-hint" id="k-key-hint">${A.contacts.setup.keyHint}</p>
          </div>
          <div class="field">
            <label for="k-pass">${A.contacts.setup.passphrase}</label>
            <input id="k-pass" name="passphrase" type="password" autocomplete="current-password">
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit" data-submit>${A.contacts.setup.submit}</button></div>
        </form>` : html`<p class="login-note">${A.contacts.setup.noEndpoint}</p>`}
    </section>`;
}

/** `filter` è 'all', 'open' oppure uno stato. */
export function contactsListView({ contacts, counts, filter }) {
  const visible = contacts.filter((contact) => filter === 'all' || (filter === 'open' ? ['received', 'reviewing', 'quoted', 'confirmed', 'printing'].includes(contact.status) : contact.status === filter));
  return html`
    <section class="page-head">
      <h1>${A.contacts.title}</h1>
      <p class="lead">${A.contacts.lead}</p>
      <div class="admin-actions">
        <div class="field admin-filter">
          <label for="c-filter">${A.contacts.filter}</label>
          <select id="c-filter" data-contact-filter>
            <option value="all" ${filter === 'all' ? 'selected' : ''}>${A.contacts.all} (${counts.all})</option>
            <option value="open" ${filter === 'open' ? 'selected' : ''}>${A.contacts.open} (${counts.open})</option>
            ${CONTACT_STATUSES.map((status) => html`<option value="${status}" ${filter === status ? 'selected' : ''}>${A.contacts.statuses[status]} (${counts[status] ?? 0})</option>`)}
          </select>
        </div>
        <button class="btn btn-ghost btn-small" type="button" data-contacts-reload>${A.contacts.reload}</button>
      </div>
    </section>
    <section class="section admin-section">
      ${contacts.length === 0 ? html`<p class="muted">${A.contacts.none}</p>`
        : visible.length === 0 ? html`<p class="muted">${A.contacts.empty}</p>` : html`
        <ul class="admin-rows">
          ${visible.map((contact) => html`<li class="admin-row contact-row">
            ${statusPill(contact.status)}
            <span class="admin-row-main">
              <b>${contact.name}</b>
              <span class="muted">${contact.reference} · ${shortWhen(contact.receivedAt)} · ${contact.material || '—'} × ${contact.quantity}</span>
            </span>
            <span class="admin-tags">
              <span class="admin-tag">${A.contacts.mode[contact.mode === 'file' ? 'file' : 'idea']}</span>
              ${contact.files ? html`<span class="admin-tag">${A.contacts.hasFiles}</span>` : ''}
            </span>
            <a class="btn btn-ghost btn-small" href="/admin/contacts/${contact.reference}">${A.contacts.open_}</a>
          </li>`)}
        </ul>`}
    </section>`;
}

export function contactDetailView({ contact }) {
  const reply = mailLink(contact.email, contact.reference);
  const drive = driveLink(contact.driveUrl);
  const none = A.contacts.detail.none;
  return html`
    <section class="page-head">
      <a class="back-link" href="/admin/contacts">${A.contacts.detail.back}</a>
      <h1>${contact.name}</h1>
      <p class="lead">${contact.reference} · ${A.contacts.detail.received.toLowerCase()} ${when(contact.receivedAt)}</p>
      <div class="admin-actions">
        ${reply ? html`<a class="btn btn-primary" href="${reply}">${A.contacts.detail.reply}</a>` : ''}
        ${drive ? html`<a class="btn btn-ghost" href="${drive}" target="_blank" rel="noopener" data-external>${A.contacts.detail.openDrive}</a>` : ''}
      </div>
    </section>
    <section class="section admin-section">
      <dl class="admin-details">
        <div><dt>${A.contacts.detail.email}</dt><dd>${contact.email}</dd></div>
        <div><dt>${A.contacts.detail.start}</dt><dd>${A.contacts.mode[contact.mode === 'file' ? 'file' : 'idea']}</dd></div>
        <div><dt>${A.contacts.detail.material}</dt><dd>${contact.material || none}</dd></div>
        <div><dt>${A.contacts.detail.quantity}</dt><dd>${contact.quantity}</dd></div>
        <div><dt>${A.contacts.detail.deadline}</dt><dd>${contact.deadline || none}</dd></div>
        <div><dt>${A.contacts.detail.work}</dt><dd>${contact.work || none}</dd></div>
        <div><dt>${A.contacts.detail.lang}</dt><dd>${A.contacts.detail.langs[contact.lang] ?? none}</dd></div>
        <div><dt>${A.contacts.detail.files}</dt><dd>${contact.files || none}</dd></div>
      </dl>
      <div class="admin-message">
        <h2>${A.contacts.detail.description}</h2>
        <p>${contact.description}</p>
      </div>

      <form class="admin-form" data-contact-form data-reference="${contact.reference}" novalidate>
        <div class="field">
          <label for="c-status">${A.contacts.detail.status}</label>
          <select id="c-status" name="status" aria-describedby="status-error">
            ${CONTACT_STATUSES.map((status) => html`<option value="${status}" ${status === contact.status ? 'selected' : ''}>${A.contacts.statuses[status]}</option>`)}
          </select>
          ${errorSlot('status')}
        </div>
        <div class="field">
          <label for="c-note">${A.contacts.detail.note} (${A.common.optional})</label>
          <textarea id="c-note" name="note" rows="4" maxlength="1000" aria-describedby="c-note-hint note-error">${contact.note}</textarea>
          <p class="field-hint" id="c-note-hint">${A.contacts.detail.noteHint}</p>
          ${errorSlot('note')}
        </div>
        <div class="form-actions form-actions-row">
          <button class="btn btn-primary" type="submit" data-submit>${A.common.save}</button>
          <a class="btn btn-ghost" href="/admin/contacts">${A.common.cancel}</a>
          <button class="btn btn-ghost" type="button" data-delete>${A.common.delete}</button>
        </div>
      </form>
    </section>`;
}
