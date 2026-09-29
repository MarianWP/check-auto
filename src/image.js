/* Фото в браузері: одне декодування, JPEG потрібного розміру. Спільне для адмінки (фото до проблем) і чату помічника. */
export async function decodeImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Це не зображення");
  return createImageBitmap(file);
}
/* JPEG у масштабі k (1 — оригінальний розмір). */
export function toJpeg(bmp, k, quality) {
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
}
export const blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const fit = (bmp, max) => Math.min(1, max / Math.max(bmp.width, bmp.height));

/* Фото для помічника: довша сторона до 1280 px (ШІ цього досить, щоб роздивитися деталі) — кількасот КБ замість мегабайтів,
   і мініатюра 240 px для стрічки чату. */
export async function chatPhoto(file) {
  const bmp = await decodeImage(file);
  try {
    const big = await toJpeg(bmp, fit(bmp, 1280), 0.82), small = await toJpeg(bmp, fit(bmp, 240), 0.7);
    if (!big || !small) throw new Error("Не вдалося підготувати фото");
    return { image: await blobToDataUrl(big), thumb: await blobToDataUrl(small) };
  } finally { if (bmp.close) bmp.close(); }
}
