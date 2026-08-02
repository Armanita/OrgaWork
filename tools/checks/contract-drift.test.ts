import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { verifyContractDrift } from './contract-drift.js';

const fixtureFiles = [
  'packages/contracts/openapi/orgawork.openapi.json',
  'apps/api/src/application.ts',
  'apps/api/src/routes/health.ts',
  'apps/api/src/routes/readiness.ts',
] as const;

async function createContractFixture(): Promise<string> {
  const root = resolve('.');
  const temporary = await mkdtemp(join(tmpdir(), 'orgawork-contract-'));

  for (const relativePath of fixtureFiles) {
    const destination = resolve(temporary, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(root, relativePath), destination);
  }

  return temporary;
}

describe('contract drift control', () => {
  it('accepts the committed OpenAPI, server and generated client', async () => {
    await expect(verifyContractDrift()).resolves.toMatchObject({
      openApiVersion: '3.1.0',
      contractVersion: '1.0.0',
      operationIds: ['getHealth', 'getReadiness'],
      serverRoutes: ['/health', '/ready'],
    });
  });

  it('rejects a changed OpenAPI document before client use', async () => {
    const temporary = await createContractFixture();

    try {
      const path = resolve(temporary, 'packages/contracts/openapi/orgawork.openapi.json');
      const current = await readFile(path, 'utf8');

      await writeFile(path, current.replace('"version": "1.0.0"', '"version": "2.0.0"'), 'utf8');

      await expect(verifyContractDrift(temporary)).rejects.toThrow(
        'generated client fingerprint mismatch',
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it('rejects an unregistered server route', async () => {
    const temporary = await createContractFixture();

    try {
      const applicationPath = resolve(temporary, 'apps/api/src/application.ts');
      const application = await readFile(applicationPath, 'utf8');

      await writeFile(
        applicationPath,
        application.replace('application.register(readinessRoute);', ''),
        'utf8',
      );

      await expect(verifyContractDrift(temporary)).rejects.toThrow(
        'registered server routes mismatch',
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
