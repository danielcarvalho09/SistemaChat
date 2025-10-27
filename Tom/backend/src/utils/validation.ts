import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware.js';

export function validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new AppError(`Validation error: ${messages}`, 400);
    }
    throw error;
  }
}
