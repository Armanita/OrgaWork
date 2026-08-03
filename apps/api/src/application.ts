import Fastify, { type FastifyInstance } from 'fastify';

import {
  createConnectivityRoute,
  type ConnectivityRouteDependencies,
} from './routes/connectivity.js';
import { healthRoute } from './routes/health.js';
import type { DependencyHealthCheck } from '@workspace/observability';

import { registerApiObservability } from './plugins/observability.js';
import { createOperationalRoutes } from './routes/operational.js';
import { readinessRoute } from './routes/readiness.js';

export interface ApplicationOptions {
  readonly logger?: boolean;
  readonly connectivityDependencies?: ConnectivityRouteDependencies;
  readonly operationalHealthDependencies?: readonly DependencyHealthCheck[];
}

export function buildApplication(options: ApplicationOptions = {}): FastifyInstance {
  const application = Fastify({
    logger: options.logger ?? false,
  });

  registerApiObservability(application);
  application.register(
    createOperationalRoutes({
      ...(options.operationalHealthDependencies === undefined
        ? {}
        : { dependencies: options.operationalHealthDependencies }),
    }),
  );
  application.register(createConnectivityRoute(options.connectivityDependencies));
  application.register(healthRoute);
  application.register(readinessRoute);

  return application;
}
