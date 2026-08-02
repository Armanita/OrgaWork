import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generatedContractFingerprint,
  generatedContractVersion,
  generatedOperations,
} from '../../packages/api-client/src/generated-contract.js';

export interface ContractDriftResult {
  readonly openApiVersion: '3.1.0';
  readonly contractVersion: '1.0.0';
  readonly fingerprint: string;
  readonly operationIds: readonly ['getHealth', 'getReadiness'];
  readonly serverRoutes: readonly ['/health', '/ready'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Contract drift: ${label}`);
  }

  return value;
}

function requireOperationId(paths: Record<string, unknown>, path: '/health' | '/ready'): string {
  const pathItem = requireRecord(paths[path], path);
  const getOperation = requireRecord(pathItem['get'], `${path}.get`);
  const operationId = getOperation['operationId'];

  if (typeof operationId !== 'string') {
    throw new Error(`Contract drift: ${path}.operationId`);
  }

  return operationId;
}

export async function verifyContractDrift(
  projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
): Promise<ContractDriftResult> {
  const openApiPath = resolve(projectRoot, 'packages/contracts/openapi/orgawork.openapi.json');
  const [openApiText, applicationSource, healthSource, readinessSource] = await Promise.all([
    readFile(openApiPath, 'utf8'),
    readFile(resolve(projectRoot, 'apps/api/src/application.ts'), 'utf8'),
    readFile(resolve(projectRoot, 'apps/api/src/routes/health.ts'), 'utf8'),
    readFile(resolve(projectRoot, 'apps/api/src/routes/readiness.ts'), 'utf8'),
  ]);

  const fingerprint = createHash('sha256').update(openApiText, 'utf8').digest('hex');

  if (fingerprint !== generatedContractFingerprint) {
    throw new Error('Contract drift: generated client fingerprint mismatch');
  }

  const parsed: unknown = JSON.parse(openApiText);
  const document = requireRecord(parsed, 'document');
  const info = requireRecord(document['info'], 'info');
  const paths = requireRecord(document['paths'], 'paths');

  if (document['openapi'] !== '3.1.0' || info['version'] !== generatedContractVersion) {
    throw new Error('Contract drift: OpenAPI or contract version mismatch');
  }

  const healthOperationId = requireOperationId(paths, '/health');
  const readinessOperationId = requireOperationId(paths, '/ready');

  if (
    healthOperationId !== generatedOperations.health.operationId ||
    readinessOperationId !== generatedOperations.readiness.operationId
  ) {
    throw new Error('Contract drift: operation metadata mismatch');
  }

  if (
    !applicationSource.includes('application.register(healthRoute)') ||
    !applicationSource.includes('application.register(readinessRoute)') ||
    !healthSource.includes("'/health'") ||
    !readinessSource.includes("'/ready'")
  ) {
    throw new Error('Contract drift: registered server routes mismatch');
  }

  return {
    openApiVersion: '3.1.0',
    contractVersion: '1.0.0',
    fingerprint,
    operationIds: ['getHealth', 'getReadiness'],
    serverRoutes: ['/health', '/ready'],
  };
}

const invokedPath = process.argv[1];

if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void verifyContractDrift()
    .then((result) => {
      process.stdout.write(
        [
          'CONTRACT_DRIFT_CHECK: VERIFIED',
          `OPENAPI_VERSION: ${result.openApiVersion}`,
          `CONTRACT_VERSION: ${result.contractVersion}`,
          '',
        ].join('\n'),
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Contract drift check failed';
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
