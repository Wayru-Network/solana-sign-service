import { Context, Next } from 'koa';
import { verifyToken } from '@/services/api-token/api-token.service';

/**
 * Middleware to validate X-API-KEY header
 * This middleware checks if the request has a valid API key in the X-API-KEY header
 */
export async function apiKeyAuth(ctx: Context, next: Next) {
    // Get the API key from the header
    const apiKey = ctx.headers['x-api-key'] as string;

    if (!apiKey) {
        ctx.status = 401;
        ctx.body = {
            error: true,
            message: 'Unauthorized: X-API-KEY header is required'
        };
        return;
    }

    try {
        // Verify the token
        const token = await verifyToken(apiKey);

        if (!token) {
            ctx.status = 401;
            ctx.body = {
                error: true,
                message: 'Unauthorized: Invalid or expired API key'
            };
            return;
        }

        // Attach token information to context state
        ctx.state.apiToken = token;

        // Continue to the next middleware
        await next();
    } catch (error) {
        console.error('Error validating API key:', error);
        ctx.status = 401;
        ctx.body = {
            error: true,
            message: 'Unauthorized: Error validating API key'
        };
        return;
    }
}

