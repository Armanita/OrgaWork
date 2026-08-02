ALTER ROLE orgawork_migration NOBYPASSRLS;
ALTER ROLE orgawork_runtime NOBYPASSRLS;

CREATE OR REPLACE FUNCTION public.orgawork_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $orgawork_current_organization$
  SELECT NULLIF(current_setting('orgawork.organization_id', true), '')::uuid
$orgawork_current_organization$;

REVOKE ALL
  ON FUNCTION public.orgawork_current_organization_id()
  FROM PUBLIC;
GRANT EXECUTE
  ON FUNCTION public.orgawork_current_organization_id()
  TO orgawork_runtime;

CREATE TABLE IF NOT EXISTS public.orgawork_outbox (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  topic text NOT NULL CHECK (btrim(topic) <> ''),
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  UNIQUE (organization_id, idempotency_key),
  CONSTRAINT orgawork_outbox_available_time_check
    CHECK (available_at >= occurred_at),
  CONSTRAINT orgawork_outbox_published_time_check
    CHECK (published_at IS NULL OR published_at >= occurred_at)
);

CREATE TABLE IF NOT EXISTS public.orgawork_inbox (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  consumer_name text NOT NULL CHECK (btrim(consumer_name) <> ''),
  message_id uuid NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz,
  failure_code text,
  UNIQUE (organization_id, consumer_name, message_id),
  CONSTRAINT orgawork_inbox_processed_time_check
    CHECK (processed_at IS NULL OR processed_at >= received_at)
);

CREATE TABLE IF NOT EXISTS public.orgawork_process_heartbeat (
  process_name text NOT NULL CHECK (btrim(process_name) <> ''),
  instance_id text NOT NULL CHECK (btrim(instance_id) <> ''),
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  stopped_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (process_name, instance_id),
  CONSTRAINT orgawork_process_heartbeat_seen_time_check
    CHECK (last_seen_at >= started_at),
  CONSTRAINT orgawork_process_heartbeat_lease_time_check
    CHECK (lease_expires_at >= last_seen_at),
  CONSTRAINT orgawork_process_heartbeat_stopped_time_check
    CHECK (stopped_at IS NULL OR stopped_at >= started_at)
);

ALTER TABLE public.orgawork_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_inbox FORCE ROW LEVEL SECURITY;

DO $orgawork_outbox_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orgawork_outbox'
      AND policyname = 'orgawork_outbox_organization_policy'
  ) THEN
    CREATE POLICY orgawork_outbox_organization_policy
      ON public.orgawork_outbox
      FOR ALL
      TO orgawork_runtime
      USING (
        organization_id = public.orgawork_current_organization_id()
      )
      WITH CHECK (
        organization_id = public.orgawork_current_organization_id()
      );
  END IF;
END
$orgawork_outbox_policy$;

DO $orgawork_inbox_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orgawork_inbox'
      AND policyname = 'orgawork_inbox_organization_policy'
  ) THEN
    CREATE POLICY orgawork_inbox_organization_policy
      ON public.orgawork_inbox
      FOR ALL
      TO orgawork_runtime
      USING (
        organization_id = public.orgawork_current_organization_id()
      )
      WITH CHECK (
        organization_id = public.orgawork_current_organization_id()
      );
  END IF;
END
$orgawork_inbox_policy$;

REVOKE ALL ON TABLE public.orgawork_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_inbox FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_process_heartbeat FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_outbox
  TO orgawork_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_inbox
  TO orgawork_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_process_heartbeat
  TO orgawork_runtime;
