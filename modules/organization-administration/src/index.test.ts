import { readFileSync } from 'node:fs';

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
  it('keeps tenant role mutation limited to member and manager', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(source).toContain(
      "export type TenantAssignableOrganizationRoleKey = 'member' | 'manager'",
    );
    expect(source).toContain('readonly roleKeys: readonly OrganizationRoleKey[];');
    expect(source).toContain('readonly roleKeys: readonly TenantAssignableOrganizationRoleKey[];');
    expect(source).toContain("protected_role.role_key = 'organization_admin'");
  });

  it('binds invitation acceptance to user, token, and organization before locking', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const userContextIndex = source.indexOf("set_config('orgawork.user_id'");
    const tokenContextIndex = source.indexOf("set_config('orgawork.invitation_token_hash'");
    const candidateQueryIndex = source.indexOf(
      'const invitationCandidateResult = await transaction.query',
    );
    const organizationContextIndex = source.indexOf(
      "set_config('orgawork.organization_id'",
      candidateQueryIndex,
    );
    const lockQueryIndex = source.indexOf(
      'const lockedInvitationResult = await transaction.query',
      organizationContextIndex,
    );
    const forUpdateIndex = source.indexOf('FOR UPDATE OF invitation', lockQueryIndex);

    expect(source).toContain('normalizeUserId(userId)');
    expect(userContextIndex).toBeGreaterThan(-1);
    expect(tokenContextIndex).toBeGreaterThan(userContextIndex);
    expect(source).toContain(
      'setInvitationAcceptanceContext(transaction, input.tokenHash, input.userId)',
    );
    expect(candidateQueryIndex).toBeGreaterThan(tokenContextIndex);
    expect(organizationContextIndex).toBeGreaterThan(candidateQueryIndex);
    expect(lockQueryIndex).toBeGreaterThan(organizationContextIndex);
    expect(forUpdateIndex).toBeGreaterThan(lockQueryIndex);
    expect(source.slice(candidateQueryIndex, organizationContextIndex)).not.toContain('FOR UPDATE');
  });
});
