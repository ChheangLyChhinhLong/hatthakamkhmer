export function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return sendJson(res, 405, { error: 'Method not allowed.' });
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

export function getBearerToken(req) {
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(.+)$/i.exec(header) : null;
  return match?.[1] || null;
}

export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    const error = new Error(`Server configuration is missing: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }
}

export function handleError(res, error) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (statusCode >= 500) console.error('API request failed:', error.message);
  return sendJson(res, statusCode, {
    error: statusCode >= 500 ? 'The request could not be completed. Check server configuration and logs.' : error.message,
    ...(error.code ? { code: error.code } : {}),
  });
}

export function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

export function requireMethod(req, res, method) {
  if (req.method === method) return true;
  methodNotAllowed(res, [method]);
  return false;
}
