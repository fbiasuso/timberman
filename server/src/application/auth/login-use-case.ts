import type { UserRepo } from '../../domain/ports/user-repo.js';
import { InvalidCredentialsError } from '../../domain/errors/index.js';
import type { BcryptService, RegisterUserDTO } from './register-use-case.js';

/**
 * Port interface for JWT signing — infrastructure implements it.
 */
export interface JwtService {
  sign(payload: { sub: string; role: string; username: string }): string;
}

export interface LoginResult {
  token: string;
  user: RegisterUserDTO;
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly bcrypt: BcryptService,
    private readonly jwt: JwtService,
  ) {}

  async execute(username: string, password: string): Promise<LoginResult> {
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      // Don't reveal whether the username exists
      throw new InvalidCredentialsError();
    }

    const isValid = await this.bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const token = this.jwt.sign({
      sub: user.id,
      role: user.role,
      username: user.username,
    });

    const snapshot = user.toSnapshot();
    return {
      token,
      user: {
        id: snapshot.id,
        username: snapshot.username,
        role: snapshot.role,
        balance: snapshot.balance,
        createdAt: snapshot.createdAt,
      },
    };
  }
}
