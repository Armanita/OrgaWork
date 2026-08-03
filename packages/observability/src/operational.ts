export type MetricOutcome = 'success' | 'failure';
export type OperationalHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type HeartbeatStatus = 'healthy' | 'stale' | 'missing';

interface Aggregate {
  readonly labels: Readonly<Record<string, string>>;
  count: number;
  durationSum: number;
}

export interface DependencyHealthCheck {
  readonly name: string;
  readonly required: boolean;
  check(): Promise<void>;
}

export interface DependencyHealthResult {
  readonly name: string;
  readonly required: boolean;
  readonly status: 'healthy' | 'unhealthy';
  readonly durationMilliseconds: number;
  readonly code?: 'DEPENDENCY_CHECK_FAILED' | 'DEPENDENCY_CHECK_TIMEOUT';
}

export interface OperationalHealthReport {
  readonly service: 'orgawork-api';
  readonly status: OperationalHealthStatus;
  readonly timestamp: string;
  readonly dependencies: readonly DependencyHealthResult[];
}

export interface HeartbeatInspection {
  readonly process: string;
  readonly status: HeartbeatStatus;
  readonly recordedAt?: string;
  readonly ageMilliseconds?: number;
  readonly maximumAgeMilliseconds: number;
}

export interface HealthTransition {
  readonly previous: OperationalHealthStatus;
  readonly current: OperationalHealthStatus;
  readonly changedAt: string;
}

function normalizedName(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,63}$/u.test(normalized)) {
    throw new TypeError(`${label} معتبر نیست.`);
  }
  return normalized;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} باید نامنفی و متناهی باشد.`);
  }
  return value;
}

function normalizeRoute(value: string): string {
  const path = value.split('?')[0]?.trim() || '/';
  return path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/giu, '/:id').replace(/\/\d+(?=\/|$)/gu, '/:id');
}

function key(labels: Readonly<Record<string, string>>): string {
  return JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

function renderedLabels(labels: Readonly<Record<string, string>>): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0
    ? ''
    : `{${entries.map(([name, value]) => `${name}="${escapeLabel(value)}"`).join(',')}}`;
}

function addAggregate(
  target: Map<string, Aggregate>,
  labels: Readonly<Record<string, string>>,
  durationMilliseconds: number,
): void {
  const identity = key(labels);
  const aggregate = target.get(identity) ?? { labels, count: 0, durationSum: 0 };
  aggregate.count += 1;
  aggregate.durationSum += finiteNonNegative(durationMilliseconds, 'مدت عملیات');
  target.set(identity, aggregate);
}

export class MetricRegistry {
  private readonly api = new Map<string, Aggregate>();
  private readonly database = new Map<string, Aggregate>();
  private readonly queue = new Map<string, Aggregate>();
  private readonly processes = new Map<string, Aggregate>();
  private readonly queueDepth = new Map<string, number>();
  private readonly heartbeatSeconds = new Map<string, number>();
  private readonly dependencyHealth = new Map<string, number>();

  public reset(): void {
    this.api.clear();
    this.database.clear();
    this.queue.clear();
    this.processes.clear();
    this.queueDepth.clear();
    this.heartbeatSeconds.clear();
    this.dependencyHealth.clear();
  }

  public recordApiRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMilliseconds: number,
  ): void {
    addAggregate(
      this.api,
      {
        method: method.trim().toUpperCase(),
        route: normalizeRoute(route),
        status: String(statusCode),
      },
      durationMilliseconds,
    );
  }

  public recordDatabaseOperation(
    operation: 'query' | 'transaction',
    outcome: MetricOutcome,
    durationMilliseconds: number,
  ): void {
    addAggregate(this.database, { operation, outcome }, durationMilliseconds);
  }

  public recordQueueOperation(
    queue: string,
    operation: string,
    outcome: MetricOutcome,
    durationMilliseconds: number,
  ): void {
    addAggregate(
      this.queue,
      {
        queue: normalizedName(queue, 'نام صف'),
        operation: normalizedName(operation, 'نام عملیات صف'),
        outcome,
      },
      durationMilliseconds,
    );
  }

  public setQueueDepth(queue: string, depth: number): void {
    this.queueDepth.set(normalizedName(queue, 'نام صف'), finiteNonNegative(depth, 'عمق صف'));
  }

  public recordProcessCycle(
    processName: 'worker' | 'scheduler',
    outcome: MetricOutcome,
    durationMilliseconds: number,
  ): void {
    addAggregate(this.processes, { process: processName, outcome }, durationMilliseconds);
  }

  public setProcessHeartbeat(processName: string, timestamp: Date): void {
    const milliseconds = timestamp.getTime();
    if (Number.isNaN(milliseconds)) throw new RangeError('زمان ضربان معتبر نیست.');
    this.heartbeatSeconds.set(normalizedName(processName, 'نام فرایند'), milliseconds / 1000);
  }

  public setDependencyHealth(dependency: string, healthy: boolean): void {
    this.dependencyHealth.set(normalizedName(dependency, 'نام وابستگی'), healthy ? 1 : 0);
  }

  public renderPrometheus(): string {
    const lines: string[] = [];
    const renderAggregates = (name: string, help: string, values: Map<string, Aggregate>): void => {
      lines.push(`# HELP ${name}_total ${help}`);
      lines.push(`# TYPE ${name}_total counter`);
      lines.push(`# HELP ${name}_duration_milliseconds_sum مجموع مدت ${help}`);
      lines.push(`# TYPE ${name}_duration_milliseconds_sum counter`);
      for (const aggregate of [...values.values()].sort((a, b) =>
        key(a.labels).localeCompare(key(b.labels)),
      )) {
        const labels = renderedLabels(aggregate.labels);
        lines.push(`${name}_total${labels} ${aggregate.count}`);
        lines.push(`${name}_duration_milliseconds_sum${labels} ${aggregate.durationSum}`);
      }
    };

    renderAggregates('orgawork_api_requests', 'درخواست‌های رابط برنامه‌نویسی', this.api);
    renderAggregates('orgawork_database_operations', 'عملیات پایگاه داده', this.database);
    renderAggregates('orgawork_queue_operations', 'عملیات صف', this.queue);
    renderAggregates('orgawork_process_cycles', 'چرخه‌های Worker و Scheduler', this.processes);

    lines.push('# HELP orgawork_queue_depth تعداد پیام‌های در انتظار صف');
    lines.push('# TYPE orgawork_queue_depth gauge');
    for (const [queue, depth] of [...this.queueDepth.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`orgawork_queue_depth${renderedLabels({ queue })} ${depth}`);
    }

    lines.push('# HELP orgawork_process_heartbeat_timestamp_seconds آخرین زمان ضربان فرایند');
    lines.push('# TYPE orgawork_process_heartbeat_timestamp_seconds gauge');
    for (const [processName, timestamp] of [...this.heartbeatSeconds.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(
        `orgawork_process_heartbeat_timestamp_seconds${renderedLabels({ process: processName })} ${timestamp}`,
      );
    }

    lines.push('# HELP orgawork_dependency_health سلامت وابستگی با مقدار یک برای سالم');
    lines.push('# TYPE orgawork_dependency_health gauge');
    for (const [dependency, healthy] of [...this.dependencyHealth.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`orgawork_dependency_health${renderedLabels({ dependency })} ${healthy}`);
    }

    return `${lines.join('\n')}\n`;
  }
}

export const defaultMetricRegistry = new MetricRegistry();

export class HeartbeatRegistry {
  private readonly records = new Map<string, Date>();
  public constructor(private readonly metrics: MetricRegistry = defaultMetricRegistry) {}
  public reset(): void {
    this.records.clear();
  }
  public record(processValue: string, at: Date = new Date()): void {
    const processName = normalizedName(processValue, 'نام فرایند');
    if (Number.isNaN(at.getTime())) throw new RangeError('زمان ثبت ضربان معتبر نیست.');
    const value = new Date(at.getTime());
    this.records.set(processName, value);
    this.metrics.setProcessHeartbeat(processName, value);
  }
  public inspect(
    processValue: string,
    maximumAgeMilliseconds: number,
    now: Date = new Date(),
  ): HeartbeatInspection {
    const processName = normalizedName(processValue, 'نام فرایند');
    if (!Number.isInteger(maximumAgeMilliseconds) || maximumAgeMilliseconds < 1) {
      throw new RangeError('حداکثر سن ضربان باید عددی صحیح و مثبت باشد.');
    }
    const recordedAt = this.records.get(processName);
    if (recordedAt === undefined)
      return { process: processName, status: 'missing', maximumAgeMilliseconds };
    const ageMilliseconds = Math.max(0, now.getTime() - recordedAt.getTime());
    return {
      process: processName,
      status: ageMilliseconds <= maximumAgeMilliseconds ? 'healthy' : 'stale',
      recordedAt: recordedAt.toISOString(),
      ageMilliseconds,
      maximumAgeMilliseconds,
    };
  }
}

export const defaultHeartbeatRegistry = new HeartbeatRegistry();

async function runDependency(
  dependency: DependencyHealthCheck,
  timeoutMilliseconds: number,
  clock: () => number,
  metrics: MetricRegistry,
): Promise<DependencyHealthResult> {
  const name = normalizedName(dependency.name, 'نام وابستگی');
  const startedAt = clock();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      dependency.check(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('DEPENDENCY_CHECK_TIMEOUT')),
          timeoutMilliseconds,
        );
      }),
    ]);
    metrics.setDependencyHealth(name, true);
    return {
      name,
      required: dependency.required,
      status: 'healthy',
      durationMilliseconds: Math.max(0, clock() - startedAt),
    };
  } catch (error: unknown) {
    metrics.setDependencyHealth(name, false);
    const timedOut = error instanceof Error && error.message === 'DEPENDENCY_CHECK_TIMEOUT';
    return {
      name,
      required: dependency.required,
      status: 'unhealthy',
      durationMilliseconds: Math.max(0, clock() - startedAt),
      code: timedOut ? 'DEPENDENCY_CHECK_TIMEOUT' : 'DEPENDENCY_CHECK_FAILED',
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function evaluateOperationalHealth(
  dependencies: readonly DependencyHealthCheck[],
  options: {
    readonly timeoutMilliseconds?: number;
    readonly now?: () => Date;
    readonly clock?: () => number;
    readonly metrics?: MetricRegistry;
  } = {},
): Promise<OperationalHealthReport> {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 5000;
  if (
    !Number.isInteger(timeoutMilliseconds) ||
    timeoutMilliseconds < 1 ||
    timeoutMilliseconds > 60000
  ) {
    throw new RangeError('مهلت بررسی سلامت معتبر نیست.');
  }
  const clock = options.clock ?? (() => performance.now());
  const metrics = options.metrics ?? defaultMetricRegistry;
  const results = await Promise.all(
    dependencies.map((dependency) =>
      runDependency(dependency, timeoutMilliseconds, clock, metrics),
    ),
  );
  const requiredFailure = results.some(
    (result) => result.required && result.status === 'unhealthy',
  );
  const optionalFailure = results.some(
    (result) => !result.required && result.status === 'unhealthy',
  );
  return {
    service: 'orgawork-api',
    status: requiredFailure ? 'unhealthy' : optionalFailure ? 'degraded' : 'healthy',
    timestamp: (options.now ?? (() => new Date()))().toISOString(),
    dependencies: results,
  };
}

export class HealthStateTracker {
  private current: OperationalHealthStatus | undefined;
  public update(
    status: OperationalHealthStatus,
    changedAt: Date = new Date(),
  ): HealthTransition | undefined {
    const previous = this.current;
    this.current = status;
    if (previous === undefined || previous === status) return undefined;
    return { previous, current: status, changedAt: changedAt.toISOString() };
  }
  public getCurrent(): OperationalHealthStatus | undefined {
    return this.current;
  }
}

export interface BaselineAlert {
  readonly code:
    | 'DEPENDENCY_UNHEALTHY'
    | 'PROCESS_HEARTBEAT_MISSING'
    | 'PROCESS_HEARTBEAT_STALE'
    | 'API_ERROR_RATE_HIGH';
  readonly severity: 'warning' | 'critical';
  readonly subject: string;
}

export function evaluateBaselineAlerts(input: {
  readonly health: OperationalHealthReport;
  readonly heartbeats: readonly HeartbeatInspection[];
  readonly apiErrorRate: number;
  readonly apiErrorRateThreshold?: number;
}): readonly BaselineAlert[] {
  const threshold = input.apiErrorRateThreshold ?? 0.05;
  if (
    !Number.isFinite(input.apiErrorRate) ||
    input.apiErrorRate < 0 ||
    input.apiErrorRate > 1 ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 1
  ) {
    throw new RangeError('نرخ خطای رابط برنامه‌نویسی معتبر نیست.');
  }
  const alerts: BaselineAlert[] = [];
  for (const dependency of input.health.dependencies) {
    if (dependency.status === 'unhealthy')
      alerts.push({
        code: 'DEPENDENCY_UNHEALTHY',
        severity: dependency.required ? 'critical' : 'warning',
        subject: dependency.name,
      });
  }
  for (const heartbeat of input.heartbeats) {
    if (heartbeat.status === 'missing')
      alerts.push({
        code: 'PROCESS_HEARTBEAT_MISSING',
        severity: 'critical',
        subject: heartbeat.process,
      });
    if (heartbeat.status === 'stale')
      alerts.push({
        code: 'PROCESS_HEARTBEAT_STALE',
        severity: 'warning',
        subject: heartbeat.process,
      });
  }
  if (input.apiErrorRate > threshold)
    alerts.push({ code: 'API_ERROR_RATE_HIGH', severity: 'warning', subject: 'orgawork-api' });
  return alerts;
}
