import { describe, expect, it } from 'vitest';

import { createMembershipId, createOrganizationId } from '@workspace/contracts';

import {
  TeamDomainError,
  addTeamMember,
  changeTeamMemberRole,
  createTeam,
  removeTeamMember,
  renameTeam,
  type MembershipReference,
} from './index.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const secondOrganizationId = '22222222-2222-4222-8222-222222222222';
const teamId = '33333333-3333-4333-8333-333333333333';
const membershipId = '44444444-4444-4444-8444-444444444444';

function membership(
  status: MembershipReference['status'] = 'active',
  organization = organizationId,
): MembershipReference {
  return {
    id: createMembershipId(membershipId),
    organizationId: createOrganizationId(organization),
    status,
  };
}

function team() {
  return createTeam({
    id: teamId,
    organizationId,
    name: '  تیم   عملیات  ',
    now: '2026-08-03T18:00:00.000Z',
  });
}

describe('team domain model', () => {
  it('creates and renames a team inside one organization', () => {
    const original = team();
    const renamed = renameTeam(original, 'تیم پشتیبانی', '2026-08-03T18:01:00.000Z');

    expect(original.name).toBe('تیم عملیات');
    expect(renamed.name).toBe('تیم پشتیبانی');
    expect(renamed.organizationId).toBe(organizationId);
  });

  it('adds only an active membership from the same organization', () => {
    const updated = addTeamMember(team(), {
      id: '55555555-5555-4555-8555-555555555555',
      membership: membership(),
      now: '2026-08-03T18:01:00.000Z',
    });

    expect(updated.members).toHaveLength(1);
    expect(updated.members[0]?.role).toBe('member');
    expect(updated.version).toBe(2);
  });

  it('rejects an inactive organization membership', () => {
    expect(() =>
      addTeamMember(team(), {
        id: '55555555-5555-4555-8555-555555555555',
        membership: membership('suspended'),
        now: '2026-08-03T18:01:00.000Z',
      }),
    ).toThrow('فقط عضویت فعال');
  });

  it('rejects a membership from another organization', () => {
    expect(() =>
      addTeamMember(team(), {
        id: '55555555-5555-4555-8555-555555555555',
        membership: membership('active', secondOrganizationId),
        now: '2026-08-03T18:01:00.000Z',
      }),
    ).toThrow(TeamDomainError);
  });

  it('rejects duplicate membership in one team', () => {
    const once = addTeamMember(team(), {
      id: '55555555-5555-4555-8555-555555555555',
      membership: membership(),
      now: '2026-08-03T18:01:00.000Z',
    });

    expect(() =>
      addTeamMember(once, {
        id: '66666666-6666-4666-8666-666666666666',
        membership: membership(),
        now: '2026-08-03T18:02:00.000Z',
      }),
    ).toThrow('از قبل در تیم');
  });

  it('changes the independent team role', () => {
    const once = addTeamMember(team(), {
      id: '55555555-5555-4555-8555-555555555555',
      membership: membership(),
      now: '2026-08-03T18:01:00.000Z',
    });
    const promoted = changeTeamMemberRole(
      once,
      createMembershipId(membershipId),
      'team_manager',
      '2026-08-03T18:02:00.000Z',
    );

    expect(promoted.members[0]?.role).toBe('team_manager');
    expect(promoted.members[0]?.version).toBe(2);
  });

  it('removes a team member without changing organization membership', () => {
    const reference = membership();
    const once = addTeamMember(team(), {
      id: '55555555-5555-4555-8555-555555555555',
      membership: reference,
      now: '2026-08-03T18:01:00.000Z',
    });
    const removed = removeTeamMember(once, reference.id, '2026-08-03T18:02:00.000Z');

    expect(removed.members).toHaveLength(0);
    expect(reference.status).toBe('active');
  });
});
