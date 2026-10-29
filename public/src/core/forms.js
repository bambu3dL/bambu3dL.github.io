// Aiuti per i moduli dell'area riservata: lettura dei valori e messaggi di errore per campo.

/** Tutti i campi di un modulo come oggetto semplice. Le caselle spuntate valgono true, quelle libere false. */
export function formValues(form) {
  const values = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === 'string') values[key] = value;
  });
  form.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    values[box.name] = box.checked;
  });
  return values;
}

export function clearFieldErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((node) => {
    node.hidden = true;
    node.textContent = '';
  });
  form.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
}

/** `errors` è { campo: codice }; `messages` traduce i codici. Porta il focus sul primo campo sbagliato. */
export function showFieldErrors(form, errors, messages) {
  let first = null;
  Object.entries(errors).forEach(([name, code]) => {
    const slot = form.querySelector(`[data-error-for="${name}"]`);
    if (slot) {
      slot.textContent = messages[code] ?? messages.required;
      slot.hidden = false;
    }
    const input = form.elements[name] ?? form.querySelector(`[name="${name}"]`);
    if (input?.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      first ??= input;
    }
  });
  first?.focus();
}
