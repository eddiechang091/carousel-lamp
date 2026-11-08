import { translate } from '@/i18n';
export const PHOTO_COUNT = 16;
export type Crop = { zoom: number; x: number; y: number };
export const initialCrop: Crop = { zoom: 1, x: 0, y: 0 };
export function cropRect(width: number, height: number, crop: Crop) {
  const scale =
    Math.max(440 / width, 520 / height) * Math.max(1, Math.min(3, crop.zoom));
  const w = 440 / scale,
    h = 520 / scale;
  const x = ((width - w) * (Math.max(-1, Math.min(1, crop.x)) + 1)) / 2;
  const y = ((height - h) * (Math.max(-1, Math.min(1, crop.y)) + 1)) / 2;
  return { x, y, w, h };
}
export function drawCrop(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  crop: Crop,
) {
  canvas.width = 440;
  canvas.height = 520;
  const c = canvas.getContext('2d');
  if (!c) throw new Error(translate('error.previewFailed'));
  const r = cropRect(img.naturalWidth, img.naturalHeight, crop);
  c.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, 440, 520);
}
export function loadPhoto(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(translate('error.decodeFailed')));
    image.src = src;
  });
}

// Handwriting-style font stack for the mood caption on the polaroid border.
export const HAND_FONT = "'Caveat','KaiTi','STKaiti','楷体','Segoe Script',cursive";

export function wrapCaption(
  c: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(current); current = ''; continue; }
    const test = current + ch;
    if (c.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else current = test;
  }
  if (current) lines.push(current);
  return lines;
}

export function drawCaption(
  c: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  scale = 1,
) {
  const minSize = 18 * scale;
  let size = 34 * scale;
  let lines: string[] = [];
  do {
    c.font = `${size}px ${HAND_FONT}`;
    lines = wrapCaption(c, text, maxWidth);
    if (lines.length <= 2 || size <= minSize) break;
    size -= 2 * scale;
  } while (size > minSize);
  const lineHeight = size * 1.02;
  let y = cy - (lineHeight * (lines.length - 1)) / 2;
  for (const line of lines) {
    c.fillText(line, cx, y);
    y += lineHeight;
  }
}

// Composites the current polaroid (photo + white border + handwriting caption)
// into a high-resolution PNG data URL, using the original image and crop.
export async function renderPolaroidExport(opts: {
  image?: HTMLImageElement;
  crop: Crop;
  index: number;
  caption: string;
}): Promise<string> {
  try { await document.fonts.load(`34px ${HAND_FONT}`); } catch { /* fallback font */ }
  const scale = 3;
  const W = 512 * scale,
    H = 640 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) throw new Error(translate('error.previewFailed'));
  c.fillStyle = '#fff9ed';
  c.fillRect(0, 0, W, H);
  const px = 36 * scale,
    py = 30 * scale,
    pw = 440 * scale,
    ph = 520 * scale;
  if (opts.image) {
    c.save();
    c.beginPath();
    c.rect(px, py, pw, ph);
    c.clip();
    const r = cropRect(opts.image.naturalWidth, opts.image.naturalHeight, opts.crop);
    c.drawImage(opts.image, r.x, r.y, r.w, r.h, px, py, pw, ph);
    c.restore();
  } else {
    c.fillStyle = '#e7dfd2';
    c.fillRect(px, py, pw, ph);
  }
  c.fillStyle = '#fff9ed';
  c.fillRect(0, 550 * scale, W, 90 * scale);
  c.textBaseline = 'middle';
  c.fillStyle = '#b6a084';
  c.font = `${18 * scale}px sans-serif`;
  c.textAlign = 'left';
  c.fillText(String(opts.index + 1).padStart(2, '0'), 22 * scale, 596 * scale);
  const text = opts.caption.trim();
  if (text) {
    c.fillStyle = '#463c33';
    c.textAlign = 'center';
    drawCaption(c, text, 262 * scale, 598 * scale, 404 * scale, scale);
  } else {
    c.fillStyle = '#856d5a';
    c.font = `${22 * scale}px sans-serif`;
    c.textAlign = 'center';
    c.fillText('dear memory', 262 * scale, 598 * scale);
  }
  return canvas.toDataURL('image/png');
}
