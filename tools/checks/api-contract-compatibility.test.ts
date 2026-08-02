import { describe, expect, it } from 'vitest';

import { buildApplication } from '../../apps/api/src/application.js';
import {
  generatedContractFingerprint,
  OrgaWorkApiClient,
  type ApiClientFetch,
} from '../../packages/api-client/src/index.js';

import { verifyContractDrift } from './contract-drift.js';

function createFastifyAdapter(application: ReturnType<typeof buildApplication>): ApiClientFetch {
  return async (url, init) => {
    const response = await application.inject({
      method: init.method,
      url: new URL(url).pathname,
      headers: { ...init.headers },
    });

    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      json: (): Promise<unknown> => Promise.resolve(response.json()),
    };
  };
}

describe('OpenAPI, server and typed client compatibility', () => {
  it('consumes the real health route through the typed client', async () => {
    const application = buildApplication();

    try {
      const client = new OrgaWorkApiClient(
        'http://orgawork.test',
        createFastifyAdapter(application),
      );

      await expect(client.health()).resolves.toMatchObject({
        service: 'orgawork-api',
        status: 'ok',
      });
    } finally {
      await application.close();
    }
  });

  it('consumes the real readiness route through the typed client', async () => {
    const application = buildApplication();

    try {
      const client = new OrgaWorkApiClient(
        'http://orgawork.test',
        createFastifyAdapter(application),
      );

      await expect(client.readiness()).resolves.toMatchObject({
        service: 'orgawork-api',
        status: 'ready',
      });
    } finally {
      await application.close();
    }
  });

  it('keeps the generated client fingerprint aligned with OpenAPI', async () => {
    const result = await verifyContractDrift();

    expect(result.fingerprint).toBe(generatedContractFingerprint);
  });
});
