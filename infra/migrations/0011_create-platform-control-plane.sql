DO $orgawork_oa_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.orgawork_membership_roles
     WHERE role_key = 'platform_operator'
  ) THEN
    RAISE EXCEPTION 'Historical platform_operator tenant membership roles must be remediated before OA migration'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.orgawork_role_permissions
     WHERE role_key = 'platform_operator'
  ) THEN
    RAISE EXCEPTION 'Historical platform_operator tenant permissions must be remediated before OA migration'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.orgawork_invitations
     WHERE role_key = 'organization_admin'
  ) THEN
    RAISE EXCEPTION 'Historical organization_admin invitations must be remediated before OA migration'
      USING ERRCODE = '23514';
  END IF;
END
$orgawork_oa_preflight$;

ALTER TABLE public.orgawork_role_permissions
  DROP CONSTRAINT IF EXISTS orgawork_role_permissions_role_key_check;
ALTER TABLE public.orgawork_role_permissions
  ADD CONSTRAINT orgawork_role_permissions_role_key_check
  CHECK (role_key IN ('member', 'manager', 'organization_admin'));

ALTER TABLE public.orgawork_membership_roles
  DROP CONSTRAINT IF EXISTS orgawork_membership_roles_role_key_check;
ALTER TABLE public.orgawork_membership_roles
  ADD CONSTRAINT orgawork_membership_roles_role_key_check
  CHECK (role_key IN ('member', 'manager', 'organization_admin'));

ALTER TABLE public.orgawork_invitations
  DROP CONSTRAINT IF EXISTS orgawork_invitations_role_key_check;
ALTER TABLE public.orgawork_invitations
  ADD CONSTRAINT orgawork_invitations_role_key_check
  CHECK (role_key IN ('member', 'manager'));

CREATE TABLE public.orgawork_platform_operators (
  user_id uuid PRIMARY KEY,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_platform_operators_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.orgawork_users (id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_platform_operators_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT orgawork_platform_operators_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_platform_operators_updated_time_check
    CHECK (updated_at >= created_at)
);

CREATE TABLE public.orgawork_platform_provisioning_audit (
  id uuid PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  organization_id uuid NULL,
  target_user_id uuid NULL,
  request_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  result text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT orgawork_platform_audit_actor_fk
    FOREIGN KEY (actor_user_id)
    REFERENCES public.orgawork_users (id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_platform_audit_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.orgawork_organizations (id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_platform_audit_target_user_fk
    FOREIGN KEY (target_user_id)
    REFERENCES public.orgawork_users (id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_platform_audit_action_check
    CHECK (action IN ('organization.create', 'organization_admin.provision')),
  CONSTRAINT orgawork_platform_audit_reason_check
    CHECK (
      reason = btrim(reason)
      AND char_length(reason) BETWEEN 10 AND 500
    ),
  CONSTRAINT orgawork_platform_audit_result_check
    CHECK (result IN ('succeeded', 'failed'))
);

CREATE INDEX orgawork_platform_audit_actor_created_index
  ON public.orgawork_platform_provisioning_audit (actor_user_id, created_at DESC);

CREATE TABLE public.orgawork_platform_idempotency (
  actor_user_id uuid NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  result_json jsonb NOT NULL,
  request_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (actor_user_id, operation, idempotency_key),
  CONSTRAINT orgawork_platform_idempotency_actor_fk
    FOREIGN KEY (actor_user_id)
    REFERENCES public.orgawork_users (id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_platform_idempotency_operation_check
    CHECK (operation IN ('organization.create', 'organization_admin.provision')),
  CONSTRAINT orgawork_platform_idempotency_key_check
    CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  CONSTRAINT orgawork_platform_idempotency_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE OR REPLACE FUNCTION public.orgawork_current_platform_target_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $orgawork_current_platform_target_organization_id$
  SELECT NULLIF(
    current_setting('orgawork.platform_target_organization_id', true),
    ''
  )::uuid
$orgawork_current_platform_target_organization_id$;

ALTER TABLE public.orgawork_platform_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_platform_operators FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_platform_provisioning_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_platform_provisioning_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_platform_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_platform_idempotency FORCE ROW LEVEL SECURITY;

CREATE POLICY orgawork_platform_operators_self_select
  ON public.orgawork_platform_operators
  FOR SELECT
  TO orgawork_runtime
  USING (user_id = public.orgawork_current_user_id());

CREATE POLICY orgawork_platform_audit_self_select
  ON public.orgawork_platform_provisioning_audit
  FOR SELECT
  TO orgawork_runtime
  USING (actor_user_id = public.orgawork_current_user_id());

CREATE POLICY orgawork_platform_audit_active_operator_insert
  ON public.orgawork_platform_provisioning_audit
  FOR INSERT
  TO orgawork_runtime
  WITH CHECK (
    actor_user_id = public.orgawork_current_user_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_platform_idempotency_self_select
  ON public.orgawork_platform_idempotency
  FOR SELECT
  TO orgawork_runtime
  USING (actor_user_id = public.orgawork_current_user_id());

CREATE POLICY orgawork_platform_idempotency_active_operator_insert
  ON public.orgawork_platform_idempotency
  FOR INSERT
  TO orgawork_runtime
  WITH CHECK (
    actor_user_id = public.orgawork_current_user_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_organizations_platform_target_select
  ON public.orgawork_organizations
  FOR SELECT
  TO orgawork_runtime
  USING (
    id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_organizations_platform_target_insert
  ON public.orgawork_organizations
  FOR INSERT
  TO orgawork_runtime
  WITH CHECK (
    id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_memberships_platform_target_select
  ON public.orgawork_memberships
  FOR SELECT
  TO orgawork_runtime
  USING (
    organization_id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_memberships_platform_target_insert
  ON public.orgawork_memberships
  FOR INSERT
  TO orgawork_runtime
  WITH CHECK (
    organization_id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_membership_roles_platform_target_select
  ON public.orgawork_membership_roles
  FOR SELECT
  TO orgawork_runtime
  USING (
    EXISTS (
      SELECT 1
        FROM public.orgawork_memberships AS membership
       WHERE membership.id = membership_id
         AND membership.organization_id =
           public.orgawork_current_platform_target_organization_id()
    )
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_membership_roles_platform_target_insert
  ON public.orgawork_membership_roles
  FOR INSERT
  TO orgawork_runtime
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.orgawork_memberships AS membership
       WHERE membership.id = membership_id
         AND membership.organization_id =
           public.orgawork_current_platform_target_organization_id()
    )
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_membership_roles_platform_target_delete
  ON public.orgawork_membership_roles
  FOR DELETE
  TO orgawork_runtime
  USING (
    EXISTS (
      SELECT 1
        FROM public.orgawork_memberships AS membership
       WHERE membership.id = membership_id
         AND membership.organization_id =
           public.orgawork_current_platform_target_organization_id()
    )
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

REVOKE ALL ON TABLE public.orgawork_platform_operators FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_platform_provisioning_audit FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_platform_idempotency FROM PUBLIC;

GRANT SELECT
  ON TABLE public.orgawork_platform_operators
  TO orgawork_runtime;

GRANT SELECT, INSERT
  ON TABLE public.orgawork_platform_provisioning_audit
  TO orgawork_runtime;

GRANT SELECT, INSERT
  ON TABLE public.orgawork_platform_idempotency
  TO orgawork_runtime;

REVOKE ALL ON FUNCTION public.orgawork_current_platform_target_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orgawork_current_platform_target_organization_id()
  TO orgawork_runtime;
