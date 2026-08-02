export const connectivityClientPlan = [
  {
    service: 'postgresql',
    workspace: '@workspace/database',
    workspacePath: 'packages/database',
    clientPackage: 'pg',
    clientVersion: '8.22.0',
    typePackage: '@types/pg',
    typeVersion: '8.20.0',
    probeOperation: 'SELECT 1',
    readOnly: true,
  },
  {
    service: 'redis',
    workspace: '@workspace/queue',
    workspacePath: 'packages/queue',
    clientPackage: 'redis',
    clientVersion: '6.1.0',
    probeOperation: 'PING',
    readOnly: true,
  },
  {
    service: 'minio',
    workspace: '@workspace/storage',
    workspacePath: 'packages/storage',
    clientPackage: '@aws-sdk/client-s3',
    clientVersion: '3.1090.0',
    probeOperation: 'HeadBucketCommand',
    readOnly: true,
  },
] as const;

export const applicationConnectivityPlan = [
  {
    application: 'web',
    evidenceChannel: 'HTTP GET /api/connectivity',
    executionPhase: 'request',
  },
  {
    application: 'api',
    evidenceChannel: 'HTTP GET /connectivity',
    executionPhase: 'request',
  },
  {
    application: 'worker',
    evidenceChannel: 'connectivity-verified event',
    executionPhase: 'startup',
  },
  {
    application: 'scheduler',
    evidenceChannel: 'connectivity-verified event',
    executionPhase: 'startup',
  },
] as const;

export const connectivityServiceNames = ['postgresql', 'redis', 'minio'] as const;

export const deferredConnectivityScope = [
  'database migrations',
  'database schema changes',
  'row-level security',
  'business data reads and writes',
  'public bucket policy changes',
  'persistence acceptance after restart',
] as const;

export function assertApplicationConnectivityPlan(): void {
  const services = new Set(connectivityClientPlan.map((entry) => entry.service));
  const applications = new Set(applicationConnectivityPlan.map((entry) => entry.application));

  if (services.size !== connectivityServiceNames.length) {
    throw new Error('برنامه اتصال باید دقیقاً سه سرویس یکتا داشته باشد.');
  }

  if (applications.size !== 4) {
    throw new Error('برنامه اتصال باید دقیقاً چهار برنامه یکتا داشته باشد.');
  }

  for (const entry of connectivityClientPlan) {
    if (!entry.readOnly) {
      throw new Error('Probe سرویس ' + entry.service + ' باید فقط‌خواندنی باشد.');
    }

    if (!/^\d+\.\d+\.\d+$/u.test(entry.clientVersion)) {
      throw new Error('نسخه Client سرویس ' + entry.service + ' باید ثابت باشد.');
    }
  }
}
