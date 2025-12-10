import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '@/services/api-token/api-token.service';
import { signAndSendTransaction } from '@/services/request-transaction/sign-and-send.service';
import { verifyTransactionHashSchema } from '@/validations/request-transaction/request-transaction.validation';
import { ENV } from '@config/env/env';
import { requestTransactionToClaimDepinStakerRewards } from '@/services/request-transaction/request-transaction.service';
import { randomUUID } from 'crypto';

let io: SocketIOServer | null = null;
let solanaSignNamespace: any = null;

// Allowed origins for Socket.io connections
const allowedOrigins = [
    'http://localhost:3000',           // development local
    'https://dev.explorer.wayru.io',   // staging
    'https://explorer.wayru.io'        // production
];

/**
 * Initialize Socket.io server
 * @param httpServer - HTTP server instance from Koa
 */
export const initializeSocketIO = (httpServer: HTTPServer): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps, Postman, etc.) only in development
                if (!origin) {
                    // In production, reject requests without origin
                    if (ENV.NODE_ENV === 'production') {
                        return callback(new Error('Not allowed by CORS: No origin'));
                    }
                    return callback(null, true);
                }

                // Check if origin is in allowed list
                if (allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    console.warn(`🚫 Origin blocked: ${origin}`);
                    callback(new Error(`Not allowed by CORS: Origin ${origin} is not allowed`));
                }
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true, // Allow Engine.IO v3 clients
    });

    // Create namespace for solana-sign
    solanaSignNamespace = io.of('/solana-sign');

    // Middleware for authentication on the namespace
    solanaSignNamespace.use(async (socket: any, next: any) => {
        try {
            // Get API token from handshake auth
            const apiToken = socket.handshake.auth?.apiToken || socket.handshake.headers['x-api-token'];

            if (!apiToken) {
                return next(new Error('Authentication error: API token required'));
            }

            // Verify the token
            const token = await verifyToken(apiToken);

            if (!token) {
                return next(new Error('Authentication error: Invalid or expired API token'));
            }

            // Attach token to socket data
            socket.data.apiToken = token;
            next();
        } catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Authentication error'));
        }
    });

    // Handle connections on the namespace
    solanaSignNamespace.on('connection', (socket: any) => {
        console.log(`✅ Socket connected to /solana-sign: ${socket.id} (API Token: ${socket.data.apiToken?.name || 'unknown'})`);

        // Handle staking:get-tx-to-claim event
        socket.on('staking:get-tx-to-claim', async (data: { signature: string; includeInitTx: boolean }, callback: any) => {
            try {
                if (!data.signature) {
                    const errorResponse = {
                        error: true,
                        code: 'VALIDATION_ERROR',
                        message: 'Signature is required',
                    };
                    socket.emit('staking:get-tx-to-claim:error', errorResponse);
                    if (callback && typeof callback === 'function') {
                        callback(errorResponse);
                    }
                    return;
                }

                const { signature, includeInitTx = false } = data;

                // Request transaction
                const result = await requestTransactionToClaimDepinStakerRewards(
                    signature,
                    includeInitTx,
                    false // includeAdminAuthorization = false (user will sign first)
                );

                if (result.error) {
                    const errorResponse = {
                        error: true,
                        code: result.code,
                        message: 'Failed to create transaction',
                    };
                    socket.emit('staking:get-tx-to-claim:error', errorResponse);
                    if (callback && typeof callback === 'function') {
                        callback(errorResponse);
                    }
                    return;
                }

                const successResponse = {
                    error: false,
                    code: result.code,
                    serializedTx: result.serializedTx || undefined,
                    serializedInitTx: result.serializedInitTx || undefined,
                    nonce: result.nonce,
                };

                socket.emit('staking:get-tx-to-claim:response', successResponse);
                if (callback && typeof callback === 'function') {
                    callback(successResponse);
                }
            } catch (error: any) {
                console.error('Error handling staking:get-tx-to-claim:', error);
                const errorResponse = {
                    error: true,
                    message: error.message || 'Unknown error occurred',
                };
                socket.emit('staking:get-tx-to-claim:error', errorResponse);
                if (callback && typeof callback === 'function') {
                    callback(errorResponse);
                }
            }
        });

        // Handle staking:sign-and-send event
        socket.on('staking:sign-and-send', async (data: { nonce: number; serializedTransaction: string }, callback: any) => {
            const requestId = randomUUID();

            try {
                // Validate the data
                await verifyTransactionHashSchema.validate(data, {
                    abortEarly: false,
                    stripUnknown: true,
                });

                const { serializedTransaction, nonce } = data;

                // Send immediate response
                const immediateResponse = {
                    success: true,
                    requestId: requestId,
                    message: 'Transaction received, processing...',
                };
                socket.emit('staking:sign-and-send:response', immediateResponse);
                if (callback && typeof callback === 'function') {
                    callback(immediateResponse);
                }

                // Emit pending status
                socket.emit('staking:sign-and-send:status', {
                    requestId: requestId,
                    status: 'pending',
                });

                // Process the transaction asynchronously
                (async () => {
                    try {
                        const result = await signAndSendTransaction(serializedTransaction, nonce);

                        if (result.isValid && result.signature) {
                            // Transaction confirmed
                            socket.emit('staking:sign-and-send:status', {
                                requestId: requestId,
                                status: 'confirmed',
                                signature: result.signature,
                            });
                        } else {
                            // Transaction failed
                            socket.emit('staking:sign-and-send:status', {
                                requestId: requestId,
                                status: 'failed',
                                error: result.message || 'Transaction failed',
                            });
                        }
                    } catch (error: any) {
                        console.error('Error processing staking:sign-and-send:', error);
                        socket.emit('staking:sign-and-send:status', {
                            requestId: requestId,
                            status: 'failed',
                            error: error.message || 'Unknown error occurred',
                        });
                    }
                })();
            } catch (error: any) {
                console.error('Error handling staking:sign-and-send:', error);
                const errorResponse = {
                    error: true,
                    message: error.errors ? error.errors.join(', ') : (error.message || 'Validation error'),
                    requestId: requestId,
                };
                socket.emit('staking:sign-and-send:error', errorResponse);
                if (callback && typeof callback === 'function') {
                    callback(errorResponse);
                }
            }
        });

        // Handle sign-and-send-transaction event (legacy)
        socket.on('sign-and-send-transaction', async (data: { serializedTransaction: string; nonce: number }, callback: any) => {
            try {
                // Validate the data
                await verifyTransactionHashSchema.validate(data, {
                    abortEarly: false,
                    stripUnknown: true,
                });

                const { serializedTransaction, nonce } = data;

                // Process the transaction
                const result = await signAndSendTransaction(serializedTransaction, nonce);

                // Send response via callback (acknowledgment)
                if (callback && typeof callback === 'function') {
                    callback({
                        error: !result.isValid,
                        code: result.code,
                        message: result.message,
                        isValid: result.isValid,
                        signature: result.signature || null,
                    });
                } else {
                    // If no callback, emit response
                    socket.emit('sign-and-send-transaction-response', {
                        error: !result.isValid,
                        code: result.code,
                        message: result.message,
                        isValid: result.isValid,
                        signature: result.signature || null,
                    });
                }
            } catch (error: any) {
                console.error('Error handling sign-and-send-transaction:', error);

                const errorResponse = {
                    error: true,
                    code: 'VALIDATION_ERROR',
                    message: error.errors ? error.errors.join(', ') : 'Validation error',
                    isValid: false,
                    signature: null,
                };

                if (callback && typeof callback === 'function') {
                    callback(errorResponse);
                } else {
                    socket.emit('sign-and-send-transaction-response', errorResponse);
                }
            }
        });

        // Handle disconnection
        socket.on('disconnect', (reason: string) => {
            console.log(`❌ Socket disconnected from /solana-sign: ${socket.id} (reason: ${reason})`);
        });

        // Handle errors
        socket.on('error', (error: Error) => {
            console.error(`Socket error for ${socket.id}:`, error);
        });
    });

    console.log('🚀 Socket.io server initialized');
    console.log('📡 Namespace /solana-sign created and ready');
    return io;
};

/**
 * Get the Socket.io server instance
 */
export const getSocketIO = (): SocketIOServer | null => {
    return io;
};

/**
 * Get the solana-sign namespace
 */
export const getSolanaSignNamespace = () => {
    return solanaSignNamespace;
};

/**
 * Close Socket.io server
 */
export const closeSocketIO = async (): Promise<void> => {
    if (solanaSignNamespace) {
        solanaSignNamespace.removeAllListeners();
        solanaSignNamespace = null;
    }
    if (io) {
        io.close();
        io = null;
        console.log('🔌 Socket.io server closed');
    }
};

