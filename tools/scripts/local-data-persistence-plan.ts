export const persistenceAcceptanceStage = 'P1.4.11';

export const persistenceAcceptanceTable = 'public.orgawork_persistence_acceptance';
export const persistenceAcceptanceBucket = 'orgawork-files';
export const persistenceAcceptanceRedisKeyPrefix = 'orgawork:p1.4.11:';
export const persistenceAcceptanceObjectPrefix = 'acceptance/p1.4.11/';

export const persistenceAcceptanceLifecycleCommands = ['infra:stop', 'infra:start'] as const;
export const forbiddenPersistenceCommands = ['infra:cleanup'] as const;
export const forbiddenPersistenceArguments = ['--volumes', '-v', '--remove-orphans'] as const;

const markerIdPattern = /^[a-z0-9][a-z0-9-]{7,63}$/;

export interface PersistenceAcceptancePlan {
  readonly stage: typeof persistenceAcceptanceStage;
  readonly markerId: string;
  readonly markerValue: string;
  readonly lifecycleCommands: typeof persistenceAcceptanceLifecycleCommands;
  readonly postgresql: {
    readonly table: typeof persistenceAcceptanceTable;
    readonly createTableSql: string;
    readonly writeSql: string;
    readonly readSql: string;
    readonly deleteSql: string;
    readonly dropTableSql: string;
  };
  readonly redis: {
    readonly key: string;
  };
  readonly minio: {
    readonly bucket: typeof persistenceAcceptanceBucket;
    readonly objectKey: string;
  };
  readonly cleanupRequired: true;
  readonly preserveNamedVolumes: true;
  readonly preserveBucketPrivacy: true;
}

export function normalizePersistenceMarkerId(value: string): string {
  const markerId = value.trim().toLowerCase();

  if (!markerIdPattern.test(markerId)) {
    throw new Error(
      'شناسه آزمون ماندگاری باید ۸ تا ۶۴ نویسه و فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.',
    );
  }

  return markerId;
}

export function buildPersistenceAcceptancePlan(value: string): PersistenceAcceptancePlan {
  const markerId = normalizePersistenceMarkerId(value);
  const markerValue = 'orgawork-persistence-' + markerId;

  return {
    stage: persistenceAcceptanceStage,
    markerId,
    markerValue,
    lifecycleCommands: persistenceAcceptanceLifecycleCommands,
    postgresql: {
      table: persistenceAcceptanceTable,
      createTableSql:
        'CREATE TABLE IF NOT EXISTS public.orgawork_persistence_acceptance (marker_id text PRIMARY KEY, marker_value text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())',
      writeSql:
        'INSERT INTO public.orgawork_persistence_acceptance (marker_id, marker_value) VALUES (, ) ON CONFLICT (marker_id) DO UPDATE SET marker_value = EXCLUDED.marker_value, created_at = now()',
      readSql: 'SELECT marker_value FROM public.orgawork_persistence_acceptance WHERE marker_id = ',
      deleteSql: 'DELETE FROM public.orgawork_persistence_acceptance WHERE marker_id = ',
      dropTableSql: 'DROP TABLE IF EXISTS public.orgawork_persistence_acceptance',
    },
    redis: {
      key: persistenceAcceptanceRedisKeyPrefix + markerId,
    },
    minio: {
      bucket: persistenceAcceptanceBucket,
      objectKey: persistenceAcceptanceObjectPrefix + markerId + '.txt',
    },
    cleanupRequired: true,
    preserveNamedVolumes: true,
    preserveBucketPrivacy: true,
  };
}

export function assertSafePersistenceAcceptancePlan(plan: PersistenceAcceptancePlan): void {
  if (plan.stage !== persistenceAcceptanceStage) {
    throw new Error('مرحله برنامه ماندگاری معتبر نیست.');
  }

  if (plan.lifecycleCommands.join(',') !== 'infra:stop,infra:start') {
    throw new Error('چرخه مجاز آزمون ماندگاری باید فقط infra:stop و infra:start باشد.');
  }

  for (const command of forbiddenPersistenceCommands) {
    if ((plan.lifecycleCommands as readonly string[]).includes(command)) {
      throw new Error('فرمان ممنوع در برنامه ماندگاری پیدا شد: ' + command);
    }
  }

  if (!plan.redis.key.startsWith(persistenceAcceptanceRedisKeyPrefix)) {
    throw new Error('کلید Redis خارج از فضای نام پذیرش است.');
  }

  if (!plan.minio.objectKey.startsWith(persistenceAcceptanceObjectPrefix)) {
    throw new Error('کلید شیء MinIO خارج از مسیر پذیرش است.');
  }

  if (plan.minio.bucket !== persistenceAcceptanceBucket) {
    throw new Error('Bucket آزمون ماندگاری معتبر نیست.');
  }

  if (!plan.cleanupRequired || !plan.preserveNamedVolumes || !plan.preserveBucketPrivacy) {
    throw new Error('قیود پاک‌سازی، حفظ Volume و خصوصی‌ماندن Bucket کامل نیست.');
  }
}
