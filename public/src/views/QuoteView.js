import { html } from '../core/html.js';
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, MAX_FILES } from '../models/QuoteRequest.js';
import { icon } from './components/icons.js';
import { materialTile } from './components/parts.js';

export function quoteView({ t, lang, i18n, materials, prefill, work }) {
  const accept = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');
  const mode = prefill.mode;
  const selected = materials.find((material) => material.id === prefill.materialId) ?? null;
  const optional = ` (${t('quote.optional')})`;
  return html`
    <section class="page-head">
      <h1>${t('quote.title')}</h1>
      <p class="lead">${t('quote.lead')}</p>
    </section>

    <section class="section quote-layout">
      <form class="quote-form" data-quote-form novalidate>
        <fieldset class="mode-pick">
          <legend>${t('quote.mode.legend')}</legend>
          <label class="mode-option">
            <input type="radio" name="mode" value="idea" ${mode === 'idea' ? 'checked' : ''}>
            <span class="mode-card">${icon('idea', { size: 26 })}<b>${t('quote.mode.idea')}</b><small>${t('quote.mode.ideaText')}</small></span>
          </label>
          <label class="mode-option">
            <input type="radio" name="mode" value="file" ${mode === 'file' ? 'checked' : ''}>
            <span class="mode-card">${icon('file', { size: 26 })}<b>${t('quote.mode.file')}</b><small>${t('quote.mode.fileText')}</small></span>
          </label>
        </fieldset>

        ${work ? html`<p class="work-ref"><span>${t('quote.forWork')}</span> <b>${work.title(lang)}</b><input type="hidden" name="workId" value="${work.id}"></p>` : ''}

        <div class="field-row">
          <div class="field" data-field="name">
            <label for="name">${t('quote.fields.name')}</label>
            <input id="name" name="name" type="text" autocomplete="name" required aria-describedby="name-error">
            <p class="field-error" id="name-error" data-error-for="name" hidden></p>
          </div>
          <div class="field" data-field="email">
            <label for="email">${t('quote.fields.email')}</label>
            <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required aria-describedby="email-error">
            <p class="field-error" id="email-error" data-error-for="email" hidden></p>
          </div>
        </div>

        <div class="field" data-field="description">
          <label for="description">${t('quote.fields.description')}</label>
          <textarea id="description" name="description" rows="5" required aria-describedby="description-hint description-error"></textarea>
          <p class="field-hint" id="description-hint" data-mode-hint="idea">${t('quote.fields.descriptionIdea')}</p>
          <p class="field-hint" id="description-hint-file" data-mode-hint="file" hidden>${t('quote.fields.descriptionFile')}</p>
          <p class="field-error" id="description-error" data-error-for="description" hidden></p>
        </div>

        <div class="field" data-field="files" data-mode-only="file" ${mode === 'file' ? '' : 'hidden'}>
          <label for="files">${t('quote.fields.files')}</label>
          <div class="file-drop">
            ${icon('upload', { size: 24 })}
            <input id="files" name="files" type="file" multiple accept="${accept}" aria-describedby="files-hint files-error">
          </div>
          <p class="field-hint" id="files-hint">${t('quote.fields.filesHint', { max: MAX_FILES, size: Math.round(MAX_FILE_BYTES / 1048576) })}</p>
          <ul class="file-list" data-file-list></ul>
          <p class="field-error" id="files-error" data-error-for="files" hidden></p>
        </div>

        <div class="field-row">
          <div class="field" data-field="materialId">
            <label for="materialId">${t('quote.fields.material')}</label>
            <select id="materialId" name="materialId" required aria-describedby="materialId-error">
              <option value="" ${selected || prefill.materialId === 'other' ? '' : 'selected'}>${t('quote.fields.materialPlaceholder')}</option>
              ${materials.map((material) => html`<option value="${material.id}" ${selected?.id === material.id ? 'selected' : ''}>${material.label(lang)}</option>`)}
              <option value="other" ${prefill.materialId === 'other' ? 'selected' : ''}>${t('quote.fields.materialOther')}</option>
            </select>
            <p class="field-error" id="materialId-error" data-error-for="materialId" hidden></p>
          </div>
          <div class="field" data-field="quantity">
            <label for="quantity">${t('quote.fields.quantity')}</label>
            <input id="quantity" name="quantity" type="number" min="1" max="1000" value="1" inputmode="numeric" aria-describedby="quantity-error">
            <p class="field-error" id="quantity-error" data-error-for="quantity" hidden></p>
          </div>
        </div>

        <div class="field" data-field="customMaterial" data-custom ${prefill.materialId === 'other' ? '' : 'hidden'}>
          <label for="customMaterial">${t('quote.fields.customMaterial')}</label>
          <input id="customMaterial" name="customMaterial" type="text" aria-describedby="customMaterial-hint customMaterial-error">
          <p class="field-hint" id="customMaterial-hint">${t('quote.fields.customMaterialHint')}</p>
          <p class="field-error" id="customMaterial-error" data-error-for="customMaterial" hidden></p>
        </div>

        <div class="field" data-field="deadline">
          <label for="deadline">${t('quote.fields.deadline')}${optional}</label>
          <input id="deadline" name="deadline" type="text" aria-describedby="deadline-hint">
          <p class="field-hint" id="deadline-hint">${t('quote.fields.deadlineHint')}</p>
        </div>

        <div class="hp" aria-hidden="true">
          <label for="company">Company</label>
          <input id="company" name="company" type="text" tabindex="-1" autocomplete="off">
        </div>

        <div class="field field-check" data-field="privacyAccepted">
          <label class="check">
            <input id="privacyAccepted" name="privacyAccepted" type="checkbox" aria-describedby="privacyAccepted-error">
            <span>${t('quote.privacy.before')} <a href="/privacy" target="_blank" rel="noopener">${t('quote.privacy.link')}</a>${t('quote.privacy.after')}</span>
          </label>
          <p class="field-error" id="privacyAccepted-error" data-error-for="privacyAccepted" hidden></p>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary btn-large" type="submit" data-submit>${t('quote.submit')}${icon('arrow')}</button>
          <p class="form-status" data-form-status role="status"></p>
        </div>
      </form>

      <aside class="quote-aside" aria-label="${t('quote.aside.title')}">
        <div class="aside-chip" data-aside-chip>${asideChip({ material: selected, other: prefill.materialId === 'other', t, lang, i18n })}</div>
        <h2>${t('quote.aside.title')}</h2>
        <ol class="aside-steps">
          ${i18n.list('quote.aside.steps').map((step) => html`<li>${step}</li>`)}
        </ol>
      </aside>
    </section>`;
}

/** Il riquadro del materiale: senza 3D (la pagina dei contatti non scarica three.js), con la tessera piatta di strati. */
export function asideChip({ material, other = false, t, lang, i18n }) {
  if (!material) {
    return html`<figure class="material is-empty"><span class="material-art"><span class="thumb-fallback is-neutral" aria-hidden="true"></span></span><figcaption><span>${other ? t('quote.aside.otherMaterial') : t('quote.aside.pickMaterial')}</span></figcaption></figure>`;
  }
  return materialTile({ material, image: null, lang, i18n });
}

export function quoteSuccessView({ t, result }) {
  return html`<section class="section quote-done" aria-labelledby="done-title" tabindex="-1" data-done>
    <span class="done-mark">${icon('check', { size: 28 })}</span>
    <h1 id="done-title">${result.simulated ? t('quote.done.titleDemo') : t('quote.done.title')}</h1>
    <p class="lead">${t('quote.done.text')}</p>
    <p class="reference"><span>${t('quote.done.reference')}</span> <b>${result.reference}</b></p>
    ${result.simulated ? html`<p class="demo-note">${t('quote.done.demo')}</p>` : ''}
    <a class="btn btn-ghost" href="/how-it-works">${t('quote.done.how')}</a>
  </section>`;
}
