-- Count the first study event when creating a user's progress row.
create or replace function public.increment_study_progress_v1(p_field text)
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

    insert into public.study_progress (
        user_id,
        notes_created,
        quiz_attempts,
        flashcards_reviewed,
        tutor_questions
    ) values (
        auth.uid(),
        case when p_field = 'notes_created' then 1 else 0 end,
        case when p_field = 'quiz_attempts' then 1 else 0 end,
        case when p_field = 'flashcards_reviewed' then 1 else 0 end,
        case when p_field = 'tutor_questions' then 1 else 0 end
    )
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

with owners as (
    select user_id from public.study_notes where user_id is not null
    union select user_id from public.quiz_attempts
    union select user_id from public.flashcard_reviews where reviewed
    union select user_id from public.tutor_messages where role = 'user'
), totals as (
    select
        owners.user_id,
        (select count(*) from public.study_notes notes where notes.user_id = owners.user_id)::integer as notes_created,
        (select count(*) from public.quiz_attempts attempts where attempts.user_id = owners.user_id)::integer as quiz_attempts,
        (select count(*) from public.flashcard_reviews reviews where reviews.user_id = owners.user_id and reviews.reviewed)::integer as flashcards_reviewed,
        (select count(*) from public.tutor_messages messages where messages.user_id = owners.user_id and messages.role = 'user')::integer as tutor_questions
    from owners
)
insert into public.study_progress (user_id, notes_created, quiz_attempts, flashcards_reviewed, tutor_questions)
select user_id, notes_created, quiz_attempts, flashcards_reviewed, tutor_questions
from totals
on conflict (user_id) do update set
    notes_created = greatest(public.study_progress.notes_created, excluded.notes_created),
    quiz_attempts = greatest(public.study_progress.quiz_attempts, excluded.quiz_attempts),
    flashcards_reviewed = greatest(public.study_progress.flashcards_reviewed, excluded.flashcards_reviewed),
    tutor_questions = greatest(public.study_progress.tutor_questions, excluded.tutor_questions),
    updated_at = now();