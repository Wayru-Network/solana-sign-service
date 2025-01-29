import Koa from "koa";
import bodyParser from "koa-bodyparser";
import logger from "koa-logger";
import { errorHandler } from "@/middlewares/auth-validator";
import { dbErrorHandler } from "@/middlewares/db-error-handler";
import transactionRoutes from "@/routes/request-transaction/request-transaction.route";
import { ENV } from "@/config/env/database";

const app = new Koa();

// Middlewares
app.use(logger());
app.use(bodyParser());
app.use(errorHandler);
app.use(dbErrorHandler);

// Rutas
app.use(transactionRoutes.routes());
app.use(transactionRoutes.allowedMethods());

// Manejo de errores global
app.on('error', (err, ctx) => {
  console.error('Server Error:', err);
});

// Inicializar servidor
const PORT = ENV.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});