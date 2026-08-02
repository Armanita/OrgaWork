const defaultPostgreSqlHost = '127.0.0.1';
const defaultPostgreSqlPort = 5432;
const defaultPostgreSqlDatabase = 'orgawork';
const defaultPostgreSqlUser = 'orgawork';
const defaultRedisHost = '127.0.0.1';
const defaultRedisPort = 6379;
const defaultMinioHost = '127.0.0.1';
const defaultMinioApiPort = 9000;
const defaultMinioRootUser = 'orgawork-minio';
const defaultMinioBucket = 'orgawork-files';
const defaultMinioRegion = 'us-east-1';

export interface ApplicationConnectivityConfiguration {
  readonly postgresql: {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly user: string;
    readonly password: string;
  };
  readonly redis: {
    readonly host: string;
    readonly port: number;
    readonly password: string;
  };
  readonly minio: {
    readonly endpoint: string;
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly bucket: string;
  };
}

function readText(environment: NodeJS.ProcessEnv, key: string, defaultValue: string): string {
  return environment[key]?.trim() || defaultValue;
}

function readRequiredSecret(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();

  if (value === undefined || value === '') {
    throw new Error('متغیر محرمانه ' + key + ' باید در محیط اجرا تعریف شود.');
  }

  return value;
}

function readPort(environment: NodeJS.ProcessEnv, key: string, defaultValue: number): number {
  const rawValue = environment[key]?.trim();
  const value = rawValue === undefined || rawValue === '' ? defaultValue : Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new RangeError('مقدار ' + key + ' باید عددی صحیح بین ۱ تا ۶۵۵۳۵ باشد.');
  }

  return value;
}

export function resolveApplicationConnectivityConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): ApplicationConnectivityConfiguration {
  const minioHost = readText(environment, 'MINIO_HOST', defaultMinioHost);
  const minioApiPort = readPort(environment, 'MINIO_API_PORT', defaultMinioApiPort);

  return {
    postgresql: {
      host: readText(environment, 'POSTGRES_HOST', defaultPostgreSqlHost),
      port: readPort(environment, 'POSTGRES_PORT', defaultPostgreSqlPort),
      database: readText(environment, 'POSTGRES_DB', defaultPostgreSqlDatabase),
      user: readText(environment, 'POSTGRES_USER', defaultPostgreSqlUser),
      password: readRequiredSecret(environment, 'POSTGRES_PASSWORD'),
    },
    redis: {
      host: readText(environment, 'REDIS_HOST', defaultRedisHost),
      port: readPort(environment, 'REDIS_PORT', defaultRedisPort),
      password: readRequiredSecret(environment, 'REDIS_PASSWORD'),
    },
    minio: {
      endpoint: 'http://' + minioHost + ':' + String(minioApiPort),
      region: defaultMinioRegion,
      accessKeyId: readText(environment, 'MINIO_ROOT_USER', defaultMinioRootUser),
      secretAccessKey: readRequiredSecret(environment, 'MINIO_ROOT_PASSWORD'),
      bucket: readText(environment, 'MINIO_BUCKET', defaultMinioBucket),
    },
  };
}
