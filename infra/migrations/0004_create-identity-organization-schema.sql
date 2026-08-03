
CREATE TABLE public.orgawork_users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_users_email_normalized_check
    CHECK (
      email = btrim(email)
      AND email = lower(email)
      AND position('@' IN email) > 1
      AND position('.' IN split_part(email, '@', 2)) > 1
    ),
  CONSTRAINT orgawork_users_status_check
    CHECK (status IN ('pending', 'active', 'disabled')),
  CONSTRAINT orgawork_users_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_users_updated_time_check
    CHECK (updated_at >= created_at),
  CONSTRAINT orgawork_users_email_unique
    UNIQUE (email)
);

CREATE TABLE public.orgawork_organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_organizations_name_check
    CHECK (btrim(name) <> '' AND name = btrim(name)),
  CONSTRAINT orgawork_organizations_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_organizations_updated_time_check
    CHECK (updated_at >= created_at)
);

CREATE TABLE public.orgawork_memberships (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_memberships_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.orgawork_users (id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_memberships_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.orgawork_organizations (id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_memberships_status_check
    CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  CONSTRAINT orgawork_memberships_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_memberships_updated_time_check
    CHECK (updated_at >= created_at),
  CONSTRAINT orgawork_memberships_user_organization_unique
    UNIQUE (organization_id, user_id),
  CONSTRAINT orgawork_memberships_id_organization_unique
    UNIQUE (id, organization_id)
);

CREATE TABLE public.orgawork_teams (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_teams_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.orgawork_organizations (id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_teams_name_check
    CHECK (btrim(name) <> '' AND name = btrim(name)),
  CONSTRAINT orgawork_teams_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_teams_updated_time_check
    CHECK (updated_at >= created_at),
  CONSTRAINT orgawork_teams_name_organization_unique
    UNIQUE (organization_id, name),
  CONSTRAINT orgawork_teams_id_organization_unique
    UNIQUE (id, organization_id)
);

CREATE TABLE public.orgawork_team_memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  team_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_team_memberships_team_organization_fk
    FOREIGN KEY (team_id, organization_id)
    REFERENCES public.orgawork_teams (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_team_memberships_membership_organization_fk
    FOREIGN KEY (membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_team_memberships_role_check
    CHECK (role IN ('member', 'team_manager')),
  CONSTRAINT orgawork_team_memberships_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_team_memberships_updated_time_check
    CHECK (updated_at >= created_at),
  CONSTRAINT orgawork_team_memberships_team_member_unique
    UNIQUE (team_id, membership_id),
  CONSTRAINT orgawork_team_memberships_id_organization_unique
    UNIQUE (id, organization_id)
);

CREATE INDEX orgawork_memberships_user_index
  ON public.orgawork_memberships (user_id);
CREATE INDEX orgawork_memberships_organization_status_index
  ON public.orgawork_memberships (organization_id, status);
CREATE INDEX orgawork_teams_organization_index
  ON public.orgawork_teams (organization_id);
CREATE INDEX orgawork_team_memberships_organization_index
  ON public.orgawork_team_memberships (organization_id);
CREATE INDEX orgawork_team_memberships_membership_index
  ON public.orgawork_team_memberships (membership_id);

CREATE OR REPLACE FUNCTION public.orgawork_validate_user_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_user_update$
BEGIN
  IF NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'User identity fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'User version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'pending' AND NEW.status IN ('active', 'disabled'))
    OR (OLD.status = 'active' AND NEW.status = 'disabled')
    OR (OLD.status = 'disabled' AND NEW.status = 'active')
  ) THEN
    RAISE EXCEPTION 'User status transition is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_user_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_organization_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_organization_update$
BEGIN
  IF NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Organization identity fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Organization version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_organization_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_membership_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_membership_update$
BEGIN
  IF (
    NEW.id <> OLD.id
    OR NEW.user_id <> OLD.user_id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.created_at <> OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Membership ownership fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Membership version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'invited' AND NEW.status IN ('active', 'revoked'))
    OR (OLD.status = 'active' AND NEW.status IN ('suspended', 'revoked'))
    OR (OLD.status = 'suspended' AND NEW.status IN ('active', 'revoked'))
  ) THEN
    RAISE EXCEPTION 'Membership status transition is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_membership_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_team_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_team_update$
BEGIN
  IF (
    NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.created_at <> OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Team ownership fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Team version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_team_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_team_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_team_membership$
DECLARE
  resolved_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.team_id <> OLD.team_id
    OR NEW.membership_id <> OLD.membership_id
    OR NEW.created_at <> OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Team membership ownership fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.version <> OLD.version + 1
    OR NEW.updated_at < OLD.updated_at
  ) THEN
    RAISE EXCEPTION 'Team membership version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  SELECT membership.status
    INTO resolved_status
    FROM public.orgawork_memberships AS membership
   WHERE membership.id = NEW.membership_id
     AND membership.organization_id = NEW.organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team membership target does not exist in the organization'
      USING ERRCODE = '23503';
  END IF;

  IF resolved_status <> 'active' THEN
    RAISE EXCEPTION 'Only active membership may join a team'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_team_membership$;

CREATE TRIGGER orgawork_users_validate_update
BEFORE UPDATE ON public.orgawork_users
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_user_update();

CREATE TRIGGER orgawork_organizations_validate_update
BEFORE UPDATE ON public.orgawork_organizations
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_organization_update();

CREATE TRIGGER orgawork_memberships_validate_update
BEFORE UPDATE ON public.orgawork_memberships
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_membership_update();

CREATE TRIGGER orgawork_teams_validate_update
BEFORE UPDATE ON public.orgawork_teams
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_team_update();

CREATE TRIGGER orgawork_team_memberships_validate
BEFORE INSERT OR UPDATE ON public.orgawork_team_memberships
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_team_membership();

ALTER TABLE public.orgawork_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_teams FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_team_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY orgawork_organizations_organization_policy
  ON public.orgawork_organizations
  FOR ALL
  TO orgawork_runtime
  USING (id = public.orgawork_current_organization_id())
  WITH CHECK (id = public.orgawork_current_organization_id());

CREATE POLICY orgawork_memberships_organization_policy
  ON public.orgawork_memberships
  FOR ALL
  TO orgawork_runtime
  USING (
    organization_id = public.orgawork_current_organization_id()
  )
  WITH CHECK (
    organization_id = public.orgawork_current_organization_id()
  );

CREATE POLICY orgawork_teams_organization_policy
  ON public.orgawork_teams
  FOR ALL
  TO orgawork_runtime
  USING (
    organization_id = public.orgawork_current_organization_id()
  )
  WITH CHECK (
    organization_id = public.orgawork_current_organization_id()
  );

CREATE POLICY orgawork_team_memberships_organization_policy
  ON public.orgawork_team_memberships
  FOR ALL
  TO orgawork_runtime
  USING (
    organization_id = public.orgawork_current_organization_id()
  )
  WITH CHECK (
    organization_id = public.orgawork_current_organization_id()
  );

REVOKE ALL ON TABLE public.orgawork_users FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_organizations FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_memberships FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_teams FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_team_memberships FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_users
  TO orgawork_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_organizations
  TO orgawork_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_memberships
  TO orgawork_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_teams
  TO orgawork_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.orgawork_team_memberships
  TO orgawork_runtime;

REVOKE ALL ON FUNCTION public.orgawork_validate_user_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_organization_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_membership_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_team_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_team_membership() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.orgawork_validate_user_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_organization_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_membership_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_team_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_team_membership()
  TO orgawork_runtime;
