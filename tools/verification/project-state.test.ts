import { describe, expect, it } from 'vitest';

import {
  isAtOrBeyondMajorStage,
  isAtOrBeyondStage,
  parseStageReference,
  roadmapStageChecked,
  roadmapStageOpen,
} from './project-state.js';

describe('project stage state semantics', () => {
  it('parses major and substage references without depending on titles', () => {
    expect(parseStageReference('P3 — پرونده، مسئولیت و اقدام')).toMatchObject({
      id: 'P3',
      major: 3,
    });
    expect(parseStageReference('P3.2 پیاده‌سازی ایجاد پرونده توسط کاربر')).toMatchObject({
      id: 'P3.2',
      major: 3,
      minor: 2,
    });
    expect(parseStageReference('invalid')).toBeUndefined();
  });

  it('compares current stages semantically', () => {
    expect(isAtOrBeyondMajorStage('P3 — پرونده، مسئولیت و اقدام', 2)).toBe(true);
    expect(isAtOrBeyondMajorStage('P12.1 پذیرش نهایی', 3)).toBe(true);
    expect(isAtOrBeyondMajorStage('P1.10 پذیرش بنیاد', 2)).toBe(false);

    expect(isAtOrBeyondStage('P2.4 پیاده‌سازی', 2, 3)).toBe(true);
    expect(isAtOrBeyondStage('P3 — پرونده', 2, 15)).toBe(true);
    expect(isAtOrBeyondStage('P2.2 مدل دامنه', 2, 3)).toBe(false);
  });

  it('reads roadmap completion independently from the current-stage title', () => {
    const roadmap = [
      '- [x] P3.1 تثبیت قرارداد دامنه پرونده',
      '- [ ] P3.2 پیاده‌سازی ایجاد پرونده توسط کاربر',
    ].join('\n');

    expect(roadmapStageChecked(roadmap, 'P3.1')).toBe(true);
    expect(roadmapStageOpen(roadmap, 'P3.2')).toBe(true);
    expect(roadmapStageOpen(roadmap, 'P3.1')).toBe(false);
  });
});
