import 'dotenv/config';

export const ENV = {
    PORT: process.env.PORT || 1338,
    DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
    DATABASE_PORT: process.env.DATABASE_PORT || '5432',
    DATABASE_NAME: process.env.DATABASE_NAME || 'database',
    DATABASE_USERNAME: process.env.DATABASE_USERNAME || 'user',
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
    DATABASE_SSL: process.env.DATABASE_SSL === 'true',
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'develop',
    DB_ADMIN_PUBLIC_KEY: process.env.DB_ADMIN_PUBLIC_KEY || '',
    ADMIN_REWARD_SYSTEM_PRIVATE_KEY: process.env.ADMIN_REWARD_SYSTEM_PRIVATE_KEY,
    SOLANA_API_KEY: process.env.SOLANA_API_KEY,
    SOLANA_API_URL: process.env.SOLANA_API_URL,
    REWARD_TOKEN_MINT: process.env.REWARD_TOKEN_MINT || '5AZRsHiVCQPU8uDh9aKkgmgXz52VmqnYwzhYB6eFum5',
    REWARD_SYSTEM_PROGRAM_ID: process.env.REWARD_SYSTEM_PROGRAM_ID || '98MWRmimeQobxgPx1atu3Dg9WGUeMP2zxjzoyuaPAZUu',
    AIRDROPS_PROGRAM_ID: process.env.AIRDROPS_PROGRAM_ID || '5KK2ThgEp1AZM8bo79ijJcumSqz9B48bszyhYhuw3K7o'
  };