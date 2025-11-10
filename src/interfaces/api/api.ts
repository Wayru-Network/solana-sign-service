import { Context, Middleware } from 'koa';
import { User } from '../user';

export interface CtxBase<T = any> extends Context {
    state: {
        user: User
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
     * Additional middlewares to apply to this route
     */
    middlewares?: Middleware[];
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