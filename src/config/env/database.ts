export const ENV = {
    PORT: process.env.PORT || 3000,
    DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
    DATABASE_PORT: process.env.DATABASE_PORT || '5432',
    DATABASE_NAME: process.env.DATABASE_NAME || 'database',
    DATABASE_USERNAME: process.env.DATABASE_USERNAME || 'user',
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
    DATABASE_SSL: process.env.DATABASE_SSL === 'true'
  };