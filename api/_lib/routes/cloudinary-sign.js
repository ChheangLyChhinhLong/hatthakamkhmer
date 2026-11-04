import { createHash } from 'node:crypto';
import { handleError, methodNotAllowed, requireEnv, sendJson } from '../http.js';
import { requireAdmin } from '../supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    await requireAdmin(req);
    requireEnv(['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'hatthakam-products';
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
      .digest('hex');
    return sendJson(res, 200, {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      signature,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
