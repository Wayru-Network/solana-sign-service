import Koa from "koa";
import bodyParser from "koa-bodyparser";
import logger from "koa-logger";
import { errorHandler } from "@middlewares/auth-validator";
import { dbErrorHandler } from "@middlewares/db-error-handler";
import  router from "@routes/api.routes";
import { ENV } from "@config/env/env";
import cors from '@koa/cors';
import { PRODUCTION_ORIGINS } from "@constants/api";
import { RewardSystemManager } from "@services/solana/contracts/reward-system.manager";
import { AirdropsSystemManager } from "@services/solana/contracts/airdrop-system.manager";


const app = new Koa();
// Middlewares
app.use(logger());
app.use(bodyParser());
app.use(cors({
  origin: (ctx) => {
    if (ENV.NODE_ENV !== 'develop' && PRODUCTION_ORIGINS.includes(ctx.get('origin'))) {
      return ctx.get('origin');
    }
    return '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));
app.use(errorHandler);
app.use(dbErrorHandler);

// Routes
app.use(router.routes());
app.use(router.allowedMethods());

// Global error handling
app.on('error', async (err, ctx) => {
  console.error('Server Error:', err);
  
  // Check if it's a database connection error
  if (err.message.includes('Connection terminated unexpectedly')) {
    console.log('Database connection terminated. Attempting to reconnect...');
    // The DatabasePool class will handle reconnection automatically
    // shout down programPaused
    RewardSystemManager.cleanup();
    AirdropsSystemManager.cleanup();
  }
});

// Initialize server
const PORT = Number(ENV.PORT);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});