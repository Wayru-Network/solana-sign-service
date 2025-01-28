import { Keypair as KeypairHelper } from '@solana/web3.js';

/**
 * Get a Keypair from a Uint8Array
 * @param unit8Array - The Uint8Array to convert to a Keypair
 * @returns The Keypair
 */
export const getKeyPairFromUnit8Array = (unit8Array: Uint8Array) => {
    if (!unit8Array) {
        throw new Error(`Uint8Array is requierd, getKeyPairFromUnit8Array`);
    }

    try {
        return KeypairHelper.fromSecretKey(
            Uint8Array.from(unit8Array)
        );
    } catch (e) {
        console.error(`Error creating admin keypair:`, e);
        throw e;
    }
}