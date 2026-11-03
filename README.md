# ហត្ថកម្មខ្មែរ — Khmer Artisan Shop

A Khmer-English artisan marketplace built with React, Vite, React Router, Tailwind CSS, Lucide, Vercel serverless functions, and Supabase. The shop features Khmer-inspired wood and gold styling, Cambodian artisan stories, product discovery, and a server-backed checkout.

## Features

- Responsive home, catalog, product detail, artisan, about, contact, login, payment return, and admin pages
- Search, category/material/province/price filters, product quick views, favorites, and a persisted cart
- Supabase-backed catalog, customer profiles, stock-aware order creation, transactions, and admin data with row-level security
- Telegram Login Widget authentication verified by the server; customer and admin roles
- ABA PayWay and Bakong KHQR checkout through khqrpay, with idempotency keys, hosted payment redirect, server-side status checks, and signed webhooks
- Telegram customer/admin order notifications through a retryable database outbox
- Admin product/order management, analytics, and signed Cloudinary image uploads
- Vercel serverless API routes and SPA routing

## Local development

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

The app can run without credentials in storefront preview mode using its sample catalog. Authentication, persistent catalog data, admin tools, and checkout require the services below. Client-side environment variables must use the `VITE_` prefix; keep all secrets server-side.

## Supabase setup

1. Create a Supabase project.
2. Apply [`supabase/migrations/20261019000100_store.sql`](./supabase/migrations/20261019000100_store.sql) using the Supabase SQL Editor or Supabase CLI.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never use the `VITE_` prefix.
4. In Supabase Auth, allow the deployed site and local development URL as redirect URLs.
5. To grant the first administrator, sign in using Telegram, find the profile in `public.profiles`, and set its `role` to `admin` from the Supabase SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin', updated_at = now()
   where telegram_id = '<trusted-telegram-user-id>';
   ```

   Only grant this role to a Telegram account you control. The app never lets a browser assign its own role.

## Telegram setup

1. Create a bot with BotFather and configure the domain used by the deployed app in the Telegram Login Widget settings.
2. Set `VITE_TELEGRAM_BOT_USERNAME` to the bot username without `@`, and set the server-only `TELEGRAM_BOT_TOKEN`.
3. Set `TELEGRAM_ADMIN_GROUP_ID` to the admin group/channel chat ID and add the bot with permission to send messages.
4. Telegram authentication is verified server-side using the Login Widget hash and a five-minute authentication age limit. The resulting Supabase session is issued using a one-time magic-link token.

Order notifications are stored in `public.telegram_outbox`. Failed messages remain retryable from the admin dashboard after Telegram is configured.

## khqrpay and checkout

Create an ABA or Bakong API key in the [khqrpay dashboard](https://khqrpay.site/dashboard). Set the API key's webhook secret there, then set the matching `KHQRPAY_API_KEY`, `KHQRPAY_WEBHOOK_SECRET`, and `PUBLIC_BASE_URL` in your deployment. The integration uses `https://khqrpay.site/api/v1` by default; `KHQRPAY_BASE_URL` may only point to that HTTPS host.

- ABA PayWay: `POST /api/v1/aba/create`
- Bakong KHQR: `POST /api/v1/bakong/create`
- Server status check: `GET /api/v1/payment?id={id}`
- Send webhook callbacks to `https://<your-domain>/api/v1/webhooks`; the callback URL is sent when creating each payment and the signing secret is configured on the khqrpay API key.

Webhook signatures are verified against the exact raw request body using HMAC-SHA256 from `X-Webhook-Signature`. Payment state is only changed by the signed webhook or a server-to-server khqrpay status check. Underpaid callbacks are not credited automatically and require manual review. The hosted checkout redirect is not treated as proof of payment. The database RPC checks amount and currency, locks the transaction/order, and prevents duplicate stock restoration on terminal events.

Cash on Delivery does not need khqrpay credentials. Online payment methods stay unavailable until the necessary server environment variables are configured. Use the [khqrpay test page](https://khqrpay.site/try) to test your API key; never commit live keys.

## Cloudinary setup

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the server. The admin API creates short-lived signed upload parameters; uploads go directly from the admin browser to Cloudinary, and only resulting asset URLs are stored in Supabase. The API secret is never exposed to the client.

## Environment variables

Use [`.env.example`](./.env.example) as the complete template:

- Browser-safe: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT_USERNAME`
- Server-only: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `KHQRPAY_API_KEY`, `KHQRPAY_WEBHOOK_SECRET`, `KHQRPAY_BASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_GROUP_ID`, `PUBLIC_BASE_URL`

Configure the same variables in Vercel Project Settings. Set `PUBLIC_BASE_URL` to the canonical HTTPS origin without a trailing slash.

## Deployment

1. Push the repository to GitHub and import it into Vercel.
2. Use the Vite preset, `npm run build`, and `dist` as the output directory.
3. Add the environment variables, apply the Supabase migration, configure the Telegram domain and khqrpay webhook URL, then deploy.
4. Test Telegram login, COD, ABA/Bakong payments using the khqrpay test page, webhook retries, and admin uploads before switching to production credentials.

[`vercel.json`](./vercel.json) rewrites application paths to the SPA entry point. Vercel's filesystem API routes under `api/` remain available as serverless functions.

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

Product photography and Google Fonts load from external services and require an internet connection.
