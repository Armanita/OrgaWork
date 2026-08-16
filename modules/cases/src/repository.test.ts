import { describe, expect, it } from 'vitest';
import {
  mapRowToFollowUpCase,
  mapRowToCaseAssignment,
  type CaseRow,
  type AssignmentRow,
} from './repository.js';

describe('cases repository mappers', () => {
  it('maps case database row to FollowUpCase domain entity correctly', () => {
    const row: CaseRow = {
      id: '11111111-1111-4111-8111-111111111111',
      organization_id: '22222222-2222-4222-8222-222222222222',
      title: 'عنوان پرونده تست',
      status: 'open',
      created_by_user_id: '33333333-3333-4333-8333-333333333333',
      subject_user_id: '33333333-3333-4333-8333-333333333333',
      primary_assignment_id: '44444444-4444-4444-8444-444444444444',
      current_work: { kind: 'action', id: '55555555-5555-4555-8555-555555555555' },
      last_outcome: null,
      cancellation_reason: null,
      created_at: new Date('2026-08-13T10:00:00.000Z'),
      updated_at: new Date('2026-08-13T10:00:00.000Z'),
      version: 1,
    };

    const entity = mapRowToFollowUpCase(row);

    expect(entity.id).toBe(row.id);
    expect(entity.organizationId).toBe(row.organization_id);
    expect(entity.title).toBe('عنوان پرونده تست');
    expect(entity.status).toBe('open');
    expect(entity.primaryAssignmentId).toBe(row.primary_assignment_id);
    expect(entity.currentWork).toEqual(row.current_work);
  });

  it('maps assignment database row to CaseAssignment domain entity correctly', () => {
    const row: AssignmentRow = {
      id: '44444444-4444-4444-8444-444444444444',
      case_id: '11111111-1111-4111-8111-111111111111',
      organization_id: '22222222-2222-4222-8222-222222222222',
      assignee_user_id: '33333333-3333-4333-8333-333333333333',
      assigned_by_user_id: '33333333-3333-4333-8333-333333333333',
      status: 'accepted',
      acceptance_mode: 'forced',
      is_primary: true,
      rejection_reason: null,
      transferred_to_assignment_id: null,
      accepted_at: new Date('2026-08-13T10:00:00.000Z'),
      ended_at: null,
      created_at: new Date('2026-08-13T10:00:00.000Z'),
      updated_at: new Date('2026-08-13T10:00:00.000Z'),
      version: 1,
    };

    const entity = mapRowToCaseAssignment(row);

    expect(entity.id).toBe(row.id);
    expect(entity.caseId).toBe(row.case_id);
    expect(entity.isPrimary).toBe(true);
    expect(entity.status).toBe('accepted');
    expect(entity.acceptanceMode).toBe('forced');
  });
});
