import { html, safeHex } from '../core/html.js';
import { A } from '../i18n/admin.it.js';
import { SHAPES } from '../models/AdminRules.js';
import { errorSlot } from './AdminViews.js';
import { stockGauge } from './components/parts.js';

const grams = (value) => `${new Intl.NumberFormat('it').format(Math.round(value))} g`;
const inUse = (spool) => spool.status !== 'finished';
export const materialLabel = (material) => `${material.family} · ${material.name.it}`;
const spoolNumber = (spool) => spool.id.split('-').pop();

/** Residuo e capacità di un filo, sommando le sue bobine in uso (stessa regola del modello pubblico Material). */
export function filamentStats(material, spools) {
  const active = spools.filter((spool) => spool.materialId === material.id && inUse(spool));
  const stockG = active.reduce((sum, spool) => sum + spool.remainingG, 0);
  const capacity = active.reduce((sum, spool) => sum + spool.netG, 0);
  const capacityG = capacity > 0 ? capacity : material.spoolG;
  return { active: active.length, stockG, capacityG, fraction: Math.min(1, stockG / capacityG) };
}

function spoolsInUse(count) {
  const texts = A.materials.spoolsInUse;
  return (count === 0 ? texts.zero : count === 1 ? texts.one : texts.other).replace('{n}', count);
}

/* ---------- Fili ---------- */

export function materialsListView({ materials, families, spools }) {
  return html`
    <section class="page-head">
      <h1>${A.materials.title}</h1>
      <p class="lead">${A.materials.lead}</p>
      <div class="admin-actions"><a class="btn btn-primary" href="/admin/materials/new">${A.materials.add}</a></div>
    </section>

    <section class="section admin-section">
      ${materials.length === 0 ? html`<p class="muted">${A.common.noItems}</p>` : html`
        <ul class="admin-rows">
          ${materials.map((material) => {
            const stats = filamentStats(material, spools);
            return html`<li class="admin-row" data-hex="${safeHex(material.hex)}">
              <span class="swatch" data-hex="${safeHex(material.hex)}" aria-hidden="true"></span>
              <span class="admin-row-main">
                <b>${materialLabel(material)}</b>
                <span class="muted">${material.brand ? `${material.brand} · ` : ''}${spoolsInUse(stats.active)} · ${grams(stats.stockG)} / ${grams(stats.capacityG)}</span>
              </span>
              ${stockGauge({ remaining: stats.fraction, after: stats.fraction })}
              <a class="btn btn-ghost btn-small" href="/admin/materials/${material.id}">${A.common.edit}</a>
            </li>`;
          })}
        </ul>`}
    </section>

    <section class="section admin-section">
      <h2>${A.materials.families.title}</h2>
      <p class="muted">${A.materials.families.lead}</p>
      <ul class="admin-rows">
        ${Object.entries(families).map(([code, text]) => html`<li class="admin-row admin-row-text">
          <span class="admin-row-main"><b>${code}</b><span class="muted">${text.it}</span></span>
          <span class="admin-row-actions">
            <button class="btn btn-ghost btn-small" type="button" data-family-edit="${code}">${A.common.edit}</button>
            <button class="btn btn-ghost btn-small" type="button" data-family-delete="${code}">${A.common.delete}</button>
          </span>
        </li>`)}
      </ul>
      <form class="admin-form" data-family-form novalidate>
        <h3>${A.materials.families.form}</h3>
        <div class="field">
          <label for="f-code">${A.materials.families.code}</label>
          <input id="f-code" name="code" type="text" maxlength="12" autocapitalize="characters" autocomplete="off" aria-describedby="f-code-hint code-error">
          <p class="field-hint" id="f-code-hint">${A.materials.families.codeHint}</p>
          ${errorSlot('code')}
        </div>
        <div class="field">
          <label for="f-it">${A.materials.families.it}</label>
          <textarea id="f-it" name="it" rows="3" aria-describedby="it-error"></textarea>
          ${errorSlot('it')}
        </div>
        <div class="field">
          <label for="f-en">${A.materials.families.en} (${A.common.optional})</label>
          <textarea id="f-en" name="en" rows="3"></textarea>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit" data-submit>${A.materials.families.save}</button></div>
      </form>
    </section>`;
}

export function materialFormView({ material, families, spools }) {
  const editing = material !== null;
  const value = material ?? { family: Object.keys(families)[0] ?? '', name: { it: '', en: '' }, brand: '', hex: '#e5372b', spoolG: 1000 };
  const stats = editing ? filamentStats(material, spools) : null;
  return html`
    <section class="page-head">
      <a class="back-link" href="/admin/materials">${A.materials.form.back}</a>
      <h1>${editing ? A.materials.form.editTitle : A.materials.form.newTitle}</h1>
    </section>
    <section class="section admin-section">
      <form class="admin-form" data-material-form data-id="${editing ? material.id : ''}" novalidate>
        <div class="field">
          <label for="m-family">${A.materials.form.family}</label>
          <select id="m-family" name="family" aria-describedby="family-error">
            ${Object.keys(families).map((code) => html`<option value="${code}" ${code === value.family ? 'selected' : ''}>${code}</option>`)}
          </select>
          ${errorSlot('family')}
        </div>
        <div class="field-row">
          <div class="field">
            <label for="m-name-it">${A.materials.form.nameIt}</label>
            <input id="m-name-it" name="nameIt" type="text" value="${value.name.it}" aria-describedby="nameIt-error">
            ${errorSlot('nameIt')}
          </div>
          <div class="field">
            <label for="m-name-en">${A.materials.form.nameEn} (${A.common.optional})</label>
            <input id="m-name-en" name="nameEn" type="text" value="${value.name.en ?? ''}">
          </div>
        </div>
        <div class="field">
          <label for="m-brand">${A.materials.form.brand} (${A.common.optional})</label>
          <input id="m-brand" name="brand" type="text" maxlength="40" value="${value.brand ?? ''}" aria-describedby="brand-error">
          ${errorSlot('brand')}
        </div>
        <div class="field-row">
          <div class="field">
            <label for="m-hex">${A.materials.form.hex}</label>
            <input id="m-hex" name="hex" type="color" value="${value.hex}" aria-describedby="hex-error">
            ${errorSlot('hex')}
          </div>
          <div class="field">
            <label for="m-spool">${A.materials.form.spool}</label>
            <input id="m-spool" name="spoolG" type="number" min="1" max="20000" step="1" inputmode="numeric" value="${value.spoolG}" aria-describedby="spoolG-error">
            ${errorSlot('spoolG')}
          </div>
        </div>
        ${editing ? html`
          <p class="admin-fixed"><b>${A.materials.form.currentStock}:</b> ${grams(stats.stockG)} · ${spoolsInUse(stats.active)}. <span class="muted">${A.materials.form.stockNote}</span> <a href="/admin/stock?material=${material.id}">${A.nav.stock}</a></p>` : html`
          <div class="field">
            <label for="m-initial">${A.materials.form.initialSpools}</label>
            <input id="m-initial" name="initialSpools" type="number" min="0" max="10" step="1" inputmode="numeric" value="1" aria-describedby="m-initial-hint initialSpools-error">
            <p class="field-hint" id="m-initial-hint">${A.materials.form.initialSpoolsHint}</p>
            ${errorSlot('initialSpools')}
          </div>`}
        <div class="form-actions form-actions-row">
          <button class="btn btn-primary" type="submit" data-submit>${A.common.save}</button>
          <a class="btn btn-ghost" href="/admin/materials">${A.common.cancel}</a>
          ${editing ? html`<button class="btn btn-ghost" type="button" data-delete>${A.common.delete}</button>` : ''}
        </div>
      </form>
    </section>`;
}

/* ---------- Oggetti ---------- */

export function worksListView({ works, materialsById }) {
  return html`
    <section class="page-head">
      <h1>${A.works.title}</h1>
      <p class="lead">${A.works.lead}</p>
      <div class="admin-actions"><a class="btn btn-primary" href="/admin/works/new">${A.works.add}</a></div>
    </section>
    <section class="section admin-section">
      ${works.length === 0 ? html`<p class="muted">${A.common.noItems}</p>` : html`
        <ul class="admin-rows">
          ${works.map((work) => {
            const material = materialsById.get(work.materialId);
            return html`<li class="admin-row" data-hex="${safeHex(material?.hex ?? '#888888')}">
              <span class="swatch" data-hex="${safeHex(material?.hex ?? '#888888')}" aria-hidden="true"></span>
              <span class="admin-row-main">
                <b>${work.title.it}</b>
                <span class="muted">${material ? materialLabel(material) : '—'} · ${grams(work.estimatedG)} · ${work.date}</span>
              </span>
              <span class="admin-tags">
                ${work.visible === false ? html`<span class="admin-tag">${A.works.hidden}</span>` : ''}
                ${work.photo ? html`<span class="admin-tag">${A.works.hasPhoto}</span>` : ''}
              </span>
              <a class="btn btn-ghost btn-small" href="/admin/works/${work.id}">${A.common.edit}</a>
            </li>`;
          })}
        </ul>`}
    </section>`;
}

function shapeFields(kind, shape) {
  return SHAPES[kind].fields.map((field) => html`<div class="field">
    <label for="w-shape-${field.name}">${A.works.form.params[field.name]}</label>
    <input id="w-shape-${field.name}" name="shape_${field.name}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" inputmode="decimal" value="${shape?.kind === kind && shape[field.name] !== undefined ? shape[field.name] : field.value}">
  </div>`);
}

export function workFormView({ work, materials, today }) {
  const editing = work !== null;
  const value = work ?? { title: { it: '' }, summary: { it: '' }, materialId: '', estimatedG: '', dimensionsMm: [], date: today, shape: { kind: 'twistVase' }, visible: true };
  const [dimW = '', dimD = '', dimH = ''] = value.dimensionsMm ?? [];
  const kind = value.shape.kind in SHAPES ? value.shape.kind : 'twistVase';
  return html`
    <section class="page-head">
      <a class="back-link" href="/admin/works">${A.works.form.back}</a>
      <h1>${editing ? A.works.form.editTitle : A.works.form.newTitle}</h1>
    </section>
    <section class="section admin-section">
      <form class="admin-form" data-work-form data-id="${editing ? work.id : ''}" novalidate>
        <div class="field-row">
          <div class="field">
            <label for="w-title-it">${A.works.form.titleIt}</label>
            <input id="w-title-it" name="titleIt" type="text" value="${value.title.it}" aria-describedby="titleIt-error">
            ${errorSlot('titleIt')}
          </div>
          <div class="field">
            <label for="w-title-en">${A.works.form.titleEn} (${A.common.optional})</label>
            <input id="w-title-en" name="titleEn" type="text" value="${value.title.en ?? ''}">
          </div>
        </div>
        <div class="field">
          <label for="w-summary-it">${A.works.form.summaryIt}</label>
          <textarea id="w-summary-it" name="summaryIt" rows="3" aria-describedby="summaryIt-error">${value.summary.it}</textarea>
          ${errorSlot('summaryIt')}
        </div>
        <div class="field">
          <label for="w-summary-en">${A.works.form.summaryEn} (${A.common.optional})</label>
          <textarea id="w-summary-en" name="summaryEn" rows="3">${value.summary.en ?? ''}</textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="w-material">${A.works.form.material}</label>
            <select id="w-material" name="materialId" aria-describedby="materialId-error">
              <option value="" ${value.materialId ? '' : 'selected'}>${A.works.form.pickMaterial}</option>
              ${materials.map((material) => html`<option value="${material.id}" ${material.id === value.materialId ? 'selected' : ''}>${materialLabel(material)}</option>`)}
            </select>
            ${errorSlot('materialId')}
          </div>
          <div class="field">
            <label for="w-grams">${A.works.form.grams}</label>
            <input id="w-grams" name="estimatedG" type="number" min="1" max="20000" step="1" inputmode="numeric" value="${value.estimatedG}" aria-describedby="estimatedG-error">
            ${errorSlot('estimatedG')}
          </div>
        </div>
        <fieldset class="field admin-dims">
          <legend>${A.works.form.size}</legend>
          <div class="admin-dims-row">
            <label>${A.works.form.width}<input name="dimW" type="number" min="1" max="2000" inputmode="numeric" value="${dimW}"></label>
            <label>${A.works.form.depth}<input name="dimD" type="number" min="1" max="2000" inputmode="numeric" value="${dimD}"></label>
            <label>${A.works.form.height}<input name="dimH" type="number" min="1" max="2000" inputmode="numeric" value="${dimH}"></label>
          </div>
          ${errorSlot('dimensions')}
        </fieldset>
        <div class="field">
          <label for="w-date">${A.works.form.date}</label>
          <input id="w-date" name="date" type="date" value="${value.date}" aria-describedby="date-error">
          ${errorSlot('date')}
        </div>

        <fieldset class="field admin-shape">
          <legend>${A.works.form.shape}</legend>
          <select name="kind" aria-label="${A.works.form.shape}" data-shape-kind aria-describedby="kind-error">
            ${Object.keys(SHAPES).map((key) => html`<option value="${key}" ${key === kind ? 'selected' : ''}>${A.works.form.shapes[key]}</option>`)}
          </select>
          ${errorSlot('kind')}
          <p class="field-hint">${A.works.form.shapeHint}</p>
          ${Object.keys(SHAPES).map((key) => html`<div class="admin-shape-fields" data-shape-fields="${key}" ${key === kind ? '' : 'hidden'}>${shapeFields(key, value.shape)}</div>`)}
        </fieldset>

        <div class="field">
          <label for="w-photo">${A.works.form.photo} (${A.common.optional})</label>
          ${editing && work.photo ? html`<img class="admin-photo" src="/${work.photo}" alt="" data-photo-current>` : ''}
          <div data-photo-preview hidden></div>
          <input id="w-photo" name="photo" type="file" accept="image/*" aria-describedby="w-photo-hint photo-error">
          <p class="field-hint" id="w-photo-hint">${A.works.form.photoHint}</p>
          ${errorSlot('photo')}
          ${editing && work.photo ? html`<label class="check"><input type="checkbox" name="removePhoto"><span>${A.works.form.photoRemove}</span></label>` : ''}
        </div>
        <label class="check"><input type="checkbox" name="visible" ${value.visible === false ? '' : 'checked'}><span>${A.works.form.visible}</span></label>

        <div class="form-actions form-actions-row">
          <button class="btn btn-primary" type="submit" data-submit>${A.common.save}</button>
          <a class="btn btn-ghost" href="/admin/works">${A.common.cancel}</a>
          ${editing ? html`<button class="btn btn-ghost" type="button" data-delete>${A.common.delete}</button>` : ''}
        </div>
      </form>
    </section>`;
}

/* ---------- Bobine ---------- */

const when = (iso) => new Date(iso).toLocaleString('it', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function stockView({ materials, spools, works, log, pickedSpool }) {
  const byId = new Map(materials.map((material) => [material.id, material]));
  const spoolText = (spool) => `${A.stock.list.spool.replace('{n}', spoolNumber(spool))}`;
  const spoolOption = (spool) => {
    const material = byId.get(spool.materialId);
    return html`<option value="${spool.id}" ${spool.id === pickedSpool ? 'selected' : ''}>${material ? materialLabel(material) : spool.materialId} · ${spoolText(spool)} — ${grams(spool.remainingG)}${inUse(spool) ? '' : ` (${A.stock.list.finished})`}</option>`;
  };
  return html`
    <section class="page-head">
      <h1>${A.stock.title}</h1>
      <p class="lead">${A.stock.lead}</p>
    </section>

    <section class="section admin-section admin-split">
      <form class="admin-form" data-printed-form novalidate>
        <h2>${A.stock.printed.title}</h2>
        <p class="muted">${A.stock.printed.lead}</p>
        ${works.length === 0 ? html`<p class="muted">${A.stock.printed.none}</p>` : html`
          <div class="field">
            <label for="p-work">${A.stock.printed.work}</label>
            <select id="p-work" name="workId" aria-describedby="workId-error">
              ${works.map((work) => html`<option value="${work.id}" data-grams="${work.estimatedG}" data-material="${work.materialId}">${work.title.it}</option>`)}
            </select>
            ${errorSlot('workId')}
          </div>
          <div class="field">
            <label for="p-copies">${A.stock.printed.copies}</label>
            <input id="p-copies" name="copies" type="number" min="1" max="100" step="1" value="1" inputmode="numeric">
          </div>
          <p class="admin-fixed" data-printed-preview aria-live="polite"></p>
          <div class="form-actions"><button class="btn btn-primary" type="submit" data-submit>${A.stock.printed.submit}</button></div>`}
      </form>

      <form class="admin-form" data-used-form novalidate>
        <h2>${A.stock.used.title}</h2>
        <p class="muted">${A.stock.used.lead}</p>
        ${materials.length === 0 ? html`<p class="muted">${A.stock.used.none}</p>` : html`
          <div class="field">
            <label for="u-material">${A.stock.used.material}</label>
            <select id="u-material" name="materialId" aria-describedby="materialId-error">
              ${materials.map((material) => html`<option value="${material.id}" data-stock="${filamentStats(material, spools).stockG}">${materialLabel(material)} — ${grams(filamentStats(material, spools).stockG)}</option>`)}
            </select>
            ${errorSlot('materialId')}
          </div>
          <div class="field">
            <label for="u-grams">${A.stock.used.grams}</label>
            <input id="u-grams" name="grams" type="number" min="1" max="100000" step="1" inputmode="numeric" aria-describedby="grams-error">
            ${errorSlot('grams')}
          </div>
          <div class="field">
            <label for="u-reason">${A.stock.used.reason} (${A.common.optional})</label>
            <input id="u-reason" name="reason" type="text" maxlength="120" aria-describedby="u-reason-hint">
            <p class="field-hint" id="u-reason-hint">${A.stock.used.reasonHint}</p>
          </div>
          <p class="admin-fixed" data-used-preview aria-live="polite"></p>
          <div class="form-actions"><button class="btn btn-primary" type="submit" data-submit>${A.stock.used.submit}</button></div>`}
      </form>

      <form class="admin-form" data-add-spool-form novalidate>
        <h2>${A.stock.add.title}</h2>
        ${materials.length === 0 ? html`<p class="muted">${A.stock.add.none}</p>` : html`
          <div class="field">
            <label for="a-material">${A.stock.add.material}</label>
            <select id="a-material" name="materialId" aria-describedby="materialId-error">
              ${materials.map((material) => html`<option value="${material.id}" data-spool="${material.spoolG}">${materialLabel(material)}</option>`)}
            </select>
            ${errorSlot('materialId')}
          </div>
          <div class="field-row">
            <div class="field">
              <label for="a-net">${A.stock.add.net}</label>
              <input id="a-net" name="netG" type="number" min="1" max="20000" step="1" inputmode="numeric" value="${materials[0].spoolG}" aria-describedby="netG-error">
              ${errorSlot('netG')}
            </div>
            <div class="field">
              <label for="a-left">${A.stock.add.left} (${A.common.optional})</label>
              <input id="a-left" name="remainingG" type="number" min="0" max="20000" step="1" inputmode="numeric" aria-describedby="a-left-hint remainingG-error">
              <p class="field-hint" id="a-left-hint">${A.stock.add.leftHint}</p>
              ${errorSlot('remainingG')}
            </div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit" data-submit>${A.stock.add.submit}</button></div>`}
      </form>
    </section>

    <section class="section admin-section">
      <h2>${A.stock.list.title}</h2>
      ${materials.map((material) => {
        const own = spools.filter((spool) => spool.materialId === material.id);
        const stats = filamentStats(material, spools);
        return html`<div class="spool-group" data-hex="${safeHex(material.hex)}">
          <div class="spool-group-head">
            <span class="swatch" data-hex="${safeHex(material.hex)}" aria-hidden="true"></span>
            <b>${materialLabel(material)}</b>
            <span class="muted">${grams(stats.stockG)} · ${spoolsInUse(stats.active)}</span>
          </div>
          ${own.length === 0 ? html`<p class="muted spool-none">${A.stock.list.none}</p>` : html`
            <ul class="admin-rows">
              ${own.map((spool) => html`<li class="admin-row ${inUse(spool) ? '' : 'is-finished'}" data-hex="${safeHex(material.hex)}">
                <span class="admin-status ${inUse(spool) ? 'is-printing' : 'is-closed'}">${inUse(spool) ? A.stock.list.inUse : A.stock.list.finished}</span>
                <span class="admin-row-main"><b>${spoolText(spool)}</b><span class="muted">${grams(spool.remainingG)} / ${grams(spool.netG)} · ${spool.addedAt}</span></span>
                ${stockGauge({ remaining: Math.min(1, spool.remainingG / Math.max(1, spool.netG)), after: Math.min(1, spool.remainingG / Math.max(1, spool.netG)) })}
                <span class="admin-row-actions">
                  <button class="btn btn-ghost btn-small" type="button" data-pick="${spool.id}">${A.stock.list.adjust}</button>
                  <button class="btn btn-ghost btn-small" type="button" data-spool-status="${spool.id}" data-to="${inUse(spool) ? 'finished' : 'active'}">${inUse(spool) ? A.stock.list.finish : A.stock.list.reopen}</button>
                  <button class="btn btn-ghost btn-small" type="button" data-spool-delete="${spool.id}">${A.stock.list.delete}</button>
                </span>
              </li>`)}
            </ul>`}
        </div>`;
      })}
    </section>

    <section class="section admin-section">
      <form class="admin-form" data-move-form novalidate>
        <h2>${A.stock.move.title}</h2>
        ${spools.length === 0 ? html`<p class="muted">${A.stock.list.none}</p>` : html`
          <div class="field">
            <label for="mv-spool">${A.stock.move.spool}</label>
            <select id="mv-spool" name="spoolId" aria-describedby="spoolId-error">${spools.map(spoolOption)}</select>
            ${errorSlot('spoolId')}
          </div>
          <div class="field">
            <label for="mv-mode">${A.stock.move.mode}</label>
            <select id="mv-mode" name="mode" aria-describedby="mode-error">
              ${Object.entries(A.stock.move.modes).map(([key, label]) => html`<option value="${key}">${label}</option>`)}
            </select>
            ${errorSlot('mode')}
          </div>
          <div class="field">
            <label for="mv-grams">${A.stock.move.grams}</label>
            <input id="mv-grams" name="grams" type="number" min="0" max="100000" step="1" inputmode="numeric" aria-describedby="grams-error">
            ${errorSlot('grams')}
          </div>
          <div class="field">
            <label for="mv-reason">${A.stock.move.reason} (${A.common.optional})</label>
            <input id="mv-reason" name="reason" type="text" maxlength="120" aria-describedby="mv-reason-hint">
            <p class="field-hint" id="mv-reason-hint">${A.stock.move.reasonHint}</p>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit" data-submit>${A.stock.move.submit}</button></div>`}
      </form>
    </section>

    <section class="section admin-section">
      <h2>${A.stock.log.title}</h2>
      ${log.length === 0 ? html`<p class="muted">${A.stock.log.empty}</p>` : html`
        <ul class="admin-log">
          ${log.slice(0, 20).map((entry) => {
            const material = byId.get(entry.materialId);
            return html`<li>
              <span class="muted">${when(entry.at)}</span>
              <b>${material ? materialLabel(material) : entry.materialId}${entry.spoolId ? ` · ${A.stock.list.spool.replace('{n}', entry.spoolId.split('-').pop())}` : ''}</b>
              <span>${grams(entry.before)} → ${grams(entry.after)}</span>
              ${entry.reason ? html`<span class="muted">${entry.reason}</span>` : ''}
            </li>`;
          })}
        </ul>`}
    </section>`;
}
