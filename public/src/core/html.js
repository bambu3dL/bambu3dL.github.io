// Template tag con escape automatico: ogni valore interpolato è testo, tranne ciò che passa da raw()
// o da un altro html``. È l'unico punto in cui il sito costruisce markup, quindi l'unico da verificare per l'XSS.

const RAW = Symbol('raw-html');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"'`]/g, (char) => ESCAPES[char]);
}

export function raw(value) {
  return { [RAW]: true, value: String(value) };
}

function stringify(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(stringify).join('');
  if (typeof value === 'object' && value[RAW]) return value.value;
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += stringify(values[i]) + strings[i + 1];
  return raw(out);
}

export function render(target, template) {
  target.innerHTML = template[RAW] ? template.value : escapeHtml(template);
}

// Un hex arriva dai dati: lo accettiamo solo se ha la forma attesa, perché finisce negli attributi SVG.
export function safeHex(value, fallback = '#888888') {
  return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : fallback;
}
