import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

function createDb() {
  return drizzle(neon(process.env.POSTGRES_URL!), { schema });
}

let _instance: ReturnType<typeof createDb> | undefined;

// Lazy singleton — only connects at runtime, not at build time
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop: string | symbol) {
    if (!_instance) _instance = createDb();
    return (_instance as unknown as Record<string | symbol, unknown>)[prop];
  },
});
