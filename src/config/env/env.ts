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
    ASSET_REWARD_ID: process.env.ASSET_REWARD_ID || '4QwHzu44JzCZgFsJzvBCSNvJ3rMTxMC171yoJms618mD',
    REWARD_SYSTEM_PROGRAM_ID: process.env.REWARD_SYSTEM_PROGRAM_ID || '242r2rA4LJNTdsiMc3DchjgHoeJc3FxaUr71GwsEskJM'
  };