import { createClient } from 'redis';

export interface RedisConnectivityConfiguration {
  readonly host: string;
  readonly port: number;
  readonly password: string;
}

export interface RedisConnectivityResult {
  readonly service: 'redis';
  readonly status: 'connected';
  readonly operation: 'PING';
  readonly response: 'PONG';
}

export async function probeRedisConnectivity(
  configuration: RedisConnectivityConfiguration,
): Promise<RedisConnectivityResult> {
  const client = createClient({
    password: configuration.password,
    socket: {
      host: configuration.host,
      port: configuration.port,
      connectTimeout: 5_000,
      reconnectStrategy: false,
    },
  });

  client.on('error', () => undefined);

  await client.connect();

  try {
    const response = await client.ping();

    if (response !== 'PONG') {
      throw new Error('پاسخ Probe خواندنی Redis معتبر نیست.');
    }

    return {
      service: 'redis',
      status: 'connected',
      operation: 'PING',
      response: 'PONG',
    };
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}
