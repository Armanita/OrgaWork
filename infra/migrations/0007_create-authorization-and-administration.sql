BEGIN;
CREATE TABLE public.orgawork_role_permissions (
  role_key text NOT NULL CHECK (role_key IN ('member','manager','organization_admin','platform_operator')),
  permission_key text NOT NULL,
  PRIMARY KEY (role_key,permission_key)
);
INSERT INTO public.orgawork_role_permissions(role_key,permission_key) VALUES
 ('member','organization.view'),('member','task.view'),
 ('manager','organization.view'),('manager','task.view'),('manager','task.update'),('manager','task.assign'),('manager','report.view'),
 ('organization_admin','organization.view'),('organization_admin','organization.manage_members'),('organization_admin','organization.manage_teams'),('organization_admin','organization.manage_roles'),('organization_admin','task.view'),('organization_admin','task.update'),('organization_admin','task.assign'),('organization_admin','report.view');

CREATE TABLE public.orgawork_membership_roles (
  membership_id uuid NOT NULL REFERENCES public.orgawork_memberships(id) ON DELETE CASCADE,
  role_key text NOT NULL CHECK (role_key IN ('member','manager','organization_admin','platform_operator')),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (membership_id,role_key)
);
CREATE TABLE public.orgawork_explicit_denials (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.orgawork_organizations(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.orgawork_memberships(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  resource_type text NULL,
  resource_id uuid NULL,
  reason text NOT NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX orgawork_explicit_denials_lookup_idx ON public.orgawork_explicit_denials(organization_id,membership_id,permission_key,resource_type,resource_id);
CREATE TABLE public.orgawork_authorization_audit (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission_key text NOT NULL,
  resource_type text NULL,
  resource_id uuid NULL,
  allowed boolean NOT NULL,
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE public.orgawork_invitations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.orgawork_organizations(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  role_key text NOT NULL CHECK (role_key IN ('member','manager','organization_admin')),
  status text NOT NULL CHECK (status IN ('active','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  revoked_at timestamptz NULL
);
CREATE UNIQUE INDEX orgawork_invitations_active_unique ON public.orgawork_invitations(organization_id,email_normalized) WHERE status='active';

ALTER TABLE public.orgawork_membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_membership_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_explicit_denials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_explicit_denials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_authorization_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_authorization_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY orgawork_membership_roles_tenant ON public.orgawork_membership_roles TO orgawork_runtime USING (EXISTS (SELECT 1 FROM public.orgawork_memberships m WHERE m.id=membership_id AND m.organization_id=public.orgawork_current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.orgawork_memberships m WHERE m.id=membership_id AND m.organization_id=public.orgawork_current_organization_id()));
CREATE POLICY orgawork_explicit_denials_tenant ON public.orgawork_explicit_denials TO orgawork_runtime USING (organization_id=public.orgawork_current_organization_id()) WITH CHECK (organization_id=public.orgawork_current_organization_id());
CREATE POLICY orgawork_authorization_audit_tenant ON public.orgawork_authorization_audit TO orgawork_runtime USING (organization_id=public.orgawork_current_organization_id()) WITH CHECK (organization_id=public.orgawork_current_organization_id());
CREATE POLICY orgawork_invitations_token_lookup
  ON public.orgawork_invitations
  FOR SELECT
  TO orgawork_runtime
  USING (
    token_hash = NULLIF(
      current_setting('orgawork.invitation_token_hash', true),
      ''
    )
  );
CREATE POLICY orgawork_invitations_tenant ON public.orgawork_invitations TO orgawork_runtime USING (organization_id=public.orgawork_current_organization_id()) WITH CHECK (organization_id=public.orgawork_current_organization_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orgawork_membership_roles,public.orgawork_explicit_denials,public.orgawork_authorization_audit,public.orgawork_invitations TO orgawork_runtime;
COMMIT;
