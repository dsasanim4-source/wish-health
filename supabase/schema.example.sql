create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text,
  password_hash text not null,
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token_hash text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings(key, value)
values ('admin_totp_secret_base32', 'REPLACE_WITH_YOUR_BASE32_SECRET')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create table if not exists public.daily_entries (
  id text primary key,
  user_id uuid,
  date date not null,
  diet jsonb not null default '[]'::jsonb,
  mood jsonb,
  sleep jsonb,
  period jsonb,
  exercise jsonb,
  gratitude text not null default '',
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_entries add column if not exists user_id uuid;
alter table public.daily_entries add column if not exists raw_text text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_entries_user_id_fkey'
      and conrelid = 'public.daily_entries'::regclass
  ) then
    alter table public.daily_entries
      add constraint daily_entries_user_id_fkey
      foreign key (user_id) references public.app_users(id) on delete cascade;
  end if;
end $$;

alter table public.daily_entries drop constraint if exists daily_entries_date_key;
drop index if exists public.daily_entries_user_date_unique;
create unique index daily_entries_user_date_unique on public.daily_entries(user_id, date);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_admin_sessions enable row level security;
alter table public.app_settings enable row level security;
alter table public.daily_entries enable row level security;

drop policy if exists "Allow public read daily entries" on public.daily_entries;
drop policy if exists "Allow public insert daily entries" on public.daily_entries;
drop policy if exists "Allow public update daily entries" on public.daily_entries;
drop policy if exists "Allow public delete daily entries" on public.daily_entries;

create or replace function public.app_hash_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create or replace function public.app_new_token()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

create or replace function public.app_base32_decode(p_secret text)
returns bytea
language plpgsql
immutable
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  cleaned text := upper(regexp_replace(coalesce(p_secret, ''), '[=\s]', '', 'g'));
  output bytea := ''::bytea;
  buffer bigint := 0;
  bits integer := 0;
  ch text;
  value integer;
  byte_value integer;
  i integer;
begin
  for i in 1..length(cleaned) loop
    ch := substr(cleaned, i, 1);
    value := strpos(alphabet, ch) - 1;
    if value < 0 then
      raise exception '管理员动态码密钥格式不正确';
    end if;

    buffer := (buffer << 5) | value::bigint;
    bits := bits + 5;

    while bits >= 8 loop
      bits := bits - 8;
      byte_value := ((buffer >> bits) & 255)::integer;
      output := output || decode(lpad(to_hex(byte_value), 2, '0'), 'hex');
      buffer := buffer & ((1::bigint << bits) - 1);
    end loop;
  end loop;

  return output;
end;
$$;

create or replace function public.app_totp_code(p_secret text, p_counter bigint)
returns text
language plpgsql
immutable
as $$
declare
  key_bytes bytea := public.app_base32_decode(p_secret);
  counter_bytes bytea := decode(lpad(to_hex(p_counter), 16, '0'), 'hex');
  digest_bytes bytea;
  offset_value integer;
  binary_value integer;
begin
  digest_bytes := extensions.hmac(counter_bytes, key_bytes, 'sha1');
  offset_value := get_byte(digest_bytes, 19) & 15;
  binary_value :=
    ((get_byte(digest_bytes, offset_value) & 127) << 24) |
    ((get_byte(digest_bytes, offset_value + 1) & 255) << 16) |
    ((get_byte(digest_bytes, offset_value + 2) & 255) << 8) |
    (get_byte(digest_bytes, offset_value + 3) & 255);

  return lpad((binary_value % 1000000)::text, 6, '0');
end;
$$;

create or replace function public.app_verify_totp(p_secret text, p_code text)
returns boolean
language plpgsql
stable
as $$
declare
  current_counter bigint := floor(extract(epoch from now()) / 30)::bigint;
  drift integer;
begin
  if p_secret is null or p_secret = '' then
    raise exception '请先在 app_settings 中配置管理员 Google Authenticator 密钥';
  end if;

  if p_code !~ '^\d{6}$' then
    return false;
  end if;

  for drift in -1..1 loop
    if public.app_totp_code(p_secret, current_counter + drift) = p_code then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.app_user_from_session(p_session_token text)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  session_user_record public.app_users;
begin
  delete from public.app_sessions where expires_at < now();

  select u.*
  into session_user_record
  from public.app_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token_hash = public.app_hash_token(p_session_token)
    and s.expires_at > now()
    and u.active = true;

  if session_user_record.id is null then
    raise exception '登录已失效，请重新登录';
  end if;

  return session_user_record;
end;
$$;

create or replace function public.app_assert_admin(p_admin_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.app_admin_sessions where expires_at < now();

  if not exists (
    select 1
    from public.app_admin_sessions
    where token_hash = public.app_hash_token(p_admin_token)
      and expires_at > now()
  ) then
    raise exception '管理员登录已失效';
  end if;
end;
$$;

create or replace function public.app_admin_login_totp(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  token text;
begin
  select value into secret
  from public.app_settings
  where key = 'admin_totp_secret_base32';

  if not public.app_verify_totp(secret, p_code) then
    raise exception '动态密码不正确';
  end if;

  token := public.app_new_token();

  insert into public.app_admin_sessions(token_hash, expires_at)
  values (public.app_hash_token(token), now() + interval '8 hours');

  return jsonb_build_object('token', token);
end;
$$;

create or replace function public.app_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found_user public.app_users;
  token text;
begin
  select *
  into found_user
  from public.app_users
  where username = lower(trim(p_username))
    and active = true;

  if found_user.id is null or found_user.password_hash <> extensions.crypt(p_password, found_user.password_hash) then
    raise exception '用户名或密码错误';
  end if;

  token := public.app_new_token();

  insert into public.app_sessions(token_hash, user_id, expires_at)
  values (public.app_hash_token(token), found_user.id, now() + interval '30 days');

  return jsonb_build_object(
    'token', token,
    'user_id', found_user.id,
    'username', found_user.username,
    'display_name', coalesce(found_user.display_name, found_user.username),
    'must_change_password', found_user.must_change_password
  );
end;
$$;

create or replace function public.app_change_password(
  p_session_token text,
  p_current_password text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_user_record public.app_users;
begin
  session_user_record := public.app_user_from_session(p_session_token);

  if session_user_record.password_hash <> extensions.crypt(p_current_password, session_user_record.password_hash) then
    raise exception '当前密码不正确';
  end if;

  if length(coalesce(p_new_password, '')) < 6 then
    raise exception '新密码至少 6 位';
  end if;

  update public.app_users
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      must_change_password = false,
      updated_at = now()
  where id = session_user_record.id;

  return jsonb_build_object('must_change_password', false);
end;
$$;

create or replace function public.app_admin_create_user(
  p_admin_token text,
  p_username text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_user public.app_users;
  clean_username text := lower(trim(p_username));
begin
  perform public.app_assert_admin(p_admin_token);

  if clean_username !~ '^[a-z0-9_]{3,32}$' then
    raise exception '用户名只能包含小写字母、数字、下划线，长度 3-32 位';
  end if;

  insert into public.app_users(username, display_name, password_hash, must_change_password)
  values (clean_username, nullif(trim(coalesce(p_display_name, '')), ''), extensions.crypt('123456', extensions.gen_salt('bf')), true)
  returning * into new_user;

  return to_jsonb(new_user) - 'password_hash';
end;
$$;

create or replace function public.app_admin_reset_password(
  p_admin_token text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_user public.app_users;
begin
  perform public.app_assert_admin(p_admin_token);

  update public.app_users
  set password_hash = extensions.crypt('123456', extensions.gen_salt('bf')),
      must_change_password = true,
      updated_at = now()
  where id = p_user_id
    and active = true
  returning * into updated_user;

  if updated_user.id is null then
    raise exception '用户不存在或已停用';
  end if;

  delete from public.app_sessions
  where user_id = updated_user.id;

  return to_jsonb(updated_user) - 'password_hash';
end;
$$;

create or replace function public.app_admin_list_users(p_admin_token text)
returns table (
  id uuid,
  username text,
  display_name text,
  must_change_password boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_assert_admin(p_admin_token);

  return query
  select u.id, u.username, u.display_name, u.must_change_password, u.created_at
  from public.app_users u
  order by u.created_at desc;
end;
$$;

drop function if exists public.app_get_entries(text);
drop function if exists public.app_admin_list_records(text);

create or replace function public.app_get_entries(p_session_token text)
returns table (
  id text,
  date date,
  diet jsonb,
  mood jsonb,
  sleep jsonb,
  period jsonb,
  exercise jsonb,
  gratitude text,
  raw_text text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_user_record public.app_users;
begin
  session_user_record := public.app_user_from_session(p_session_token);

  return query
  select e.id, e.date, e.diet, e.mood, e.sleep, e.period, e.exercise, e.gratitude, e.raw_text, e.created_at, e.updated_at
  from public.daily_entries e
  where e.user_id = session_user_record.id
  order by e.date desc;
end;
$$;

create or replace function public.app_save_entry(p_session_token text, p_entry jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_user_record public.app_users;
  saved_entry public.daily_entries;
  entry_id text;
  entry_date date;
begin
  session_user_record := public.app_user_from_session(p_session_token);
  entry_id := nullif(p_entry->>'id', '');

  if entry_id is null or entry_id like 'draft-%' then
    entry_id := public.app_new_token();
  end if;

  entry_date := coalesce(nullif(p_entry->>'date', '')::date, current_date);

  insert into public.daily_entries (
    id, user_id, date, diet, mood, sleep, period, exercise, gratitude, raw_text, created_at, updated_at
  )
  values (
    entry_id,
    session_user_record.id,
    entry_date,
    coalesce(p_entry->'diet', '[]'::jsonb),
    case when p_entry->'mood' = 'null'::jsonb then null else p_entry->'mood' end,
    case when p_entry->'sleep' = 'null'::jsonb then null else p_entry->'sleep' end,
    case when p_entry->'period' = 'null'::jsonb then null else p_entry->'period' end,
    case when p_entry->'exercise' = 'null'::jsonb then null else p_entry->'exercise' end,
    coalesce(p_entry->>'gratitude', ''),
    nullif(p_entry->>'raw_text', ''),
    coalesce(nullif(p_entry->>'created_at', '')::timestamptz, now()),
    now()
  )
  on conflict (user_id, date)
  do update set
    diet = excluded.diet,
    mood = excluded.mood,
    sleep = excluded.sleep,
    period = excluded.period,
    exercise = excluded.exercise,
    gratitude = excluded.gratitude,
    raw_text = excluded.raw_text,
    updated_at = now()
  returning * into saved_entry;

  return to_jsonb(saved_entry);
end;
$$;

create or replace function public.app_delete_entry(p_session_token text, p_entry_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  session_user_record public.app_users;
begin
  session_user_record := public.app_user_from_session(p_session_token);

  delete from public.daily_entries
  where id = p_entry_id
    and user_id = session_user_record.id;

  return found;
end;
$$;

create or replace function public.app_admin_list_records(p_admin_token text)
returns table (
  username text,
  display_name text,
  id text,
  date date,
  diet jsonb,
  mood jsonb,
  sleep jsonb,
  period jsonb,
  exercise jsonb,
  gratitude text,
  raw_text text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_assert_admin(p_admin_token);

  return query
  select u.username, u.display_name, e.id, e.date, e.diet, e.mood, e.sleep, e.period, e.exercise, e.gratitude, e.raw_text, e.created_at, e.updated_at
  from public.daily_entries e
  join public.app_users u on u.id = e.user_id
  order by e.date desc, e.updated_at desc;
end;
$$;

grant usage on schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
