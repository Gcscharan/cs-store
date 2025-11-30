// backend/src/utils/imageUtils.ts
import sharp from 'sharp';

export async function bufferToBase64DataUrl(buffer: Buffer, mime = 'image/jpeg') {
  const b64 = buffer.toString('base64');
  return `data:${mime};base64,${b64}`;
}

export async function createResizedBase64(buffer: Buffer, maxWidth: number, quality = 80) {
  const img = sharp(buffer).rotate();
  const metadata = await img.metadata();
  const resized = metadata.width && metadata.width > maxWidth ? img.resize({ width: maxWidth }) : img;
  const output = await resized.jpeg({ quality, mozjpeg: true }).toBuffer();
  return bufferToBase64DataUrl(output, 'image/jpeg');
}

export async function generateFullAndThumbFromBuffer(buffer: Buffer) {
  const full = await createResizedBase64(buffer, 1200, 80);
  const thumb = await createResizedBase64(buffer, 220, 70);
  return { full, thumb };
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.split(',')[1] ?? dataUrl;
  return Buffer.from(base64, 'base64');
}
