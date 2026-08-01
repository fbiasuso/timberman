import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { SystemConfig } from '../../domain/entities/system-config.js';
import { RegisterUseCase } from './register-use-case.js';
import type { BcryptService, RegisterUserDTO } from './register-use-case.js';
import { LoginUseCase } from './login-use-case.js';
import type { JwtService, LoginResult } from './login-use-case.js';

/**
 * Thin facade that combines RegisterUseCase and LoginUseCase
 * with the shared system config (registration toggle read live
 * from the config reference at request time).
 */
export class AuthService {
  private readonly registerUseCase: RegisterUseCase;
  private readonly loginUseCase: LoginUseCase;

  constructor(
    userRepo: UserRepo,
    bcrypt: BcryptService,
    jwt: JwtService,
    config: SystemConfig,
  ) {
    this.registerUseCase = new RegisterUseCase(userRepo, bcrypt, config);
    this.loginUseCase = new LoginUseCase(userRepo, bcrypt, jwt);
  }

  async register(username: string, password: string): Promise<RegisterUserDTO> {
    return this.registerUseCase.execute(username, password);
  }

  async login(username: string, password: string): Promise<LoginResult> {
    return this.loginUseCase.execute(username, password);
  }
}
