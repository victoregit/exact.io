import type { PoolConfig } from 'pg';

export function createPostgresPoolConfig(
  connectionString: string,
  caCertificate = process.env.DATABASE_CA_CERT,
): PoolConfig {
  if (!caCertificate) return { connectionString };

  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');

  return {
    connectionString: url.toString(),
    ssl: {
      ca: caCertificate,
      rejectUnauthorized: true,
    },
  };
}
