import { describe, expect, it } from 'vitest';

import enMessages from '../messages/en.json';
import faMessages from '../messages/fa.json';

function collectKeys(value: unknown, prefix = ''): readonly string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [prefix];
  }

  const keys: string[] = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPrefix = prefix === '' ? key : `${prefix}.${key}`;
    keys.push(...collectKeys(nestedValue, nestedPrefix));
  }

  return keys;
}

describe('bilingual message catalogs', () => {
  it('keeps English and Persian catalogs structurally identical', () => {
    expect([...collectKeys(faMessages)].sort()).toEqual([...collectKeys(enMessages)].sort());
  });

  it('keeps the Persian catalog populated with Persian interface text', () => {
    expect(faMessages.application.name).toMatch(/[\u0600-\u06ff]/u);
    expect(faMessages.dashboard.title).toMatch(/[\u0600-\u06ff]/u);
  });

  it('keeps the English development catalog populated with English text', () => {
    expect(enMessages.application.name).toBe('OrgaWork');
    expect(enMessages.dashboard.title).toMatch(/[A-Za-z]/u);
  });
});
