import { dispatchTelegramOutbox } from '../../_lib/telegram.js';
import { handleError, methodNotAllowed, sendJson } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    await requireAdmin(req);
    const deliveries = await dispatchTelegramOutbox(50);
    return sendJson(res, 200, {
      delivered: deliveries.filter((delivery) => delivery.sent).length,
      failed: deliveries.filter((delivery) => !delivery.sent).length,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
