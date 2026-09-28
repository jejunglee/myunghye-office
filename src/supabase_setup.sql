-- =====================================================================
--  명혜학교 온라인 교무실 — Supabase 서버 설정
--  사용법: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run
--  여러 번 실행해도 안전합니다.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. 교직원 프로필 (로그인 계정과 1:1)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  name         text not null,
  dept         text,
  title        text not null default '',
  level        int  not null default 1 check (level between 1 and 3),
  status       text not null default 'pending' check (status in ('pending','active','inactive')),
  meal_manager boolean not null default false,
  is_owner     boolean not null default false,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  last_login   timestamptz
);

-- ---------------------------------------------------------------------
-- 2. 교무실 데이터 (일정·회의·자료·공지·급식·알림·기록·부서·설정)
-- ---------------------------------------------------------------------
create table if not exists public.items (
  collection  text not null,
  id          text not null,
  data        jsonb not null,
  dept        text,
  sensitive   boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (collection, id)
);
create index if not exists items_collection_idx on public.items (collection);

create or replace function public.touch_item() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items for each row execute function public.touch_item();

-- ---------------------------------------------------------------------
-- 3. 권한 확인 함수
-- ---------------------------------------------------------------------
create or replace function public.is_active() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and level >= 3)
$$;
create or replace function public.my_dept() returns text language sql stable security definer set search_path = public as $$
  select dept from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 4. 가입 시 프로필 자동 생성
--    · 맨 처음 가입한 계정 = 대표 관리자(최고관리자, 즉시 사용 가능)
--    · 그 다음부터 = 일반 교직원, 관리자 승인 대기
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, username, name, dept, title, level, status, is_owner, approved_at)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'dept',
    case when first_user then coalesce(new.raw_user_meta_data->>'title', '') else '' end,
    case when first_user then 3 else 1 end,
    case when first_user then 'active' else 'pending' end,
    first_user,
    case when first_user then now() else null end
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 프로필 수정 보호: 권한·상태는 관리자만, 대표 관리자는 누구도 강등·비활성화 불가
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_owner := old.is_owner;
  new.username := old.username;
  if old.is_owner and (new.level < 3 or new.status <> 'active') then
    raise exception '대표 관리자 계정은 권한을 낮추거나 비활성화할 수 없습니다.';
  end if;
  if not public.is_admin() then
    if new.level <> old.level or new.status <> old.status or new.meal_manager <> old.meal_manager or new.dept is distinct from old.dept then
      raise exception '권한이 없습니다.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- ---------------------------------------------------------------------
-- 5. 행 수준 보안 (RLS): 승인된 교직원만 읽고 쓰기
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.items    enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (public.is_active() or id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "items read"        on public.items;
drop policy if exists "depts public read" on public.items;
drop policy if exists "items insert"      on public.items;
drop policy if exists "items update"      on public.items;
drop policy if exists "items delete"      on public.items;
create policy "items read" on public.items for select to authenticated
  using (public.is_active() and (not sensitive or public.is_admin() or dept = public.my_dept()));
create policy "depts public read" on public.items for select to anon, authenticated
  using (collection = 'depts');   -- 가입 화면의 부서 목록
create policy "items insert" on public.items for insert to authenticated
  with check (public.is_active() and (collection not in ('depts','config') or public.is_admin()));
create policy "items update" on public.items for update to authenticated
  using (public.is_active() and (collection not in ('depts','config') or public.is_admin()))
  with check (public.is_active() and (collection not in ('depts','config') or public.is_admin()));
create policy "items delete" on public.items for delete to authenticated
  using (public.is_active() and (collection not in ('depts','config') or public.is_admin()));

-- ---------------------------------------------------------------------
-- 6. 관리자 전용 기능: 비밀번호 초기화 · 가입 거절(계정 삭제)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  if length(new_password) < 6 then raise exception '비밀번호는 6자 이상이어야 합니다.'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now() where id = target;
end $$;

create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  if exists (select 1 from public.profiles where id = target and is_owner) then raise exception '대표 관리자 계정은 삭제할 수 없습니다.'; end if;
  delete from auth.users where id = target;
end $$;

revoke all on function public.admin_set_password(uuid, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. 파일 저장소 (한글·엑셀·PDF 등 원본 파일, 파일당 50MB)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "mh files read"   on storage.objects;
drop policy if exists "mh files insert" on storage.objects;
drop policy if exists "mh files update" on storage.objects;
drop policy if exists "mh files delete" on storage.objects;
create policy "mh files read"   on storage.objects for select to authenticated using (bucket_id = 'files' and public.is_active());
create policy "mh files insert" on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_active());
create policy "mh files update" on storage.objects for update to authenticated using (bucket_id = 'files' and public.is_active());
create policy "mh files delete" on storage.objects for delete to authenticated using (bucket_id = 'files' and public.is_admin());

-- ---------------------------------------------------------------------
-- 8. 실시간 반영 (다른 선생님의 변경이 바로 보이게)
-- ---------------------------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.items;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

select '✅ 명혜학교 온라인 교무실 서버 설정 완료' as result;
