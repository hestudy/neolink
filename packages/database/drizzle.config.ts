import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://neolink:neolink_password@localhost:5432/neolink',
  },
  verbose: true,
  strict: true,
} satisfies Config;
