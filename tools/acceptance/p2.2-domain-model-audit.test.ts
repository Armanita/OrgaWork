import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { inspectP22DomainModel, type DomainModelAuditMode } from './p2.2-domain-model-audit.js';

function currentMode(): DomainModelAuditMode {
  const roadmap = readFileSync(resolve(process.cwd(), 'docs/ROADMAP.md'), 'utf8');
  return roadmap.includes('- [x] P2.2 ') ? 'closed' : 'pre';
}

describe('P2.2 domain model acceptance', () => {
  it('accepts the current repository state without hidden issues', () => {
    const report = inspectP22DomainModel(
      process.cwd(),
      currentMode(),
      new Date('2026-08-03T00:00:00.000Z'),
    );

    expect(report.issues).toEqual([]);
    expect(report.workspaces).toBeGreaterThanOrEqual(16);
    expect(report.packageManifests).toBeGreaterThanOrEqual(17);
  });

  it('keeps domain modules independent from persistence', () => {
    for (const module of ['identity', 'organizations', 'teams']) {
      const manifest = JSON.parse(
        readFileSync(resolve(process.cwd(), `modules/${module}/package.json`), 'utf8'),
      ) as { readonly dependencies?: Readonly<Record<string, string>> };

      expect(manifest.dependencies).toEqual({ '@workspace/contracts': 'workspace:*' });
    }
  });

  it('keeps P2.2 closed while later stages advance without premature UI implementation', () => {
    const roadmap = readFileSync('docs/ROADMAP.md', 'utf8');
    const status = readFileSync('docs/PROJECT-STATUS.md', 'utf8');

    expect(roadmap).toContain('- [x] P2.2 ایجاد مدل کاربر، سازمان، عضویت و تیم');
    expect(roadmap).toContain('- [ ] P2.13 ایجاد رابط فارسی ورود و مدیریت سازمان');
    expect(status).toContain('طراحی واقعی رابط کاربری هنوز آغاز نشده است.');
  });
});
