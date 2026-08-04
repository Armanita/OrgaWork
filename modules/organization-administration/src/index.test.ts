import { describe, expect, it } from 'vitest';
import {
  createOrganizationAdministrationService,
  invitationPolicy,
  type OrganizationAdministrationRepository,
} from './index.js';

describe('organization administration', () => {
  it('creates a hashed one-time invitation with a seventy-two-hour lifetime', async () => {
    let captured:
      Parameters<OrganizationAdministrationRepository['createInvitation']>[0] | undefined;
    const repository = {
      createInvitation: async (input) => {
        captured = input;
        return { id: input.id, reused: false };
      },
    } as OrganizationAdministrationRepository;
    const service = createOrganizationAdministrationService(repository, {
      now: () => new Date('2026-08-04T00:00:00.000Z'),
      createId: () => '11111111-1111-4111-8111-111111111111',
    });
    const result = await service.createInvitation({
      organizationId: '22222222-2222-4222-8222-222222222222',
      email: 'USER@example.com',
    });
    expect(result.token).toBeDefined();
    expect(captured?.email).toBe('user@example.com');
    expect(Date.parse(captured?.expiresAt ?? '') - Date.parse(captured?.now ?? '')).toBe(
      invitationPolicy.lifetimeMilliseconds,
    );
    expect(captured?.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
  });
});
