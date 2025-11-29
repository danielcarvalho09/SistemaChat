import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware.js';

export function validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Preservar os erros do Zod para que possam ser usados no controller
      const zodError = error as z.ZodError;
      (zodError as any).statusCode = 400;
      throw zodError; // Lançar o erro do Zod diretamente para preservar detalhes
    }
    throw error;
  }
}
