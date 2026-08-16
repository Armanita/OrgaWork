-- Migration: 0010_create-cases-and-assignments-schema.sql
-- Description: Create cases and assignments tables with tenant isolation (RLS) and constraints

CREATE TABLE public.orgawork_cases (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  created_by_user_id uuid NOT NULL,
  subject_user_id uuid NOT NULL,
  primary_assignment_id uuid NULL,
  current_work jsonb NULL,
  last_outcome text NULL,
  cancellation_reason text NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_cases_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT orgawork_cases_org_fk FOREIGN KEY (organization_id) REFERENCES public.orgawork_organizations (id),
  CONSTRAINT orgawork_cases_created_by_user_fk FOREIGN KEY (created_by_user_id) REFERENCES public.orgawork_users (id),
  CONSTRAINT orgawork_cases_subject_user_fk FOREIGN KEY (subject_user_id) REFERENCES public.orgawork_users (id),
  CONSTRAINT orgawork_cases_title_check CHECK (btrim(title) <> '' AND title = btrim(title)),
  CONSTRAINT orgawork_cases_status_check CHECK (status IN ('open', 'resolved', 'closed', 'cancelled')),
  CONSTRAINT orgawork_cases_version_check CHECK (version > 0),
  CONSTRAINT orgawork_cases_updated_time_check CHECK (updated_at >= created_at)
);

CREATE TABLE public.orgawork_assignments (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  assignee_user_id uuid NOT NULL,
  assigned_by_user_id uuid NOT NULL,
  status text NOT NULL,
  acceptance_mode text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  rejection_reason text NULL,
  transferred_to_assignment_id uuid NULL,
  accepted_at timestamptz NULL,
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_assignments_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT orgawork_assignments_case_org_fk FOREIGN KEY (case_id, organization_id) REFERENCES public.orgawork_cases (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT orgawork_assignments_assignee_user_fk FOREIGN KEY (assignee_user_id) REFERENCES public.orgawork_users (id),
  CONSTRAINT orgawork_assignments_assigned_by_user_fk FOREIGN KEY (assigned_by_user_id) REFERENCES public.orgawork_users (id),
  CONSTRAINT orgawork_assignments_transferred_to_fk FOREIGN KEY (transferred_to_assignment_id, organization_id) REFERENCES public.orgawork_assignments (id, organization_id),
  CONSTRAINT orgawork_assignments_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'transferred', 'ended')),
  CONSTRAINT orgawork_assignments_acceptance_mode_check CHECK (acceptance_mode IN ('explicit', 'forced')),
  CONSTRAINT orgawork_assignments_version_check CHECK (version > 0),
  CONSTRAINT orgawork_assignments_updated_time_check CHECK (updated_at >= created_at)
);

-- Circular composite FK from cases to assignments for primary_assignment_id
ALTER TABLE public.orgawork_cases
  ADD CONSTRAINT orgawork_cases_primary_assignment_fk
  FOREIGN KEY (primary_assignment_id, organization_id)
  REFERENCES public.orgawork_assignments (id, organization_id);

-- Indexes for performance
CREATE INDEX orgawork_cases_org_status_idx ON public.orgawork_cases (organization_id, status);
CREATE INDEX orgawork_cases_org_created_by_idx ON public.orgawork_cases (organization_id, created_by_user_id);
CREATE INDEX orgawork_cases_org_subject_user_idx ON public.orgawork_cases (organization_id, subject_user_id);

CREATE INDEX orgawork_assignments_org_case_idx ON public.orgawork_assignments (organization_id, case_id);
CREATE INDEX orgawork_assignments_org_assignee_idx ON public.orgawork_assignments (organization_id, assignee_user_id, status);

-- Partial Unique Index enforcing domain invariant: at most one active primary assignment per case
CREATE UNIQUE INDEX orgawork_assignments_active_primary_idx
  ON public.orgawork_assignments (organization_id, case_id)
  WHERE (is_primary = true AND status IN ('pending', 'accepted'));

-- Row Level Security (RLS) Enablement & Enforcement
ALTER TABLE public.orgawork_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_cases FORCE ROW LEVEL SECURITY;

CREATE POLICY orgawork_cases_tenant_isolation_policy ON public.orgawork_cases
  FOR ALL
  TO public
  USING (organization_id = orgawork_current_organization_id())
  WITH CHECK (organization_id = orgawork_current_organization_id());

ALTER TABLE public.orgawork_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgawork_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY orgawork_assignments_tenant_isolation_policy ON public.orgawork_assignments
  FOR ALL
  TO public
  USING (organization_id = orgawork_current_organization_id())
  WITH CHECK (organization_id = orgawork_current_organization_id());

-- Grants for application runtime role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgawork_cases TO orgawork_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgawork_assignments TO orgawork_app_runtime;
