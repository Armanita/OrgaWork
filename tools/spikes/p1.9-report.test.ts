import { describe, expect, it } from 'vitest';

import { p19TechnicalSpikes } from './p1.9-catalog.js';
import { renderP19Markdown, type P19SpikeSummary } from './p1.9-report.js';

describe('گزارش Spikeهای P1.9', () => {
  it('برای هر Spike سؤال، گزینه، محدودیت، تصمیم و بدهی دارد', () => {
    expect(p19TechnicalSpikes).toHaveLength(5);

    for (const spike of p19TechnicalSpikes) {
      expect(spike.question.trim()).not.toBe('');
      expect(spike.options.length).toBeGreaterThanOrEqual(2);
      expect(spike.evidence.length).toBeGreaterThanOrEqual(2);
      expect(spike.limitations.length).toBeGreaterThanOrEqual(1);
      expect(spike.decision.text.trim()).not.toBe('');
      expect(spike.technicalDebt.length).toBeGreaterThanOrEqual(1);
      expect(spike.classification).toBe('spike-only');
    }
  });

  it('Markdown تصمیم‌ها را بدون ادعای محصول عملیاتی تولید می‌کند', () => {
    const summary: P19SpikeSummary = {
      schemaVersion: 1,
      generatedAt: '2026-08-03T00:00:00.000Z',
      stage: 'P1.9',
      classification: 'technical-spike',
      architecture: {
        workspaces: 13,
        sourceFiles: 68,
        issues: 0,
      },
      migrationMarkers: {},
      realInfrastructureEvidence: true,
      spikes: p19TechnicalSpikes,
    };

    const markdown = renderP19Markdown(summary);
    expect(markdown).toContain('P1.9.1');
    expect(markdown).toContain('P1.9.5');
    expect(markdown).toContain('تصمیم');
    expect(markdown).toContain('بدهی');
  });
});
