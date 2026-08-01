import request from 'supertest';
import { beforeAll, afterAll, expect, describe, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import type { ApolloServer } from '@apollo/server';

let app: Express;
let apollo: ApolloServer;

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
