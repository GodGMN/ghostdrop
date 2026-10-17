import { open } from 'node:fs/promises';

export const lifetimes = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 30 * 86_400_000,
};
export async function detectType(path, name) {
  const file = await open(path, 'r');
  const buffer = Buffer.alloc(16);
  try {
    await file.read(buffer, 0, 16, 0);
  } finally {
    await file.close();
  }
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return 'image/gif';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  if (/\.(txt|md|csv|log|json)$/i.test(name)) return 'text/plain';
  return 'application/octet-stream';
}
