const key = process.env.SOLANA_API_KEY
const api_url = process.env.SOLANA_API_URL
// Provide the API URL with the API key if it is available, otherwise use the default API URL
export const SOLANA_API_URL = ((key && api_url) ? `${process.env.SOLANA_API_URL}?api-key=${key}` : process.env.SOLANA_API_URL) as string

export const REWARD_SYSTEM_PROGRAM_ID = process.env.REWARD_SYSTEM_PROGRAM_ID || '242r2rA4LJNTdsiMc3DchjgHoeJc3FxaUr71GwsEskJM';
export const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as string;

export const NODE_ENV = process.env.NODE_ENV;
export const ASSET_REWARD_ID = process.env.NFT_MINT || '4QwHzu44JzCZgFsJzvBCSNvJ3rMTxMC171yoJms618mD'
