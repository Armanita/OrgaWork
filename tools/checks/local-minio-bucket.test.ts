import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');

const environmentExample = read('.env.example');
const minioCompose = read('infra/compose/minio.compose.yaml');

const pinnedImage =
  'minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2';

describe('local private MinIO bucket contract', () => {
  it('declares one stable non-sensitive bucket name in the environment template', () => {
    expect(environmentExample).toContain('MINIO_BUCKET=orgawork-files');
    expect(environmentExample).not.toContain('MINIO_ROOT_PASSWORD=');
  });

  it('uses the already pinned MinIO image for the one-shot initializer', () => {
    expect(minioCompose.split(pinnedImage).length - 1).toBe(2);
    expect(minioCompose).toContain('  minio_bucket_init:');
    expect(minioCompose).toContain('    container_name: orgawork-minio-bucket-init');
  });

  it('waits for the MinIO service to become healthy on the private network', () => {
    expect(minioCompose).toContain('        condition: service_healthy');
    expect(minioCompose).toContain('      - orgawork_internal');
    expect(minioCompose).toContain('      MINIO_BUCKET: ${MINIO_BUCKET:-orgawork-files}');
  });

  it('creates the bucket idempotently through an authenticated local alias', () => {
    expect(minioCompose).toContain('mc alias set local http://minio:9000');
    expect(minioCompose).toContain('mc mb --ignore-existing');
    expect(minioCompose).toContain('local/$$MINIO_BUCKET');
  });

  it('enforces private anonymous policy and exits as a one-shot task', () => {
    expect(minioCompose).toContain('mc anonymous set private');
    expect(minioCompose).toContain('mc stat');
    expect(minioCompose).not.toContain('mc anonymous set public');
    expect(minioCompose).not.toContain('mc anonymous set download');
    expect(minioCompose).not.toContain('mc anonymous set upload');
    expect(minioCompose).toContain("    restart: 'no'");
  });
});
