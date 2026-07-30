import client from './client';

export interface UserDTO {
  id: string;
  username: string;
  role: string;
  balance: number;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: UserDTO;
}

export const authApi = {
  register(username: string, password: string) {
    return client.post<{ user: UserDTO }>('/auth/register', { username, password });
  },

  login(username: string, password: string) {
    return client.post<LoginResponse>('/auth/login', { username, password });
  },

  getMe() {
    return client.get<UserDTO>('/auth/me');
  },
};
