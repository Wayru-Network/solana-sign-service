import { Connection, Commitment } from '@solana/web3.js';

/**
 * Singleton class to manage Solana RPC connection
 * Provides a single reusable connection instance with automatic renewal
 */
class SolanaConnection {
    private static instance: Connection | null = null;
    private static lastInitTime: number = 0;
    private static readonly RECONNECT_INTERVAL = 1000 * 60 * 30; // 30 minutes

    private constructor() {} // Private constructor for Singleton pattern

    /**
     * Gets the Solana connection instance
     * Creates a new connection if none exists or if the current one is older than RECONNECT_INTERVAL
     * @returns {Connection} The Solana connection instance
     */
    public static getInstance(): Connection {
        const currentTime = Date.now();

        // Create new connection if none exists or if it's time to renew
        if (!SolanaConnection.instance || (currentTime - SolanaConnection.lastInitTime) > SolanaConnection.RECONNECT_INTERVAL) {
            const key = process.env.SOLANA_API_KEY;
            const api_url = process.env.SOLANA_API_URL;
            const API = ((key && api_url) ? `${api_url}?api-key=${key}` : api_url) ?? 'http://localhost:8899';
            
            SolanaConnection.instance = new Connection(API, {
                commitment: 'confirmed',
                disableRetryOnRateLimit: false,
                confirmTransactionInitialTimeout: 60000
            });
            SolanaConnection.lastInitTime = currentTime;
        }

        return SolanaConnection.instance;
    }

    /**
     * Forces creation of a new connection instance
     * Useful when current connection is having issues
     */
    public static resetConnection(): void {
        SolanaConnection.instance = null;
        SolanaConnection.getInstance();
    }
}

/**
 * Helper function to get a Solana connection with optional commitment level
 * @param {Commitment} commitment - Optional commitment level for the connection
 * @returns {Connection} Solana connection instance
 */
export const getSolanaConnection = (commitment?: Commitment): Connection => {
    const connection = SolanaConnection.getInstance();
    if (commitment) {
        return new Connection(connection.rpcEndpoint, { commitment });
    }
    return connection;
};