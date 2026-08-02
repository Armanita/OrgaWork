CREATE TABLE IF NOT EXISTS public.orgawork_migration_history (
  version integer PRIMARY KEY CHECK (version > 0),
  name text NOT NULL,
  file_name text NOT NULL UNIQUE,
  fingerprint char(64) NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  applied_order bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
