const defaultWorkerName = 'orgawork-worker';
const defaultPollingIntervalMilliseconds = 5_000;
const minimumPollingIntervalMilliseconds = 100;
const maximumPollingIntervalMilliseconds = 300_000;

export interface WorkerRuntimeConfiguration {
  readonly name: string;
  readonly pollingIntervalMilliseconds: number;
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

  throw new RangeError('مقدار اجرای تک‌مرحله‌ای باید برابر درست یا نادرست باشد.');
}

export function resolveWorkerRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): WorkerRuntimeConfiguration {
  const name = environment['WORKER_NAME']?.trim() || defaultWorkerName;

  const rawPollingInterval = environment['WORKER_POLL_INTERVAL_MS']?.trim();

  const pollingIntervalMilliseconds =
    rawPollingInterval === undefined || rawPollingInterval === ''
      ? defaultPollingIntervalMilliseconds
      : Number(rawPollingInterval);

  if (
    !Number.isInteger(pollingIntervalMilliseconds) ||
    pollingIntervalMilliseconds < minimumPollingIntervalMilliseconds ||
    pollingIntervalMilliseconds > maximumPollingIntervalMilliseconds
  ) {
    throw new RangeError('فاصله بررسی پردازشگر باید عددی صحیح بین ۱۰۰ تا ۳۰۰۰۰۰ میلی‌ثانیه باشد.');
  }

  return {
    name,
    pollingIntervalMilliseconds,
    runOnce: parseRunOnce(environment['WORKER_RUN_ONCE']),
  };
}
