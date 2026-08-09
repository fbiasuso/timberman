import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '../../../domain/errors/index.js';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Domain errors (known business rule violations)
  if (error instanceof DomainError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  // Zod validation errors (route body/query validation)
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Fastify built-in validation errors (JSON Schema)
  if ('validation' in error) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
  }

  // @fastify/multipart size-limit exceeded (design D3): the plugin rejects
  // with FST_REQ_FILE_TOO_LARGE (default 413) when a file exceeds the 1 MiB
  // cap. Map it to 400 with a client-facing message — the team is untouched.
  const errorCode = (error as FastifyError).code;
  if (errorCode === 'FST_REQ_FILE_TOO_LARGE') {
    return reply.status(400).send({
      error: 'FILE_TOO_LARGE',
      message: 'Image exceeds the 1 MiB size limit',
    });
  }

  // JWT verification errors (from jsonwebtoken)
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  // Unhandled errors
  request.log.error(error);
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'Internal server error',
  });
}
