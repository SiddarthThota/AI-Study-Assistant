-- StudyFlow authenticated workflow, applied after the 20261001021124 baseline.
-- Existing rows are preserved. Conflicting policies or non-card legacy payloads
-- abort the migration before affected data or security configuration is changed.

do $$
declare
    expected record;
    actual_type text;
    actual_nullable text;
    actual_identity text;
begin
    for expected in
        select * from (values
            ('study_notes', 'id', 'int8', 'NO', 'YES'),
            ('study_notes', 'user_email', 'text', 'YES', 'NO'),
            ('study_notes', 'topic', 'text', 'YES', 'NO'),
            ('study_notes', 'difficulty', 'text', 'YES', 'NO'),
            ('study_notes', 'notes', 'text', 'YES', 'NO'),
            ('study_notes', 'created_at', 'timestamp', 'YES', 'NO'),
            ('study_notes', 'user_id', 'uuid', 'YES', 'NO'),
            ('study_history', 'id', 'int8', 'NO', 'YES'),
            ('study_history', 'user_email', 'text', 'YES', 'NO'),
            ('study_history', 'topic', 'text', 'YES', 'NO'),
            ('study_history', 'notes', 'text', 'YES', 'NO'),
            ('study_history', 'created_at', 'timestamp', 'YES', 'NO'),
            ('study_history', 'user_id', 'uuid', 'YES', 'NO'),
            ('quiz_history', 'id', 'int8', 'NO', 'YES'),
            ('quiz_history', 'user_email', 'text', 'YES', 'NO'),
            ('quiz_history', 'topic', 'text', 'YES', 'NO'),
            ('quiz_history', 'score', 'int4', 'YES', 'NO'),
            ('quiz_history', 'created_at', 'timestamp', 'YES', 'NO'),
            ('quiz_history', 'user_id', 'uuid', 'YES', 'NO'),
            ('flashcards', 'id', 'int8', 'NO', 'YES'),
            ('flashcards', 'user_email', 'text', 'YES', 'NO'),
            ('flashcards', 'topic', 'text', 'YES', 'NO'),
            ('flashcards', 'flashcard_content', 'text', 'YES', 'NO'),
            ('flashcards', 'created_at', 'timestamp', 'YES', 'NO'),
            ('flashcards', 'user_id', 'uuid', 'YES', 'NO')
        ) as expected_columns(table_name, column_name, udt_name, is_nullable, is_identity)
    loop
        select column_info.udt_name, column_info.is_nullable, column_info.is_identity
        into actual_type, actual_nullable, actual_identity
        from information_schema.columns as column_info
        where column_info.table_schema = 'public'
          and column_info.table_name = expected.table_name
          and column_info.column_name = expected.column_name;

        if not found
            or actual_type is distinct from expected.udt_name
            or actual_nullable is distinct from expected.is_nullable
            or actual_identity is distinct from expected.is_identity then
            raise exception 'Baseline conflict on public.%.%: expected % nullable %, identity %, found % nullable %, identity %',
                expected.table_name, expected.column_name, expected.udt_name,
                expected.is_nullable, expected.is_identity, actual_type,
                actual_nullable, actual_identity;
        end if;
    end loop;

    for expected in
        select * from (values
            ('study_notes', 'study_notes_pkey'),
            ('study_history', 'study_history_pkey'),
            ('quiz_history', 'quiz_history_pkey'),
            ('flashcards', 'flashcards_pkey')
        ) as expected_keys(table_name, constraint_name)
    loop
        if not exists (
            select 1 from pg_constraint as constraint_row
                        join pg_attribute as primary_column
                            on primary_column.attrelid = constraint_row.conrelid
            where constraint_row.conrelid = to_regclass(format('public.%I', expected.table_name))
              and constraint_row.conname = expected.constraint_name
              and constraint_row.contype = 'p'
              and constraint_row.convalidated
                            and primary_column.attname = 'id'
                            and constraint_row.conkey = array[primary_column.attnum]::smallint[]
        ) then
            raise exception 'Baseline conflict: missing primary key public.%.%',
                expected.table_name, expected.constraint_name;
        end if;
    end loop;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and (
              (table_name = 'study_notes' and column_name in ('study_session_id', 'source_type'))
              or (table_name = 'flashcards' and column_name in ('study_session_id', 'flashcard_content_legacy'))
          )
    ) then
        raise exception 'Baseline conflict: StudyFlow workflow columns already exist; inspect before applying this migration';
    end if;
end $$;

do $$
declare
    unexpected_policy text;
begin
    select string_agg(format('%I.%I', policy.tablename, policy.policyname), ', ')
    into unexpected_policy
    from pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = any(array['study_notes', 'flashcards', 'study_history', 'quiz_history']);

    if unexpected_policy is not null then
        raise exception 'Review existing policies before migration; unexpected policies: %', unexpected_policy;
    end if;
end $$;

create function pg_temp.parse_legacy_flashcards(payload text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
    line text;
    lines text[];
    question text;
    answer text;
    answer_started boolean := false;
    cards jsonb := '[]'::jsonb;
begin
    if payload is null then
        raise exception 'Cannot parse a null legacy flashcard payload';
    end if;

    lines := pg_catalog.regexp_split_to_array(
        pg_catalog.replace(payload, E'\r\n', E'\n'),
        E'\n'
    );

    foreach line in array lines loop
        if line ~ '^[[:space:]]*Q:[[:space:]]*' then
            if question is not null then
                if not answer_started or pg_catalog.btrim(answer, E' \t\n\r') = '' then
                    raise exception 'Legacy flashcard question has no non-empty answer';
                end if;
                cards := cards || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
                    'question', question,
                    'answer', pg_catalog.btrim(answer, E' \t\n\r')
                ));
            end if;
            question := pg_catalog.regexp_replace(line, '^[[:space:]]*Q:[[:space:]]*', '');
            if pg_catalog.btrim(question) = '' then
                raise exception 'Legacy flashcard question is empty';
            end if;
            answer := '';
            answer_started := false;
        elsif question is null then
            if line !~ '^[[:space:]]*$'
                and line !~* '^[[:space:]]*Here are the flashcards( about .*)?:[[:space:]]*$' then
                raise exception 'Unrecognized text before the first legacy Q/A card';
            end if;
        elsif not answer_started and line ~ '^[[:space:]]*A:[[:space:]]*' then
            answer := pg_catalog.regexp_replace(line, '^[[:space:]]*A:[[:space:]]*', '');
            answer_started := true;
        elsif answer_started then
            answer := answer || E'\n' || line;
        elsif line !~ '^[[:space:]]*$' then
            raise exception 'Unrecognized text between a legacy question and answer';
        end if;
    end loop;

    if question is null or not answer_started or pg_catalog.btrim(answer, E' \t\n\r') = '' then
        raise exception 'Legacy flashcard payload ends with an incomplete Q/A card';
    end if;
    cards := cards || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'question', question,
        'answer', pg_catalog.btrim(answer, E' \t\n\r')
    ));
    return cards;
end;
$function$;

do $$
begin
    if pg_temp.parse_legacy_flashcards(
        E'Here are the flashcards about Parser Tests:\n\nQ: First question?\nA: First answer.\nContinued answer.\n\nQ: Second question?\nA: Second answer.'
    ) <> '[{"question":"First question?","answer":"First answer.\nContinued answer."},{"question":"Second question?","answer":"Second answer."}]'::jsonb then
        raise exception 'Legacy flashcard parser self-test failed';
    end if;
end $$;

do $$
declare
    flashcard_row record;
    parsed_content jsonb;
begin
    for flashcard_row in
        select id, flashcard_content
        from public.flashcards
        where flashcard_content is not null
    loop
        parsed_content := pg_temp.parse_legacy_flashcards(flashcard_row.flashcard_content);
        if jsonb_typeof(parsed_content) is distinct from 'array'
            or jsonb_array_length(parsed_content) = 0
            or exists (
                select 1
                from jsonb_array_elements(parsed_content) as card(value)
                where jsonb_typeof(card.value) is distinct from 'object'
                   or jsonb_typeof(card.value -> 'question') is distinct from 'string'
                   or jsonb_typeof(card.value -> 'answer') is distinct from 'string'
            ) then
            raise exception 'Cannot safely normalize flashcards.flashcard_content for row %', flashcard_row.id;
        end if;
    end loop;
end $$;

alter table public.study_notes
    add column if not exists study_session_id uuid,
    add column if not exists source_type text not null default 'topic';
alter table public.flashcards add column if not exists study_session_id uuid;
alter table public.flashcards add column flashcard_content_legacy text;
update public.flashcards
set flashcard_content_legacy = flashcard_content;
update public.flashcards
set flashcard_content = pg_temp.parse_legacy_flashcards(flashcard_content)::text
where flashcard_content is not null;
alter table public.flashcards
    alter column flashcard_content type jsonb using flashcard_content::jsonb;
comment on column public.flashcards.flashcard_content_legacy is
        'Exact pre-migration flashcard text retained for rollback and historical fidelity.';

update public.study_notes notes
set user_id = matched_user.id
from auth.users matched_user
where notes.user_id is null
    and notes.user_email = matched_user.email
    and (select count(*) from auth.users candidate where candidate.email = notes.user_email) = 1;
update public.flashcards cards
set user_id = matched_user.id
from auth.users matched_user
where cards.user_id is null
    and cards.user_email = matched_user.email
    and (select count(*) from auth.users candidate where candidate.email = cards.user_email) = 1;
update public.study_history history
set user_id = matched_user.id
from auth.users matched_user
where history.user_id is null
    and history.user_email = matched_user.email
    and (select count(*) from auth.users candidate where candidate.email = history.user_email) = 1;
update public.quiz_history history
set user_id = matched_user.id
from auth.users matched_user
where history.user_id is null
    and history.user_email = matched_user.email
    and (select count(*) from auth.users candidate where candidate.email = history.user_email) = 1;

comment on column public.study_notes.user_id is
        'Null legacy owners are unattributed; backfill only from a unique exact auth.users.email match.';
comment on column public.flashcards.user_id is
        'Null legacy owners are unattributed; backfill only from a unique exact auth.users.email match.';
comment on column public.study_history.user_id is
        'Null legacy owners are unattributed; backfill only from a unique exact auth.users.email match.';
comment on column public.quiz_history.user_id is
        'Null legacy owners are unattributed; backfill only from a unique exact auth.users.email match.';

create table if not exists public.study_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    topic text not null,
    source_type text not null default 'topic',
    created_at timestamptz not null default now()
);
alter table public.study_notes add constraint study_notes_session_fk
    foreign key (study_session_id) references public.study_sessions (id) on delete set null;
alter table public.flashcards add constraint flashcards_session_fk
    foreign key (study_session_id) references public.study_sessions (id) on delete set null;

create table if not exists public.quizzes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    study_session_id uuid references public.study_sessions (id) on delete set null,
    topic text not null,
    questions jsonb not null,
    created_at timestamptz not null default now()
);
create table if not exists public.quiz_attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    quiz_id uuid not null references public.quizzes (id) on delete cascade,
    topic text not null,
    answers jsonb not null,
    score integer not null check (score >= 0),
    question_count integer not null check (question_count > 0 and score <= question_count),
    created_at timestamptz not null default now()
);
create table if not exists public.flashcard_reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    flashcard_id bigint not null references public.flashcards (id) on delete cascade,
    card_index integer not null check (card_index >= 0),
    reviewed boolean not null default true,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (flashcard_id, card_index)
);
create table if not exists public.tutor_conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    study_session_id uuid references public.study_sessions (id) on delete set null,
    topic text not null,
    created_at timestamptz not null default now()
);
create table if not exists public.tutor_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    conversation_id uuid not null references public.tutor_conversations (id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);
create table if not exists public.study_activity (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    study_session_id uuid references public.study_sessions (id) on delete set null,
    event_type text not null,
    label text not null,
    created_at timestamptz not null default now()
);
create table if not exists public.study_progress (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    notes_created integer not null default 0 check (notes_created >= 0),
    quiz_attempts integer not null default 0 check (quiz_attempts >= 0),
    flashcards_reviewed integer not null default 0 check (flashcards_reviewed >= 0),
    tutor_questions integer not null default 0 check (tutor_questions >= 0),
    updated_at timestamptz not null default now()
);
create table if not exists public.user_settings (
    user_id uuid primary key references auth.users (id) on delete cascade,
    study_goal text not null default 'Master difficult concepts with daily practice.',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists study_notes_user_created_idx on public.study_notes (user_id, created_at desc);
create index if not exists study_notes_session_idx on public.study_notes (study_session_id);
create index if not exists flashcards_user_created_idx on public.flashcards (user_id, created_at desc);
create index if not exists flashcards_session_idx on public.flashcards (study_session_id);
create index if not exists study_sessions_user_created_idx on public.study_sessions (user_id, created_at desc);
create index if not exists quizzes_user_created_idx on public.quizzes (user_id, created_at desc);
create index if not exists quizzes_session_idx on public.quizzes (study_session_id);
create index if not exists quiz_attempts_user_created_idx on public.quiz_attempts (user_id, created_at desc);
create index if not exists quiz_attempts_quiz_user_idx on public.quiz_attempts (quiz_id, user_id);
create index if not exists flashcard_reviews_user_created_idx on public.flashcard_reviews (user_id, created_at desc);
create index if not exists tutor_conversations_user_created_idx on public.tutor_conversations (user_id, created_at desc);
create index if not exists tutor_conversations_session_idx on public.tutor_conversations (study_session_id);
create index if not exists tutor_messages_conversation_user_created_idx on public.tutor_messages (conversation_id, user_id, created_at);
create index if not exists study_activity_user_created_idx on public.study_activity (user_id, created_at desc);
create index if not exists study_activity_session_idx on public.study_activity (study_session_id);

alter table public.study_notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.study_history enable row level security;
alter table public.quiz_history enable row level security;
alter table public.study_sessions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.tutor_conversations enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.study_activity enable row level security;
alter table public.study_progress enable row level security;
alter table public.user_settings enable row level security;

revoke all on table
    public.study_notes, public.flashcards, public.study_history, public.quiz_history,
    public.study_sessions, public.quizzes, public.quiz_attempts, public.flashcard_reviews,
    public.tutor_conversations, public.tutor_messages, public.study_activity,
    public.study_progress, public.user_settings
from public, anon, authenticated;
revoke all on sequence
    public.study_notes_id_seq, public.flashcards_id_seq,
    public.study_history_id_seq, public.quiz_history_id_seq
from public, anon, authenticated;

alter default privileges for role postgres in schema public
    revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke execute on functions from anon, authenticated;

grant select, insert on table public.study_notes, public.flashcards to authenticated;
grant usage on sequence public.study_notes_id_seq, public.flashcards_id_seq to authenticated;
grant select, insert on table public.study_sessions to authenticated;
grant select, insert on table public.quizzes, public.quiz_attempts to authenticated;
grant select, insert, update on table public.flashcard_reviews to authenticated;
grant select, insert on table public.tutor_conversations, public.tutor_messages, public.study_activity to authenticated;
grant select, insert, update on table public.study_progress, public.user_settings to authenticated;

create policy study_notes_select_own on public.study_notes
    for select to authenticated using (auth.uid() = user_id);
create policy study_notes_insert_own on public.study_notes
    for insert to authenticated with check (
        auth.uid() = user_id and exists (
            select 1 from public.study_sessions s where s.id = study_session_id and s.user_id = auth.uid()
        )
    );
create policy flashcards_select_own on public.flashcards
    for select to authenticated using (auth.uid() = user_id);
create policy flashcards_insert_own on public.flashcards
    for insert to authenticated with check (
        auth.uid() = user_id and (
            study_session_id is null or exists (
                select 1 from public.study_sessions s where s.id = study_session_id and s.user_id = auth.uid()
            )
        )
    );

create policy study_sessions_select_own on public.study_sessions
    for select to authenticated using (auth.uid() = user_id);
create policy study_sessions_insert_own on public.study_sessions
    for insert to authenticated with check (auth.uid() = user_id);
create policy quizzes_select_own on public.quizzes
    for select to authenticated using (auth.uid() = user_id);
create policy quizzes_insert_own on public.quizzes
    for insert to authenticated with check (
        auth.uid() = user_id and (
            study_session_id is null or exists (
                select 1 from public.study_sessions s where s.id = study_session_id and s.user_id = auth.uid()
            )
        )
    );
create policy quiz_attempts_select_own on public.quiz_attempts
    for select to authenticated using (auth.uid() = user_id);
create policy quiz_attempts_insert_own on public.quiz_attempts
    for insert to authenticated with check (
        auth.uid() = user_id and exists (
            select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()
        )
    );

create policy flashcard_reviews_select_own on public.flashcard_reviews
    for select to authenticated using (auth.uid() = user_id);
create policy flashcard_reviews_insert_own on public.flashcard_reviews
    for insert to authenticated with check (
        auth.uid() = user_id and exists (
            select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid()
        )
    );
create policy flashcard_reviews_update_own on public.flashcard_reviews
    for update to authenticated using (
        auth.uid() = user_id and exists (
            select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid()
        )
    ) with check (
        auth.uid() = user_id and exists (
            select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid()
        )
    );

create policy tutor_conversations_select_own on public.tutor_conversations
    for select to authenticated using (auth.uid() = user_id);
create policy tutor_conversations_insert_own on public.tutor_conversations
    for insert to authenticated with check (
        auth.uid() = user_id and (
            study_session_id is null or exists (
                select 1 from public.study_sessions s where s.id = study_session_id and s.user_id = auth.uid()
            )
        )
    );
create policy tutor_messages_select_own on public.tutor_messages
    for select to authenticated using (
        auth.uid() = user_id and exists (
            select 1 from public.tutor_conversations c where c.id = conversation_id and c.user_id = auth.uid()
        )
    );
create policy tutor_messages_insert_own on public.tutor_messages
    for insert to authenticated with check (
        auth.uid() = user_id and exists (
            select 1 from public.tutor_conversations c where c.id = conversation_id and c.user_id = auth.uid()
        )
    );

create policy study_activity_select_own on public.study_activity
    for select to authenticated using (auth.uid() = user_id);
create policy study_activity_insert_own on public.study_activity
    for insert to authenticated with check (
        auth.uid() = user_id and (
            study_session_id is null or exists (
                select 1 from public.study_sessions s where s.id = study_session_id and s.user_id = auth.uid()
            )
        )
    );
create policy study_progress_select_own on public.study_progress
    for select to authenticated using (auth.uid() = user_id);
create policy study_progress_insert_own on public.study_progress
    for insert to authenticated with check (auth.uid() = user_id);
create policy study_progress_update_own on public.study_progress
    for update to authenticated using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
create policy user_settings_select_own on public.user_settings
    for select to authenticated using (auth.uid() = user_id);
create policy user_settings_insert_own on public.user_settings
    for insert to authenticated with check (auth.uid() = user_id);
create policy user_settings_update_own on public.user_settings
    for update to authenticated using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create function public.increment_study_progress_v1(p_field text)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;
    if p_field not in ('notes_created', 'quiz_attempts', 'flashcards_reviewed', 'tutor_questions') then
        raise exception 'Invalid progress field';
    end if;
    insert into public.study_progress (user_id) values (auth.uid())
    on conflict (user_id) do update set
        notes_created = public.study_progress.notes_created + case when p_field = 'notes_created' then 1 else 0 end,
        quiz_attempts = public.study_progress.quiz_attempts + case when p_field = 'quiz_attempts' then 1 else 0 end,
        flashcards_reviewed = public.study_progress.flashcards_reviewed + case when p_field = 'flashcards_reviewed' then 1 else 0 end,
        tutor_questions = public.study_progress.tutor_questions + case when p_field = 'tutor_questions' then 1 else 0 end,
        updated_at = now();
end;
$function$;
revoke all on function public.increment_study_progress_v1(text) from public, anon, authenticated;
grant execute on function public.increment_study_progress_v1(text) to authenticated;