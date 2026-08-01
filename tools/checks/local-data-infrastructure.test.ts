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

describe('local data infrastructure contract', () => {
  it('uses one explicit shared dedicated network', () => {
    for (const content of Object.values(files)) {
      expect(content).toContain('name: orgawork-data-local');
      expect(content).toContain('      - orgawork_internal');
      expect(content).toContain('    name: orgawork-internal');
      expect(content).toContain('    driver: bridge');
      expect(content).not.toContain('    internal: true');
      expect(content).not.toContain('network_mode:');
    }
  });

  it('uses named volumes instead of tmpfs', () => {
    expect(files.postgres).toContain('      - orgawork_postgres_data:/var/lib/postgresql/data');
    expect(files.redis).toContain('      - orgawork_redis_data:/data');
    expect(files.minio).toContain('      - orgawork_minio_data:/data');
    for (const content of Object.values(files)) {
      expect(content).not.toContain('tmpfs:');
    }
  });

  it('assigns stable explicit Docker volume names', () => {
    expect(files.postgres).toContain('    name: orgawork-postgres-data');
    expect(files.redis).toContain('    name: orgawork-redis-data');
    expect(files.minio).toContain('    name: orgawork-minio-data');
  });

  it('keeps Redis persistence on the named volume through AOF', () => {
    expect(files.redis).toContain('      - --appendonly');
    expect(files.redis).toContain("      - 'yes'");
    expect(files.redis).toContain('      - --appendfsync');
    expect(files.redis).toContain('      - everysec');
  });
});
