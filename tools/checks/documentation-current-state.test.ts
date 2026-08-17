import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  isAtOrBeyondMajorStage,
  roadmapCurrentStage,
  roadmapStageChecked,
  roadmapStageOpen,
  statusCurrentSubstage,
} from '../verification/project-state.js';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('documentation state contract', () => {
  it('keeps historical P1/P2/P2R acceptance evidence discoverable', () => {
    const readme = read('docs/README.md');

    expect(readme).toContain('docs/acceptance/P1-FINAL-ACCEPTANCE.md');
    expect(readme).toContain('docs/acceptance/P0-P2.3-FULL-AUDIT.md');
    expect(readme).toContain('docs/acceptance/P2-FINAL-ACCEPTANCE.md');
    expect(readme).toContain('docs/acceptance/P2R-FINAL-ACCEPTANCE.md');
  });

  it('preserves the historical P2R-to-P3 boundary in historical evidence', () => {
    const roadmap = read('docs/ROADMAP.md');
    const journal = read('docs/IMPLEMENTATION-JOURNAL.md');
    const acceptance = read('docs/acceptance/P2R-FINAL-ACCEPTANCE.md');

    expect(roadmap).toContain('- [x] P2R.1.7');
    expect(roadmap).toContain('- [x] P2R.1.8');
    expect(roadmap).toContain(
      'P2R.1.8 بسته و پذیرفته شده است؛ آغاز P3.1 باید در Commit جداگانه انجام شود.',
    );
    expect(journal).toContain('`P3.1` در این Commit آغاز نشد');
    expect(acceptance).toContain('P2R.1.8');
    expect(acceptance).toContain('شاهد: `EVD-042`');
  });

  it('reads the current P3 state without rewriting P2R history', () => {
    const roadmap = read('docs/ROADMAP.md');
    const status = read('docs/PROJECT-STATUS.md');
    const currentRoadmapStage = roadmapCurrentStage(roadmap);
    const currentStatusStage = statusCurrentSubstage(status);

    expect(currentRoadmapStage).toBeDefined();
    expect(currentStatusStage).toBeDefined();
    expect(isAtOrBeyondMajorStage(currentRoadmapStage ?? '', 3)).toBe(true);
    expect(isAtOrBeyondMajorStage(currentStatusStage ?? '', 3)).toBe(true);

    expect(roadmapStageChecked(roadmap, 'P3.1')).toBe(true);
    expect(roadmapStageOpen(roadmap, 'P3.2')).toBe(true);
    expect(status).toContain(
      'P3.1 — تثبیت قرارداد دامنه پرونده` (accepted در commit تاریخی `a743f5c`)',
    );
    expect(status).toContain('زیرمرحله‌های `P3.2` به بعد اجرا نشده‌اند.');
  });

  it('aligns final P2R acceptance and traceability evidence', () => {
    const acceptance = read('docs/acceptance/P2R-FINAL-ACCEPTANCE.md');
    const traceability = read('docs/TRACEABILITY-MATRIX.md');

    expect(acceptance).toContain('P2R.1.8');
    expect(acceptance).toContain('شاهد: `EVD-042`');
    expect(acceptance).toContain('۶ آزمون مرورگر واقعی');
    expect(acceptance).toContain('۸۱ فایل آزمون و ۳۸۹ آزمون');
    expect(acceptance).toContain('۵۸ خطای قدیمی');
    expect(acceptance).toContain('صفر خطای جدید');
    expect(acceptance).toContain('en/ltr');
    expect(acceptance).toContain('fa/rtl');
    expect(acceptance).toContain('Checkpoint');
    expect(traceability).toContain('EVD-042');
    expect(traceability).toContain('UI-P2R-FINAL-ACCEPTANCE-001');
  });

  it('does not reopen closed P2 stages when the project advances', () => {
    const roadmap = read('docs/ROADMAP.md');

    for (let stage = 1; stage <= 15; stage += 1) {
      expect(roadmap).not.toContain(`- [ ] P2.${stage} `);
    }

    expect(roadmapStageChecked(roadmap, 'P2.15')).toBe(true);
    expect(roadmapStageChecked(roadmap, 'P3.1')).toBe(true);
    expect(roadmapStageOpen(roadmap, 'P3.2')).toBe(true);
  });
});
