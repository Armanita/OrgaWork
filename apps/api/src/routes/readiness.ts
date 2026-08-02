import type { FastifyPluginAsync } from 'fastify';

export interface ReadinessResponse {
  readonly service: 'orgawork-api';
  readonly status: 'ready';
  readonly timestamp: string;
}

const readinessResponseSchema = {
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
      const: 'ready',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
    },
  },
} as const;

export const readinessRoute: FastifyPluginAsync = (application) => {
  application.get<{ Reply: ReadinessResponse }>(
    '/ready',
    {
      schema: {
        response: {
          200: readinessResponseSchema,
        },
      },
    },
    (_request, reply) => {
      reply.header('cache-control', 'no-store');

      return {
        service: 'orgawork-api',
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    },
  );

  return Promise.resolve();
};
