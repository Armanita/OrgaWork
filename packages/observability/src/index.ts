import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';

import {
  createCorrelationId,
  createRequestId,
  createUtcTimestamp,
  type CorrelationId,
  type OrganizationId,
  type RequestId,
  type UserId,
  type UtcTimestamp,
} from '@workspace/contracts';

export const logLevels = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof logLevels)[number];

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: '00' | '01';
  readonly parentSpanId?: string;
}

export interface ObservabilityContext {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly trace: TraceContext;
  readonly organizationId?: OrganizationId;
  readonly userId?: UserId;
}

export interface StructuredLogEvent {
  readonly timestamp: UtcTimestamp;
  readonly level: LogLevel;
  readonly service: string;
  readonly event: string;
  readonly message: string;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly traceId: string;
  readonly spanId: string;
  readonly organizationId?: OrganizationId;
  readonly userId?: UserId;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface LogSink {
  write(line: string): void;
}

export interface StructuredLogger {
  debug(event: string, message: string, attributes?: Readonly<Record<string, unknown>>): void;
  info(event: string, message: string, attributes?: Readonly<Record<string, unknown>>): void;
  warn(event: string, message: string, attributes?: Readonly<Record<string, unknown>>): void;
  error(event: string, message: string, attributes?: Readonly<Record<string, unknown>>): void;
}

export interface StructuredLoggerOptions {
  readonly service: string;
  readonly sink?: LogSink;
  readonly now?: () => Date;
  readonly context?: () => ObservabilityContext | undefined;
}

export interface CreateObservabilityContextInput {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceParent?: string;
  readonly organizationId?: OrganizationId;
  readonly userId?: UserId;
}

const contextStorage = new AsyncLocalStorage<ObservabilityContext>();
const servicePattern = /^[a-z][a-z0-9-]{2,63}$/u;
const eventPattern = /^[a-z][a-z0-9-]{2,95}$/u;
const traceParentPattern = /^00-([0-9a-f]{32})-([0-9a-f]{16})-(00|01)$/u;
const zeroTraceId = '00000000000000000000000000000000';
const zeroSpanId = '0000000000000000';
const redactedValue = '[REDACTED]';
const sensitiveKeyPattern =
  /(?:password|passwd|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|credential|connection[-_]?string)/iu;
const keyValueSecretPattern =
  /\b(password|passwd|secret|token|api[-_]?key|authorization)\s*[:=]\s*([^\s,;]+)/giu;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const uriCredentialPattern = /:\/\/[^/\s:@]+:[^/\s@]+@/gu;

function normalizeName(value: string, pattern: RegExp, label: string): string {
  const normalized = value.trim().toLowerCase();

  if (!pattern.test(normalized)) {
    throw new TypeError(`${label} مشاهده‌پذیری معتبر نیست.`);
  }

  return normalized;
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function createRootTraceContext(): TraceContext {
  return {
    traceId: randomHex(16),
    spanId: randomHex(8),
    traceFlags: '01',
  };
}

function redactString(value: string): string {
  return value
    .replace(bearerPattern, 'Bearer [REDACTED]')
    .replace(keyValueSecretPattern, (_match, key: string) => `${key}=[REDACTED]`)
    .replace(uriCredentialPattern, '://[REDACTED]@');
}

function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 12) {
    return '[TRUNCATED]';
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen, depth + 1));
  }

  if (value === undefined) {
    return '[UNDEFINED]';
  }

  if (typeof value === 'symbol') {
    return value.description === undefined ? '[SYMBOL]' : `[SYMBOL:${value.description}]`;
  }

  if (typeof value === 'function') {
    return value.name === '' ? '[FUNCTION:anonymous]' : `[FUNCTION:${value.name}]`;
  }

  if (typeof value !== 'object') {
    return '[UNSUPPORTED]';
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }

  seen.add(value);

  const output: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    output[key] = sensitiveKeyPattern.test(key)
      ? redactedValue
      : redactValue(nested, seen, depth + 1);
  }

  return output;
}

export function redactSensitiveData(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>(), 0);
}

export function parseTraceParent(value: string): TraceContext {
  const normalized = value.trim().toLowerCase();
  const match = traceParentPattern.exec(normalized);

  if (match === null || match[1] === zeroTraceId || match[2] === zeroSpanId) {
    throw new TypeError('سرآیند traceparent معتبر نیست.');
  }

  return {
    traceId: match[1]!,
    spanId: randomHex(8),
    parentSpanId: match[2]!,
    traceFlags: match[3]! as '00' | '01',
  };
}

export function formatTraceParent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

export function createChildTraceContext(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: randomHex(8),
    parentSpanId: parent.spanId,
    traceFlags: parent.traceFlags,
  };
}

export function createObservabilityContext(
  input: CreateObservabilityContextInput = {},
): ObservabilityContext {
  const requestId = createRequestId(input.requestId ?? randomUUID());
  const correlationId = createCorrelationId(input.correlationId ?? requestId);
  const trace =
    input.traceParent === undefined || input.traceParent.trim() === ''
      ? createRootTraceContext()
      : parseTraceParent(input.traceParent);

  return {
    requestId,
    correlationId,
    trace,
    ...(input.organizationId === undefined ? {} : { organizationId: input.organizationId }),
    ...(input.userId === undefined ? {} : { userId: input.userId }),
  };
}

export function runWithObservabilityContext<Result>(
  context: ObservabilityContext,
  callback: () => Result,
): Result {
  return contextStorage.run(context, callback);
}

export function enterObservabilityContext(context: ObservabilityContext): void {
  contextStorage.enterWith(context);
}

export function getObservabilityContext(): ObservabilityContext | undefined {
  return contextStorage.getStore();
}

const standardOutputSink: LogSink = {
  write(line: string): void {
    process.stdout.write(`${line}\n`);
  },
};

export function createStructuredLogger(options: StructuredLoggerOptions): StructuredLogger {
  const service = normalizeName(options.service, servicePattern, 'نام سرویس');
  const sink = options.sink ?? standardOutputSink;
  const now = options.now ?? (() => new Date());
  const contextProvider = options.context ?? (() => getObservabilityContext());

  function write(
    level: LogLevel,
    eventName: string,
    messageValue: string,
    attributes?: Readonly<Record<string, unknown>>,
  ): void {
    const event = normalizeName(eventName, eventPattern, 'نام رخداد');
    const message = redactString(messageValue.trim());
    const context = contextProvider() ?? createObservabilityContext();

    if (message === '') {
      throw new TypeError('پیام رخداد نباید خالی باشد.');
    }

    const logEvent: StructuredLogEvent = {
      timestamp: createUtcTimestamp(now()),
      level,
      service,
      event,
      message,
      requestId: context.requestId,
      correlationId: context.correlationId,
      traceId: context.trace.traceId,
      spanId: context.trace.spanId,
      ...(context.organizationId === undefined ? {} : { organizationId: context.organizationId }),
      ...(context.userId === undefined ? {} : { userId: context.userId }),
      ...(attributes === undefined
        ? {}
        : {
            attributes: redactSensitiveData(attributes) as Readonly<Record<string, unknown>>,
          }),
    };

    sink.write(JSON.stringify(logEvent));
  }

  return {
    debug(event, message, attributes): void {
      write('debug', event, message, attributes);
    },
    info(event, message, attributes): void {
      write('info', event, message, attributes);
    },
    warn(event, message, attributes): void {
      write('warn', event, message, attributes);
    },
    error(event, message, attributes): void {
      write('error', event, message, attributes);
    },
  };
}
