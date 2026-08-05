import { describe, expect, it } from 'vitest';

import {
  AssignmentDomainError,
  acceptAssignment,
  assertAtMostOneActivePrimaryAssignment,
  createCaseAssignment,
  endAssignment,
  rejectAssignment,
  transferAssignment,
} from './index.js';

const ids = {
  assignment: '11111111-1111-4111-8111-111111111111',
  secondAssignment: '22222222-2222-4222-8222-222222222222',
  case: '33333333-3333-4333-8333-333333333333',
  organization: '44444444-4444-4444-8444-444444444444',
  assignee: '55555555-5555-4555-8555-555555555555',
  assigner: '66666666-6666-4666-8666-666666666666',
} as const;

function pendingPrimary() {
  return createCaseAssignment({
    id: ids.assignment,
    caseId: ids.case,
    organizationId: ids.organization,
    assigneeUserId: ids.assignee,
    assignedByUserId: ids.assigner,
    isPrimary: true,
    now: '2026-08-05T11:00:00.000Z',
  });
}

describe('case assignment contract', () => {
  it('creates an explicit assignment in pending state', () => {
    const value = pendingPrimary();

    expect(value.status).toBe('pending');
    expect(value.acceptedAt).toBeNull();
  });

  it('creates a forced assignment as accepted while preserving its mode', () => {
    const value = createCaseAssignment({
      id: ids.assignment,
      caseId: ids.case,
      organizationId: ids.organization,
      assigneeUserId: ids.assignee,
      assignedByUserId: ids.assigner,
      acceptanceMode: 'forced',
      isPrimary: true,
      now: '2026-08-05T11:00:00.000Z',
    });

    expect(value.status).toBe('accepted');
    expect(value.acceptanceMode).toBe('forced');
  });

  it('accepts a pending assignment', () => {
    expect(acceptAssignment(pendingPrimary(), '2026-08-05T11:01:00.000Z').status).toBe('accepted');
  });

  it('rejects a pending assignment only with a reason', () => {
    expect(() => rejectAssignment(pendingPrimary(), ' ', '2026-08-05T11:01:00.000Z')).toThrow(
      'دلیل روشن',
    );
    expect(
      rejectAssignment(pendingPrimary(), 'تعارض ظرفیت', '2026-08-05T11:01:00.000Z').status,
    ).toBe('rejected');
  });

  it('transfers an accepted assignment to a different assignment record', () => {
    const accepted = acceptAssignment(pendingPrimary(), '2026-08-05T11:01:00.000Z');
    const transferred = transferAssignment(
      accepted,
      ids.secondAssignment,
      '2026-08-05T11:02:00.000Z',
    );

    expect(transferred.status).toBe('transferred');
    expect(transferred.transferredToAssignmentId).toBe(ids.secondAssignment);
  });

  it('ends an accepted assignment', () => {
    const accepted = acceptAssignment(pendingPrimary(), '2026-08-05T11:01:00.000Z');

    expect(endAssignment(accepted, '2026-08-05T11:02:00.000Z').status).toBe('ended');
  });

  it('rejects invalid lifecycle transitions', () => {
    const accepted = acceptAssignment(pendingPrimary(), '2026-08-05T11:01:00.000Z');

    expect(() => acceptAssignment(accepted, '2026-08-05T11:02:00.000Z')).toThrow(
      AssignmentDomainError,
    );
  });

  it('rejects multiple active primary assignments for one case', () => {
    const second = createCaseAssignment({
      id: ids.secondAssignment,
      caseId: ids.case,
      organizationId: ids.organization,
      assigneeUserId: ids.assignee,
      assignedByUserId: ids.assigner,
      isPrimary: true,
      now: '2026-08-05T11:00:00.000Z',
    });

    expect(() => assertAtMostOneActivePrimaryAssignment([pendingPrimary(), second])).toThrow(
      'فقط یک مسئولیت اصلی فعال',
    );
  });
});
