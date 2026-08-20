import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';

import type { DependencyHealthCheck } from '@workspace/observability';

import {
  createConnectivityRoute,
  type ConnectivityRouteDependencies,
} from './routes/connectivity.js';
import { healthRoute } from './routes/health.js';
import {
  createIdentityOrganizationRoutes,
  type IdentityOrganizationRouteOptions,
} from './routes/identity-organization.js';
import {
  createOrganizationAdministrationRoutes,
  type OrganizationAdministrationRouteOptions,
} from './routes/organization-administration.js';
import { createOperationalRoutes } from './routes/operational.js';
import {
  createPlatformControlPlaneRoutes,
  type PlatformControlPlaneRouteOptions,
} from './routes/platform-control-plane.js';
import { readinessRoute } from './routes/readiness.js';
import {
  createWorkManagementRoutes,
  type WorkManagementRouteOptions,
} from './routes/work-management.js';
import { registerApiObservability } from './plugins/observability.js';

export interface ApplicationOptions {
  readonly logger?: boolean;
  readonly connectivityDependencies?: ConnectivityRouteDependencies;
  readonly operationalHealthDependencies?: readonly DependencyHealthCheck[];
  readonly identityOrganization?: IdentityOrganizationRouteOptions;
  readonly organizationAdministration?: OrganizationAdministrationRouteOptions;
  readonly platformControlPlane?: PlatformControlPlaneRouteOptions;
  readonly workManagement?: WorkManagementRouteOptions;
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
  if (options.platformControlPlane !== undefined) {
    application.register(createPlatformControlPlaneRoutes(options.platformControlPlane));
  }
  if (options.workManagement !== undefined) {
    application.register(createWorkManagementRoutes(options.workManagement));
  }

  application.register(readinessRoute);
  return application;
}
