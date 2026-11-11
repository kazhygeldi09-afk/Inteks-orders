-- =====================================================================
-- Curtains orders: tables, access rules and functions.
-- Run this once in the Supabase SQL editor (or with `supabase db push`).
--
-- Who can do what
--   designer     sees and edits only orders assigned to them (edits need a
--                reason); adds payments; can take unassigned online orders.
--   call_center  adds online orders (client name, phone, address, notes);
--                sees only the orders they entered; can fix them only until
--                a designer takes them.
--   manager,     see, change and delete everything; reports; staff.
--   owner
--
-- All writes go through the functions at the bottom (security definer,
-- each checks the caller's role). Signed-in users have read access only,
-- and Row-Level Security limits which rows they can read.
-- =====================================================================

create schema if not exists private;

create type public.app_role as enum ('designer', 'call_center', 'manager', 'owner');
create type public.order_source as enum ('designer', 'online');
create type public.order_status as enum
  ('new', 'measuring', 'in_production', 'installation', 'completed', 'cancelled');
create type public.payment_method as enum ('cash', 'card', 'kaspi', 'transfer', 'other');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default '',
  full_name  text not null default '',
  role       public.app_role,               -- null = no access at all
  active     boolean not null default true, -- false = no access, history kept
  created_at timestamptz not null default now()
);

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      bigint generated always as identity (start with 1001) unique,
  client_name       text not null check (length(btrim(client_name)) > 0),
  client_phone      text not null default '',
  client_address    text not null default '',
  order_date        date not null default current_date,
  product_details   text not null default '',
  notes             text not null default '',
  total_cost        numeric(12, 2) not null default 0 check (total_cost >= 0),
  -- kept equal to the sum of this order's payments by a trigger
  amount_paid       numeric(12, 2) not null default 0 check (amount_paid >= 0),
  remaining_balance numeric(12, 2) generated always as (total_cost - amount_paid) stored,
  status            public.order_status not null default 'new',
  source            public.order_source not null,
  designer_id       uuid references public.profiles (id),
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint paid_not_above_total check (amount_paid <= total_cost)
);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  paid_on     date not null default current_date,
  method      public.payment_method not null default 'cash',
  note        text not null default '',
  recorded_by uuid not null references public.profiles (id),
  recorded_by_name text not null default '', -- filled in automatically
  created_at  timestamptz not null default now()
);

-- Every change to an order, with who made it and why.
create table public.order_changes (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  changed_by uuid references public.profiles (id),
  changed_by_name text not null default '', -- filled in automatically
  changed_at timestamptz not null default now(),
  action     text not null, -- created | updated | taken | payment_added | payment_deleted
  reason     text not null default '',
  changes    jsonb not null default '{}'
);

create index orders_designer_idx   on public.orders (designer_id);
create index orders_created_by_idx on public.orders (created_by);
create index orders_date_idx       on public.orders (order_date);
create index orders_open_idx       on public.orders (source) where designer_id is null;
create index payments_order_idx    on public.payments (order_id);
create index payments_paid_on_idx  on public.payments (paid_on);
create index changes_order_idx     on public.order_changes (order_id, changed_at);

-- ---------------------------------------------------------------------
-- Helpers (private schema is not exposed through the API)
-- ---------------------------------------------------------------------

create function private.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('manager', 'owner'), false)
$$;

create function private.is_active_designer(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = p_id and role = 'designer' and active
  )
$$;

-- New login → profile. The role comes only from app_metadata, which only the
-- server (service role) can set, so a self-registered user gets no access.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role;
begin
  begin
    v_role := (new.raw_app_meta_data ->> 'role')::public.app_role;
  exception when others then
    v_role := null;
  end;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_app_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'full_name', ''),
    v_role
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.recalc_paid(p_order_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.orders
     set amount_paid = (select coalesce(sum(amount), 0) from public.payments where order_id = p_order_id)
   where id = p_order_id
$$;

create function private.sync_amount_paid() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.recalc_paid(new.order_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recalc_paid(old.order_id);
  end if;
  return null;
end $$;

create trigger payments_sync_amount_paid
  after insert or update or delete on public.payments
  for each row execute function private.sync_amount_paid();

-- Store the staff member's name with payments and history, so designers can
-- see who did what without being able to read the staff list.
create function private.fill_payment_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.recorded_by_name := coalesce((select full_name from public.profiles where id = new.recorded_by), '');
  return new;
end $$;

create trigger payments_fill_name
  before insert on public.payments
  for each row execute function private.fill_payment_name();

create function private.fill_change_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.changed_by_name := coalesce((select full_name from public.profiles where id = new.changed_by), '');
  return new;
end $$;

create trigger order_changes_fill_name
  before insert on public.order_changes
  for each row execute function private.fill_change_name();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Read access (Row-Level Security)
-- ---------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.orders        enable row level security;
alter table public.payments      enable row level security;
alter table public.order_changes enable row level security;

revoke all on public.profiles, public.orders, public.payments, public.order_changes
  from anon, authenticated;
grant select on public.profiles, public.orders, public.payments, public.order_changes
  to authenticated;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.my_role(), private.is_manager() to authenticated;

create policy "own profile, or managers see all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_manager()));

create policy "managers see all, designers see their own" on public.orders
  for select to authenticated
  using (
    (select private.is_manager())
    or ((select private.my_role()) = 'designer' and designer_id = (select auth.uid()))
  );

-- Payments and history follow the order: visible if the order is visible.
create policy "payments of visible orders" on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy "history of visible orders" on public.order_changes
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- ---------------------------------------------------------------------
-- Write functions. Errors are short codes the app translates.
-- ---------------------------------------------------------------------

create function public.create_order(p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_role     public.app_role := private.my_role();
  v_uid      uuid := auth.uid();
  v_id       uuid;
  v_source   public.order_source;
  v_designer uuid;
  v_status   public.order_status;
  v_total    numeric(12, 2);
  v_deposit  numeric(12, 2);
  v_date     date := coalesce(nullif(p_data ->> 'order_date', '')::date, current_date);
begin
  if v_role is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if length(btrim(coalesce(p_data ->> 'client_name', ''))) = 0 then
    raise exception 'CLIENT_NAME_REQUIRED';
  end if;

  if v_role = 'designer' then
    v_source := 'designer';
    v_designer := v_uid;
  elsif v_role = 'call_center' then
    v_source := 'online';
    v_designer := null;
  else
    v_source := coalesce(nullif(p_data ->> 'source', '')::public.order_source, 'designer');
    v_designer := nullif(p_data ->> 'designer_id', '')::uuid;
    if v_designer is not null and not private.is_active_designer(v_designer) then
      raise exception 'INVALID_DESIGNER';
    end if;
  end if;

  -- Call-center staff record contact details only, not money.
  if v_role = 'call_center' then
    v_total := 0;
    v_deposit := 0;
    v_status := 'new';
  else
    v_total := coalesce(nullif(p_data ->> 'total_cost', '')::numeric, 0);
    v_deposit := coalesce(nullif(p_data ->> 'deposit', '')::numeric, 0);
    v_status := coalesce(nullif(p_data ->> 'status', '')::public.order_status, 'new');
  end if;

  if v_total < 0 or v_deposit < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if v_deposit > v_total then
    raise exception 'OVERPAID';
  end if;

  insert into public.orders (
    client_name, client_phone, client_address, order_date, product_details, notes,
    total_cost, status, source, designer_id, created_by
  ) values (
    btrim(p_data ->> 'client_name'),
    btrim(coalesce(p_data ->> 'client_phone', '')),
    btrim(coalesce(p_data ->> 'client_address', '')),
    v_date,
    btrim(coalesce(p_data ->> 'product_details', '')),
    btrim(coalesce(p_data ->> 'notes', '')),
    v_total, v_status, v_source, v_designer, v_uid
  )
  returning id into v_id;

  insert into public.order_changes (order_id, changed_by, action)
  values (v_id, v_uid, 'created');

  if v_deposit > 0 then
    insert into public.payments (order_id, amount, paid_on, method, note, recorded_by)
    values (
      v_id, v_deposit, v_date,
      coalesce(nullif(p_data ->> 'deposit_method', '')::public.payment_method, 'cash'),
      'deposit', v_uid
    );
  end if;

  return v_id;
end $$;

create function public.update_order(p_order_id uuid, p_data jsonb, p_reason text default '')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_role    public.app_role := private.my_role();
  v_uid     uuid := auth.uid();
  v_old     public.orders;
  v_new     public.orders;
  v_allowed text[];
  v_changes jsonb := '{}';
  v_old_j   jsonb;
  v_new_j   jsonb;
  k         text;
begin
  select * into v_old from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_role in ('manager', 'owner') then
    v_allowed := array['client_name', 'client_phone', 'client_address', 'order_date',
      'product_details', 'notes', 'total_cost', 'status', 'designer_id', 'source'];
  elsif v_role = 'designer' and v_old.designer_id = v_uid then
    v_allowed := array['client_name', 'client_phone', 'client_address', 'order_date',
      'product_details', 'notes', 'total_cost', 'status'];
  elsif v_role = 'call_center' and v_old.created_by = v_uid and v_old.designer_id is null then
    v_allowed := array['client_name', 'client_phone', 'client_address', 'product_details', 'notes'];
  else
    raise exception 'NOT_ALLOWED';
  end if;

  for k in select jsonb_object_keys(p_data) loop
    if not k = any (v_allowed) then
      raise exception 'NOT_ALLOWED';
    end if;
  end loop;

  if v_role not in ('manager', 'owner') and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  v_new := jsonb_populate_record(v_old, p_data);
  v_new.client_name     := btrim(coalesce(v_new.client_name, ''));
  v_new.client_phone    := btrim(coalesce(v_new.client_phone, ''));
  v_new.client_address  := btrim(coalesce(v_new.client_address, ''));
  v_new.product_details := btrim(coalesce(v_new.product_details, ''));
  v_new.notes           := btrim(coalesce(v_new.notes, ''));

  if length(v_new.client_name) = 0 then
    raise exception 'CLIENT_NAME_REQUIRED';
  end if;
  if v_new.total_cost is null or v_new.total_cost < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if v_new.total_cost < v_old.amount_paid then
    raise exception 'TOTAL_BELOW_PAID';
  end if;
  if v_new.designer_id is distinct from v_old.designer_id
     and v_new.designer_id is not null
     and not private.is_active_designer(v_new.designer_id) then
    raise exception 'INVALID_DESIGNER';
  end if;

  v_old_j := to_jsonb(v_old);
  v_new_j := to_jsonb(v_new);
  foreach k in array v_allowed loop
    if (v_old_j -> k) is distinct from (v_new_j -> k) then
      v_changes := v_changes || jsonb_build_object(
        k, jsonb_build_object('old', v_old_j -> k, 'new', v_new_j -> k));
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return;
  end if;

  update public.orders set
    client_name     = v_new.client_name,
    client_phone    = v_new.client_phone,
    client_address  = v_new.client_address,
    order_date      = v_new.order_date,
    product_details = v_new.product_details,
    notes           = v_new.notes,
    total_cost      = v_new.total_cost,
    status          = v_new.status,
    designer_id     = v_new.designer_id,
    source          = v_new.source
  where id = p_order_id;

  insert into public.order_changes (order_id, changed_by, action, reason, changes)
  values (p_order_id, v_uid, 'updated', btrim(coalesce(p_reason, '')), v_changes);
end $$;

-- A designer takes an unassigned online order.
create function public.take_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.my_role() is distinct from 'designer' then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.orders
     set designer_id = auth.uid()
   where id = p_order_id
     and designer_id is null
     and source = 'online'
     and status <> 'cancelled';
  if not found then
    raise exception 'ALREADY_TAKEN';
  end if;

  insert into public.order_changes (order_id, changed_by, action, changes)
  values (p_order_id, auth.uid(), 'taken',
          jsonb_build_object('designer_id', jsonb_build_object('old', null, 'new', auth.uid())));
end $$;

create function public.delete_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager() then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.orders where id = p_order_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end $$;

create function public.add_payment(
  p_order_id uuid,
  p_amount   numeric,
  p_paid_on  date default current_date,
  p_method   public.payment_method default 'cash',
  p_note     text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_id    uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if not (private.is_manager()
          or (private.my_role() = 'designer' and v_order.designer_id = auth.uid())) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if v_order.amount_paid + p_amount > v_order.total_cost then
    raise exception 'OVERPAID';
  end if;

  insert into public.payments (order_id, amount, paid_on, method, note, recorded_by)
  values (p_order_id, p_amount, coalesce(p_paid_on, current_date),
          coalesce(p_method, 'cash'), btrim(coalesce(p_note, '')), auth.uid())
  returning id into v_id;

  insert into public.order_changes (order_id, changed_by, action, changes)
  values (p_order_id, auth.uid(), 'payment_added',
          jsonb_build_object('amount', p_amount, 'paid_on', coalesce(p_paid_on, current_date),
                             'method', coalesce(p_method, 'cash')));
  return v_id;
end $$;

create function public.delete_payment(p_payment_id uuid, p_reason text default '')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pay   public.payments;
  v_order public.orders;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = v_pay.order_id for update;

  if not (private.is_manager()
          or (private.my_role() = 'designer' and v_order.designer_id = auth.uid())) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not private.is_manager() and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  delete from public.payments where id = p_payment_id;

  insert into public.order_changes (order_id, changed_by, action, reason, changes)
  values (v_pay.order_id, auth.uid(), 'payment_deleted', btrim(coalesce(p_reason, '')),
          jsonb_build_object('amount', v_pay.amount, 'paid_on', v_pay.paid_on,
                             'method', v_pay.method));
end $$;

-- ---------------------------------------------------------------------
-- Read functions for the cases plain RLS can't express
-- ---------------------------------------------------------------------

-- Unassigned online orders that designers can take (contact details only).
create function public.open_online_orders()
returns table (
  id uuid, order_number bigint, order_date date, client_name text,
  client_phone text, client_address text, product_details text, notes text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.my_role() is null or private.my_role() = 'call_center' then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
    select o.id, o.order_number, o.order_date, o.client_name, o.client_phone,
           o.client_address, o.product_details, o.notes, o.created_at
      from public.orders o
     where o.source = 'online' and o.designer_id is null and o.status <> 'cancelled'
     order by o.created_at;
end $$;

-- Orders the signed-in call-center person entered. No money columns.
create function public.my_entered_orders()
returns table (
  id uuid, order_number bigint, order_date date, client_name text,
  client_phone text, client_address text, product_details text, notes text,
  status public.order_status, designer_name text, editable boolean,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.my_role() is distinct from 'call_center' then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
    select o.id, o.order_number, o.order_date, o.client_name, o.client_phone,
           o.client_address, o.product_details, o.notes, o.status,
           p.full_name, (o.designer_id is null), o.created_at
      from public.orders o
      left join public.profiles p on p.id = o.designer_id
     where o.created_by = auth.uid()
     order by o.created_at desc;
end $$;

-- Total still owed. Runs with the caller's rights, so designers get their own
-- total and managers get everyone's (optionally for one designer).
create function public.unpaid_summary(p_designer_id uuid default null)
returns table (total_unpaid numeric, orders_with_balance bigint)
language sql stable set search_path = '' as $$
  select coalesce(sum(remaining_balance), 0), count(*)
    from public.orders
   where remaining_balance > 0
     and status <> 'cancelled'
     and (p_designer_id is null or designer_id = p_designer_id)
$$;

-- Managers: month-by-month figures for one year.
--   sales       = total cost of orders dated in that month (cancelled excluded)
--   collected   = payments received in that month
--   outstanding = what is still owed on that month's orders
create function public.monthly_report(p_year int, p_designer_id uuid default null)
returns table (period int, orders_count bigint, sales numeric, collected numeric, outstanding numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_manager() then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
    with m as (select generate_series(1, 12) as mon),
    o as (
      select extract(month from x.order_date)::int as mon, count(*) as cnt,
             sum(x.total_cost) as s, sum(x.remaining_balance) as ob
        from public.orders x
       where extract(year from x.order_date) = p_year and x.status <> 'cancelled'
         and (p_designer_id is null or x.designer_id = p_designer_id)
       group by 1
    ),
    p as (
      select extract(month from y.paid_on)::int as mon, sum(y.amount) as c
        from public.payments y join public.orders x on x.id = y.order_id
       where extract(year from y.paid_on) = p_year
         and (p_designer_id is null or x.designer_id = p_designer_id)
       group by 1
    )
    select m.mon, coalesce(o.cnt, 0)::bigint, coalesce(o.s, 0)::numeric,
           coalesce(p.c, 0)::numeric, coalesce(o.ob, 0)::numeric
      from m left join o on o.mon = m.mon left join p on p.mon = m.mon
     order by m.mon;
end $$;

-- Managers: the same figures per year, for every year with data.
create function public.yearly_report(p_designer_id uuid default null)
returns table (period int, orders_count bigint, sales numeric, collected numeric, outstanding numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_manager() then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
    with o as (
      select extract(year from x.order_date)::int as yr, count(*) as cnt,
             sum(x.total_cost) as s, sum(x.remaining_balance) as ob
        from public.orders x
       where x.status <> 'cancelled'
         and (p_designer_id is null or x.designer_id = p_designer_id)
       group by 1
    ),
    p as (
      select extract(year from y.paid_on)::int as yr, sum(y.amount) as c
        from public.payments y join public.orders x on x.id = y.order_id
       where (p_designer_id is null or x.designer_id = p_designer_id)
       group by 1
    ),
    yrs as (select yr from o union select yr from p)
    select yrs.yr, coalesce(o.cnt, 0)::bigint, coalesce(o.s, 0)::numeric,
           coalesce(p.c, 0)::numeric, coalesce(o.ob, 0)::numeric
      from yrs left join o on o.yr = yrs.yr left join p on p.yr = yrs.yr
     order by yrs.yr desc;
end $$;

-- Only signed-in users may call the API functions.
revoke all on function
  public.create_order(jsonb),
  public.update_order(uuid, jsonb, text),
  public.take_order(uuid),
  public.delete_order(uuid),
  public.add_payment(uuid, numeric, date, public.payment_method, text),
  public.delete_payment(uuid, text),
  public.open_online_orders(),
  public.my_entered_orders(),
  public.unpaid_summary(uuid),
  public.monthly_report(int, uuid),
  public.yearly_report(uuid)
from public, anon;

grant execute on function
  public.create_order(jsonb),
  public.update_order(uuid, jsonb, text),
  public.take_order(uuid),
  public.delete_order(uuid),
  public.add_payment(uuid, numeric, date, public.payment_method, text),
  public.delete_payment(uuid, text),
  public.open_online_orders(),
  public.my_entered_orders(),
  public.unpaid_summary(uuid),
  public.monthly_report(int, uuid),
  public.yearly_report(uuid)
to authenticated;
