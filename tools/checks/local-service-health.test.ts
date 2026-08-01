import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');

const files = {
  postgres: read('infra/compose/postgresql.compose.yaml'),
  redis: read('infra/compose/redis.compose.yaml'),
  minio: read('infra/compose/minio.compose.yaml'),
};

const services = Object.values(files);

describe('local service health and readiness contract', () => {
  it('declares bounded Docker healthchecks for every data service', () => {
    for (const content of services) {
      expect(content).toContain('    healthcheck:');
      expect(content).toContain('      interval: 10s');
      expect(content).toContain('      timeout: 5s');
      expect(content).toContain('      retries: 5');
      expect(content).toContain('      start_period: 20s');
    }
  });

  it('uses pg_isready with the configured PostgreSQL identity', () => {
    expect(files.postgres).toContain('pg_isready');
    expect(files.postgres).toContain('POSTGRES_USER');
    expect(files.postgres).toContain('POSTGRES_DB');
  });

  it('uses an authenticated Redis PING readiness probe', () => {
    expect(files.redis).toContain('REDIS_PASSWORD:');
    expect(files.redis).toContain('redis-cli --no-auth-warning -a');
    expect(files.redis).toContain('PING');
    expect(files.redis).toContain('PONG');
  });

  it('uses the MinIO readiness endpoint from inside the container', () => {
    expect(files.minio).toContain('/minio/health/ready');
    expect(files.minio).toContain('127.0.0.1:9000');
  });
});
