import { describe, expect, it } from 'vitest';

import { collectUserFacingTexts, userFacingMessages } from './messages.fa';

describe('فرهنگ متن‌های قابل مشاهده', () => {
  const texts = collectUserFacingTexts(userFacingMessages);

  it('هیچ متن خالی ندارد', () => {
    expect(texts.length).toBeGreaterThan(0);

    for (const text of texts) {
      expect(text.trim()).not.toBe('');
    }
  });

  it('هیچ حرف انگلیسی در متن‌های قابل مشاهده ندارد', () => {
    const textsContainingEnglish = texts.filter((text) => /[A-Za-z]/u.test(text));

    expect(textsContainingEnglish).toEqual([]);
  });
});
