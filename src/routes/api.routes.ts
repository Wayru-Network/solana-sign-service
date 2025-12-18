import Router from 'koa-router';
import { authValidator } from '@/middlewares/auth-validator';
import { routes as transactionRoutes } from "@/routes/request-transaction/request-transaction.route";
import { routes as simulateRoutes } from "@/routes/request-transaction/simulate-request-transaction";
import { ROUTES } from "@/routes/routes";
import { Route } from '@/interfaces/api/api';
import rateLimiter from '@middlewares/rate-limiter/rate-limiter';

const mainRouter = new Router({
  prefix: ROUTES.API  // Define the base prefix /api here
});

// Helper function to register routes with their configuration
function registerRoutes(router: Router, routes: Route[], basePath: string) {
  routes.forEach(route => {
    const requiresAuth = route.config?.auth !== false; // Default to true if not specified
    const middlewares: any[] = [];

    // Add JWT auth middleware if required
    if (requiresAuth) {
      middlewares.push(authValidator);
    }

    if (route.config?.rateLimiter === true) {
      middlewares.push(rateLimiter({
        excludedPaths: [ROUTES.REQUEST_TRANSACTION]
      }));
    }

    // Add custom middlewares if specified
    if (route.config?.middlewares) {
      middlewares.push(...route.config.middlewares);
    }

    // Register route with middlewares
    router[route.method](
      `${basePath}${route.path}`,
      ...middlewares,
      route.handler
    );
  });
}

// Create a single router for all routes
const apiRoutes = new Router();

// Register all routes with their individual configurations
registerRoutes(apiRoutes, transactionRoutes, ROUTES.REQUEST_TRANSACTION);
registerRoutes(apiRoutes, simulateRoutes, ROUTES.REQUEST_TRANSACTION);

// Add routes to main router
mainRouter.use(apiRoutes.routes());
mainRouter.use(apiRoutes.allowedMethods());

export default mainRouter;