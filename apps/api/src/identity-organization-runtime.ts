import { resolveApplicationConnectivityConfiguration } from '@workspace/configuration';
import { createPostgreSqlAccess, type PostgreSqlAccess } from '@workspace/database';
import {
  createAuthenticationService,
  createPostgreSqlAuthenticationRepository,
} from '@workspace/authentication';
import {
  createOrganizationContextService,
  createPostgreSqlOrganizationContextRepository,
} from '@workspace/organization-context';
import {
  createAuthorizationService,
  createPostgreSqlAuthorizationRepository,
} from '@workspace/authorization';
import {
  createOrganizationAdministrationService,
  createPlatformControlPlaneService,
  createPostgreSqlOrganizationAdministrationRepository,
  createPostgreSqlPlatformControlPlaneRepository,
} from '@workspace/organization-administration';

export async function createIdentityOrganizationRuntime(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const configuration = resolveApplicationConnectivityConfiguration(environment);
  const database = createPostgreSqlAccess(configuration.postgresql, {
    applicationName: 'orgawork-api-identity',
  });
  const authentication = await createAuthenticationService({
    repository: createPostgreSqlAuthenticationRepository(database),
  });
  const organizationContext = createOrganizationContextService(
    createPostgreSqlOrganizationContextRepository(database),
  );
  const authorization = createAuthorizationService(
    createPostgreSqlAuthorizationRepository(database),
  );
  const administration = createOrganizationAdministrationService(
    createPostgreSqlOrganizationAdministrationRepository(database),
  );
  const platformControlPlane = createPlatformControlPlaneService(
    createPostgreSqlPlatformControlPlaneRepository(database),
  );
  return {
    database,
    authentication,
    organizationContext,
    authorization,
    administration,
    platformControlPlane,
    production: environment['NODE_ENV'] === 'production',
  };
}
export async function closeIdentityOrganizationRuntime(database: PostgreSqlAccess): Promise<void> {
  await database.close();
}
