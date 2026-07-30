import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../../../domain/errors/index.js';

function makeRequest(authHeader?: string): FastifyRequest {
  return {
    headers: {
      authorization: authHeader,
    },
  } as unknown as FastifyRequest;
}

function makeReply(): FastifyReply {
  return {} as FastifyReply;
}

describe('AuthMiddleware', () => {
  const validPayload = { sub: 'user-1', role: 'user', username: 'testuser' };

  let jwtService: { verify: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    jwtService = { verify: vi.fn() };
  });

  it('attaches user to request for valid JWT', async () => {
    jwtService.verify.mockReturnValue(validPayload);
    const middleware = createAuthMiddleware(jwtService);
    const req = makeRequest('Bearer valid-token');
    const reply = makeReply();

    await middleware(req, reply);

    expect(req.user).toEqual(validPayload);
  });

  it('throws UnauthorizedError when JWT is expired', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const middleware = createAuthMiddleware(jwtService);
    const req = makeRequest('Bearer expired-token');
    const reply = makeReply();

    await expect(middleware(req, reply)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when JWT is malformed', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const middleware = createAuthMiddleware(jwtService);
    const req = makeRequest('Bearer malformed');
    const reply = makeReply();

    await expect(middleware(req, reply)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when authorization header is missing', async () => {
    const middleware = createAuthMiddleware(jwtService);
    const req = makeRequest();
    const reply = makeReply();

    await expect(middleware(req, reply)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when authorization header does not start with Bearer', async () => {
    const middleware = createAuthMiddleware(jwtService);
    const req = makeRequest('Basic some-token');
    const reply = makeReply();

    await expect(middleware(req, reply)).rejects.toThrow(UnauthorizedError);
  });
});
