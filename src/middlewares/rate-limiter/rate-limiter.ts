'use strict';

import { Middleware } from "@/interfaces/rate-limiter";
import { RateLimit } from 'koa2-ratelimit';
import { Context, Next } from 'koa';


interface RateLimitConfig {
    interval?: { min?: number };
    max?: number;
    message?: string;
    headers?: boolean;
    excludedPaths?: string[];
}
export default (config: Middleware['config']) => {
    return async (ctx: Context, next: Next) => {
        const rateLimitConfig: RateLimitConfig = config || {};

        // Use the config values, with proper defaults
        const interval = rateLimitConfig.interval?.min ?? 1;
        const max = rateLimitConfig.max ?? 8;
        const message = rateLimitConfig.message || 'Too many requests, please try again later.';

        return RateLimit.middleware({
            interval: { min: interval },
            max: max,
            message: message,
            headers: true,
        })(ctx, next);
    };
};