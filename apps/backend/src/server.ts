import { createApp } from './app.js';
import { env } from './shared/env.js';

const { app } = await createApp();

app.listen(env.PORT, () => {
  console.log(`GraphQL ready at http://localhost:${env.PORT}/graphql`);
});
