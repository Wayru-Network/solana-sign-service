import { Context, Next } from 'koa';
import { Schema } from 'yup';

export const validate = (schema: Schema) => async (ctx: Context, next: Next) => {
  try {
    const validatedBody = await schema.validate(ctx.request.body, {
      abortEarly: false, // show all validation errors, not only the first one
      stripUnknown: true // remove fields not defined in the schema
    });
    
    ctx.request.body = validatedBody;
    return next();
  } catch (err: any) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: err.errors || 'Validation error',
      errors: err.inner?.map((e: any) => ({
        field: e.path,
        message: e.message
      }))
    };
  }
};