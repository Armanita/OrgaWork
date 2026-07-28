import Fastify, { type FastifyInstance } from 'fastify';

import { healthRoute } from './routes/health.js';

export interface ApplicationOptions {
  readonly logger?: boolean;
}

export function buildApplication(options: ApplicationOptions = {}): FastifyInstance {
  const application = Fastify({
    logger: options.logger ?? false,
  });

  application.register(healthRoute);

  return application;
}
