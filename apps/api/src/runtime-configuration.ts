const defaultHost = '127.0.0.1';
const defaultPort = 3001;

export interface RuntimeConfiguration {
  readonly host: string;
  readonly port: number;
}

export function resolveRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfiguration {
  const host = environment['HOST']?.trim() || defaultHost;
  const rawPort = environment['PORT']?.trim();

  const port = rawPort === undefined || rawPort === '' ? defaultPort : Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError('مقدار درگاه اجرا باید عددی صحیح بین ۱ تا ۶۵۵۳۵ باشد.');
  }

  return {
    host,
    port,
  };
}
