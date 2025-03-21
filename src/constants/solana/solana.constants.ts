import { ENV } from "@config/env/env";

// Provide the API URL with the API key if it is available, otherwise use the default API URL
export const SOLANA_API_URL = ((ENV.SOLANA_API_KEY && ENV.SOLANA_API_URL) ? `${ENV.SOLANA_API_URL}?api-key=${ENV.SOLANA_API_KEY}` : ENV.SOLANA_API_URL) as string