import { describe, expect, it } from 'vitest';

import { createPostgresPoolConfig } from '../src/postgres.js';

describe('createPostgresPoolConfig', () => {
  it('preserves the connection string when no CA certificate is configured', () => {
    expect(
      createPostgresPoolConfig(
        'postgres://user:pass@localhost:5432/exact?sslmode=require',
        '',
      ),
    ).toEqual({
      connectionString:
        'postgres://user:pass@localhost:5432/exact?sslmode=require',
    });
  });

  it('uses the supplied CA and removes sslmode from the connection string', () => {
    expect(
      createPostgresPoolConfig(
        'postgres://user:pass@db.example.com:5432/exact?sslmode=require',
        'certificate',
      ),
    ).toEqual({
      connectionString: 'postgres://user:pass@db.example.com:5432/exact',
      ssl: {
        ca: 'certificate',
        rejectUnauthorized: true,
      },
    });
  });
});
