BEGIN;

CREATE OR REPLACE FUNCTION public.orgawork_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $orgawork_current_user$
  SELECT NULLIF(current_setting('orgawork.user_id', true), '')::uuid
$orgawork_current_user$;

REVOKE ALL ON FUNCTION public.orgawork_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orgawork_current_user_id() TO orgawork_runtime;

CREATE TABLE public.orgawork_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.orgawork_users(id) ON DELETE CASCADE,
  secret_hash text NOT NULL UNIQUE CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
  csrf_token text NOT NULL CHECK (length(csrf_token) >= 32),
  status text NOT NULL CHECK (status IN ('active','revoked','expired')),
  session_revision integer NOT NULL DEFAULT 1 CHECK (session_revision >= 1),
  current_organization_id uuid NULL REFERENCES public.orgawork_organizations(id),
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  CHECK (idle_expires_at <= absolute_expires_at),
  CHECK (absolute_expires_at <= created_at + interval '7 days')
);
CREATE INDEX orgawork_sessions_user_status_idx ON public.orgawork_sessions(user_id,status);
CREATE INDEX orgawork_sessions_expiry_idx ON public.orgawork_sessions(status,idle_expires_at,absolute_expires_at);

CREATE TABLE public.orgawork_login_rate_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  failure_count integer NOT NULL CHECK (failure_count >= 0),
  window_started_at timestamptz NOT NULL,
  blocked_until timestamptz NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE public.orgawork_password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.orgawork_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('active','consumed','revoked')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  consumed_at timestamptz NULL
);
CREATE INDEX orgawork_password_reset_tokens_user_status_idx ON public.orgawork_password_reset_tokens(user_id,status);

ALTER TABLE public.orgawork_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_login_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_login_rate_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_password_reset_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY orgawork_memberships_user_lookup_policy
  ON public.orgawork_memberships
  FOR SELECT
  TO orgawork_runtime
  USING (user_id = public.orgawork_current_user_id());

CREATE POLICY orgawork_organizations_user_lookup_policy
  ON public.orgawork_organizations
  FOR SELECT
  TO orgawork_runtime
  USING (
    EXISTS (
      SELECT 1
      FROM public.orgawork_memberships AS membership
      WHERE membership.organization_id = id
        AND membership.user_id = public.orgawork_current_user_id()
        AND membership.status = 'active'
    )
  );

CREATE POLICY orgawork_sessions_runtime_policy ON public.orgawork_sessions TO orgawork_runtime USING (true) WITH CHECK (true);
CREATE POLICY orgawork_login_rate_limits_runtime_policy ON public.orgawork_login_rate_limits TO orgawork_runtime USING (true) WITH CHECK (true);
CREATE POLICY orgawork_password_reset_tokens_runtime_policy ON public.orgawork_password_reset_tokens TO orgawork_runtime USING (true) WITH CHECK (true);

GRANT SELECT,INSERT,UPDATE,DELETE ON public.orgawork_sessions,public.orgawork_login_rate_limits,public.orgawork_password_reset_tokens TO orgawork_runtime;
COMMIT;
