INSERT INTO public.orgawork_role_permissions (role_key, permission_key)
VALUES
  ('member', 'case.create_self'),
  ('manager', 'case.create_self');

CREATE TABLE public.orgawork_cases (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL,
  due_at timestamptz NULL,
  created_by_membership_id uuid NOT NULL,
  status text NOT NULL,
  cancellation_reason text NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_cases_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.orgawork_organizations (id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_cases_creator_organization_fk
    FOREIGN KEY (created_by_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_cases_title_check
    CHECK (btrim(title) <> '' AND title = btrim(title)),
  CONSTRAINT orgawork_cases_description_check
    CHECK (btrim(description) <> '' AND description = btrim(description)),
  CONSTRAINT orgawork_cases_priority_check
    CHECK (priority IN ('low', 'normal', 'high')),
  CONSTRAINT orgawork_cases_status_check
    CHECK (status IN ('open', 'resolved', 'closed', 'cancelled')),
  CONSTRAINT orgawork_cases_cancellation_check
    CHECK (
      (
        status = 'cancelled'
        AND cancellation_reason IS NOT NULL
        AND btrim(cancellation_reason) <> ''
      )
      OR (
        status <> 'cancelled'
        AND cancellation_reason IS NULL
      )
    ),
  CONSTRAINT orgawork_cases_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_cases_updated_time_check
    CHECK (updated_at >= created_at),
  CONSTRAINT orgawork_cases_id_organization_unique
    UNIQUE (id, organization_id)
);

CREATE TABLE public.orgawork_case_responsibilities (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL,
  target_kind text NOT NULL,
  target_membership_id uuid NULL,
  target_team_id uuid NULL,
  assigned_by_membership_id uuid NOT NULL,
  status text NOT NULL,
  acceptance_mode text NOT NULL,
  role text NOT NULL,
  accepted_by_membership_id uuid NULL,
  rejected_by_membership_id uuid NULL,
  rejection_reason text NULL,
  transferred_to_responsibility_id uuid NULL,
  accepted_at timestamptz NULL,
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_case_responsibilities_case_organization_fk
    FOREIGN KEY (case_id, organization_id)
    REFERENCES public.orgawork_cases (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_case_responsibilities_target_membership_organization_fk
    FOREIGN KEY (target_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_case_responsibilities_target_team_organization_fk
    FOREIGN KEY (target_team_id, organization_id)
    REFERENCES public.orgawork_teams (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_case_responsibilities_assigner_organization_fk
    FOREIGN KEY (assigned_by_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_case_responsibilities_acceptor_organization_fk
    FOREIGN KEY (accepted_by_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_case_responsibilities_rejector_organization_fk
    FOREIGN KEY (rejected_by_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_case_responsibilities_target_check
    CHECK (
      (
        target_kind = 'membership'
        AND target_membership_id IS NOT NULL
        AND target_team_id IS NULL
      )
      OR (
        target_kind = 'team'
        AND target_membership_id IS NULL
        AND target_team_id IS NOT NULL
      )
    ),
  CONSTRAINT orgawork_case_responsibilities_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'transferred', 'ended')),
  CONSTRAINT orgawork_case_responsibilities_acceptance_mode_check
    CHECK (acceptance_mode IN ('self', 'explicit', 'forced')),
  CONSTRAINT orgawork_case_responsibilities_role_check
    CHECK (role IN ('primary', 'collaborator')),
  CONSTRAINT orgawork_case_responsibilities_self_acceptance_check
    CHECK (
      acceptance_mode <> 'self'
      OR (
        target_kind = 'membership'
        AND accepted_by_membership_id = target_membership_id
        AND accepted_at IS NOT NULL
        AND status IN ('accepted', 'transferred', 'ended')
      )
    ),
  CONSTRAINT orgawork_case_responsibilities_status_time_check
    CHECK (
      (
        status = 'pending'
        AND accepted_at IS NULL
        AND ended_at IS NULL
      )
      OR (
        status = 'accepted'
        AND accepted_at IS NOT NULL
        AND ended_at IS NULL
      )
      OR (
        status = 'rejected'
        AND accepted_at IS NULL
        AND ended_at IS NOT NULL
      )
      OR (
        status = 'transferred'
        AND accepted_at IS NOT NULL
        AND ended_at IS NOT NULL
      )
      OR (
        status = 'ended'
        AND ended_at IS NOT NULL
      )
    ),
  CONSTRAINT orgawork_case_responsibilities_rejection_check
    CHECK (
      (
        status = 'rejected'
        AND rejected_by_membership_id IS NOT NULL
        AND rejection_reason IS NOT NULL
        AND btrim(rejection_reason) <> ''
      )
      OR (
        status <> 'rejected'
        AND rejected_by_membership_id IS NULL
        AND rejection_reason IS NULL
      )
    ),
  CONSTRAINT orgawork_case_responsibilities_transfer_check
    CHECK (
      (
        status = 'transferred'
        AND transferred_to_responsibility_id IS NOT NULL
      )
      OR (
        status <> 'transferred'
        AND transferred_to_responsibility_id IS NULL
      )
    ),
  CONSTRAINT orgawork_case_responsibilities_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_case_responsibilities_updated_time_check
    CHECK (updated_at >= created_at),
  CONSTRAINT orgawork_case_responsibilities_end_time_check
    CHECK (ended_at IS NULL OR ended_at >= created_at),
  CONSTRAINT orgawork_case_responsibilities_id_case_organization_unique
    UNIQUE (id, case_id, organization_id),
  CONSTRAINT orgawork_case_responsibilities_transfer_case_organization_fk
    FOREIGN KEY (transferred_to_responsibility_id, case_id, organization_id)
    REFERENCES public.orgawork_case_responsibilities (id, case_id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.orgawork_actions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL,
  source_responsibility_id uuid NULL,
  responsible_kind text NOT NULL,
  responsible_membership_id uuid NULL,
  responsible_team_id uuid NULL,
  created_by_membership_id uuid NOT NULL,
  kind text NOT NULL,
  parent_action_id uuid NULL,
  title text NOT NULL,
  due_at timestamptz NULL,
  status text NOT NULL,
  cancellation_reason text NULL,
  cancelled_by_membership_id uuid NULL,
  created_at timestamptz NOT NULL,
  started_at timestamptz NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_actions_case_organization_fk
    FOREIGN KEY (case_id, organization_id)
    REFERENCES public.orgawork_cases (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_actions_source_responsibility_case_organization_fk
    FOREIGN KEY (source_responsibility_id, case_id, organization_id)
    REFERENCES public.orgawork_case_responsibilities (id, case_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_actions_responsible_membership_organization_fk
    FOREIGN KEY (responsible_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_actions_responsible_team_organization_fk
    FOREIGN KEY (responsible_team_id, organization_id)
    REFERENCES public.orgawork_teams (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_actions_creator_organization_fk
    FOREIGN KEY (created_by_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_actions_canceller_organization_fk
    FOREIGN KEY (cancelled_by_membership_id, organization_id)
    REFERENCES public.orgawork_memberships (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_actions_responsible_check
    CHECK (
      (
        responsible_kind = 'membership'
        AND responsible_membership_id IS NOT NULL
        AND responsible_team_id IS NULL
      )
      OR (
        responsible_kind = 'team'
        AND responsible_membership_id IS NULL
        AND responsible_team_id IS NOT NULL
      )
    ),
  CONSTRAINT orgawork_actions_kind_check
    CHECK (kind IN ('primary', 'secondary')),
  CONSTRAINT orgawork_actions_parent_kind_check
    CHECK (
      (kind = 'primary' AND parent_action_id IS NULL)
      OR
      (kind = 'secondary' AND parent_action_id IS NOT NULL)
    ),
  CONSTRAINT orgawork_actions_title_check
    CHECK (btrim(title) <> '' AND title = btrim(title)),
  CONSTRAINT orgawork_actions_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT orgawork_actions_status_time_check
    CHECK (
      (status = 'pending' AND started_at IS NULL)
      OR (status IN ('in_progress', 'completed') AND started_at IS NOT NULL)
      OR status = 'cancelled'
    ),
  CONSTRAINT orgawork_actions_cancellation_check
    CHECK (
      (
        status = 'cancelled'
        AND cancelled_by_membership_id IS NOT NULL
        AND cancellation_reason IS NOT NULL
        AND btrim(cancellation_reason) <> ''
      )
      OR (
        status <> 'cancelled'
        AND cancelled_by_membership_id IS NULL
        AND cancellation_reason IS NULL
      )
    ),
  CONSTRAINT orgawork_actions_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_actions_updated_time_check
    CHECK (updated_at >= created_at),
  CONSTRAINT orgawork_actions_started_time_check
    CHECK (started_at IS NULL OR started_at >= created_at),
  CONSTRAINT orgawork_actions_id_case_organization_unique
    UNIQUE (id, case_id, organization_id),
  CONSTRAINT orgawork_actions_parent_case_organization_fk
    FOREIGN KEY (parent_action_id, case_id, organization_id)
    REFERENCES public.orgawork_actions (id, case_id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.orgawork_case_current_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL,
  kind text NOT NULL,
  action_id uuid NULL,
  responsibility_id uuid NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  CONSTRAINT orgawork_case_current_work_case_organization_fk
    FOREIGN KEY (case_id, organization_id)
    REFERENCES public.orgawork_cases (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_case_current_work_action_case_organization_fk
    FOREIGN KEY (action_id, case_id, organization_id)
    REFERENCES public.orgawork_actions (id, case_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_case_current_work_responsibility_case_organization_fk
    FOREIGN KEY (responsibility_id, case_id, organization_id)
    REFERENCES public.orgawork_case_responsibilities (id, case_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT orgawork_case_current_work_target_check
    CHECK (
      (
        kind = 'action'
        AND action_id IS NOT NULL
        AND responsibility_id IS NULL
      )
      OR (
        kind = 'responsibility_acceptance'
        AND action_id IS NULL
        AND responsibility_id IS NOT NULL
      )
    ),
  CONSTRAINT orgawork_case_current_work_time_check
    CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT orgawork_case_current_work_id_case_organization_unique
    UNIQUE (id, case_id, organization_id)
);

CREATE TABLE public.orgawork_idempotency_records (
  organization_id uuid NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  request_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  state text NOT NULL,
  resource_id uuid NULL,
  response_status integer NULL,
  result_snapshot jsonb NULL,
  created_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  PRIMARY KEY (organization_id, operation, idempotency_key),
  CONSTRAINT orgawork_idempotency_records_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.orgawork_organizations (id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_idempotency_records_operation_check
    CHECK (btrim(operation) <> '' AND operation = btrim(operation)),
  CONSTRAINT orgawork_idempotency_records_key_check
    CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  CONSTRAINT orgawork_idempotency_records_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT orgawork_idempotency_records_state_check
    CHECK (state IN ('in_progress', 'completed')),
  CONSTRAINT orgawork_idempotency_records_completion_check
    CHECK (
      (
        state = 'in_progress'
        AND resource_id IS NULL
        AND response_status IS NULL
        AND result_snapshot IS NULL
        AND completed_at IS NULL
      )
      OR (
        state = 'completed'
        AND resource_id IS NOT NULL
        AND response_status BETWEEN 200 AND 599
        AND result_snapshot IS NOT NULL
        AND completed_at IS NOT NULL
        AND completed_at >= created_at
      )
    )
);

CREATE UNIQUE INDEX orgawork_case_responsibilities_active_primary_unique
  ON public.orgawork_case_responsibilities (organization_id, case_id)
  WHERE role = 'primary' AND status IN ('pending', 'accepted');

CREATE UNIQUE INDEX orgawork_actions_active_primary_unique
  ON public.orgawork_actions (organization_id, case_id)
  WHERE kind = 'primary' AND status IN ('pending', 'in_progress');

CREATE UNIQUE INDEX orgawork_case_current_work_active_unique
  ON public.orgawork_case_current_work (organization_id, case_id)
  WHERE ended_at IS NULL;

CREATE INDEX orgawork_cases_organization_status_index
  ON public.orgawork_cases (organization_id, status);

CREATE INDEX orgawork_case_responsibilities_organization_case_index
  ON public.orgawork_case_responsibilities (organization_id, case_id);

CREATE INDEX orgawork_actions_organization_case_index
  ON public.orgawork_actions (organization_id, case_id);

CREATE OR REPLACE FUNCTION public.orgawork_validate_work_management_case_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_work_management_case_update$
BEGIN
  IF (
    NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.created_by_membership_id <> OLD.created_by_membership_id
    OR NEW.created_at <> OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Work Management case ownership fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Work Management case version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'open' AND NEW.status IN ('resolved', 'cancelled'))
    OR (OLD.status = 'resolved' AND NEW.status IN ('closed', 'open'))
    OR (OLD.status = 'closed' AND NEW.status = 'open')
  ) THEN
    RAISE EXCEPTION 'Work Management case status transition is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_work_management_case_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_work_management_responsibility_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_work_management_responsibility_update$
BEGIN
  IF (
    NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.case_id <> OLD.case_id
    OR NEW.target_kind <> OLD.target_kind
    OR NEW.target_membership_id IS DISTINCT FROM OLD.target_membership_id
    OR NEW.target_team_id IS DISTINCT FROM OLD.target_team_id
    OR NEW.assigned_by_membership_id <> OLD.assigned_by_membership_id
    OR NEW.acceptance_mode <> OLD.acceptance_mode
    OR NEW.role <> OLD.role
    OR NEW.created_at <> OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Work Management responsibility ownership fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Work Management responsibility version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected', 'ended'))
    OR (OLD.status = 'accepted' AND NEW.status IN ('transferred', 'ended'))
  ) THEN
    RAISE EXCEPTION 'Work Management responsibility status transition is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_work_management_responsibility_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_work_management_action_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_work_management_action_update$
BEGIN
  IF (
    NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.case_id <> OLD.case_id
    OR NEW.source_responsibility_id IS DISTINCT FROM OLD.source_responsibility_id
    OR NEW.created_by_membership_id <> OLD.created_by_membership_id
    OR NEW.kind <> OLD.kind
    OR NEW.parent_action_id IS DISTINCT FROM OLD.parent_action_id
    OR NEW.created_at <> OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Work Management action ownership fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Work Management action version or timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'pending' AND NEW.status IN ('in_progress', 'cancelled'))
    OR (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Work Management action status transition is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_work_management_action_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_work_management_current_work_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_work_management_current_work_update$
BEGIN
  IF (
    NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.case_id <> OLD.case_id
    OR NEW.kind <> OLD.kind
    OR NEW.action_id IS DISTINCT FROM OLD.action_id
    OR NEW.responsibility_id IS DISTINCT FROM OLD.responsibility_id
    OR NEW.started_at <> OLD.started_at
  ) THEN
    RAISE EXCEPTION 'Work Management current-work identity fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL OR NEW.ended_at < OLD.started_at THEN
    RAISE EXCEPTION 'Work Management current-work end transition is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_work_management_current_work_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_work_management_idempotency_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_work_management_idempotency_update$
BEGIN
  IF (
    NEW.organization_id <> OLD.organization_id
    OR NEW.operation <> OLD.operation
    OR NEW.idempotency_key <> OLD.idempotency_key
    OR NEW.request_fingerprint <> OLD.request_fingerprint
    OR NEW.request_id <> OLD.request_id
    OR NEW.correlation_id <> OLD.correlation_id
    OR NEW.created_at <> OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Work Management idempotency identity fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state <> 'in_progress' OR NEW.state <> 'completed' THEN
    RAISE EXCEPTION 'Work Management idempotency state transition is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_work_management_idempotency_update$;

CREATE OR REPLACE FUNCTION public.orgawork_validate_work_management_case_invariants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_work_management_case_invariants$
DECLARE
  resolved_case_id uuid;
  resolved_organization_id uuid;
  resolved_case_status text;
  active_primary_count integer;
  active_current_work_count integer;
  active_current_work_kind text;
  active_action_status text;
  active_responsibility_status text;
  active_responsibility_role text;
BEGIN
  IF TG_TABLE_NAME = 'orgawork_cases' THEN
    IF TG_OP = 'DELETE' THEN
      resolved_case_id := OLD.id;
      resolved_organization_id := OLD.organization_id;
    ELSE
      resolved_case_id := NEW.id;
      resolved_organization_id := NEW.organization_id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      resolved_case_id := OLD.case_id;
      resolved_organization_id := OLD.organization_id;
    ELSE
      resolved_case_id := NEW.case_id;
      resolved_organization_id := NEW.organization_id;
    END IF;
  END IF;

  SELECT case_record.status
    INTO resolved_case_status
    FROM public.orgawork_cases AS case_record
   WHERE case_record.id = resolved_case_id
     AND case_record.organization_id = resolved_organization_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
    INTO active_primary_count
    FROM public.orgawork_case_responsibilities AS responsibility
   WHERE responsibility.organization_id = resolved_organization_id
     AND responsibility.case_id = resolved_case_id
     AND responsibility.role = 'primary'
     AND responsibility.status IN ('pending', 'accepted');

  SELECT count(*)
    INTO active_current_work_count
    FROM public.orgawork_case_current_work AS current_work
   WHERE current_work.organization_id = resolved_organization_id
     AND current_work.case_id = resolved_case_id
     AND current_work.ended_at IS NULL;

  IF resolved_case_status = 'open' THEN
    IF active_primary_count <> 1 THEN
      RAISE EXCEPTION 'Open Work Management case requires exactly one active primary responsibility'
        USING ERRCODE = '23514';
    END IF;

    IF active_current_work_count <> 1 THEN
      RAISE EXCEPTION 'Open Work Management case requires exactly one active current work'
        USING ERRCODE = '23514';
    END IF;

    SELECT
      current_work.kind,
      action.status,
      responsibility.status,
      responsibility.role
      INTO
        active_current_work_kind,
        active_action_status,
        active_responsibility_status,
        active_responsibility_role
      FROM public.orgawork_case_current_work AS current_work
      LEFT JOIN public.orgawork_actions AS action
        ON action.id = current_work.action_id
       AND action.case_id = current_work.case_id
       AND action.organization_id = current_work.organization_id
      LEFT JOIN public.orgawork_case_responsibilities AS responsibility
        ON responsibility.id = current_work.responsibility_id
       AND responsibility.case_id = current_work.case_id
       AND responsibility.organization_id = current_work.organization_id
     WHERE current_work.organization_id = resolved_organization_id
       AND current_work.case_id = resolved_case_id
       AND current_work.ended_at IS NULL;

    IF (
      active_current_work_kind = 'action'
      AND (
        active_action_status IS NULL
        OR active_action_status NOT IN ('pending', 'in_progress')
      )
    ) THEN
      RAISE EXCEPTION 'Work Management current action must be active'
        USING ERRCODE = '23514';
    END IF;

    IF (
      active_current_work_kind = 'responsibility_acceptance'
      AND (
        active_responsibility_status IS NULL
        OR active_responsibility_status <> 'pending'
        OR active_responsibility_role IS DISTINCT FROM 'primary'
      )
    ) THEN
      RAISE EXCEPTION 'Work Management responsibility-acceptance current work must target a pending primary responsibility'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF active_primary_count <> 0 OR active_current_work_count <> 0 THEN
      RAISE EXCEPTION 'Inactive Work Management case cannot keep active responsibility or current work'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END
$orgawork_validate_work_management_case_invariants$;

CREATE TRIGGER orgawork_cases_validate_update
BEFORE UPDATE ON public.orgawork_cases
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_case_update();

CREATE TRIGGER orgawork_case_responsibilities_validate_update
BEFORE UPDATE ON public.orgawork_case_responsibilities
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_responsibility_update();

CREATE TRIGGER orgawork_actions_validate_update
BEFORE UPDATE ON public.orgawork_actions
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_action_update();

CREATE TRIGGER orgawork_case_current_work_validate_update
BEFORE UPDATE ON public.orgawork_case_current_work
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_current_work_update();

CREATE TRIGGER orgawork_idempotency_records_validate_update
BEFORE UPDATE ON public.orgawork_idempotency_records
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_idempotency_update();

CREATE CONSTRAINT TRIGGER orgawork_cases_validate_p3_invariants
AFTER INSERT OR UPDATE OR DELETE ON public.orgawork_cases
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_case_invariants();

CREATE CONSTRAINT TRIGGER orgawork_case_responsibilities_validate_p3_invariants
AFTER INSERT OR UPDATE OR DELETE ON public.orgawork_case_responsibilities
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_case_invariants();

CREATE CONSTRAINT TRIGGER orgawork_actions_validate_p3_invariants
AFTER INSERT OR UPDATE OR DELETE ON public.orgawork_actions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_case_invariants();

CREATE CONSTRAINT TRIGGER orgawork_case_current_work_validate_p3_invariants
AFTER INSERT OR UPDATE OR DELETE ON public.orgawork_case_current_work
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_work_management_case_invariants();

ALTER TABLE public.orgawork_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_case_responsibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_case_responsibilities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_case_current_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_case_current_work FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_idempotency_records FORCE ROW LEVEL SECURITY;

CREATE POLICY orgawork_cases_organization_policy
  ON public.orgawork_cases
  FOR ALL
  TO orgawork_runtime
  USING (organization_id = public.orgawork_current_organization_id())
  WITH CHECK (organization_id = public.orgawork_current_organization_id());

CREATE POLICY orgawork_case_responsibilities_organization_policy
  ON public.orgawork_case_responsibilities
  FOR ALL
  TO orgawork_runtime
  USING (organization_id = public.orgawork_current_organization_id())
  WITH CHECK (organization_id = public.orgawork_current_organization_id());

CREATE POLICY orgawork_actions_organization_policy
  ON public.orgawork_actions
  FOR ALL
  TO orgawork_runtime
  USING (organization_id = public.orgawork_current_organization_id())
  WITH CHECK (organization_id = public.orgawork_current_organization_id());

CREATE POLICY orgawork_case_current_work_organization_policy
  ON public.orgawork_case_current_work
  FOR ALL
  TO orgawork_runtime
  USING (organization_id = public.orgawork_current_organization_id())
  WITH CHECK (organization_id = public.orgawork_current_organization_id());

CREATE POLICY orgawork_idempotency_records_organization_policy
  ON public.orgawork_idempotency_records
  FOR ALL
  TO orgawork_runtime
  USING (organization_id = public.orgawork_current_organization_id())
  WITH CHECK (organization_id = public.orgawork_current_organization_id());

REVOKE ALL ON TABLE public.orgawork_cases FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_case_responsibilities FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_actions FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_case_current_work FROM PUBLIC;
REVOKE ALL ON TABLE public.orgawork_idempotency_records FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.orgawork_cases
  TO orgawork_runtime;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.orgawork_case_responsibilities
  TO orgawork_runtime;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.orgawork_actions
  TO orgawork_runtime;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.orgawork_case_current_work
  TO orgawork_runtime;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.orgawork_idempotency_records
  TO orgawork_runtime;

REVOKE ALL ON FUNCTION public.orgawork_validate_work_management_case_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_work_management_responsibility_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_work_management_action_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_work_management_current_work_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_work_management_idempotency_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orgawork_validate_work_management_case_invariants() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.orgawork_validate_work_management_case_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_work_management_responsibility_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_work_management_action_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_work_management_current_work_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_work_management_idempotency_update()
  TO orgawork_runtime;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_work_management_case_invariants()
  TO orgawork_runtime;
