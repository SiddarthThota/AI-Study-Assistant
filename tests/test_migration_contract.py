from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
BASELINE = (ROOT / "supabase" / "migrations" / "20261001021124_remote_schema.sql").read_text(encoding="utf-8")
MIGRATION_PATH = ROOT / "supabase" / "migrations" / "20261001021200_studyflow_authenticated_workflow.sql"
MIGRATION = MIGRATION_PATH.read_text(encoding="utf-8")
PROGRESS_FIX_PATH = ROOT / "supabase" / "migrations" / "20261002140000_fix_initial_study_progress_increment.sql"
PROGRESS_FIX = PROGRESS_FIX_PATH.read_text(encoding="utf-8")
LOCAL_RLS = (ROOT / "supabase" / "tests" / "rls_workflow.sql").read_text(encoding="utf-8")


def test_sql_contains_no_data_destructive_statements() -> None:
    sql = f"{SCHEMA}\n{BASELINE}\n{MIGRATION}\n{PROGRESS_FIX}"

    assert not re.search(r"\b(drop\s+table|drop\s+column|truncate|delete\s+from)\b", sql, re.IGNORECASE)


def test_migration_follows_the_applied_remote_baseline() -> None:
    assert BASELINE.strip()
    migration_version = MIGRATION_PATH.name.split("_", 1)[0]
    assert migration_version > "20261001021124"
    baseline_tables = set(re.findall(
        r'create\s+table\s+if\s+not\s+exists\s+"public"\."(\w+)"', BASELINE, re.IGNORECASE
    ))
    assert baseline_tables == {"profiles", "study_notes", "study_history", "quiz_history", "flashcards"}
    assert '"flashcard_content" "text"' in BASELINE
    assert '"id" bigint NOT NULL' in BASELINE
    assert "alter table public.profiles" not in MIGRATION.lower()


def test_progress_fix_does_not_drop_or_delete_existing_data() -> None:
    assert not re.search(r"\b(drop\s+table|drop\s+column|truncate|delete\s+from)\b", PROGRESS_FIX, re.IGNORECASE)


def test_progress_fix_follows_the_applied_workflow_migration() -> None:
    assert PROGRESS_FIX_PATH.name.split("_", 1)[0] > MIGRATION_PATH.name.split("_", 1)[0]
    assert "security invoker" in PROGRESS_FIX.lower()
    assert "case when p_field = 'notes_created' then 1 else 0 end" in PROGRESS_FIX.lower()
    assert "revoke all on function public.increment_study_progress_v1(text)" in PROGRESS_FIX.lower()
    assert "grant execute on function public.increment_study_progress_v1(text) to authenticated" in PROGRESS_FIX.lower()
    assert "greatest(public.study_progress.notes_created, excluded.notes_created)" in PROGRESS_FIX.lower()
    assert "from public.study_notes notes where notes.user_id = owners.user_id" in PROGRESS_FIX.lower()


def test_migration_adds_exactly_the_required_workflow_tables() -> None:
    created_tables = set(re.findall(r"create\s+table\s+if\s+not\s+exists\s+public\.(\w+)", MIGRATION, re.IGNORECASE))
    assert created_tables == {
        "study_sessions",
        "quizzes",
        "quiz_attempts",
        "flashcard_reviews",
        "tutor_conversations",
        "tutor_messages",
        "study_activity",
        "study_progress",
        "user_settings",
    }


def test_migration_indexes_user_queries_and_foreign_key_columns() -> None:
    required_indexes = (
        "study_notes_session_idx on public.study_notes (study_session_id)",
        "flashcards_session_idx on public.flashcards (study_session_id)",
        "quizzes_session_idx on public.quizzes (study_session_id)",
        "tutor_conversations_session_idx on public.tutor_conversations (study_session_id)",
        "tutor_messages_conversation_user_created_idx on public.tutor_messages (conversation_id, user_id, created_at)",
        "study_activity_session_idx on public.study_activity (study_session_id)",
    )
    migration = MIGRATION.lower()
    assert all(index.lower() in migration for index in required_indexes)


def test_migration_preserves_legacy_id_types_and_validates_flashcard_conversion() -> None:
    assert "('study_notes', 'id', 'int8', 'NO', 'YES')" in MIGRATION
    assert "('flashcards', 'flashcard_content', 'text', 'YES', 'NO')" in MIGRATION
    assert "flashcard_id bigint not null references public.flashcards (id)" in MIGRATION.lower()
    assert "parse_legacy_flashcards" in MIGRATION.lower()
    assert "legacy flashcard payload ends with an incomplete q/a card" in MIGRATION.lower()
    assert "alter column flashcard_content type jsonb using flashcard_content::jsonb" in MIGRATION.lower()


def test_migration_archives_legacy_flashcard_text_and_parses_q_a_deterministically() -> None:
    assert "add column flashcard_content_legacy text" in MIGRATION.lower()
    assert "set flashcard_content_legacy = flashcard_content" in MIGRATION.lower()
    assert "parse_legacy_flashcards(flashcard_content)" in MIGRATION.lower()
    assert "unrecognized text before the first legacy q/a card" in MIGRATION.lower()
    assert "legacy flashcard payload ends with an incomplete q/a card" in MIGRATION.lower()


def test_migration_backfills_only_unique_exact_email_matches() -> None:
    assert MIGRATION.lower().count("where notes.user_id is null") == 1
    assert MIGRATION.lower().count("where cards.user_id is null") == 1
    assert MIGRATION.lower().count("where history.user_id is null") == 2
    assert MIGRATION.lower().count("candidate.email =") == 4
    assert "alter table public.profiles" not in MIGRATION.lower()


def test_existing_study_tables_get_owner_only_select_and_insert_policies() -> None:
    for table in ("study_notes", "flashcards"):
        assert re.search(
            rf"create\s+policy\s+{table}_select_own\s+on\s+public\.{table}\s+for\s+select\s+to\s+authenticated\s+using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)",
            MIGRATION,
            re.IGNORECASE | re.DOTALL,
        )
        assert re.search(rf"create\s+policy\s+{table}_insert_own", MIGRATION, re.IGNORECASE)
    for parent_table in ("study_sessions", "quizzes", "flashcards", "tutor_conversations"):
        assert f"from public.{parent_table}" in MIGRATION.lower()


def test_all_end_user_policies_are_explicitly_owner_scoped() -> None:
    select_tables = set(re.findall(
        r"create\s+policy\s+\w+_select_own\s+on\s+public\.(\w+)", MIGRATION, re.IGNORECASE
    ))
    insert_policies = re.findall(
        r"create\s+policy\s+\w+_insert_own\s+on\s+public\.\w+\s+for\s+insert\b(.*?);",
        MIGRATION,
        re.IGNORECASE | re.DOTALL,
    )
    assert select_tables == {
        "study_notes", "flashcards", "study_sessions", "quizzes", "quiz_attempts",
        "flashcard_reviews", "tutor_conversations", "tutor_messages", "study_activity",
        "study_progress", "user_settings",
    }
    assert len(insert_policies) == 11
    assert all("with check" in body.lower() and "auth.uid()" in body.lower() for body in insert_policies)
    assert MIGRATION.lower().count("alter table public.") >= 13


def test_every_update_policy_has_owner_using_and_with_check() -> None:
    sql = f"{SCHEMA}\n{MIGRATION}"
    policies = re.findall(
        r"create\s+policy\s+([\w\"]+)\s+on\s+[^;]+?\bfor\s+update\b([^;]*);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )

    assert policies
    for name, body in policies:
        assert re.search(r"\busing\s*\(", body, re.IGNORECASE), name
        assert re.search(r"\bwith\s+check\s*\(", body, re.IGNORECASE), name
        assert body.lower().count("auth.uid()") >= 2, name


def test_migration_grants_only_minimum_end_user_operations() -> None:
    grants = re.findall(
        r"grant\s+([\w,\s]+?)\s+on\s+(?:table\s+)?([^;]+?)\s+to\s+authenticated\s*;",
        MIGRATION,
        re.IGNORECASE,
    )
    table_grants = {
        table.strip().lower(): {privilege.strip().lower() for privilege in privileges.split(",")}
        for privileges, tables in grants
        if "function" not in tables.lower()
        for table in tables.split(",")
    }

    assert table_grants["public.study_notes"] == {"select", "insert"}
    assert table_grants["public.flashcards"] == {"select", "insert"}
    assert "public.quiz_history" not in table_grants
    assert "public.study_history" not in table_grants
    assert table_grants["public.study_sessions"] == {"select", "insert"}
    assert table_grants["public.quizzes"] == {"select", "insert"}
    assert table_grants["public.quiz_attempts"] == {"select", "insert"}
    assert table_grants["public.flashcard_reviews"] == {"select", "insert", "update"}
    assert table_grants["public.tutor_conversations"] == {"select", "insert"}
    assert table_grants["public.tutor_messages"] == {"select", "insert"}
    assert table_grants["public.study_activity"] == {"select", "insert"}
    assert table_grants["public.study_progress"] == {"select", "insert", "update"}
    assert table_grants["public.user_settings"] == {"select", "insert", "update"}
    assert all("delete" not in privileges for privileges in table_grants.values())
    assert "public.study_history, public.quiz_history" in MIGRATION.lower()
    assert "grant usage on sequence public.study_notes_id_seq, public.flashcards_id_seq to authenticated" in MIGRATION.lower()
    assert "service_role" not in MIGRATION.lower()
    assert "revoke all on tables from anon, authenticated" in MIGRATION.lower()
    assert "revoke all on sequences from anon, authenticated" in MIGRATION.lower()
    assert "revoke execute on functions from anon, authenticated" in MIGRATION.lower()


def test_schema_bootstrap_does_not_blindly_drop_policies() -> None:
    assert not re.search(r"\bdrop\s+policy\b", SCHEMA, re.IGNORECASE)
    assert "Policy conflict" in SCHEMA
    assert "Unexpected policies" in SCHEMA


def test_migration_checks_existing_columns_constraints_and_foreign_keys() -> None:
    assert "Baseline conflict" in MIGRATION
    assert "Cannot safely normalize flashcards.flashcard_content" in MIGRATION
    assert "Review existing policies before migration" in MIGRATION


def test_migration_versioned_rpc_is_invoker_and_not_replace() -> None:
    assert "create or replace function" not in MIGRATION.lower()
    assert "create function public.increment_study_progress_v1" in MIGRATION.lower()
    assert "security invoker" in MIGRATION.lower()
    assert "revoke all on function public.increment_study_progress_v1(text) from public, anon, authenticated" in MIGRATION.lower()


def test_local_rls_suite_covers_ownership_and_least_privilege_cases() -> None:
    required_cases = (
        "User A reads own note",
        "User A cannot read User B note",
        "User A cannot change row ownership",
        "note cannot link to User B session",
        "attempt cannot link to User B quiz",
        "review cannot link to User B flashcards",
        "message cannot link to User B conversation",
        "anonymous cannot read study notes",
        "Unattributed note stays hidden",
    )
    for case in required_cases:
        assert case in LOCAL_RLS
    assert "rollback;" in LOCAL_RLS.lower()
    assert "local only" in LOCAL_RLS.lower()
