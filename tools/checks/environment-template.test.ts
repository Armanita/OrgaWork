import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const environmentExamplePath = resolve(projectRoot, '.env.example');
const gitignorePath = resolve(projectRoot, '.gitignore');

function parseEnvironmentTemplate(content: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      throw new Error(`خط نامعتبر در فایل نمونه محیط: ${rawLine}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (entries.has(key)) {
      throw new Error(`متغیر تکراری در فایل نمونه محیط: ${key}`);
    }

    entries.set(key, value);
  }

  return entries;
}

describe('الگوی امن محیط محلی', () => {
  const bytes = readFileSync(environmentExamplePath);
  const content = bytes.toString('utf8');
  const entries = parseEnvironmentTemplate(content);

  it('UTF-8 بدون BOM و دارای خط پایانی استاندارد است', () => {
    expect([...bytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(content.endsWith('\n')).toBe(true);
    expect(content).not.toContain('\r');
    expect(content).not.toContain('\uFFFD');
  });

  it('فقط متغیرهای اجرایی شناخته‌شده مرحله فعلی را ثبت می‌کند', () => {
    expect([...entries.keys()]).toEqual([
      'NODE_ENV',
      'HOST',
      'PORT',
      'WORKER_NAME',
      'WORKER_POLL_INTERVAL_MS',
      'WORKER_RUN_ONCE',
      'SCHEDULER_NAME',
      'SCHEDULER_INTERVAL_MS',
      'SCHEDULER_RUN_ONCE',
      'POSTGRES_HOST',
      'POSTGRES_PORT',
      'POSTGRES_DB',
      'POSTGRES_USER',
    ]);
  });

  it('مقادیر نمونه غیرحساس و معتبر توسعه محلی دارد', () => {
    expect(Object.fromEntries(entries)).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: '3001',
      WORKER_NAME: 'orgawork-worker',
      WORKER_POLL_INTERVAL_MS: '5000',
      WORKER_RUN_ONCE: 'false',
      SCHEDULER_NAME: 'orgawork-scheduler',
      SCHEDULER_INTERVAL_MS: '60000',
      SCHEDULER_RUN_ONCE: 'false',
      POSTGRES_HOST: '127.0.0.1',
      POSTGRES_PORT: '5432',
      POSTGRES_DB: 'orgawork',
      POSTGRES_USER: 'orgawork',
    });

    for (const [key, value] of entries) {
      expect(key).not.toMatch(/PASSWORD|SECRET|TOKEN|PRIVATE_KEY|ACCESS_KEY|CREDENTIAL/i);
      expect(value).not.toMatch(/password|secret|token|credential|private[-_ ]?key/i);
    }
  });

  it('فایل واقعی محلی را نادیده می‌گیرد و فقط فایل نمونه را مجاز می‌کند', () => {
    const gitignore = readFileSync(gitignorePath, 'utf8');
    const rules = gitignore
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));

    expect(rules).toContain('.env');
    expect(rules).toContain('.env.*');
    expect(rules).toContain('!.env.example');
  });
});
