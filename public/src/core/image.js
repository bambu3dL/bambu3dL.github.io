import { bytesToBase64 } from './base64.js';

/**
 * Riduce una foto a un JPEG con il lato lungo al massimo `maxSide` pixel e lo restituisce in base64,
 * pronta da caricare nel repository. Lancia se il file non è un'immagine leggibile.
 */
export async function resizeToJpeg(file, { maxSide = 1600, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; // i PNG trasparenti diventano JPEG su fondo bianco
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('jpeg'))), 'image/jpeg', quality);
    });
    return { base64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())), width, height, bytes: blob.size };
  } finally {
    bitmap.close?.();
  }
}
