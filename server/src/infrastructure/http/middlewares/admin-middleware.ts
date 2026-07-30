import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../../../domain/errors/index.js';

export function createAdminMiddleware() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user || request.user.role !== 'admin') {
      throw new ForbiddenError();
    }
  };
}
