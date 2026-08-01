import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../../../application/auth/auth-service.js';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { SystemConfig } from '../../../domain/entities/system-config.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';
import type { BcryptServiceImpl } from '../../auth/bcrypt-service.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function createAuthRoutes(
  userRepo: UserRepo,
  jwtService: JwtServiceImpl,
  bcryptService: BcryptServiceImpl,
  config: SystemConfig,
): FastifyPluginAsync {
  return async (fastify) => {
    const authService = new AuthService(userRepo, bcryptService, jwtService, config);
    const authMiddleware = createAuthMiddleware(jwtService);

    // ── POST /api/auth/register ───────────────────────────────
    fastify.post('/api/auth/register', async (request, reply) => {
      const body = registerSchema.parse(request.body);
      const user = await authService.register(body.username, body.password);
      return reply.status(201).send({ user });
    });

    // ── POST /api/auth/login ──────────────────────────────────
    fastify.post('/api/auth/login', async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const result = await authService.login(body.username, body.password);
      return result;
    });

    // ── GET /api/auth/me ──────────────────────────────────────
    fastify.get('/api/auth/me', {
      preHandler: [authMiddleware],
    }, async (request, _reply) => {
      const user = await userRepo.findById(request.user!.sub);
      if (!user) {
        return _reply.status(404).send({
          error: 'USER_NOT_FOUND',
          message: 'Authenticated user not found',
        });
      }
      const snapshot = user.toSnapshot();
      return {
        id: snapshot.id,
        username: snapshot.username,
        role: snapshot.role,
        balance: snapshot.balance,
      };
    });
  };
}
