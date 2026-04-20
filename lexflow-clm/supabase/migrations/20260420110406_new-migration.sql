-- =========================================
-- LexFlow full schema migration
-- =========================================

create extension if not exists pgcrypto;

-- =========================================
-- CONTRACTS
-- =========================================

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'MSA',
  owner text not null,
  counterparty text not null,
  value_gbp numeric(12,2) not null default 0,
  status text not null default 'Draft',
  priority text not null default 'Medium',
  governing_law text not null default 'England & Wales',
  renewal_date date not null,
  obligation text not null,
  notes text,
  auto_renew boolean not null default false,
  security_review boolean not null default false,
  finance_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contracts_status_check
    check (status in ('Draft', 'In Review', 'Approved', 'Signed', 'Archived')),

  constraint contracts_priority_check
    check (priority in ('High', 'Medium', 'Low'))
);

create index if not exists contracts_created_at_idx on public.contracts (created_at desc);
create index if not exists contracts_status_idx on public.contracts (status);
create index if not exists contracts_priority_idx on public.contracts (priority);
create index if not exists contracts_renewal_date_idx on public.contracts (renewal_date);

-- =========================================
-- APPROVALS
-- =========================================

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  approval_type text not null,
  decision text not null default 'Pending',
  approver_name text,
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),

  constraint approvals_decision_check
    check (decision in ('Pending', 'Approved', 'Rejected'))
);

create index if not exists approvals_contract_id_idx on public.approvals (contract_id);
create index if not exists approvals_decision_idx on public.approvals (decision);

-- Optional uniqueness so you do not get duplicate approval rows
create unique index if not exists approvals_contract_type_unique
  on public.approvals (contract_id, approval_type);

-- =========================================
-- OBLIGATIONS
-- =========================================

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  title text not null,
  owner text not null,
  due_date date,
  status text not null default 'Open',
  notes text,
  created_at timestamptz not null default now(),

  constraint obligations_status_check
    check (status in ('Open', 'In Progress', 'Done', 'Overdue'))
);

create index if not exists obligations_contract_id_idx on public.obligations (contract_id);
create index if not exists obligations_status_idx on public.obligations (status);
create index if not exists obligations_due_date_idx on public.obligations (due_date);

-- =========================================
-- DOCUMENTS
-- =========================================

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  file_url text,
  mime_type text,
  uploaded_by text not null default 'User',
  created_at timestamptz not null default now()
);

create index if not exists documents_contract_id_idx on public.documents (contract_id);
create index if not exists documents_created_at_idx on public.documents (created_at desc);

-- =========================================
-- ACTIVITIES
-- =========================================

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  action text not null,
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activities_contract_id_idx on public.activities (contract_id);
create index if not exists activities_created_at_idx on public.activities (created_at desc);

-- =========================================
-- UPDATED_AT TRIGGER FOR CONTRACTS
-- =========================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contracts_set_updated_at on public.contracts;

create trigger contracts_set_updated_at
before update on public.contracts
for each row
execute function public.set_updated_at();

-- =========================================
-- ENABLE RLS
-- =========================================

alter table public.contracts enable row level security;
alter table public.approvals enable row level security;
alter table public.obligations enable row level security;
alter table public.documents enable row level security;
alter table public.activities enable row level security;

-- =========================================
-- CONTRACTS POLICIES
-- =========================================

drop policy if exists "contracts_select_anon" on public.contracts;
drop policy if exists "contracts_insert_anon" on public.contracts;
drop policy if exists "contracts_update_anon" on public.contracts;
drop policy if exists "contracts_delete_anon" on public.contracts;

create policy "contracts_select_anon"
on public.contracts
for select
to anon
using (true);

create policy "contracts_insert_anon"
on public.contracts
for insert
to anon
with check (true);

create policy "contracts_update_anon"
on public.contracts
for update
to anon
using (true)
with check (true);

create policy "contracts_delete_anon"
on public.contracts
for delete
to anon
using (true);

-- =========================================
-- APPROVALS POLICIES
-- =========================================

drop policy if exists "approvals_select_anon" on public.approvals;
drop policy if exists "approvals_insert_anon" on public.approvals;
drop policy if exists "approvals_update_anon" on public.approvals;
drop policy if exists "approvals_delete_anon" on public.approvals;

create policy "approvals_select_anon"
on public.approvals
for select
to anon
using (true);

create policy "approvals_insert_anon"
on public.approvals
for insert
to anon
with check (true);

create policy "approvals_update_anon"
on public.approvals
for update
to anon
using (true)
with check (true);

create policy "approvals_delete_anon"
on public.approvals
for delete
to anon
using (true);

-- =========================================
-- OBLIGATIONS POLICIES
-- =========================================

drop policy if exists "obligations_select_anon" on public.obligations;
drop policy if exists "obligations_insert_anon" on public.obligations;
drop policy if exists "obligations_update_anon" on public.obligations;
drop policy if exists "obligations_delete_anon" on public.obligations;

create policy "obligations_select_anon"
on public.obligations
for select
to anon
using (true);

create policy "obligations_insert_anon"
on public.obligations
for insert
to anon
with check (true);

create policy "obligations_update_anon"
on public.obligations
for update
to anon
using (true)
with check (true);

create policy "obligations_delete_anon"
on public.obligations
for delete
to anon
using (true);

-- =========================================
-- DOCUMENTS POLICIES
-- =========================================

drop policy if exists "documents_select_anon" on public.documents;
drop policy if exists "documents_insert_anon" on public.documents;
drop policy if exists "documents_update_anon" on public.documents;
drop policy if exists "documents_delete_anon" on public.documents;

create policy "documents_select_anon"
on public.documents
for select
to anon
using (true);

create policy "documents_insert_anon"
on public.documents
for insert
to anon
with check (true);

create policy "documents_update_anon"
on public.documents
for update
to anon
using (true)
with check (true);

create policy "documents_delete_anon"
on public.documents
for delete
to anon
using (true);

-- =========================================
-- ACTIVITIES POLICIES
-- =========================================

drop policy if exists "activities_select_anon" on public.activities;
drop policy if exists "activities_insert_anon" on public.activities;
drop policy if exists "activities_update_anon" on public.activities;
drop policy if exists "activities_delete_anon" on public.activities;

create policy "activities_select_anon"
on public.activities
for select
to anon
using (true);

create policy "activities_insert_anon"
on public.activities
for insert
to anon
with check (true);

create policy "activities_update_anon"
on public.activities
for update
to anon
using (true)
with check (true);

create policy "activities_delete_anon"
on public.activities
for delete
to anon
using (true);

-- =========================================
-- STORAGE BUCKET
-- =========================================

insert into storage.buckets (id, name, public)
values ('contract-files', 'contract-files', false)
on conflict (id) do nothing;

-- =========================================
-- STORAGE POLICIES
-- =========================================

drop policy if exists "contract_files_select" on storage.objects;
drop policy if exists "contract_files_insert" on storage.objects;
drop policy if exists "contract_files_delete" on storage.objects;

create policy "contract_files_select"
on storage.objects
for select
to anon
using (bucket_id = 'contract-files');

create policy "contract_files_insert"
on storage.objects
for insert
to anon
with check (bucket_id = 'contract-files');

create policy "contract_files_delete"
on storage.objects
for delete
to anon
using (bucket_id = 'contract-files');