import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertArchitecture } from './architecture-policy.js';
import { p19TechnicalSpikes } from '../spikes/p1.9-catalog.js';

const repository = process.cwd();
const migration = readFileSync(
  resolve(repository, 'infra/migrations/0003_create-tenant-runtime-infrastructure.sql'),
  'utf8',
);
const modelSource = readFileSync(resolve(repository, 'tools/spikes/p1.9-models.ts'), 'utf8');
const realSource = readFileSync(
  resolve(repository, 'tools/spikes/p1.9-real-infrastructure.ts'),
  'utf8',
);

describe('پذیرش مرحله P1.9', () => {
  it('هر Spike سؤال، گزینه، شاهد، محدودیت، تصمیم و بدهی دارد', () => {
    expect(p19TechnicalSpikes.map((spike) => spike.id)).toEqual([
      'P1.9.1',
      'P1.9.2',
      'P1.9.3',
      'P1.9.4',
      'P1.9.5',
    ]);

    for (const spike of p19TechnicalSpikes) {
      expect(spike.question).not.toBe('');
      expect(spike.options.length).toBeGreaterThanOrEqual(2);
      expect(spike.evidence.length).toBeGreaterThanOrEqual(2);
      expect(spike.limitations.length).toBeGreaterThanOrEqual(1);
      expect(spike.decision.text).not.toBe('');
      expect(spike.technicalDebt.length).toBeGreaterThanOrEqual(1);
      expect(spike.classification).toBe('spike-only');
    }
  });

  it('مرز واقعی ماژول‌ها بدون Issue است', () => {
    expect(assertArchitecture(repository).issues).toEqual([]);
  });

  it('Outbox، Inbox، RLS و روابط مرکب در Migration وجود دارند', () => {
    for (const marker of [
      'UNIQUE (organization_id, idempotency_key)',
      'UNIQUE (organization_id, consumer_name, message_id)',
      'FORCE ROW LEVEL SECURITY',
      'orgawork_current_organization_id',
      'PRIMARY KEY (process_name, instance_id)',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  it('مدل بازگشتی Cache، Lease، تحویل تکراری و Pool را پوشش می‌دهد', () => {
    expect(modelSource).toContain('class OutboxLeaseModel');
    expect(modelSource).toContain('class OrganizationSessionCache');
    expect(modelSource).toContain('class TransactionContextPoolModel');
    expect(modelSource).toContain('compositeIdentity');
  });

  it('Spike واقعی PostgreSQL و Redis پاک‌سازی کنترل‌شده دارد', () => {
    expect(realSource).toContain('withOrganizationTransaction');
    expect(realSource).toContain("'SET',");
    expect(realSource).toContain("'NX',");
    expect(realSource).toContain("'PX',");
    expect(realSource).toContain('P1.9_REAL_INFRASTRUCTURE_CLEANUP');
    expect(existsSync(resolve(repository, 'tools/spikes/p1.9-report.ts'))).toBe(true);
  });
});
