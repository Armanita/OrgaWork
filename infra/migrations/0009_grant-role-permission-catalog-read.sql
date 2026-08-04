BEGIN;

REVOKE ALL ON TABLE public.orgawork_role_permissions FROM PUBLIC;

GRANT SELECT
  ON TABLE public.orgawork_role_permissions
  TO orgawork_runtime;

COMMIT;
