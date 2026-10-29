// Base64 per testo UTF-8 (accenti inclusi) e per byte grezzi. btoa/atob da soli rompono sugli accenti.

export function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(text) {
  const binary = atob(String(text).replace(/\s/g, ''));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Il contenuto di un File del browser in base64 (senza il prefisso "data:"). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function textToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function base64ToText(base64) {
  return new TextDecoder().decode(base64ToBytes(base64));
}
