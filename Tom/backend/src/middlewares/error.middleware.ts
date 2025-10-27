import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { ApiError } from '../models/types';
import { ZodError } from 'zod';

/**
 * Handler global de erros
 */
export const errorHandler = (
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Log do erro
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    params: request.params,
    query: request.query,
    body: request.body,
  });

  // Erro de validação do Zod
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    const apiError: ApiError = {
      statusCode: 400,
      message: 'Validation failed',
      errors: validationErrors,
    };

    return reply.status(400).send(apiError);
  }

  // Erro customizado com statusCode
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const apiError: ApiError = {
      statusCode: error.statusCode,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    };

    return reply.status(error.statusCode).send(apiError);
  }

  // Erros do Prisma
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;

    // Violação de unique constraint
    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'field';
      return reply.status(409).send({
        statusCode: 409,
        message: `${field} already exists`,
      });
    }

    // Registro não encontrado
    if (prismaError.code === 'P2025') {
      return reply.status(404).send({
        statusCode: 404,
        message: 'Resource not found',
      });
    }

    // Foreign key constraint failed
    if (prismaError.code === 'P2003') {
      return reply.status(400).send({
        statusCode: 400,
        message: 'Invalid reference to related resource',
      });
    }
  }

  // Erro de validação do Fastify
  if ('validation' in error) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Validation failed',
      errors: (error as any).validation,
    });
  }

  // Erro genérico (500)
  const apiError: ApiError = {
    statusCode: 500,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error.message,
    }),
  };

  reply.status(500).send(apiError);
};

/**
 * Handler para rotas não encontradas (404)
 */
export const notFoundHandler = (
  request: FastifyRequest,
  reply: FastifyReply
): void => {
  logger.warn(`Route not found: ${request.method} ${request.url}`);

  reply.status(404).send({
    statusCode: 404,
    message: 'Route not found',
    path: request.url,
    method: request.method,
  });
};

/**
 * Classe customizada para erros da aplicação
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erros específicos pré-definidos
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 422);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false);
  }
}
