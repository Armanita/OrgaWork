import Fastify, { type FastifyInstance } from 'fastify';

import {
  createConnectivityRoute,
  type ConnectivityRouteDependencies,
} from './routes/connectivity.js';
import { healthRoute } from './routes/health.js';

export interface ApplicationOptions {
  readonly logger?: boolean;
  readonly connectivityDependencies?: ConnectivityRouteDependencies;
}

export function buildApplication(options: ApplicationOptions = {}): FastifyInstance {
  const application = Fastify({
    logger: options.logger ?? false,
  });

  application.register(createConnectivityRoute(options.connectivityDependencies));
  application.register(healthRoute);

  return application;
}
