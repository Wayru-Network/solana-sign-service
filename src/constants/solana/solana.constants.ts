import { ENV } from "@config/env/env";
import { getKeyByName } from "@services/keys/keys-queries";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// Provide the API URL with the API key if it is available, otherwise use the default API URL
export const SOLANA_API_URL = ((ENV.SOLANA_API_KEY && ENV.SOLANA_API_URL) ? `${ENV.SOLANA_API_URL}?api-key=${ENV.SOLANA_API_KEY}` : ENV.SOLANA_API_URL) as string