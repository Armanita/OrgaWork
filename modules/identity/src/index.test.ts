import { describe, expect, it } from 'vitest';

import {
  UserDomainError,
  activateUser,
  createUser,
  disableUser,
  isUserActive,
  normalizeEmail,
  transitionUserStatus,
} from './index.js';

const userId = '11111111-1111-4111-8111-111111111111';

function pendingUser() {
  return createUser({
    id: userId,
    email: '  PERSON@Example.COM  ',
    now: '2026-08-03T18:00:00.000Z',
  });
}

describe('identity domain model', () => {
  it('normalizes email without coupling identity to an organization', () => {
    const user = pendingUser();

    expect(user.email).toBe('person@example.com');
    expect(user.status).toBe('pending');
    expect(user.version).toBe(1);
    expect(user).not.toHaveProperty('organizationId');
  });

  it('rejects malformed email addresses', () => {
    expect(() => normalizeEmail('invalid')).toThrow(UserDomainError);
  });

  it('activates a pending user immutably', () => {
    const original = pendingUser();
    const activated = activateUser(original, '2026-08-03T18:01:00.000Z');

    expect(original.status).toBe('pending');
    expect(activated.status).toBe('active');
    expect(activated.version).toBe(2);
    expect(isUserActive(activated)).toBe(true);
  });

  it('disables an active user and allows controlled reactivation', () => {
    const active = activateUser(pendingUser(), '2026-08-03T18:01:00.000Z');
    const disabled = disableUser(active, '2026-08-03T18:02:00.000Z');
    const reactivated = activateUser(disabled, '2026-08-03T18:03:00.000Z');

    expect(disabled.status).toBe('disabled');
    expect(reactivated.status).toBe('active');
    expect(reactivated.version).toBe(4);
  });

  it('returns the same aggregate for an idempotent transition', () => {
    const active = activateUser(pendingUser(), '2026-08-03T18:01:00.000Z');

    expect(activateUser(active, '2026-08-03T18:02:00.000Z')).toBe(active);
  });

  it('rejects a transition back to pending', () => {
    const active = activateUser(pendingUser(), '2026-08-03T18:01:00.000Z');

    expect(() => transitionUserStatus(active, 'pending', '2026-08-03T18:02:00.000Z')).toThrow(
      'تغییر وضعیت کاربر',
    );
  });
});
