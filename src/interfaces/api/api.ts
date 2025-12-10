import { Context, Middleware } from 'koa';
import { User } from '../user';
import { ApiToken } from '@/services/api-token/api-token.service';

export interface CtxBase<T = any> extends Context {
    state: {
        user?: User;
        apiToken?: ApiToken;
    }
    request: {
        body?: T
    } & Context['request']
}

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export interface RouteConfig {
    /**
     * Whether this route requires authentication (default: true)
     */
    auth?: boolean;
    /**
     * Whether this route requires API key authentication (default: false)
     * If true, the X-API-TOKEN header will be validated
     */
    apiKeyAuth?: boolean;
    /**
     * Additional middlewares to apply to this route
     */
    middlewares?: Middleware[];
    /**
     * Whether this route requires rate limiting (default: false)
     */
    rateLimiter?: boolean;
}

export interface Route<T = any> {
    method: HttpMethod;
    path: string;
    handler: (ctx: CtxBase<T>) => Promise<void>;
    /**
     * Route configuration (middlewares, auth, etc.)
     */
    config?: RouteConfig;
}