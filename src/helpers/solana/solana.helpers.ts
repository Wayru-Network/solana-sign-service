import { ENV } from '@config/env/env';
import { getKeyByName } from '@services/keys/keys-queries';
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

export const getRewardTokenMint = async () => {
    const key = await getKeyByName('REWARD_TOKEN_MINT');
    const id = key?.value || ENV.DEFAULT_REWARD_TOKEN_MINT;
    // remove all spaces
    return id.replace(/\s/g, '');
}

export const getRewardSystemProgramId = async () => {
    const key = await getKeyByName('REWARD_SYSTEM_PROGRAM_ID');
    const id = key?.value || ENV.DEFAULT_REWARD_SYSTEM_PROGRAM_ID;
    // remove all spaces
    return id.replace(/\s/g, '');
}

export const getAirdropsProgramId = async () => {
    const key = await getKeyByName('AIRDROPS_PROGRAM_ID');
    const id = key?.value || ENV.DEFAULT_AIRDROPS_PROGRAM_ID;
    // remove all spaces
    return id.replace(/\s/g, '');
}

export const getSolanaPriorityFee = async () => {
    const key = await getKeyByName('SOLANA_PRIORITY_FEE_TO_CLAIM');
    const fee = Number(key?.value) || 0.00001;
    return fee;
}