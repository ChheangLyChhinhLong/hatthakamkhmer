create table if not exists public.admin_login_otp_challenges (
  telegram_id text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  next_send_at timestamptz not null,
  window_started_at timestamptz not null,
  send_count smallint not null default 1 check (send_count between 1 and 5),
  failed_attempts smallint not null default 0 check (failed_attempts between 0 and 5),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (telegram_id ~ '^[0-9]{1,20}$')
);

create table if not exists public.admin_auth_audit (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null,
  event text not null check (event in (
    'otp_request_cooldown',
    'otp_request_rate_limited',
    'otp_send_requested',
    'otp_sent',
    'otp_delivery_failed',
    'otp_verify_rejected',
    'otp_verify_invalid',
    'otp_verify_expired',
    'otp_verify_used',
    'otp_verify_locked',
    'otp_verified'
  )),
  created_at timestamptz not null default now(),
  check (telegram_id ~ '^[0-9]{1,20}$')
);

create index if not exists admin_auth_audit_created_idx
  on public.admin_auth_audit(created_at desc);

create table if not exists public.admin_auth_sessions (
  session_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.admin_login_otp_challenges enable row level security;
alter table public.admin_auth_audit enable row level security;
alter table public.admin_auth_sessions enable row level security;

revoke all on public.admin_login_otp_challenges from public, anon, authenticated;
revoke all on public.admin_auth_audit from public, anon, authenticated;
revoke all on public.admin_auth_sessions from public, anon, authenticated;
grant all on public.admin_login_otp_challenges to service_role;
grant all on public.admin_auth_audit to service_role;
grant all on public.admin_auth_sessions to service_role;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles p
      join public.admin_auth_sessions s
        on s.user_id = p.id
       and s.session_id = (select auth.jwt() ->> 'session_id')::uuid
       and s.expires_at > now()
       and s.revoked_at is null
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

create or replace function public.issue_admin_login_otp(p_telegram_id text, p_code_hash text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.admin_login_otp_challenges%rowtype;
begin
  if p_telegram_id is null or p_telegram_id !~ '^[0-9]{1,20}$'
     or p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid admin OTP request';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_telegram_id));
  select * into v_challenge
    from public.admin_login_otp_challenges
    where telegram_id = p_telegram_id
    for update;

  if not found then
    insert into public.admin_login_otp_challenges (
      telegram_id, code_hash, expires_at, next_send_at, window_started_at
    ) values (
      p_telegram_id, p_code_hash, now() + interval '5 minutes',
      now() + interval '60 seconds', now()
    );
    return 'sent';
  end if;

  if v_challenge.next_send_at > now() then return 'cooldown'; end if;
  if v_challenge.window_started_at <= now() - interval '1 hour' then
    v_challenge.window_started_at := now();
    v_challenge.send_count := 0;
  end if;
  if v_challenge.send_count >= 5 then return 'rate_limited'; end if;

  update public.admin_login_otp_challenges
    set code_hash = p_code_hash,
        expires_at = now() + interval '5 minutes',
        next_send_at = now() + interval '60 seconds',
        window_started_at = v_challenge.window_started_at,
        send_count = v_challenge.send_count + 1,
        failed_attempts = 0,
        consumed_at = null,
        updated_at = now()
    where telegram_id = p_telegram_id;
  return 'sent';
end;
$$;

create or replace function public.verify_admin_login_otp(p_telegram_id text, p_code_hash text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.admin_login_otp_challenges%rowtype;
begin
  if p_telegram_id is null or p_telegram_id !~ '^[0-9]{1,20}$'
     or p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid admin OTP verification';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_telegram_id));
  select * into v_challenge
    from public.admin_login_otp_challenges
    where telegram_id = p_telegram_id
    for update;
  if not found then return 'invalid'; end if;
  if v_challenge.consumed_at is not null then return 'used'; end if;
  if v_challenge.expires_at <= now() then return 'expired'; end if;
  if v_challenge.failed_attempts >= 5 then return 'locked'; end if;

  if v_challenge.code_hash <> p_code_hash then
    update public.admin_login_otp_challenges
      set failed_attempts = failed_attempts + 1, updated_at = now()
      where telegram_id = p_telegram_id;
    if v_challenge.failed_attempts + 1 >= 5 then return 'locked'; end if;
    return 'invalid';
  end if;

  update public.admin_login_otp_challenges
    set consumed_at = now(), updated_at = now()
    where telegram_id = p_telegram_id;
  return 'verified';
end;
$$;

revoke all on function public.issue_admin_login_otp(text, text) from public, anon, authenticated;
grant execute on function public.issue_admin_login_otp(text, text) to service_role;
revoke all on function public.verify_admin_login_otp(text, text) from public, anon, authenticated;
grant execute on function public.verify_admin_login_otp(text, text) to service_role;
