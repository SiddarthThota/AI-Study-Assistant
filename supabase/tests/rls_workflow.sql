-- LOCAL ONLY. Supabase test db executes this file through pg_prove.
-- The fixture users and records are created inside this transaction and rolled back.

begin;
select no_plan();

insert into auth.users (id, email)
values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls-user-a@example.test'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls-user-b@example.test');

create temporary table rls_test_ids (
    fixture_name text primary key,
    fixture_id bigint not null
) on commit drop;
grant select on rls_test_ids to authenticated;

insert into public.study_sessions (id, user_id, topic)
values
    ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS fixture A'),
    ('10000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS fixture B');

with inserted as (
    insert into public.study_notes (user_id, study_session_id, topic, difficulty, notes)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'RLS fixture A', 'Beginner', 'A')
    returning id
)
insert into pg_temp.rls_test_ids select 'note_a', id from inserted;

with inserted as (
    insert into public.study_notes (user_id, study_session_id, topic, difficulty, notes)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '10000000-0000-4000-8000-000000000002', 'RLS fixture B', 'Beginner', 'B')
    returning id
)
insert into pg_temp.rls_test_ids select 'note_b', id from inserted;

with inserted as (
    insert into public.study_notes (user_id, topic, difficulty, notes)
    values (null, 'Unattributed legacy row', 'Beginner', 'Preserved but unowned')
    returning id
)
insert into pg_temp.rls_test_ids select 'note_unattributed', id from inserted;

with inserted as (
    insert into public.flashcards (user_id, study_session_id, topic, flashcard_content)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'RLS fixture A', '[{"question":"A","answer":"A"}]'::jsonb)
    returning id
)
insert into pg_temp.rls_test_ids select 'cards_a', id from inserted;

with inserted as (
    insert into public.flashcards (user_id, study_session_id, topic, flashcard_content)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '10000000-0000-4000-8000-000000000002', 'RLS fixture B', '[{"question":"B","answer":"B"}]'::jsonb)
    returning id
)
insert into pg_temp.rls_test_ids select 'cards_b', id from inserted;

with inserted as (
    insert into public.flashcards (user_id, topic, flashcard_content)
    values (null, 'Unattributed legacy cards', '[{"question":"Q","answer":"A"}]'::jsonb)
    returning id
)
insert into pg_temp.rls_test_ids select 'cards_unattributed', id from inserted;

insert into public.quizzes (id, user_id, study_session_id, topic, questions)
values
    ('20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'RLS fixture A', '[{"correct_answer":"A"}]'),
    ('20000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '10000000-0000-4000-8000-000000000002', 'RLS fixture B', '[{"correct_answer":"B"}]');
insert into public.quiz_attempts (id, user_id, quiz_id, topic, answers, score, question_count)
values
    ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'RLS fixture A', '["A"]', 1, 1),
    ('30000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000002', 'RLS fixture B', '["B"]', 1, 1);
insert into public.flashcard_reviews (id, user_id, flashcard_id, card_index, reviewed)
values
    ('40000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'cards_a'), 0, true),
    ('40000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'cards_b'), 0, true);
insert into public.tutor_conversations (id, user_id, study_session_id, topic)
values
    ('50000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'RLS fixture A'),
    ('50000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '10000000-0000-4000-8000-000000000002', 'RLS fixture B');
insert into public.tutor_messages (id, user_id, conversation_id, role, content)
values
    ('60000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '50000000-0000-4000-8000-000000000001', 'user', 'A'),
    ('60000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '50000000-0000-4000-8000-000000000002', 'user', 'B');
insert into public.study_activity (id, user_id, study_session_id, event_type, label)
values
    ('70000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'test', 'A'),
    ('70000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '10000000-0000-4000-8000-000000000002', 'test', 'B');
insert into public.user_settings (user_id, study_goal)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A goal'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B goal');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.study_notes$$, '42501', 'permission denied for table study_notes', 'anonymous cannot read study notes');
select throws_ok($$select * from public.quizzes$$, '42501', 'permission denied for table quizzes', 'anonymous cannot read quizzes');
select throws_ok(
    $$insert into public.study_notes (user_id, topic, difficulty, notes) values (null, 'anonymous', 'Beginner', 'blocked')$$,
    '42501', 'permission denied for table study_notes', 'anonymous cannot insert study notes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is((select count(*) from public.study_notes where id = (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'note_a')), 1::bigint, 'User A reads own note');
select is((select count(*) from public.study_notes where id = (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'note_b')), 0::bigint, 'User A cannot read User B note');
select is((select count(*) from public.study_notes where id = (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'note_unattributed')), 0::bigint, 'Unattributed note stays hidden');
select is((select count(*) from public.flashcards where id = (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'cards_a')), 1::bigint, 'User A reads own flashcards');
select is((select count(*) from public.flashcards where id = (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'cards_b')), 0::bigint, 'User A cannot read User B flashcards');
select is((select count(*) from public.flashcards where id = (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'cards_unattributed')), 0::bigint, 'Unattributed flashcards stay hidden');
select is((select count(*) from public.study_sessions where id = '10000000-0000-4000-8000-000000000001'), 1::bigint, 'User A reads own session');
select is((select count(*) from public.study_sessions where id = '10000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B session');
select is((select count(*) from public.quizzes where id = '20000000-0000-4000-8000-000000000001'), 1::bigint, 'User A reads own quiz');
select is((select count(*) from public.quizzes where id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B quiz');
select is((select count(*) from public.quiz_attempts where id = '30000000-0000-4000-8000-000000000001'), 1::bigint, 'User A reads own attempt');
select is((select count(*) from public.quiz_attempts where id = '30000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B attempt');
select is((select count(*) from public.flashcard_reviews where id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'User A reads own review');
select is((select count(*) from public.flashcard_reviews where id = '40000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B review');
select is((select count(*) from public.tutor_conversations where id = '50000000-0000-4000-8000-000000000001'), 1::bigint, 'User A reads own tutor conversation');
select is((select count(*) from public.tutor_conversations where id = '50000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B tutor conversation');
select is((select count(*) from public.tutor_messages where id = '60000000-0000-4000-8000-000000000001'), 1::bigint, 'User A reads own tutor message');
select is((select count(*) from public.tutor_messages where id = '60000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B tutor message');
select is((select count(*) from public.study_activity where id = '70000000-0000-4000-8000-000000000001'), 1::bigint, 'User A reads own activity');
select is((select count(*) from public.study_activity where id = '70000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B activity');
select lives_ok($$select public.increment_study_progress_v1('notes_created')$$, 'first study event creates progress');
select is((select count(*) from public.study_progress where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1::bigint, 'User A reads own progress');
select is((select notes_created from public.study_progress where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'first note increments progress');
select is((select count(*) from public.study_progress where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0::bigint, 'User A cannot read User B progress');
select is((select count(*) from public.user_settings where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1::bigint, 'User A reads own settings');
select is((select count(*) from public.user_settings where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0::bigint, 'User A cannot read User B settings');

select throws_ok(
    $$update public.flashcard_reviews set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = '40000000-0000-4000-8000-000000000001'$$,
    '42501', 'new row violates row-level security policy for table "flashcard_reviews"', 'User A cannot change row ownership'
);
select results_eq(
    $$update public.flashcard_reviews set reviewed = false where id = '40000000-0000-4000-8000-000000000001' returning 1::bigint$$,
    $$values (1::bigint)$$,
    'owner can update own review'
);
select results_eq(
    $$update public.flashcard_reviews set reviewed = false where id = '40000000-0000-4000-8000-000000000002' returning 1::bigint$$,
    $$select 1::bigint where false$$,
    'User A cannot update User B review'
);
select results_eq(
    $$update public.study_progress set notes_created = 3 where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1::bigint$$,
    $$values (1::bigint)$$,
    'owner can update own progress'
);
select results_eq(
    $$update public.study_progress set notes_created = 3 where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1::bigint$$,
    $$select 1::bigint where false$$,
    'User A cannot update User B progress'
);
select results_eq(
    $$update public.user_settings set study_goal = 'Updated A goal' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1::bigint$$,
    $$values (1::bigint)$$,
    'owner can update own settings'
);
select results_eq(
    $$update public.user_settings set study_goal = 'Unauthorized' where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1::bigint$$,
    $$select 1::bigint where false$$,
    'User A cannot update User B settings'
);

select throws_ok(
    $$insert into public.study_notes (user_id, study_session_id, topic, difficulty, notes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', 'bad link', 'Beginner', 'blocked')$$,
    '42501', 'new row violates row-level security policy for table "study_notes"', 'note cannot link to User B session'
);
select throws_ok(
    $$insert into public.flashcards (user_id, study_session_id, topic, flashcard_content) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', 'bad link', '[]'::jsonb)$$,
    '42501', 'new row violates row-level security policy for table "flashcards"', 'flashcards cannot link to User B session'
);
select throws_ok(
    $$insert into public.quizzes (user_id, study_session_id, topic, questions) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', 'bad link', '[]'::jsonb)$$,
    '42501', 'new row violates row-level security policy for table "quizzes"', 'quiz cannot link to User B session'
);
select throws_ok(
    $$insert into public.quiz_attempts (user_id, quiz_id, topic, answers, score, question_count) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000002', 'bad link', '[]'::jsonb, 0, 1)$$,
    '42501', 'new row violates row-level security policy for table "quiz_attempts"', 'attempt cannot link to User B quiz'
);
select throws_ok(
    $$insert into public.flashcard_reviews (user_id, flashcard_id, card_index) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select fixture_id from pg_temp.rls_test_ids where fixture_name = 'cards_b'), 0)$$,
    '42501', 'new row violates row-level security policy for table "flashcard_reviews"', 'review cannot link to User B flashcards'
);
select throws_ok(
    $$insert into public.tutor_conversations (user_id, study_session_id, topic) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', 'bad link')$$,
    '42501', 'new row violates row-level security policy for table "tutor_conversations"', 'conversation cannot link to User B session'
);
select throws_ok(
    $$insert into public.tutor_messages (user_id, conversation_id, role, content) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '50000000-0000-4000-8000-000000000002', 'user', 'blocked')$$,
    '42501', 'new row violates row-level security policy for table "tutor_messages"', 'message cannot link to User B conversation'
);
select throws_ok(
    $$insert into public.study_activity (user_id, study_session_id, event_type, label) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', 'test', 'blocked')$$,
    '42501', 'new row violates row-level security policy for table "study_activity"', 'activity cannot link to User B session'
);

reset role;
select * from finish();
rollback;
