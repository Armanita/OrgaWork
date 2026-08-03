export type JsonRecord = Record<string, unknown>;

export interface CapturedProcessOutput {
  readonly name: string;
  readonly stdout: string;
  readonly stderr: string;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRecord(text: string): JsonRecord {
  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`رخداد دارای قالب معتبر نیست: ${text}`);
  }

  if (!isJsonRecord(value)) {
    throw new Error(`رخداد باید یک شیء باشد: ${text}`);
  }

  return value;
}

function processFailure(running: CapturedProcessOutput): string {
  return `${running.name} متوقف شد.\n` + `خروجی:\n${running.stdout}\n` + `خطا:\n${running.stderr}`;
}

function attributesOf(event: JsonRecord, label: string): JsonRecord {
  const attributes = event['attributes'];

  if (!isJsonRecord(attributes)) {
    throw new Error(`ویژگی‌های رخداد ${label} معتبر نیستند.`);
  }

  return attributes;
}

function eventAt(events: readonly JsonRecord[], index: number, label: string): JsonRecord {
  const event = events[index];

  if (event === undefined) {
    throw new Error(`رخداد ${label} پیدا نشد.`);
  }

  return event;
}

export function parseLifecycleEvents(
  running: CapturedProcessOutput,
  expectedEvents: readonly string[],
): readonly JsonRecord[] {
  if (running.stderr.trim() !== '') {
    throw new Error(processFailure(running));
  }

  const lines = running.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (lines.length !== expectedEvents.length) {
    throw new Error(
      `${running.name} باید دقیقاً ${String(expectedEvents.length)} رخداد ثبت کند؛ ` +
        `تعداد: ${String(lines.length)}\n${running.stdout}`,
    );
  }

  const events = lines.map((line) => parseJsonRecord(line));
  const actualEvents = events.map((event) => event['event']);

  for (let index = 0; index < expectedEvents.length; index += 1) {
    const expected = expectedEvents[index];
    const actual = actualEvents[index];

    if (actual !== expected) {
      throw new Error(
        `ترتیب رخدادهای ${running.name} معتبر نیست؛ ` +
          `در جایگاه ${String(index + 1)} مقدار ${String(expected)} انتظار می‌رفت ` +
          `اما ${String(actual)} دریافت شد.`,
      );
    }
  }

  return events;
}

export function validateWorkerProcessOutput(
  running: CapturedProcessOutput,
  exitCode: number,
): void {
  if (exitCode !== 0) {
    throw new Error(processFailure(running));
  }

  const events = parseLifecycleEvents(running, [
    'worker-started',
    'worker-cycle-completed',
    'worker-stopped',
  ]);

  const started = eventAt(events, 0, 'worker-started');
  const cycle = eventAt(events, 1, 'worker-cycle-completed');
  const stopped = eventAt(events, 2, 'worker-stopped');

  if (
    started['service'] !== 'orgawork-worker' ||
    cycle['service'] !== 'orgawork-worker' ||
    stopped['service'] !== 'orgawork-worker'
  ) {
    throw new Error('نام سرویس رخدادهای پردازشگر معتبر نیست.');
  }

  const startedAttributes = attributesOf(started, 'worker-started');
  const cycleAttributes = attributesOf(cycle, 'worker-cycle-completed');
  const stoppedAttributes = attributesOf(stopped, 'worker-stopped');

  if (
    startedAttributes['pollingIntervalMilliseconds'] !== 250 ||
    startedAttributes['runOnce'] !== true
  ) {
    throw new Error('رخداد آغاز پردازشگر معتبر نیست.');
  }

  if (
    cycleAttributes['service'] !== 'orgawork-worker' ||
    cycleAttributes['status'] !== 'completed' ||
    cycleAttributes['sequence'] !== 1 ||
    typeof cycleAttributes['heartbeatAt'] !== 'string'
  ) {
    throw new Error('رخداد چرخه پردازشگر معتبر نیست.');
  }

  if (stoppedAttributes['reason'] !== 'run-once') {
    throw new Error('رخداد توقف پردازشگر معتبر نیست.');
  }
}

export function validateSchedulerProcessOutput(
  running: CapturedProcessOutput,
  exitCode: number,
): void {
  if (exitCode !== 0) {
    throw new Error(processFailure(running));
  }

  const events = parseLifecycleEvents(running, [
    'scheduler-started',
    'schedule-run-completed',
    'scheduler-stopped',
  ]);

  const started = eventAt(events, 0, 'scheduler-started');
  const runEvent = eventAt(events, 1, 'schedule-run-completed');
  const stopped = eventAt(events, 2, 'scheduler-stopped');

  if (
    started['service'] !== 'orgawork-scheduler' ||
    runEvent['service'] !== 'orgawork-scheduler' ||
    stopped['service'] !== 'orgawork-scheduler'
  ) {
    throw new Error('نام سرویس رخدادهای زمان‌بند معتبر نیست.');
  }

  const startedAttributes = attributesOf(started, 'scheduler-started');
  const runAttributes = attributesOf(runEvent, 'schedule-run-completed');
  const stoppedAttributes = attributesOf(stopped, 'scheduler-stopped');

  if (startedAttributes['intervalMilliseconds'] !== 250 || startedAttributes['runOnce'] !== true) {
    throw new Error('رخداد آغاز زمان‌بند معتبر نیست.');
  }

  if (
    runAttributes['service'] !== 'orgawork-scheduler' ||
    runAttributes['status'] !== 'completed' ||
    runAttributes['sequence'] !== 1 ||
    typeof runAttributes['heartbeatAt'] !== 'string'
  ) {
    throw new Error('رخداد اجرای زمان‌بند معتبر نیست.');
  }

  if (stoppedAttributes['reason'] !== 'run-once') {
    throw new Error('رخداد توقف زمان‌بند معتبر نیست.');
  }

  const scheduledFor = runAttributes['scheduledFor'];
  const nextRunAt = runAttributes['nextRunAt'];

  if (typeof scheduledFor !== 'string' || typeof nextRunAt !== 'string') {
    throw new Error('موعدهای زمان‌بند معتبر نیستند.');
  }

  const difference = new Date(nextRunAt).getTime() - new Date(scheduledFor).getTime();

  if (difference !== 250) {
    throw new Error(`اختلاف موعدهای زمان‌بند صحیح نیست: ${String(difference)}`);
  }
}
