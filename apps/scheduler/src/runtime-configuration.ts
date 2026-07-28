const defaultSchedulerName = 'orgawork-scheduler';
const defaultIntervalMilliseconds = 60_000;
const minimumIntervalMilliseconds = 100;
const maximumIntervalMilliseconds = 86_400_000;

export interface SchedulerRuntimeConfiguration {
  readonly name: string;
  readonly intervalMilliseconds: number;
  readonly runOnce: boolean;
}

function parseRunOnce(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new RangeError('مقدار اجرای تک‌مرحله‌ای زمان‌بند باید برابر درست یا نادرست باشد.');
}

export function resolveSchedulerRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): SchedulerRuntimeConfiguration {
  const name = environment['SCHEDULER_NAME']?.trim() || defaultSchedulerName;

  const rawInterval = environment['SCHEDULER_INTERVAL_MS']?.trim();

  const intervalMilliseconds =
    rawInterval === undefined || rawInterval === ''
      ? defaultIntervalMilliseconds
      : Number(rawInterval);

  if (
    !Number.isInteger(intervalMilliseconds) ||
    intervalMilliseconds < minimumIntervalMilliseconds ||
    intervalMilliseconds > maximumIntervalMilliseconds
  ) {
    throw new RangeError(
      'فاصله اجرای زمان‌بند باید عددی صحیح بین ۱۰۰ تا ۸۶۴۰۰۰۰۰ میلی‌ثانیه باشد.',
    );
  }

  return {
    name,
    intervalMilliseconds,
    runOnce: parseRunOnce(environment['SCHEDULER_RUN_ONCE']),
  };
}
