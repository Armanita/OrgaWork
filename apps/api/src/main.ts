import { buildApplication } from './application.js';
import {
  closeIdentityOrganizationRuntime,
  createIdentityOrganizationRuntime,
} from './identity-organization-runtime.js';
import { resolveRuntimeConfiguration } from './runtime-configuration.js';

let application: ReturnType<typeof buildApplication> | undefined;
let database: Awaited<ReturnType<typeof createIdentityOrganizationRuntime>>['database'] | undefined;
async function start(): Promise<void> {
  try {
    const runtime = await createIdentityOrganizationRuntime();
    database = runtime.database;
    application = buildApplication({
      logger: true,
      identityOrganization: {
        authentication: runtime.authentication,
        organizationContext: runtime.organizationContext,
        production: runtime.production,
      },
      organizationAdministration: {
        authentication: runtime.authentication,
        authorization: runtime.authorization,
        administration: runtime.administration,
        production: runtime.production,
      },
    });
    await application.listen(resolveRuntimeConfiguration());
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
function shutdown(): void {
  void (async () => {
    await application?.close();
    if (database) await closeIdentityOrganizationRuntime(database);
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
void start();
