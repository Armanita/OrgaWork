import { describe, expect, it } from 'vitest';

import {
  createPlatformControlPlaneService,
  type PlatformControlPlaneRepository,
} from './platform-control-plane.js';

const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];

describe('Platform Control Plane service', () => {
  it('normalizes OA-01 and preserves replay metadata', async () => {
    let captured: Parameters<PlatformControlPlaneRepository['createOrganization']>[0] | undefined;
    const repository = {
      findOperator: async () => ({
        userId: ids[0]!,
        email: 'platform@example.com',
        status: 'active' as const,
      }),
      listAudit: async () => [],
      listOrganizations: async () => [],
      renameOrganization: async () => {
        throw new Error('unused');
      },
      revokeOrganizationAdmin: async () => {
        throw new Error('unused');
      },
      createOrganization: async (input) => {
        captured = input;
        return {
          kind: 'success' as const,
          result: { organization: { id: input.organizationId, name: input.name } },
          replayed: false,
        };
      },
      provisionInitialAdmin: async () => {
        throw new Error('unused');
      },
    } satisfies PlatformControlPlaneRepository;
    let index = 1;
    const service = createPlatformControlPlaneService(repository, {
      now: () => new Date('2026-08-19T12:00:00.000Z'),
      createId: () => ids[index++]!,
    });
    const result = await service.createOrganization({
      actorUserId: ids[0]!,
      name: '  شرکت نمونه  ',
      reason: 'ایجاد سازمان برای آزمون کنترل‌پلین',
      idempotencyKey: 'oa-create-1234',
      requestId: ids[2]!,
      correlationId: ids[3]!,
    });
    expect(result.organization.name).toBe('شرکت نمونه');
    expect(result.replayed).toBe(false);
    expect(captured?.requestFingerprint).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('normalizes the initial admin email and rejects short reasons', async () => {
    let captured:
      Parameters<PlatformControlPlaneRepository['provisionInitialAdmin']>[0] | undefined;
    const repository = {
      findOperator: async () => ({
        userId: ids[0]!,
        email: 'platform@example.com',
        status: 'active' as const,
      }),
      listAudit: async () => [],
      listOrganizations: async () => [],
      renameOrganization: async () => {
        throw new Error('unused');
      },
      revokeOrganizationAdmin: async () => {
        throw new Error('unused');
      },
      createOrganization: async () => {
        throw new Error('unused');
      },
      provisionInitialAdmin: async (input) => {
        captured = input;
        return {
          kind: 'success' as const,
          result: {
            organizationId: input.organizationId,
            userId: input.candidateUserId,
            email: input.email,
            membershipId: input.candidateMembershipId,
            role: 'organization_admin' as const,
            accountSetupRequired: true,
          },
          replayed: false,
        };
      },
    } satisfies PlatformControlPlaneRepository;
    let index = 1;
    const service = createPlatformControlPlaneService(repository, {
      now: () => new Date('2026-08-19T12:00:00.000Z'),
      createId: () => ids[index++ % ids.length]!,
    });
    const result = await service.provisionInitialAdmin({
      actorUserId: ids[0]!,
      organizationId: ids[1]!,
      email: '  ADMIN@EXAMPLE.COM ',
      reason: 'تعیین مدیر اولیه برای سازمان نمونه',
      idempotencyKey: 'oa-admin-1234',
      requestId: ids[2]!,
      correlationId: ids[3]!,
    });
    expect(result.email).toBe('admin@example.com');
    expect(captured?.email).toBe('admin@example.com');

    await expect(
      service.createOrganization({
        actorUserId: ids[0]!,
        name: 'شرکت',
        reason: 'کوتاه',
        idempotencyKey: 'oa-create-5678',
        requestId: ids[2]!,
        correlationId: ids[3]!,
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('keeps platform authority default-deny', async () => {
    const repository = {
      findOperator: async () => undefined,
      listAudit: async () => [],
      listOrganizations: async () => [],
      renameOrganization: async () => {
        throw new Error('unused');
      },
      revokeOrganizationAdmin: async () => {
        throw new Error('unused');
      },
      createOrganization: async () => {
        throw new Error('unused');
      },
      provisionInitialAdmin: async () => {
        throw new Error('unused');
      },
    } satisfies PlatformControlPlaneRepository;
    const service = createPlatformControlPlaneService(repository);
    await expect(service.getOperator(ids[0]!)).rejects.toMatchObject({
      code: 'PLATFORM_AUTHORITY_REQUIRED',
    });
  });
});
