import { ENV } from "@config/env/env";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// Provide the API URL with the API key if it is available, otherwise use the default API URL
export const SOLANA_API_URL = ((ENV.SOLANA_API_KEY && ENV.SOLANA_API_URL) ? `${ENV.SOLANA_API_URL}?api-key=${ENV.SOLANA_API_KEY}` : ENV.SOLANA_API_URL) as string

export const MINIMUM_REMAINING_SOLANA_BALANCE = 0.0002 * LAMPORTS_PER_SOL; // 200,000 lamports