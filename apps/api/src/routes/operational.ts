import type { FastifyPluginAsync } from 'fastify';
import {
  defaultMetricRegistry,
  evaluateOperationalHealth,
  type DependencyHealthCheck,
  type MetricRegistry,
} from '@workspace/observability';

export interface OperationalRoutesOptions {
  readonly dependencies?: readonly DependencyHealthCheck[];
  readonly metrics?: MetricRegistry;
}

export function createOperationalRoutes(
  options: OperationalRoutesOptions = {},
): FastifyPluginAsync {
  return (application) => {
    const metrics = options.metrics ?? defaultMetricRegistry;
    application.get('/live', (_request, reply) => {
      reply.header('cache-control', 'no-store');
      return { service: 'orgawork-api', status: 'alive', timestamp: new Date().toISOString() };
    });
    application.get('/metrics', (_request, reply) => {
      reply
        .header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
        .header('cache-control', 'no-store');
      return metrics.renderPrometheus();
    });
    application.get('/health/details', async (_request, reply) => {
      const report = await evaluateOperationalHealth(options.dependencies ?? [], { metrics });
      reply.code(report.status === 'unhealthy' ? 503 : 200).header('cache-control', 'no-store');
      return report;
    });
    return Promise.resolve();
  };
}
