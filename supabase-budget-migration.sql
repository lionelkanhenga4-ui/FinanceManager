alter table if exists public.accounts
  add column if not exists type text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.accounts'::regclass
      and contype = 'c'
  loop
    execute format('alter table public.accounts drop constraint if exists %I', constraint_name);
  end loop;
end $$;

update public.accounts
set type = coalesce(nullif(trim(type), ''), 'Other')
where type is null or trim(type) = '';

alter table public.accounts alter column type set default 'Other';
alter table public.accounts alter column type set not null;

alter table if exists public.budgets
  add column if not exists limit_amount numeric(12, 2);

do $$
declare
  legacy_column text;
begin
  foreach legacy_column in array array['amount', 'budget_amount', 'monthly_limit', 'budget_limit'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'budgets'
        and column_name = legacy_column
    ) then
      execute format(
        'update public.budgets set limit_amount = %I::numeric where limit_amount is null',
        legacy_column
      );
      execute format(
        'alter table public.budgets alter column %I drop not null',
        legacy_column
      );
      exit;
    end if;
  end loop;
end $$;

do $$
declare
  legacy_column text;
begin
  foreach legacy_column in array array['amount', 'budget_amount', 'monthly_limit', 'budget_limit', 'period'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'budgets'
        and column_name = legacy_column
    ) then
      execute format(
        'alter table public.budgets alter column %I drop not null',
        legacy_column
      );
    end if;
  end loop;
end $$;

alter table if exists public.savings_goals
  add column if not exists deadline bigint;

notify pgrst, 'reload schema';