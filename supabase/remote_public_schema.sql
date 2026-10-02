


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."flashcards" (
    "id" bigint NOT NULL,
    "user_email" "text",
    "topic" "text",
    "flashcard_content" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."flashcards" OWNER TO "postgres";


ALTER TABLE "public"."flashcards" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."flashcards_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_history" (
    "id" bigint NOT NULL,
    "user_email" "text",
    "topic" "text",
    "score" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."quiz_history" OWNER TO "postgres";


ALTER TABLE "public"."quiz_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."quiz_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."study_history" (
    "id" bigint NOT NULL,
    "user_email" "text",
    "topic" "text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."study_history" OWNER TO "postgres";


ALTER TABLE "public"."study_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."study_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."study_notes" (
    "id" bigint NOT NULL,
    "user_email" "text",
    "topic" "text",
    "difficulty" "text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."study_notes" OWNER TO "postgres";


ALTER TABLE "public"."study_notes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."study_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_history"
    ADD CONSTRAINT "quiz_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_history"
    ADD CONSTRAINT "study_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_notes"
    ADD CONSTRAINT "study_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."flashcards" TO "anon";
GRANT ALL ON TABLE "public"."flashcards" TO "authenticated";
GRANT ALL ON TABLE "public"."flashcards" TO "service_role";



GRANT ALL ON SEQUENCE "public"."flashcards_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."flashcards_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."flashcards_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_history" TO "anon";
GRANT ALL ON TABLE "public"."quiz_history" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quiz_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quiz_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quiz_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."study_history" TO "anon";
GRANT ALL ON TABLE "public"."study_history" TO "authenticated";
GRANT ALL ON TABLE "public"."study_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."study_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."study_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."study_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."study_notes" TO "anon";
GRANT ALL ON TABLE "public"."study_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."study_notes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."study_notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."study_notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."study_notes_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







