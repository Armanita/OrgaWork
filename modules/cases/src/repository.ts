import {
  type PostgreSqlAccess,
  type PostgreSqlTransaction,
} from '@workspace/database';
import {
  createCaseAssignmentId,
  createCaseId,
  createOrganizationId,
  createUserId,
  createUtcTimestamp,
  type CurrentWorkReference,
} from '@workspace/contracts';
import {
  type CaseAssignment,
  type AssignmentStatus,
  type AssignmentAcceptanceMode,
} from '@workspace/assignments';
import {
  type FollowUpCase,
  type CaseStatus,
  normalizeCaseTitle,
  assertFollowUpCaseInvariant,
} from './index.js';

export interface CaseRow {
  id: string;
  organization_id: string;
  title: string;
  status: string;
  created_by_user_id: string;
  subject_user_id: string;
  primary_assignment_id: string | null;
  current_work: CurrentWorkReference | null;
  last_outcome: string | null;
  cancellation_reason: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export interface AssignmentRow {
  id: string;
  case_id: string;
  organization_id: string;
  assignee_user_id: string;
  assigned_by_user_id: string;
  status: string;
  acceptance_mode: string;
  is_primary: boolean;
  rejection_reason: string | null;
  transferred_to_assignment_id: string | null;
  accepted_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export function mapRowToFollowUpCase(row: CaseRow): FollowUpCase {
  const followUpCase: FollowUpCase = {
    id: createCaseId(row.id),
    organizationId: createOrganizationId(row.organization_id),
    title: normalizeCaseTitle(row.title),
    status: row.status as CaseStatus,
    createdByUserId: createUserId(row.created_by_user_id),
    subjectUserId: createUserId(row.subject_user_id),
    primaryAssignmentId: row.primary_assignment_id
      ? createCaseAssignmentId(row.primary_assignment_id)
      : null,
    currentWork: row.current_work,
    lastOutcome: row.last_outcome,
    cancellationReason: row.cancellation_reason,
    createdAt: createUtcTimestamp(row.created_at),
    updatedAt: createUtcTimestamp(row.updated_at),
    version: row.version,
  };

  assertFollowUpCaseInvariant(followUpCase);
  return followUpCase;
}

export function mapRowToCaseAssignment(row: AssignmentRow): CaseAssignment {
  return {
    id: createCaseAssignmentId(row.id),
    caseId: createCaseId(row.case_id),
    organizationId: createOrganizationId(row.organization_id),
    assigneeUserId: createUserId(row.assignee_user_id),
    assignedByUserId: createUserId(row.assigned_by_user_id),
    status: row.status as AssignmentStatus,
    acceptanceMode: row.acceptance_mode as AssignmentAcceptanceMode,
    isPrimary: row.is_primary,
    rejectionReason: row.rejection_reason,
    transferredToAssignmentId: row.transferred_to_assignment_id
      ? createCaseAssignmentId(row.transferred_to_assignment_id)
      : null,
    acceptedAt: row.accepted_at ? createUtcTimestamp(row.accepted_at) : null,
    endedAt: row.ended_at ? createUtcTimestamp(row.ended_at) : null,
    createdAt: createUtcTimestamp(row.created_at),
    updatedAt: createUtcTimestamp(row.updated_at),
    version: row.version,
  };
}

export async function setTenantContext(
  executor: PostgreSqlTransaction,
  organizationId: string,
): Promise<void> {
  await executor.query(
    `SELECT set_config('orgawork.current_organization_id', $1, true)`,
    [organizationId],
  );
}

export async function saveFollowUpCaseWithAssignment(
  db: PostgreSqlAccess,
  input: {
    case: FollowUpCase;
    assignment: CaseAssignment;
  },
): Promise<{ case: FollowUpCase; assignment: CaseAssignment }> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, input.case.organizationId);

    // ۱. ثبت پرونده (با primary_assignment_id برابر null جهت رعایت ترتیب کلید خارجی)
    await tx.query(
      `INSERT INTO public.orgawork_cases (
        id,
        organization_id,
        title,
        status,
        created_by_user_id,
        subject_user_id,
        primary_assignment_id,
        current_work,
        last_outcome,
        cancellation_reason,
        created_at,
        updated_at,
        version
      ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11, $12)`,
      [
        input.case.id,
        input.case.organizationId,
        input.case.title,
        input.case.status,
        input.case.createdByUserId,
        input.case.subjectUserId,
        input.case.currentWork ? JSON.stringify(input.case.currentWork) : null,
        input.case.lastOutcome,
        input.case.cancellationReason,
        input.case.createdAt,
        input.case.updatedAt,
        input.case.version,
      ],
    );

    // ۲. ثبت مسئولیت اولیه
    await tx.query(
      `INSERT INTO public.orgawork_assignments (
        id,
        case_id,
        organization_id,
        assignee_user_id,
        assigned_by_user_id,
        status,
        acceptance_mode,
        is_primary,
        rejection_reason,
        transferred_to_assignment_id,
        accepted_at,
        ended_at,
        created_at,
        updated_at,
        version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        input.assignment.id,
        input.assignment.caseId,
        input.assignment.organizationId,
        input.assignment.assigneeUserId,
        input.assignment.assignedByUserId,
        input.assignment.status,
        input.assignment.acceptanceMode,
        input.assignment.isPrimary,
        input.assignment.rejectionReason,
        input.assignment.transferredToAssignmentId,
        input.assignment.acceptedAt,
        input.assignment.endedAt,
        input.assignment.createdAt,
        input.assignment.updatedAt,
        input.assignment.version,
      ],
    );

    // ۳. به‌روزرسانی primary_assignment_id در پرونده
    await tx.query(
      `UPDATE public.orgawork_cases
       SET primary_assignment_id = $1, updated_at = $2
       WHERE id = $3 AND organization_id = $4`,
      [input.assignment.id, input.case.updatedAt, input.case.id, input.case.organizationId],
    );

    return {
      case: { ...input.case, primaryAssignmentId: input.assignment.id },
      assignment: input.assignment,
    };
  });
}

export async function findFollowUpCaseById(
  db: PostgreSqlAccess,
  organizationId: string,
  caseId: string,
): Promise<FollowUpCase | null> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, organizationId);

    const result = await tx.query<CaseRow>(
      `SELECT
        id,
        organization_id,
        title,
        status,
        created_by_user_id,
        subject_user_id,
        primary_assignment_id,
        current_work,
        last_outcome,
        cancellation_reason,
        created_at,
        updated_at,
        version
       FROM public.orgawork_cases
       WHERE id = $1 AND organization_id = $2`,
      [caseId, organizationId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return mapRowToFollowUpCase(row);
  });
}

export async function findCaseAssignmentById(
  db: PostgreSqlAccess,
  organizationId: string,
  assignmentId: string,
): Promise<CaseAssignment | null> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, organizationId);

    const result = await tx.query<AssignmentRow>(
      `SELECT
        id,
        case_id,
        organization_id,
        assignee_user_id,
        assigned_by_user_id,
        status,
        acceptance_mode,
        is_primary,
        rejection_reason,
        transferred_to_assignment_id,
        accepted_at,
        ended_at,
        created_at,
        updated_at,
        version
       FROM public.orgawork_assignments
       WHERE id = $1 AND organization_id = $2`,
      [assignmentId, organizationId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return mapRowToCaseAssignment(row);
  });
}
