import { createHttpError, handleError, sendJson } from './_lib/http.js';
import adminOtpRequest from './_lib/routes/admin-otp-request.js';
import adminOtpVerify from './_lib/routes/admin-otp-verify.js';
import adminOrderById from './_lib/routes/admin-order-by-id.js';
import adminOverview from './_lib/routes/admin-overview.js';
import adminProductById from './_lib/routes/admin-product-by-id.js';
import adminProducts from './_lib/routes/admin-products.js';
import adminSession from './_lib/routes/admin-session.js';
import adminNotificationsRetry from './_lib/routes/admin-notifications-retry.js';
import authTelegram from './_lib/routes/auth-telegram.js';
import checkoutCreate from './_lib/routes/checkout-create.js';
import cloudinarySign from './_lib/routes/cloudinary-sign.js';
import paymentStatus from './_lib/routes/payment-status.js';
import productById from './_lib/routes/product-by-id.js';
import products from './_lib/routes/products.js';
import webhooks from './_lib/routes/webhooks.js';

export const config = { api: { bodyParser: false } };

const routes = [
  { pattern: /^\/products$/, handler: products },
  { pattern: /^\/products\/([^/]+)$/, handler: productById, param: 'id' },
  { pattern: /^\/auth\/telegram$/, handler: authTelegram },
  { pattern: /^\/auth\/admin-otp\/request$/, handler: adminOtpRequest },
  { pattern: /^\/auth\/admin-otp\/verify$/, handler: adminOtpVerify },
  { pattern: /^\/checkout\/create$/, handler: checkoutCreate },
  { pattern: /^\/payments\/status$/, handler: paymentStatus },
  { pattern: /^\/admin\/session$/, handler: adminSession },
  { pattern: /^\/admin\/overview$/, handler: adminOverview },
  { pattern: /^\/admin\/products$/, handler: adminProducts },
  { pattern: /^\/admin\/products\/([^/]+)$/, handler: adminProductById, param: 'id' },
  { pattern: /^\/admin\/orders\/([^/]+)$/, handler: adminOrderById, param: 'id' },
  { pattern: /^\/admin\/notifications\/retry$/, handler: adminNotificationsRetry },
  { pattern: /^\/cloudinary\/sign$/, handler: cloudinarySign },
  { pattern: /^\/v1\/webhooks$/, handler: webhooks, rawBody: true },
];

const MAX_BODY_SIZE = 4 * 1024 * 1024;

async function parseJsonBody(req) {
  if (req.body !== undefined) return req.body;

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) throw createHttpError(413, 'Request payload exceeds the allowed size.');
    chunks.push(chunk);
  }

  if (!size) return undefined;
  const rawBody = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function getQuery(searchParams) {
  const query = {};
  for (const [key, value] of searchParams) {
    if (Object.hasOwn(query, key)) {
      query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value];
    } else {
      query[key] = value;
    }
  }
  return query;
}

export default async function handler(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
    const apiPath = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    const route = routes.find(({ pattern }) => pattern.test(apiPath));
    if (!route) return sendJson(res, 404, { error: 'API route not found.' });

    let match;
    try {
      match = route.pattern.exec(apiPath);
      if (match?.[1]) match[1] = decodeURIComponent(match[1]);
    } catch {
      throw createHttpError(400, 'Invalid URL path.');
    }

    req.query = getQuery(url.searchParams);
    if (route.param && match?.[1]) req.query[route.param] = match[1];
    if (!route.rawBody) req.body = await parseJsonBody(req);
    return await route.handler(req, res);
  } catch (error) {
    return handleError(res, error);
  }
}
