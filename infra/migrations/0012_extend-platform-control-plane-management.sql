ALTER TABLE public.orgawork_platform_provisioning_audit
  DROP CONSTRAINT orgawork_platform_audit_action_check;

ALTER TABLE public.orgawork_platform_provisioning_audit
  ADD CONSTRAINT orgawork_platform_audit_action_check
  CHECK (
    action IN (
      'organization.create',
      'organization.rename',
      'organization_admin.provision',
      'organization_admin.revoke'
    )
  );

ALTER TABLE public.orgawork_platform_idempotency
  DROP CONSTRAINT orgawork_platform_idempotency_operation_check;

ALTER TABLE public.orgawork_platform_idempotency
  ADD CONSTRAINT orgawork_platform_idempotency_operation_check
  CHECK (
    operation IN (
      'organization.create',
      'organization.rename',
      'organization_admin.provision',
      'organization_admin.revoke'
    )
  );

CREATE POLICY orgawork_platform_audit_active_operator_select_all
  ON public.orgawork_platform_provisioning_audit
  FOR SELECT
  TO orgawork_runtime
  USING (
    EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_organizations_platform_operator_list_select
  ON public.orgawork_organizations
  FOR SELECT
  TO orgawork_runtime
  USING (
    EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_organizations_platform_target_update
  ON public.orgawork_organizations
  FOR UPDATE
  TO orgawork_runtime
  USING (
    id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  )
  WITH CHECK (
    id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );

CREATE POLICY orgawork_memberships_platform_target_update
  ON public.orgawork_memberships
  FOR UPDATE
  TO orgawork_runtime
  USING (
    organization_id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  )
  WITH CHECK (
    organization_id = public.orgawork_current_platform_target_organization_id()
    AND EXISTS (
      SELECT 1
        FROM public.orgawork_platform_operators AS platform_operator
       WHERE platform_operator.user_id = public.orgawork_current_user_id()
         AND platform_operator.status = 'active'
    )
  );
