-- Bootstrap schema. Apply before versioned migrations. Existing policy names are
-- never replaced here: matching definitions are left alone and conflicts abort.

do $$
declare
    unexpected_policy text;
begin
    select string_agg(format('%I.%I', policy.tablename, policy.policyname), ', ')
    into unexpected_policy
    from pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = any(array['study_notes', 'quiz_history', 'study_history', 'flashcards'])
      and policy.policyname not in (
          'study_notes_select_own', 'study_notes_insert_own',
          'quiz_history_select_own', 'quiz_history_insert_own',
          'study_history_select_own', 'study_history_insert_own',
          'flashcards_select_own', 'flashcards_insert_own'
      );

    if unexpected_policy is not null then
        raise exception 'Unexpected policies on bootstrap tables: %. Review them before applying schema.sql.',
            unexpected_policy;
    end if;
end $$;

create table if not exists public.study_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    topic text not null,
    difficulty text not null,
    notes text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.quiz_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    topic text not null,
    score integer not null,
    created_at timestamptz not null default now()
);

create table if not exists public.study_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    topic text not null,
    notes text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    topic text not null,
    flashcard_content jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists study_notes_user_created_idx
    on public.study_notes (user_id, created_at desc);
create index if not exists quiz_history_user_created_idx
    on public.quiz_history (user_id, created_at desc);
create index if not exists study_history_user_created_idx
    on public.study_history (user_id, created_at desc);
create index if not exists flashcards_user_created_idx
    on public.flashcards (user_id, created_at desc);

do $$
declare
    expected record;
    existing_command text;
    existing_using text;
    existing_check text;
    existing_roles text;
begin
    for expected in
        select * from (values
            ('study_notes', 'study_notes_select_own', 'SELECT', 'auth.uid() = user_id', null::text),
            ('study_notes', 'study_notes_insert_own', 'INSERT', null::text, 'auth.uid() = user_id'),
            ('flashcards', 'flashcards_select_own', 'SELECT', 'auth.uid() = user_id', null::text),
            ('flashcards', 'flashcards_insert_own', 'INSERT', null::text, 'auth.uid() = user_id')
        ) as policies(table_name, policy_name, command, using_expression, check_expression)
    loop
        select policy.cmd, policy.qual, policy.with_check, array_to_string(policy.roles, ',')
        into existing_command, existing_using, existing_check, existing_roles
        from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = expected.table_name
          and policy.policyname = expected.policy_name;

        if found then
            if existing_command <> expected.command
                or existing_roles <> 'authenticated'
                or regexp_replace(lower(coalesce(existing_using, '')), '[[:space:]()]', '', 'g')
                    <> regexp_replace(lower(coalesce(expected.using_expression, '')), '[[:space:]()]', '', 'g')
                or regexp_replace(lower(coalesce(existing_check, '')), '[[:space:]()]', '', 'g')
                    <> regexp_replace(lower(coalesce(expected.check_expression, '')), '[[:space:]()]', '', 'g')
            then
                raise exception 'Policy conflict for public.%.%; inspect it before applying schema.sql',
                    expected.table_name, expected.policy_name;
            end if;
        else
            if expected.command = 'SELECT' then
                execute format(
                    'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
                    expected.policy_name, expected.table_name
                );
            else
                execute format(
                    'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
                    expected.policy_name, expected.table_name
                );
            end if;
        end if;
    end loop;
end $$;

alter table public.study_notes enable row level security;
alter table public.quiz_history enable row level security;
alter table public.study_history enable row level security;
alter table public.flashcards enable row level security;

revoke all on table public.study_notes, public.flashcards
    from public, anon, authenticated;
revoke all on table public.quiz_history, public.study_history
    from public, anon, authenticated;

grant select, insert on public.study_notes to authenticated;
grant select, insert on public.flashcards to authenticated;
