import { buildApplication } from './application.js';
import { resolveRuntimeConfiguration } from './runtime-configuration.js';

const application = buildApplication({
  logger: true,
});

async function start(): Promise<void> {
  try {
    const configuration = resolveRuntimeConfiguration();

    await application.listen(configuration);
  } catch (error: unknown) {
    application.log.error(error);
    process.exitCode = 1;
  }
}

function requestShutdown(): void {
  void application.close().catch((error: unknown) => {
    application.log.error(error);
    process.exitCode = 1;
  });
}

process.once('SIGINT', requestShutdown);
process.once('SIGTERM', requestShutdown);

void start();
