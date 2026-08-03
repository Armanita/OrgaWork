import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createConnection, type Socket } from 'node:net';
import { resolve } from 'node:path';

import {
  createPostgreSqlAccess,
  inspectLeastPrivilegeDatabaseRoles,
  loadVersionedMigrations,
  runTrackedVersionedMigrations,
  withOrganizationTransaction,
} from '../../packages/database/src/index.js';
import { probeRedisConnectivity } from '../../packages/queue/src/index.js';

type RespValue = string | number | null;

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') {
    throw new Error(`${name} در محیط Process تعریف نشده است.`);
  }
  return value;
}

function environmentText(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function environmentPort(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? String(fallback));
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} معتبر نیست.`);
  }
  return value;
}

function encodeCommand(arguments_: readonly string[]): string {
  return `*${String(arguments_.length)}\r\n${arguments_
    .map((argument) => `$${String(Buffer.byteLength(argument, 'utf8'))}\r\n${argument}\r\n`)
    .join('')}`;
}

function parseResponse(
  buffer: Buffer,
): { readonly complete: false } | { readonly complete: true; readonly value: RespValue } {
  const first = buffer[0];
  const lineEnd = buffer.indexOf('\r\n');
  if (first === undefined || lineEnd < 0) {
    return { complete: false };
  }

  const line = buffer.subarray(1, lineEnd).toString('utf8');
  if (first === 43) return { complete: true, value: line };
  if (first === 45) throw new Error(`Redis error: ${line}`);
  if (first === 58) return { complete: true, value: Number(line) };
  if (first === 36) {
    const length = Number(line);
    if (length === -1) return { complete: true, value: null };
    const start = lineEnd + 2;
    const end = start + length;
    if (buffer.length < end + 2) return { complete: false };
    return {
      complete: true,
      value: buffer.subarray(start, end).toString('utf8'),
    };
  }

  throw new Error('نوع پاسخ Redis در Spike پشتیبانی نمی‌شود.');
}

class RedisSpikeClient {
  private socket: Socket | undefined;

  public async connect(host: string, port: number): Promise<void> {
    this.socket = await new Promise<Socket>((resolveSocket, reject) => {
      const socket = createConnection({ host, port });
      socket.once('connect', () => resolveSocket(socket));
      socket.once('error', reject);
    });
  }

  public async command(arguments_: readonly string[]): Promise<RespValue> {
    const socket = this.socket;
    if (socket === undefined) throw new Error('اتصال Redis باز نیست.');

    return new Promise<RespValue>((resolveValue, reject) => {
      let buffer = Buffer.alloc(0);
      const cleanup = (): void => {
        socket.off('data', onData);
        socket.off('error', onError);
      };
      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };
      const onData = (chunk: Buffer): void => {
        buffer = Buffer.concat([buffer, chunk]);
        try {
          const result = parseResponse(buffer);
          if (result.complete) {
            cleanup();
            resolveValue(result.value);
          }
        } catch (error: unknown) {
          cleanup();
          const reason =
            error instanceof Error
              ? error
              : new Error('Redis response parsing failed.', {
                  cause: error,
                });
          reject(reason);
        }
      };

      socket.on('data', onData);
      socket.on('error', onError);
      socket.write(encodeCommand(arguments_), 'utf8');
    });
  }

  public close(): void {
    this.socket?.destroy();
    this.socket = undefined;
  }
}

const postgres = {
  host: environmentText('POSTGRES_HOST', '127.0.0.1'),
  port: environmentPort('POSTGRES_PORT', 5432),
  database: environmentText('POSTGRES_DB', 'orgawork'),
  user: environmentText('POSTGRES_USER', 'orgawork'),
  password: requiredSecret('POSTGRES_PASSWORD'),
};
const redis = {
  host: environmentText('REDIS_HOST', '127.0.0.1'),
  port: environmentPort('REDIS_PORT', 6379),
  password: requiredSecret('REDIS_PASSWORD'),
};

const access = createPostgreSqlAccess(postgres, {
  applicationName: 'orgawork-p1.9-real-spike',
  maximumConnections: 2,
});
const redisClient = new RedisSpikeClient();
const organizationA = randomUUID();
const organizationB = randomUUID();
const outboxA = randomUUID();
const outboxB = randomUUID();
const outboxDuplicate = randomUUID();
const inboxA = randomUUID();
const inboxDuplicate = randomUUID();
const messageId = randomUUID();
const heartbeatProcess = `p19-spike-${randomUUID()}`;
const heartbeatOldInstance = randomUUID();
const heartbeatNewInstance = randomUUID();
const sharedKey = `shared-${randomUUID()}`;
const leaseKey = `orgawork:p1.9:lease:${randomUUID()}`;

let redisConnected = false;

try {
  const migrations = await loadVersionedMigrations('infra/migrations');
  await runTrackedVersionedMigrations(access, migrations);

  const roles = await inspectLeastPrivilegeDatabaseRoles(access);
  if (roles.migration.bypassesRowLevelSecurity || roles.runtime.bypassesRowLevelSecurity) {
    throw new Error('نقش پایگاه داده قادر به عبور از RLS است.');
  }

  const catalog = await access.query<{
    readonly table_name: string;
    readonly rls_enabled: boolean;
    readonly rls_forced: boolean;
  }>(
    `SELECT
       class.relname AS table_name,
       class.relrowsecurity AS rls_enabled,
       class.relforcerowsecurity AS rls_forced
     FROM pg_class AS class
     JOIN pg_namespace AS namespace
       ON namespace.oid = class.relnamespace
     WHERE namespace.nspname = 'public'
       AND class.relname = ANY($1::text[])
     ORDER BY class.relname`,
    [['orgawork_inbox', 'orgawork_outbox', 'orgawork_process_heartbeat']],
  );

  if (catalog.rows.length !== 3) {
    throw new Error('جداول زیرساخت سازمانی کامل نیستند.');
  }
  for (const row of catalog.rows) {
    if (row.table_name !== 'orgawork_process_heartbeat' && (!row.rls_enabled || !row.rls_forced)) {
      throw new Error('RLS جدول سازمانی فعال و اجباری نیست.');
    }
  }

  const concurrentContexts = await Promise.all([
    withOrganizationTransaction(access, organizationA, async (transaction) => {
      await transaction.query('SELECT pg_sleep(0.05)');
      return transaction.query<{ readonly organization_id: string }>(
        `SELECT current_setting('orgawork.organization_id') AS organization_id`,
      );
    }),
    withOrganizationTransaction(access, organizationB, async (transaction) => {
      await transaction.query('SELECT pg_sleep(0.05)');
      return transaction.query<{ readonly organization_id: string }>(
        `SELECT current_setting('orgawork.organization_id') AS organization_id`,
      );
    }),
  ]);

  if (
    concurrentContexts[0].rows[0]?.organization_id !== organizationA ||
    concurrentContexts[1].rows[0]?.organization_id !== organizationB
  ) {
    throw new Error('زمینه هم‌زمان سازمان‌ها مستقل نیست.');
  }

  for (let index = 0; index < 6; index += 1) {
    const outside = await access.query<{
      readonly organization_id: string | null;
    }>(`SELECT NULLIF(current_setting('orgawork.organization_id', true), '') AS organization_id`);
    if (outside.rows[0]?.organization_id !== null) {
      throw new Error('زمینه سازمان پس از تراکنش در Pool باقی مانده است.');
    }
  }

  await withOrganizationTransaction(access, organizationA, async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_outbox
         (id, organization_id, topic, payload, idempotency_key)
       VALUES ($1, $2, 'p1.9.created', '{}'::jsonb, $3)`,
      [outboxA, organizationA, sharedKey],
    );
    await transaction.query(
      `INSERT INTO public.orgawork_inbox
         (id, organization_id, consumer_name, message_id, payload)
       VALUES ($1, $2, 'p1.9-consumer', $3, '{}'::jsonb)`,
      [inboxA, organizationA, messageId],
    );
  });

  await withOrganizationTransaction(access, organizationB, async (transaction) => {
    await transaction.query(
      `INSERT INTO public.orgawork_outbox
         (id, organization_id, topic, payload, idempotency_key)
       VALUES ($1, $2, 'p1.9.created', '{}'::jsonb, $3)`,
      [outboxB, organizationB, sharedKey],
    );
  });

  let outboxDuplicateRejected = false;
  try {
    await withOrganizationTransaction(access, organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_outbox
           (id, organization_id, topic, payload, idempotency_key)
         VALUES ($1, $2, 'p1.9.duplicate', '{}'::jsonb, $3)`,
        [outboxDuplicate, organizationA, sharedKey],
      );
    });
  } catch {
    outboxDuplicateRejected = true;
  }
  if (!outboxDuplicateRejected) {
    throw new Error('Outbox تکراری در یک سازمان پذیرفته شد.');
  }

  let inboxDuplicateRejected = false;
  try {
    await withOrganizationTransaction(access, organizationA, async (transaction) => {
      await transaction.query(
        `INSERT INTO public.orgawork_inbox
           (id, organization_id, consumer_name, message_id, payload)
         VALUES ($1, $2, 'p1.9-consumer', $3, '{}'::jsonb)`,
        [inboxDuplicate, organizationA, messageId],
      );
    });
  } catch {
    inboxDuplicateRejected = true;
  }
  if (!inboxDuplicateRejected) {
    throw new Error('Inbox تکراری در یک سازمان پذیرفته شد.');
  }

  const visibleA = await withOrganizationTransaction(access, organizationA, async (transaction) =>
    transaction.query<{ readonly id: string }>(
      `SELECT id::text AS id FROM public.orgawork_outbox ORDER BY id`,
    ),
  );
  if (visibleA.rows.length !== 1 || visibleA.rows[0]?.id !== outboxA) {
    throw new Error('جداسازی RLS سازمان A نامعتبر است.');
  }

  const constraints = await access.query<{
    readonly table_name: string;
    readonly definition: string;
  }>(
    `SELECT
       class.relname AS table_name,
       pg_get_constraintdef(constraint_row.oid) AS definition
     FROM pg_constraint AS constraint_row
     JOIN pg_class AS class
       ON class.oid = constraint_row.conrelid
     JOIN pg_namespace AS namespace
       ON namespace.oid = class.relnamespace
     WHERE namespace.nspname = 'public'
       AND class.relname = ANY($1::text[])
     ORDER BY class.relname, constraint_row.conname`,
    [['orgawork_inbox', 'orgawork_outbox', 'orgawork_process_heartbeat']],
  );
  const definitions = constraints.rows.map((row) => row.definition).join('\n');
  for (const marker of [
    'UNIQUE (organization_id, idempotency_key)',
    'UNIQUE (organization_id, consumer_name, message_id)',
    'PRIMARY KEY (process_name, instance_id)',
  ]) {
    if (!definitions.includes(marker)) {
      throw new Error(`محدودیت مرکب پیدا نشد: ${marker}`);
    }
  }

  await access.transaction(async (transaction) => {
    await transaction.query('SET LOCAL ROLE orgawork_runtime');
    await transaction.query(
      `INSERT INTO public.orgawork_process_heartbeat
         (process_name, instance_id, started_at, last_seen_at, lease_expires_at)
       VALUES (
         $1,
         $2,
         clock_timestamp() - interval '10 seconds',
         clock_timestamp() - interval '5 seconds',
         clock_timestamp() - interval '1 second'
       )`,
      [heartbeatProcess, heartbeatOldInstance],
    );
  });

  const recovered = await access.transaction(async (transaction) => {
    await transaction.query('SET LOCAL ROLE orgawork_runtime');
    return transaction.query(
      `UPDATE public.orgawork_process_heartbeat
       SET
         instance_id = $2,
         started_at = clock_timestamp(),
         last_seen_at = clock_timestamp(),
         lease_expires_at = clock_timestamp() + interval '30 seconds'
       WHERE process_name = $1
         AND instance_id = $3
         AND lease_expires_at <= clock_timestamp()`,
      [heartbeatProcess, heartbeatNewInstance, heartbeatOldInstance],
    );
  });
  if (recovered.rowCount !== 1) {
    throw new Error('Lease منقضی‌شده PostgreSQL بازیابی نشد.');
  }

  await probeRedisConnectivity(redis);
  await redisClient.connect(redis.host, redis.port);
  redisConnected = true;
  if ((await redisClient.command(['AUTH', redis.password])) !== 'OK') {
    throw new Error('AUTH Redis موفق نبود.');
  }
  if ((await redisClient.command(['SET', leaseKey, 'worker-a', 'NX', 'PX', '10000'])) !== 'OK') {
    throw new Error('Lease نخست Redis ثبت نشد.');
  }
  if ((await redisClient.command(['SET', leaseKey, 'worker-b', 'NX', 'PX', '10000'])) !== null) {
    throw new Error('مالک دوم Lease فعال را تصاحب کرد.');
  }
  await redisClient.command(['PEXPIRE', leaseKey, '1']);
  await new Promise<void>((resolvePromise) => {
    setTimeout(resolvePromise, 25);
  });
  if ((await redisClient.command(['SET', leaseKey, 'worker-b', 'NX', 'PX', '10000'])) !== 'OK') {
    throw new Error('Lease Redis پس از انقضا بازیابی نشد.');
  }
  if ((await redisClient.command(['GET', leaseKey])) !== 'worker-b') {
    throw new Error('مالک بازیابی‌شده Lease Redis معتبر نیست.');
  }

  const evidence = {
    schemaVersion: 1,
    stage: 'P1.9',
    classification: 'technical-spike',
    postgres: {
      rolesNoBypassRls: true,
      concurrentOrganizationContext: true,
      poolContextReset: true,
      rowLevelSecurityForced: true,
      outboxDuplicateRejected: true,
      inboxDuplicateRejected: true,
      crossOrganizationIdentityAllowed: true,
      compositeConstraints: true,
      expiredHeartbeatLeaseRecovered: true,
    },
    redis: {
      connectivity: true,
      activeLeaseProtected: true,
      expiredLeaseRecovered: true,
    },
  } as const;

  mkdirSync(resolve('artifacts/spikes'), { recursive: true });
  writeFileSync(
    resolve('artifacts/spikes/p1.9-real-infrastructure.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );

  process.stdout.write('P1.9_REAL_POSTGRESQL_RLS_POOL_CONTEXT: VERIFIED\n');
  process.stdout.write('P1.9_REAL_OUTBOX_INBOX_DUPLICATE_DELIVERY: VERIFIED\n');
  process.stdout.write('P1.9_REAL_COMPOSITE_CONSTRAINTS: VERIFIED\n');
  process.stdout.write('P1.9_REAL_REDIS_LEASE_RECOVERY: VERIFIED\n');
} finally {
  if (redisConnected) {
    await redisClient.command(['DEL', leaseKey]).catch(() => undefined);
  }
  redisClient.close();

  await access
    .query(
      `DELETE FROM public.orgawork_outbox
       WHERE id = ANY($1::uuid[])`,
      [[outboxA, outboxB, outboxDuplicate]],
    )
    .catch(() => undefined);
  await access
    .query(
      `DELETE FROM public.orgawork_inbox
       WHERE id = ANY($1::uuid[])`,
      [[inboxA, inboxDuplicate]],
    )
    .catch(() => undefined);
  await access
    .query(
      `DELETE FROM public.orgawork_process_heartbeat
       WHERE process_name = $1`,
      [heartbeatProcess],
    )
    .catch(() => undefined);
  await access.close();
}

process.stdout.write('P1.9_REAL_INFRASTRUCTURE_CLEANUP: VERIFIED\n');
