import { setupServer } from 'msw/node';

// No default handlers. Every test declares the responses it depends on, so a
// test never passes on a fixture some other file happened to register.
export const server = setupServer();
