import Router from 'koa-router';
import { authValidator } from '@/middlewares/auth-validator';
import transactionRouter from "@/routes/request-transaction/request-transaction.route";
import { ROUTES } from "@/routes/routes";

const mainRouter = new Router({
  prefix: ROUTES.API  // Define the base prefix /api here
});

// Group protected routes
const protectedRoutes = new Router();
protectedRoutes.use(ROUTES.REQUEST_TRANSACTION, transactionRouter.routes());
protectedRoutes.use(ROUTES.REQUEST_TRANSACTION, transactionRouter.allowedMethods());

// Configure routes in mainRouter
mainRouter.use(authValidator);  // Apply authentication middleware first
mainRouter.use(protectedRoutes.routes());  // Then add protected routes

export default mainRouter;