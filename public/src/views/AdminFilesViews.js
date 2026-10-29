import { html } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { ACCEPTED_EXTENSIONS, MAX_FILES, MAX_FILE_BYTES } from '../models/QuoteRequest.js';
import { errorSlot } from './AdminViews.js';

const FILE_ID = /^[A-Za-z0-9_-]{10,}$/;
// I dati arrivano da Apps Script: i collegamenti si accettano solo se puntano a Drive.
const driveLink = (url) => (/^https:\/\/(drive|docs)\.google\.com\//.test(String(url)) ? url : '');

const size = (bytes) => {
  const value = Number(bytes) || 0;
  if (value >= 1048576) return `${(value / 1048576).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(value / 1024))} kB`;
};
const when = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('it', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Manca l'indirizzo di Apps Script, oppure la chiave su questo dispositivo, oppure la chiave non vale. */
export function filesSetupView({ hasEndpoint, error = '' }) {
  return html`
    <section class="page-head">
      <h1>${A.files.title}</h1>
      <p class="lead">${A.files.lead}</p>
    </section>
    <section class="section admin-section">
      ${error ? html`<p class="admin-state is-failed" role="alert">${error}</p>` : ''}
      ${hasEndpoint
        ? html`<p class="muted">${A.files.setup.noKey}</p><p><a class="btn btn-primary" href="/admin/contacts">${A.files.setup.go}</a></p>`
        : html`<p class="muted">${A.contacts.setup.noEndpoint}</p>`}
    </section>`;
}

/** `options` sono le richieste (riferimento e nome); `reference` è quella aperta, vuoto = la Libreria. */
export function filesView({ options, reference, listing }) {
  const folderUrl = driveLink(listing.folder?.url);
  const accept = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(',');
  return html`
    <section class="page-head">
      <h1>${A.files.title}</h1>
      <p class="lead">${A.files.lead}</p>
    </section>

    <section class="section admin-section admin-split">
      <div class="admin-form">
        <h2>${A.files.where.title}</h2>
        <div class="field">
          <label for="f-target">${A.files.where.label}</label>
          <select id="f-target" name="target" data-files-target>
            <option value="" ${reference === '' ? 'selected' : ''}>${A.files.where.library}</option>
            ${options.map((option) => html`<option value="${option.reference}" ${option.reference === reference ? 'selected' : ''}>${option.reference} · ${option.name}</option>`)}
          </select>
          <p class="field-hint">${reference === '' ? A.files.where.libraryHint : A.files.where.requestHint}</p>
        </div>
        ${folderUrl ? html`<p><a class="btn btn-ghost btn-small" href="${folderUrl}" target="_blank" rel="noopener" data-external>${A.files.where.openFolder}</a></p>` : ''}
      </div>

      <form class="admin-form" data-upload-form novalidate>
        <h2>${A.files.upload.title}</h2>
        <div class="field">
          <label for="f-files">${A.files.upload.files}</label>
          <input id="f-files" name="files" type="file" multiple accept="${accept}" aria-describedby="f-files-hint files-error">
          <p class="field-hint" id="f-files-hint">${A.files.upload.hint.replace('{max}', MAX_FILES).replace('{size}', Math.round(MAX_FILE_BYTES / 1048576))}</p>
          ${errorSlot('files')}
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit" data-submit>${A.files.upload.submit}</button></div>
        <p class="admin-fixed" data-upload-status aria-live="polite"></p>
      </form>
    </section>

    <section class="section admin-section">
      <h2>${A.files.list.title}</h2>
      ${listing.files.length === 0 ? html`<p class="muted">${A.files.list.empty}</p>` : html`
        <ul class="admin-rows">
          ${listing.files.map((file) => {
            const link = driveLink(file.url);
            return html`<li class="admin-row admin-row-text">
              <span class="admin-row-main"><b>${file.name}</b><span class="muted">${size(file.size)} · ${when(file.updatedAt)}</span></span>
              <span class="admin-row-actions">
                ${link ? html`<a class="btn btn-ghost btn-small" href="${link}" target="_blank" rel="noopener" data-external>${A.files.list.open}</a>` : ''}
                ${FILE_ID.test(String(file.id)) ? html`<button class="btn btn-ghost btn-small" type="button" data-file-trash="${file.id}">${A.files.list.trash}</button>` : ''}
              </span>
            </li>`;
          })}
        </ul>
        ${listing.truncated ? html`<p class="muted">${A.files.list.truncated}</p>` : ''}`}
    </section>`;
}
