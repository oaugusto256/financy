import request from 'supertest';
import type { Express } from 'express';

interface ExecuteOptions {
  query: string;
  variables?: Record<string, unknown>;
  token?: string;
}

/** Runs an operation through the real HTTP stack, optionally authenticated. */
export async function execute(app: Express, options: ExecuteOptions) {
  const call = request(app).post('/graphql');
  if (options.token) call.set('Authorization', `Bearer ${options.token}`);

  const response = await call.send({
    query: options.query,
    variables: options.variables,
  });

  return response.body as {
    data?: Record<string, unknown> | null;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

/** The error code of the first error, or undefined if the operation succeeded. */
export function errorCode(body: {
  errors?: { extensions?: { code?: string } }[];
}) {
  return body.errors?.[0]?.extensions?.code;
}
