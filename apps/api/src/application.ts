import cookie from '@fastify/cookie';
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
import {
  createIdentityOrganizationRoutes,
  type IdentityOrganizationRouteOptions,
} from './routes/identity-organization.js';
import {
  createOrganizationAdministrationRoutes,
  type OrganizationAdministrationRouteOptions,
} from './routes/organization-administration.js';

export interface ApplicationOptions {
  readonly logger?: boolean;
  readonly connectivityDependencies?: ConnectivityRouteDependencies;
  readonly operationalHealthDependencies?: readonly DependencyHealthCheck[];
  readonly identityOrganization?: IdentityOrganizationRouteOptions;
  readonly organizationAdministration?: OrganizationAdministrationRouteOptions;
}

export function buildApplication(options: ApplicationOptions = {}): FastifyInstance {
  const application = Fastify({
    logger: options.logger ?? false,
  });

  application.register(cookie);
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
  application.register(createIdentityOrganizationRoutes(options.identityOrganization));
  if (options.organizationAdministration !== undefined) {
    application.register(
      createOrganizationAdministrationRoutes(options.organizationAdministration),
    );
  }
  application.register(readinessRoute);

  return application;
}
