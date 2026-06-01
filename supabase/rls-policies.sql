-- ============================================================================
-- LifeTrack — Row-Level Security para la tabla user_data
-- ----------------------------------------------------------------------------
-- Ejecutar UNA vez en Supabase → SQL Editor.
--
-- Contexto: el cliente hace
--   supabase.from('user_data').upsert({ user_id, data }, { onConflict: 'user_id' })
-- donde user_id = auth.uid() (el usuario autenticado por Google OAuth).
--
-- Sin RLS, CUALQUIER usuario autenticado puede leer/sobrescribir las filas de
-- otros usuarios. Estas policies garantizan que cada quien solo toca su fila.
-- ============================================================================

-- 1) Asegura el esquema mínimo esperado (idempotente).
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) user_id siempre = el usuario autenticado (defensa extra: el cliente no
--    puede falsificar el user_id de otro aunque lo intente).
alter table public.user_data
  alter column user_id set default auth.uid();

-- 3) Activa RLS. Por defecto, con RLS activo y sin policies, NADIE accede.
alter table public.user_data enable row level security;
-- Aplica RLS incluso al dueño de la tabla (no a service_role, que la omite).
alter table public.user_data force row level security;

-- 4) Reemplaza policies (idempotente).
drop policy if exists "user_data_select_own" on public.user_data;
drop policy if exists "user_data_insert_own" on public.user_data;
drop policy if exists "user_data_update_own" on public.user_data;
drop policy if exists "user_data_delete_own" on public.user_data;

create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "user_data_update_own"
  on public.user_data for update
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_data_delete_own"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- 5) (Opcional) mantener updated_at fresco en cada escritura.
create or replace function public.touch_user_data()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_user_data on public.user_data;
create trigger trg_touch_user_data
  before update on public.user_data
  for each row execute function public.touch_user_data();

-- ============================================================================
-- Verificación rápida (debe devolver rowsecurity = true):
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where relname = 'user_data';
-- ============================================================================
