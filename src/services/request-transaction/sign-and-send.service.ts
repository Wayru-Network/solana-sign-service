import { getKeyPairFromUnit8Array } from "@helpers/solana/solana.helpers";
import { getSolanaConnection } from "@services/solana/solana.connection";
import {
    updateTransactionTrackerStatus,
    verifyTransactionHashFromDb,
} from "@services/transaction-tracker/transaction-tracker.service";
import { Transaction } from "@solana/web3.js";
import { ENV } from "@config/env/env";
import { REQUEST_TRANSACTION_ERROR_CODES } from "@errors/request-transaction/request-transaction";
import { hasInitializeNfnodeInstruction, hasSuspiciousTokenTransfers } from "@helpers/request-transaction/request-transaction.helper";

export const signAndSendTransaction = async (
    serializedTransaction: string,
    nonce: number
) => {
    try {
        // Deserialize transaction first to check its type
        let tx = Transaction.from(Buffer.from(serializedTransaction, "base64"));

        // Check if this is an InitializeNfnode transaction
        const isInitializeNfnode = await hasInitializeNfnodeInstruction(tx);

        if (isInitializeNfnode) {
            // For InitializeNfnode transactions, we don't need to verify expected_hash
            // Instead, verify that there are no suspicious token transfers to the user's wallet
            const suspiciousCheck = await hasSuspiciousTokenTransfers(tx);

            if (suspiciousCheck.hasSuspiciousTransfers) {
                return {
                    isValid: false,
                    message: `Transaction validation failed: ${suspiciousCheck.reason || 'Suspicious token transfers detected'}`,
                    code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_ERROR_CODE,
                };
            }

            // Transaction is valid for InitializeNfnode - proceed without hash verification
        } else {
            // For other transactions (like claim rewards), verify the transaction hash
            const result = await verifyTransactionHashFromDb(
                serializedTransaction,
                nonce
            );

            if (!result.isValid) {
                return {
                    isValid: false,
                    message: result.message,
                    code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_ERROR_CODE,
                };
            }
        }
        const adminKeypair = getKeyPairFromUnit8Array(
            Uint8Array.from(JSON.parse(ENV.ADMIN_REWARD_SYSTEM_PRIVATE_KEY as string))
        );

        const connection = getSolanaConnection();

        // Check if the original blockhash is still valid
        // We cannot change the blockhash after user signs, as it would invalidate their signature
        const currentBlockHeight = await connection.getBlockHeight('finalized');
        const originalLastValidBlockHeight = tx.lastValidBlockHeight;

        if (originalLastValidBlockHeight && currentBlockHeight > originalLastValidBlockHeight) {
            // Blockhash has expired - user needs to get a new transaction
            return {
                isValid: false,
                message: "Transaction blockhash has expired. Please request a new transaction.",
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_ERROR_CODE,
            };
        }

        // Blockhash is still valid - add admin signature without changing the blockhash
        // This preserves the user's signature
        tx.partialSign(adminKeypair);

        // Send transaction
        const signature = await connection.sendRawTransaction(
            tx.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
            }),
            {
                skipPreflight: true,
                preflightCommitment: "confirmed",
            }
        );

        // Await confirmation - don't pass blockhash/lastValidBlockHeight to avoid expiration issues
        // Solana will automatically handle the confirmation without these parameters
        const confirmation = await connection.confirmTransaction(
            signature,
            "confirmed"
        );

        if (confirmation.value.err) {
            console.info("Transaction failed =>", confirmation.value.err);
            const updatedTransactionTracker = await updateTransactionTrackerStatus(nonce, 'request_unauthorized_by_admin');
            if (!updatedTransactionTracker) {
                return {
                    isValid: false,
                    message: "Error updating transaction status",
                    code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_ERROR_CODE,
                };
            }
            return {
                isValid: false,
                message: "Transaction failed",
                code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_ERROR_CODE,
            };
        }

        // if not isInitializeNfnode, update the transaction status to request_authorized_by_admin
        if (!isInitializeNfnode) {
            const updatedTransactionTracker = await updateTransactionTrackerStatus(nonce, 'request_authorized_by_admin');
            if (!updatedTransactionTracker) {
                return {
                    isValid: false,
                    message: 'Error updating transaction status',
                    code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_ERROR_CODE,
                };
            }
        }

        return {
            isValid: true,
            message: "Transaction sent successfully",
            signature: signature,
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_SUCCESS_CODE,
        };
    } catch (error) {
        console.error("Error signing and sending transaction:", error);
        return {
            isValid: false,
            message: "Error signing and sending transaction",
            code: REQUEST_TRANSACTION_ERROR_CODES.REQUEST_TRANSACTION_ERROR_CODE,
        };
    }
};
