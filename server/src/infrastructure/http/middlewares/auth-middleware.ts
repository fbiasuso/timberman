import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../auth/jwt-service.js';
import { UnauthorizedError } from '../../../domain/errors/index.js';

// Augment FastifyRequest with the authenticated user payload
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export function createAuthMiddleware(jwtService: {
  verify(token: string): JwtPayload;
}) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError();
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwtService.verify(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedError('Token inválido o expirado');
    }
  };
}
