import { loadEnvConfig } from '@next/env';
import type { Config } from 'drizzle-kit';

loadEnvConfig(process.cwd());

export default {
  schema: './lib/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
} satisfies Config;
