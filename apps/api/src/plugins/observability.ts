import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  createObservabilityContext,
  createStructuredLogger,
  defaultMetricRegistry,
  enterObservabilityContext,
  formatTraceParent,
  type LogSink,
  type MetricRegistry,
  type ObservabilityContext,
} from '@workspace/observability';

export interface ApiObservabilityOptions {
  readonly sink?: LogSink;
  readonly now?: () => number;
  readonly metrics?: MetricRegistry;
}

interface RequestState {
  readonly context: ObservabilityContext;
  readonly startedAt: number;
}

function firstHeader(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

function requestAttributes(request: FastifyRequest): Readonly<Record<string, unknown>> {
  return {
    method: request.method,
    url: request.url,
  };
}

export function registerApiObservability(
  application: FastifyInstance,
  options: ApiObservabilityOptions = {},
): void {
  const states = new WeakMap<FastifyRequest, RequestState>();
  const now = options.now ?? (() => performance.now());
  const metrics = options.metrics ?? defaultMetricRegistry;
  const logger = createStructuredLogger({
    service: 'orgawork-api',
    ...(options.sink === undefined ? {} : { sink: options.sink }),
  });

  application.addHook('onRequest', (request, reply, done) => {
    const requestId = firstHeader(request.headers['x-request-id']);
    const correlationId = firstHeader(request.headers['x-correlation-id']);
    const traceParent = firstHeader(request.headers['traceparent']);

    let context: ObservabilityContext;

    try {
      context = createObservabilityContext({
        ...(requestId === undefined ? {} : { requestId }),
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(traceParent === undefined ? {} : { traceParent }),
      });
    } catch {
      context = createObservabilityContext();
    }

    enterObservabilityContext(context);
    states.set(request, {
      context,
      startedAt: now(),
    });

    reply.header('x-request-id', context.requestId);
    reply.header('x-correlation-id', context.correlationId);
    reply.header('traceparent', formatTraceParent(context.trace));

    logger.info('request-started', 'پردازش درخواست آغاز شد', requestAttributes(request));
    done();
  });

  application.addHook('onResponse', (request, reply, done) => {
    const state = states.get(request);

    if (state !== undefined) {
      enterObservabilityContext(state.context);
    }

    const durationMilliseconds = state === undefined ? 0 : Math.max(0, now() - state.startedAt);

    metrics.recordApiRequest(request.method, request.url, reply.statusCode, durationMilliseconds);

    logger.info('request-completed', 'پردازش درخواست تکمیل شد', {
      ...requestAttributes(request),
      statusCode: reply.statusCode,
      durationMilliseconds,
    });
    done();
  });

  application.addHook('onError', (request, reply, error, done) => {
    const state = states.get(request);

    if (state !== undefined) {
      enterObservabilityContext(state.context);
    }

    logger.error('request-failed', 'پردازش درخواست ناموفق بود', {
      ...requestAttributes(request),
      statusCode: reply.statusCode,
      error,
    });
    done();
  });
}
