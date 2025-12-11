import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { signAndSendTransaction } from '@/services/request-transaction/sign-and-send.service';
import { verifyTransactionHashSchema } from '@/validations/request-transaction/request-transaction.validation';
import { ENV } from '@config/env/env';
import { requestTransactionToClaimDepinStakerRewards } from '@/services/request-transaction/request-transaction.service';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

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
            // Get token from config.options?.auth?.auth
            const authToken = socket.handshake.auth?.auth;

            if (!authToken) {
                return next(new Error('Authentication error: Auth token required'));
            }

            const socketsSalt = ENV.SOCKETS_SALT || '';
            if (!socketsSalt) {
                return next(new Error('Authentication error: Server configuration error'));
            }

            // Verify and decode the JWT token with issuer and audience validation
            let decoded: any;
            try {
                decoded = jwt.verify(authToken, socketsSalt, {
                    algorithms: ['HS256'],
                    issuer: 'wayru-explorer',
                    audience: 'wayru-sockets',
                }) as { walletAddress: string; exp: number; iat: number; iss?: string; aud?: string };
            } catch (error: any) {
                if (error.name === 'TokenExpiredError') {
                    return next(new Error('Authentication error: Token has expired'));
                }
                if (error.name === 'JsonWebTokenError') {
                    return next(new Error('Authentication error: Invalid token'));
                }
                if (error.name === 'JsonWebTokenIssuerError') {
                    return next(new Error('Authentication error: Invalid token issuer'));
                }
                if (error.name === 'JsonWebTokenAudienceError') {
                    return next(new Error('Authentication error: Invalid token audience'));
                }
                throw error;
            }

            // Verify that the token is not expired (double check, though jwt.verify should handle this)
            if (decoded.exp && decoded.exp < Date.now() / 1000) {
                return next(new Error('Authentication error: Token has expired'));
            }

            // Verify that wallet address exists in the token
            if (!decoded.walletAddress || typeof decoded.walletAddress !== 'string') {
                return next(new Error('Authentication error: Invalid token format - wallet address missing'));
            }

            // Calculate time until token expiration
            const expirationTime = decoded.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            const timeUntilExpiration = expirationTime - currentTime;

            // If token is already expired, reject connection
            if (timeUntilExpiration <= 0) {
                return next(new Error('Authentication error: Token has expired'));
            }

            // Attach wallet address and expiration info to socket data
            socket.data.walletAddress = decoded.walletAddress;
            socket.data.authToken = authToken;
            socket.data.tokenExpiration = expirationTime;

            // Set up automatic disconnection when token expires
            // This is efficient: one timeout per connection, no polling, auto-cleanup
            const expirationTimeout = setTimeout(() => {
                // Mark that this disconnect is due to token expiration
                // The 'disconnecting' event handler will emit the reason to frontend
                socket.data.disconnectReason = 'token has expired';

                // Disconnect the socket
                // Frontend will receive 'disconnect-reason' event via disconnecting handler
                if (socket.connected) {
                    socket.disconnect(true); // Force disconnect - reason: "io server disconnect"
                }
            }, timeUntilExpiration);

            // Store timeout reference for cleanup on manual disconnect
            socket.data.expirationTimeout = expirationTimeout;

            next();
        } catch (error: any) {
            next(new Error('Authentication error: ' + (error.message || 'Unknown error')));
        }
    });

    // Handle connections on the namespace
    solanaSignNamespace.on('connection', (socket: any) => {
        // Handle disconnecting event - this fires automatically before disconnect
        // IMPORTANT: This event is emitted by Socket.io automatically when socket.disconnect() is called
        // The frontend should listen to 'disconnect-reason' event BEFORE 'disconnect' event
        socket.on('disconnecting', (reason: string) => {
            // If we have a custom disconnect reason (like token expiration), emit it
            if (socket.data.disconnectReason) {
                const disconnectReason = socket.data.disconnectReason;

                // Emit the custom disconnect reason - frontend will receive this
                // Frontend debe escuchar: socket.on('disconnect-reason', (reason) => { ... })
                try {
                    socket.emit('disconnect-reason', disconnectReason);
                } catch (error: any) {
                    // Silent fail - socket may already be disconnected
                }

                // Clear the reason after emitting
                delete socket.data.disconnectReason;
            }
        });

        // Helper function to check if token is still valid
        const checkTokenExpiration = (): boolean => {
            if (!socket.data.tokenExpiration) {
                return false;
            }
            const isExpired = Date.now() >= socket.data.tokenExpiration;
            if (isExpired) {
                if (socket.connected) {
                    // Mark that this disconnect is due to token expiration
                    // The 'disconnecting' event handler will emit the reason to frontend
                    socket.data.disconnectReason = 'token has expired';

                    // Disconnect the socket
                    // Frontend will receive 'disconnect-reason' event via disconnecting handler
                    socket.disconnect(true);
                }
            }
            return !isExpired;
        };

        // Handle staking:get-tx-to-claim event
        socket.on('staking:get-tx-to-claim', async (data: { signature: string; includeInitTx: boolean }, callback: any) => {
            // Check token expiration before processing
            if (!checkTokenExpiration()) {
                const errorResponse = {
                    error: true,
                    code: 'TOKEN_EXPIRED',
                    message: 'Authentication token has expired. Please reconnect with a new token.',
                };
                socket.emit('staking:get-tx-to-claim:error', errorResponse);
                if (callback && typeof callback === 'function') {
                    callback(errorResponse);
                }
                return;
            }
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
            // Check token expiration before processing
            if (!checkTokenExpiration()) {
                const errorResponse = {
                    error: true,
                    code: 'TOKEN_EXPIRED',
                    message: 'Authentication token has expired. Please reconnect with a new token.',
                    requestId: randomUUID(),
                };
                socket.emit('staking:sign-and-send:error', errorResponse);
                if (callback && typeof callback === 'function') {
                    callback(errorResponse);
                }
                return;
            }

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
                        socket.emit('staking:sign-and-send:status', {
                            requestId: requestId,
                            status: 'failed',
                            error: error.message || 'Unknown error occurred',
                        });
                    }
                })();
            } catch (error: any) {
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
            // Check token expiration before processing
            if (!checkTokenExpiration()) {
                const errorResponse = {
                    error: true,
                    code: 'TOKEN_EXPIRED',
                    message: 'Authentication token has expired. Please reconnect with a new token.',
                    isValid: false,
                    signature: null,
                };
                if (callback && typeof callback === 'function') {
                    callback(errorResponse);
                } else {
                    socket.emit('sign-and-send-transaction-response', errorResponse);
                }
                return;
            }

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
            // Clean up expiration timeout if socket disconnects before token expires
            if (socket.data.expirationTimeout) {
                clearTimeout(socket.data.expirationTimeout);
            }
        });

        // Handle errors
        socket.on('error', (error: Error) => {
            // Silent error handling
        });
    });

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
    }
};

