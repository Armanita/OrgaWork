import { describe, expect, it } from 'vitest';

import {
  createChildTraceContext,
  createObservabilityContext,
  createStructuredLogger,
  formatTraceParent,
  getObservabilityContext,
  parseTraceParent,
  redactSensitiveData,
  runWithObservabilityContext,
  type LogSink,
} from './index.js';

class MemorySink implements LogSink {
  readonly lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }
}

describe('shared observability foundation', () => {
  it('creates valid request and correlation identifiers', () => {
    const context = createObservabilityContext();

    expect(context.requestId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(context.correlationId).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it('uses the request identifier as default correlation identifier', () => {
    const context = createObservabilityContext({
      requestId: '11111111-1111-4111-8111-111111111111',
    });

    expect(context.correlationId).toBe(context.requestId);
  });

  it('creates and formats a root trace context', () => {
    const context = createObservabilityContext();
    const traceParent = formatTraceParent(context.trace);

    expect(traceParent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
  });

  it('continues an incoming W3C trace as a child span', () => {
    const trace = parseTraceParent('00-11111111111111111111111111111111-2222222222222222-01');

    expect(trace.traceId).toBe('11111111111111111111111111111111');
    expect(trace.parentSpanId).toBe('2222222222222222');
    expect(trace.spanId).not.toBe(trace.parentSpanId);
  });

  it('creates a child trace without changing the trace identifier', () => {
    const parent = parseTraceParent('00-11111111111111111111111111111111-2222222222222222-00');
    const child = createChildTraceContext(parent);

    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
    expect(child.traceFlags).toBe('00');
  });

  it('rejects malformed and zero trace identifiers', () => {
    expect(() => parseTraceParent('invalid')).toThrow(TypeError);
    expect(() =>
      parseTraceParent('00-00000000000000000000000000000000-2222222222222222-01'),
    ).toThrow(TypeError);
  });

  it('keeps context across an asynchronous boundary', async () => {
    const context = createObservabilityContext();

    await runWithObservabilityContext(context, async () => {
      await Promise.resolve();
      expect(getObservabilityContext()).toBe(context);
    });
  });

  it('redacts sensitive object keys recursively', () => {
    expect(
      redactSensitiveData({
        user: 'ali',
        password: 'secret-value',
        nested: {
          apiKey: 'key-value',
          safe: true,
        },
      }),
    ).toEqual({
      user: 'ali',
      password: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        safe: true,
      },
    });
  });

  it('redacts bearer tokens, key values and URI credentials', () => {
    const redacted = redactSensitiveData(
      'Bearer abc.def token=very-secret postgres://user:pass@localhost/db',
    );

    expect(redacted).toBe('Bearer [REDACTED] token=[REDACTED] postgres://[REDACTED]@localhost/db');
  });

  it('handles circular values without throwing', () => {
    const value: { self?: unknown } = {};
    value.self = value;

    expect(redactSensitiveData(value)).toEqual({
      self: '[CIRCULAR]',
    });
  });

  it('serializes unsupported primitive and callable values safely', () => {
    const namedFunction = function backgroundJob(): void {};
    const inferredFunction = (): void => {};

    expect(
      redactSensitiveData({
        missing: undefined,
        symbolWithoutDescription: Symbol(),
        symbolWithDescription: Symbol('safe'),
        namedFunction,
        inferredFunction,
      }),
    ).toEqual({
      missing: '[UNDEFINED]',
      symbolWithoutDescription: '[SYMBOL]',
      symbolWithDescription: '[SYMBOL:safe]',
      namedFunction: '[FUNCTION:backgroundJob]',
      inferredFunction: '[FUNCTION:inferredFunction]',
    });
  });

  it('writes one structured JSON line with context', () => {
    const sink = new MemorySink();
    const context = createObservabilityContext({
      requestId: '11111111-1111-4111-8111-111111111111',
      correlationId: '22222222-2222-4222-8222-222222222222',
    });
    const logger = createStructuredLogger({
      service: 'orgawork-api',
      sink,
      now: () => new Date('2026-08-03T00:00:00.000Z'),
      context: () => context,
    });

    logger.info('request-completed', 'درخواست تکمیل شد', {
      statusCode: 200,
    });

    expect(sink.lines).toHaveLength(1);
    expect(JSON.parse(sink.lines[0] ?? '{}')).toMatchObject({
      timestamp: '2026-08-03T00:00:00.000Z',
      level: 'info',
      service: 'orgawork-api',
      event: 'request-completed',
      message: 'درخواست تکمیل شد',
      requestId: context.requestId,
      correlationId: context.correlationId,
      attributes: {
        statusCode: 200,
      },
    });
  });

  it('redacts error details before writing a log', () => {
    const sink = new MemorySink();
    const logger = createStructuredLogger({
      service: 'orgawork-worker',
      sink,
      now: () => new Date('2026-08-03T00:00:00.000Z'),
    });

    logger.error('worker-failed', 'token=must-not-leak', {
      authorization: 'Bearer must-not-leak',
      error: new Error('password=must-not-leak'),
    });

    const line = sink.lines[0] ?? '';

    expect(line).not.toContain('must-not-leak');
    expect(line).toContain('[REDACTED]');
  });

  it('rejects invalid service and event names', () => {
    expect(() => createStructuredLogger({ service: 'API SERVICE' })).toThrow(TypeError);

    const logger = createStructuredLogger({
      service: 'orgawork-api',
      sink: new MemorySink(),
    });

    expect(() => logger.info('INVALID EVENT', 'پیام')).toThrow(TypeError);
  });

  it('rejects empty log messages', () => {
    const logger = createStructuredLogger({
      service: 'orgawork-api',
      sink: new MemorySink(),
    });

    expect(() => logger.info('request-started', '  ')).toThrow(TypeError);
  });
});
