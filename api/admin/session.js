import { handleError, methodNotAllowed, sendJson } from '../_lib/http.js';
import { requireAdmin as requireAdminSession } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const { profile } = await requireAdminSession(req);
    return sendJson(res, 200, { admin: true, displayName: profile.display_name });
  } catch (error) {
    return handleError(res, error);
  }
}
