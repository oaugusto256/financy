import request from 'supertest';
import {
  beforeAll,
  afterAll,
  afterEach,
  expect,
  describe,
  it,
  vi,
} from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import type { ApolloServer } from '@apollo/server';
import type { GraphQLContext } from '../../src/context.js';
import { prisma } from '../../src/shared/prisma.js';
import { execute } from '../helpers/graphql.js';

let app: Express;
let apollo: ApolloServer<GraphQLContext>;

beforeAll(async () => {
  ({ app, apollo } = await createApp());
});

afterAll(async () => {
  await apollo.stop();
});

describe('the GraphQL endpoint', () => {
  it('answers the health query', async () => {
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ health }' });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data).toEqual({ health: 'ok' });
  });

  it('allows the configured origin', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', 'http://localhost:5173')
      .send({ query: '{ health }' });

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });

  it('does not allow an unconfigured origin', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', 'http://evil.example')
      .send({ query: '{ health }' });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('GET /health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports healthy when the database is reachable', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('reports unhealthy with 503 when the database probe fails', async () => {
    // Stubbed rather than genuinely broken: the suite shares one test.db and
    // runs serially (tests/setup/global-setup.ts), so actually severing the
    // connection here would poison every test that runs after this one.
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('down'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'error' });
  });
});

describe('Query.health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails when the database probe fails, matching the REST surface', async () => {
    // The two health surfaces used to disagree about what "healthy" means:
    // both answered unconditionally. Sharing the same probe keeps them
    // agreeing rather than trading one accidental gap for another.
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('down'));

    const body = await execute(app, { query: '{ health }' });

    expect(body.data).toBeFalsy();
    expect(body.errors?.[0]).toBeDefined();
  });
});
