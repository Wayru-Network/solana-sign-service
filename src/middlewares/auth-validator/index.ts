import { Context, Next } from 'koa';

export async function errorHandler(ctx: Context, next: Next) {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: err.message || 'Error interno del servidor',
      error: {
        code: err.code,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    };

    // Emitir el error para logging
    ctx.app.emit('error', err, ctx);
  }
}

// Opcional: Middleware de validación de autenticación
export async function authValidator(ctx: Context, next: Next) {
  const token = ctx.headers.authorization;
  
  if (!token) {
    ctx.throw(401, 'No se proporcionó token de autenticación');
  }

  try {
    // Aquí iría tu lógica de validación del token
    // Por ejemplo, verificar JWT, validar con tu servicio de auth, etc.
    await next();
  } catch (error) {
    ctx.throw(401, 'Token inválido');
  }
}