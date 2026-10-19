create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_id text unique,
  telegram_username text,
  display_name text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name_km text not null,
  name_en text not null,
  description_km text not null default '',
  category text not null,
  material text not null,
  province text not null,
  price_usd numeric(10,2) not null check (price_usd > 0),
  compare_at_usd numeric(10,2) check (compare_at_usd is null or compare_at_usd > price_usd),
  rating numeric(2,1) not null default 5 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  badge text not null default '',
  image_url text not null,
  gallery text[] not null default '{}',
  artisan_km text not null default '',
  artisan_province text not null default '',
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  checkout_key text not null,
  customer_name text not null,
  phone text not null,
  address text not null,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal_usd numeric(10,2) not null check (subtotal_usd >= 0),
  shipping_usd numeric(10,2) not null check (shipping_usd >= 0),
  total_usd numeric(10,2) not null check (total_usd = subtotal_usd + shipping_usd),
  currency text not null default 'USD' check (currency = 'USD'),
  payment_method text not null check (payment_method in ('aba', 'bakong', 'cod')),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'pending_cod', 'paid', 'processing', 'shipped', 'delivered', 'expired', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create unique index if not exists orders_user_checkout_key_idx on public.orders(user_id, checkout_key);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  gateway text not null check (gateway in ('aba', 'bakong')),
  provider_transaction_id text not null unique,
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'failed')),
  payment_url text not null,
  qr text,
  md5 text,
  expires_at timestamptz,
  provider_response jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  provider_event text not null,
  provider_transaction_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists public.telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  chat_id text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  lock_until timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists transactions_order_idx on public.transactions(order_id, created_at desc);
create unique index if not exists transactions_one_per_order_idx on public.transactions(order_id);
create index if not exists products_active_category_idx on public.products(is_active, category, created_at desc);
create index if not exists telegram_outbox_pending_idx on public.telegram_outbox(status, created_at) where status <> 'sent';

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, telegram_id, telegram_username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'telegram_id',
    new.raw_user_meta_data ->> 'telegram_username',
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.transactions enable row level security;
alter table public.webhook_events enable row level security;
alter table public.telegram_outbox enable row level security;

drop policy if exists "Customers can view their profile" on public.profiles;
create policy "Customers can view their profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_store_admin());

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products" on public.products
  for select to anon, authenticated using (is_active or public.is_store_admin());

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
  for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists "Customers view their orders" on public.orders;
create policy "Customers view their orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or public.is_store_admin());

drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders
  for update to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists "Customers view their transactions" on public.transactions;
create policy "Customers view their transactions" on public.transactions
  for select to authenticated using (
    exists (select 1 from public.orders where orders.id = transactions.order_id and orders.user_id = (select auth.uid()))
    or public.is_store_admin()
  );

drop policy if exists "Admins view webhook events" on public.webhook_events;
create policy "Admins view webhook events" on public.webhook_events
  for select to authenticated using (public.is_store_admin());

drop policy if exists "Admins view notification delivery" on public.telegram_outbox;
create policy "Admins view notification delivery" on public.telegram_outbox
  for select to authenticated using (public.is_store_admin());

create or replace function public.apply_khpay_event(
  p_transaction_id text,
  p_amount numeric,
  p_currency text,
  p_status text,
  p_event text,
  p_payload jsonb,
  p_dedupe_key text,
  p_admin_chat_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_new_status text;
  v_changed boolean := false;
begin
  select * into v_tx from public.transactions
  where provider_transaction_id = p_transaction_id
  for update;

  if not found then
    return jsonb_build_object('processed', false, 'reason', 'unknown_transaction');
  end if;

  select * into v_order from public.orders where id = v_tx.order_id for update;
  if not found then
    return jsonb_build_object('processed', false, 'reason', 'unknown_order');
  end if;

  if upper(coalesce(p_currency, '')) <> 'USD'
    or p_amount is null
    or p_amount <> v_tx.amount_usd
    or p_amount <> v_order.total_usd then
    raise exception 'KHPay event amount or currency does not match the order';
  end if;

  v_new_status := case
    when p_event = 'payment.paid' then 'paid'
    when p_event = 'payment.expired' then 'expired'
    when p_event = 'payment.failed' then 'failed'
    else null
  end;

  if v_new_status is null or lower(coalesce(p_status, v_new_status)) <> v_new_status then
    raise exception 'Unsupported or inconsistent KHPay event status';
  end if;

  if v_order.status = 'cancelled' and v_new_status = 'paid' then
    raise exception 'A payment was received for a cancelled order; manual reconciliation is required';
  end if;

  insert into public.webhook_events (dedupe_key, provider_event, provider_transaction_id, payload)
  values (p_dedupe_key, p_event, p_transaction_id, p_payload)
  on conflict (dedupe_key) do nothing;

  if v_order.status <> 'paid' and v_order.status not in ('cancelled', 'pending_cod')
    and v_tx.status = 'pending' then
    update public.transactions
      set status = v_new_status, provider_response = p_payload, updated_at = now(),
          paid_at = case when v_new_status = 'paid' then now() else paid_at end
      where id = v_tx.id;
    update public.orders
      set status = v_new_status, updated_at = now(),
          paid_at = case when v_new_status = 'paid' then now() else paid_at end
      where id = v_order.id;
    if v_new_status in ('expired', 'failed') then
      for v_item in select value from jsonb_array_elements(v_order.items)
      loop
        update public.products set stock = stock + (v_item ->> 'quantity')::integer, updated_at = now()
        where id = v_item ->> 'id';
      end loop;
    end if;
    v_changed := true;

    if v_new_status = 'paid' then
      insert into public.telegram_outbox (dedupe_key, chat_id, message)
      select 'order-paid:user:' || v_order.id::text, p.telegram_id,
        'អរគុណ ' || v_order.customer_name || '! ការទូទាត់សម្រាប់ការបញ្ជាទិញ #' ||
        left(v_order.id::text, 8) || ' បានជោគជ័យ — $' || to_char(v_order.total_usd, 'FM999999990.00') || ' USD។'
      from public.profiles p where p.id = v_order.user_id and p.telegram_id is not null
      on conflict (dedupe_key) do nothing;

      if nullif(trim(p_admin_chat_id), '') is not null then
        insert into public.telegram_outbox (dedupe_key, chat_id, message)
        values (
          'order-paid:admin:' || v_order.id::text,
          p_admin_chat_id,
          'ទទួលបានការទូទាត់ជោគជ័យ · #' || left(v_order.id::text, 8) ||
          ' · $' || to_char(v_order.total_usd, 'FM999999990.00') || ' USD · ' || v_order.customer_name
        )
        on conflict (dedupe_key) do nothing;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'processed', true,
    'changed', v_changed,
    'status', v_new_status,
    'order_id', v_order.id,
    'user_id', v_order.user_id,
    'customer_name', v_order.customer_name,
    'total_usd', v_order.total_usd,
    'phone', v_order.phone,
    'address', v_order.address
  );
end;
$$;

create or replace function public.claim_telegram_outbox(p_limit integer default 10)
returns setof public.telegram_outbox
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id from public.telegram_outbox
    where status in ('pending', 'failed')
      or (status = 'sending' and lock_until < now())
    order by created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.telegram_outbox o
  set status = 'sending', attempts = attempts + 1, lock_until = now() + interval '2 minutes'
  from candidates c
  where o.id = c.id
  returning o.*;
$$;

create or replace function public.create_store_order(
  p_user_id uuid,
  p_checkout_key text,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(10,2) := 0;
  v_shipping numeric(10,2);
  v_snapshot jsonb := '[]'::jsonb;
  v_status text;
begin
  if p_payment_method is null
    or p_payment_method not in ('aba', 'bakong', 'cod')
    or p_items is null
    or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Invalid checkout request';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid checkout request';
  end if;

  select * into v_order from public.orders
  where user_id = p_user_id and checkout_key = p_checkout_key;
  if found then
    return to_jsonb(v_order);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item ->> 'id', '') !~ '^[a-z0-9-]{1,100}$'
      or coalesce(v_item ->> 'quantity', '') !~ '^[1-9][0-9]?$' then
      raise exception 'Invalid cart item';
    end if;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_product from public.products
    where id = v_item ->> 'id' and is_active
    for update;
    if not found then
      raise exception 'Product is unavailable';
    end if;
    if v_product.stock < v_quantity then
      raise exception 'Product stock is insufficient';
    end if;

    update public.products
      set stock = stock - v_quantity, updated_at = now()
      where id = v_product.id;
    v_subtotal := v_subtotal + v_product.price_usd * v_quantity;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name_km,
      'enName', v_product.name_en,
      'material', v_product.material,
      'province', v_product.province,
      'image', v_product.image_url,
      'unitPrice', v_product.price_usd,
      'quantity', v_quantity,
      'lineTotal', v_product.price_usd * v_quantity
    ));
  end loop;

  v_shipping := case when v_subtotal >= 50 then 0 else 2.50 end;
  v_status := case when p_payment_method = 'cod' then 'pending_cod' else 'pending_payment' end;
  insert into public.orders (
    user_id, checkout_key, customer_name, phone, address, items,
    subtotal_usd, shipping_usd, total_usd, payment_method, status
  )
  values (
    p_user_id, p_checkout_key, trim(p_customer_name), trim(p_phone), trim(p_address), v_snapshot,
    v_subtotal, v_shipping, v_subtotal + v_shipping, p_payment_method, v_status
  )
  returning * into v_order;
  return to_jsonb(v_order);
exception
  when unique_violation then
    select * into v_order from public.orders
    where user_id = p_user_id and checkout_key = p_checkout_key;
    if found then return to_jsonb(v_order); end if;
    raise;
end;
$$;

create or replace function public.cancel_store_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('changed', false, 'reason', 'not_found'); end if;
  if v_order.status = 'cancelled' then return jsonb_build_object('changed', false, 'status', 'cancelled'); end if;
  if not (
    v_order.status = 'pending_cod'
    or (v_order.status = 'processing' and v_order.payment_method = 'cod')
  ) then
    raise exception 'This order cannot be cancelled';
  end if;
  for v_item in select value from jsonb_array_elements(v_order.items)
  loop
    update public.products set stock = stock + (v_item ->> 'quantity')::integer, updated_at = now()
    where id = v_item ->> 'id';
  end loop;
  update public.orders set status = 'cancelled', updated_at = now() where id = v_order.id returning * into v_order;
  return jsonb_build_object('changed', true, 'status', v_order.status, 'order_id', v_order.id);
end;
$$;

create or replace function public.change_store_order_payment_method(p_order_id uuid, p_payment_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_payment_method is null or p_payment_method not in ('aba', 'bakong', 'cod') then
    raise exception 'Invalid payment method';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('changed', false, 'reason', 'not_found'); end if;
  if v_order.status not in ('pending_payment', 'pending_cod') then
    return jsonb_build_object('changed', false, 'reason', 'order_not_pending');
  end if;
  if exists (select 1 from public.transactions where order_id = v_order.id) then
    return jsonb_build_object('changed', false, 'reason', 'payment_exists');
  end if;

  update public.orders
    set payment_method = p_payment_method,
        status = case when p_payment_method = 'cod' then 'pending_cod' else 'pending_payment' end,
        updated_at = now()
    where id = v_order.id
    returning * into v_order;
  return jsonb_build_object('changed', true, 'order', to_jsonb(v_order));
end;
$$;

revoke all on function public.create_store_order(uuid,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_store_order(uuid,text,text,text,text,text,jsonb) to service_role;
revoke all on function public.cancel_store_order(uuid) from public, anon, authenticated;
grant execute on function public.cancel_store_order(uuid) to service_role;
revoke all on function public.change_store_order_payment_method(uuid,text) from public, anon, authenticated;
grant execute on function public.change_store_order_payment_method(uuid,text) to service_role;
revoke all on function public.apply_khpay_event(text,numeric,text,text,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.apply_khpay_event(text,numeric,text,text,text,jsonb,text,text) to service_role;
revoke all on function public.claim_telegram_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_telegram_outbox(integer) to service_role;

insert into public.products (
  id, name_km, name_en, description_km, category, material, province,
  price_usd, compare_at_usd, rating, review_count, badge, image_url, gallery,
  artisan_km, artisan_province, stock
) values
  ('carved-lotus-bowl','ចានឈើផ្កាឈូក','Lotus Carved Wooden Bowl','ចានឈើធម្មជាតិឆ្លាក់រូបផ្កាឈូកដោយដៃ។ ស្នាដៃនីមួយៗមានលំនាំពិសេសរៀងៗខ្លួន និងប្រើប្រាស់ឈើដែលប្រមូលពីប្រភពប្រកបដោយទំនួលខុសត្រូវ។','wood','Wood','Siem Reap',28,35,4.9,24,'លក់ដាច់','https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=85',array['https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=1000&q=85'],'លោក សុខ វណ្ណា','សៀមរាប',20),
  ('bamboo-market-basket','កន្ត្រកឫស្សីត្បាញដៃ','Handwoven Bamboo Market Basket','កន្ត្រកឫស្សីត្បាញដោយដៃ រឹងមាំ និងមានទម្ងន់ស្រាល សម្រាប់ដើរផ្សារ ឬតុបតែងផ្ទះ។','bamboo','Bamboo','Battambang',19,null,4.8,18,'វត្ថុធាតុធម្មជាតិ','https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=85','{}','អ្នកស្រី ចាន់ សុភា','បាត់ដំបង',15),
  ('silk-scarf','ក្រមាសូត្រពណ៌ធម្មជាតិ','Natural Dye Silk Krama','ក្រមាសូត្រត្បាញដោយដៃ និងជ្រលក់ពណ៌ពីរុក្ខជាតិ។ ផលិតមួយៗដោយប្រុងប្រយ័ត្ននៅសហគមន៍តាកែវ។','textile','Silk','Takeo',32,null,5,31,'ផលិតដោយដៃ','https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=85','{}','អ្នកស្រី ម៉ៅ ស្រីនាង','តាកែវ',24),
  ('clay-tea-set','ឈុតពែងតែដីឥដ្ឋ','Hand-thrown Clay Tea Set','ឈុតពែងតែដីឥដ្ឋធ្វើដោយដៃ និងដុតក្នុងឡបែបប្រពៃណី។ មានភាពកក់ក្តៅ និងស័ក្តិសមសម្រាប់ពេលសម្រាក។','clay','Clay','Kampong Chhnang',42,null,4.7,12,'មានតែមួយ','https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=85','{}','លោក ឃឹម សុវណ្ណ','កំពង់ឆ្នាំង',12),
  ('rattan-lamp','ចង្កៀងផ្តៅធម្មជាតិ','Woven Rattan Pendant Lamp','ចង្កៀងត្បាញផ្តៅដោយសិប្បករជំនាញ បង្កើតពន្លឺទន់ស្រទន់ និងភាពកក់ក្តៅដល់លំហផ្ទះ។','rattan','Rattan','Kampot',56,null,4.9,9,'ជម្រើសពិសេស','https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85','{}','លោក ឡុង វិសាល','កំពត',8),
  ('recycled-glass-vase','ថូកែវកែច្នៃពណ៌ទឹកសមុទ្រ','Recycled Sea Glass Vase','កែវប្រើរួចត្រូវបានកែច្នៃជាថូពណ៌ស្រស់ស្អាត ដើម្បីកាត់បន្ថយសំណល់ និងបង្កើតស្នាដៃថ្មី។','recycled','Recycled glass','Phnom Penh',24,null,4.6,16,'កែច្នៃឡើងវិញ','https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=900&q=85','{}','ក្រុមសិប្បករបៃតង','ភ្នំពេញ',20),
  ('wooden-serving-spoons','ស្លាបព្រាឈើធម្មជាតិ','Olive Wood Serving Spoons','ស្លាបព្រាឈើប៉ូលាដោយដៃ សម្រាប់ប្រើជាមួយឧបករណ៍ផ្ទះបាយ និងអាហារប្រចាំថ្ងៃ។','wood','Wood','Siem Reap',16,null,4.8,27,'ប្រើប្រាស់ប្រចាំថ្ងៃ','https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=900&q=85','{}','លោក សុខ វណ្ណា','សៀមរាប',30),
  ('woven-wall-art','ស្នាដៃត្បាញជញ្ជាំង','Artisan Woven Wall Hanging','ស្នាដៃត្បាញដែលបញ្ចូលពណ៌ និងលំនាំបែបខ្មែរ ដោយដៃសិប្បការិនីក្នុងសហគមន៍។','textile','Silk','Takeo',38,null,4.9,14,'ស្នាដៃសហគមន៍','https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85','{}','អ្នកស្រី ម៉ៅ ស្រីនាង','តាកែវ',10)
on conflict (id) do nothing;
