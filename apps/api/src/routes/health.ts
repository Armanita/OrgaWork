import type { FastifyPluginAsync } from 'fastify';

export interface HealthResponse {
  readonly service: 'orgawork-api';
  readonly status: 'ok';
  readonly timestamp: string;
}

const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['service', 'status', 'timestamp'],
  properties: {
    service: {
      type: 'string',
      const: 'orgawork-api',
    },
    status: {
      type: 'string',
      const: 'ok',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
    },
  },
} as const;

export const healthRoute: FastifyPluginAsync = (application) => {
  application.get<{ Reply: HealthResponse }>(
    '/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    (_request, reply) => {
      reply.header('cache-control', 'no-store');

      return {
        service: 'orgawork-api',
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    },
  );

  return Promise.resolve();
};
