BEGIN;

DROP POLICY IF EXISTS orgawork_organizations_user_lookup_policy
  ON public.orgawork_organizations;

CREATE POLICY orgawork_organizations_user_lookup_policy
  ON public.orgawork_organizations
  FOR SELECT
  TO orgawork_runtime
  USING (
    EXISTS (
      SELECT 1
      FROM public.orgawork_memberships AS membership
      WHERE membership.organization_id = orgawork_organizations.id
        AND membership.user_id = public.orgawork_current_user_id()
        AND membership.status = 'active'
    )
  );

COMMIT;
