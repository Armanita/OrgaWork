import { describe, expect, it } from 'vitest';

import { inspectP2Complete } from './p2-complete-audit.js';

describe('P2 complete acceptance audit', () => {
  it('accepts the complete implementation after closure', () => {
    const report = inspectP2Complete(process.cwd(), 'closed', new Date('2026-08-04T00:00:00.000Z'));

    expect(report.issues).toEqual([]);
    expect(report.migrationVersion).toBe(9);
    expect(report.evidenceCount).toBe(41);
  }, 30_000);
});
