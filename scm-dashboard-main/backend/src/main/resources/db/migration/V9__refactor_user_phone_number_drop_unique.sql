-- Phone number should NOT be globally unique.
-- Without this, registering with a different email but same phone number fails.

-- 1) Drop the UNIQUE constraint created by: "phone_number varchar(20) unique"
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'platform_user'
      AND tc.constraint_type = 'UNIQUE'
      AND kcu.column_name = 'phone_number';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.platform_user DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

-- 2) Drop any UNIQUE index that might exist on phone_number (belt + suspenders)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'platform_user'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexdef ILIKE '%phone_number%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.indexname);
    END LOOP;
END $$;

