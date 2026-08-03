import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  inspectFoundationAcceptance,
  isPostFoundationStage,
  p110RequirementIds,
  type FoundationAcceptanceMode,
} from './p1.10-foundation-audit.js';

function currentMode(): FoundationAcceptanceMode {
  const roadmap = readFileSync(resolve(process.cwd(), 'docs/ROADMAP.md'), 'utf8');

  return roadmap.includes('- [x] P1.10.11 ') ? 'closed' : 'pre';
}

describe('P1.10 foundation acceptance audit', () => {
  it('keeps the eleven official P1.10 requirements in order', () => {
    expect(p110RequirementIds).toEqual([
      'P1.10.1',
      'P1.10.2',
      'P1.10.3',
      'P1.10.4',
      'P1.10.5',
      'P1.10.6',
      'P1.10.7',
      'P1.10.8',
      'P1.10.9',
      'P1.10.10',
      'P1.10.11',
    ]);
  });

  it('accepts the current repository state without hidden issues', () => {
    const report = inspectFoundationAcceptance(
      process.cwd(),
      currentMode(),
      new Date('2026-08-03T00:00:00.000Z'),
    );

    expect(report.stage).toBe('P1.10');
    expect(report.issues).toEqual([]);
    expect(report.workspaces).toBeGreaterThanOrEqual(13);
    expect(report.sourceFiles).toBeGreaterThanOrEqual(68);
    expect(report.evidenceCount).toBe(report.mode === 'closed' ? 30 : 29);
  });

  it('remains valid after the project advances beyond P2.1', () => {
    expect(isPostFoundationStage('P2.1 تثبیت قرارداد')).toBe(true);
    expect(isPostFoundationStage('P2.2 ایجاد مدل دامنه')).toBe(true);
    expect(isPostFoundationStage('P3.1 آغاز قابلیت‌ها')).toBe(true);
    expect(isPostFoundationStage('P12.1 پذیرش نهایی')).toBe(true);
    expect(isPostFoundationStage('P1.10 پذیرش بنیاد')).toBe(false);
    expect(isPostFoundationStage('invalid')).toBe(false);
  });

  it('includes repository security and package coverage in the report', () => {
    const report = inspectFoundationAcceptance(
      process.cwd(),
      currentMode(),
      new Date('2026-08-03T00:00:00.000Z'),
    );

    expect(report.trackedFiles).toBeGreaterThan(200);
    expect(report.packageManifests).toBeGreaterThanOrEqual(14);
  });
});
