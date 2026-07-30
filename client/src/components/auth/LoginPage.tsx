import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLogin, useRegister } from '../../hooks/use-auth';
import { useAuthStore } from '../../stores/auth-store';

type AuthTab = 'login' | 'register';

export default function LoginPage() {
  const [tab, setTab] = useState<AuthTab>('login');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: 32 }}>Timberman</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: 24 }}>
        <button
          onClick={() => setTab('login')}
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            borderBottom: tab === 'login' ? '2px solid #2563eb' : '2px solid #e5e7eb',
            background: 'none',
            cursor: 'pointer',
            fontWeight: tab === 'login' ? 600 : 400,
            color: tab === 'login' ? '#2563eb' : '#6b7280',
          }}
        >
          Iniciar sesión
        </button>
        <button
          onClick={() => setTab('register')}
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            borderBottom: tab === 'register' ? '2px solid #2563eb' : '2px solid #e5e7eb',
            background: 'none',
            cursor: 'pointer',
            fontWeight: tab === 'register' ? 600 : 400,
            color: tab === 'register' ? '#2563eb' : '#6b7280',
          }}
        >
          Registrarse
        </button>
      </div>

      {/* Form */}
      {tab === 'login' ? <LoginForm /> : <RegisterForm />}
    </div>
  );
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      {login.error && (
        <div style={{ color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          {(login.error as any)?.response?.data?.message ?? 'Error al iniciar sesión'}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          Usuario
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16 }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16 }}
        />
      </div>
      <button
        type="submit"
        disabled={login.isPending}
        style={{
          width: '100%',
          padding: '10px 0',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 16,
          fontWeight: 600,
          cursor: login.isPending ? 'not-allowed' : 'pointer',
          opacity: login.isPending ? 0.7 : 1,
        }}
      >
        {login.isPending ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
}

function RegisterForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const register = useRegister();
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return;
    register.mutate(
      { username, password },
      { onSuccess: () => setSuccess(true) },
    );
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', color: '#16a34a' }}>
        <p>¡Registro exitoso! Ahora puedes iniciar sesión.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {register.error && (
        <div style={{ color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          {(register.error as any)?.response?.data?.message ?? 'Error al registrarse'}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          Usuario
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16 }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 16 }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
          Confirmar contraseña
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 16,
            outline: password !== confirm && confirm ? '2px solid #dc2626' : undefined,
          }}
        />
      </div>
      <button
        type="submit"
        disabled={register.isPending || password !== confirm}
        style={{
          width: '100%',
          padding: '10px 0',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 16,
          fontWeight: 600,
          cursor: register.isPending || password !== confirm ? 'not-allowed' : 'pointer',
          opacity: register.isPending || password !== confirm ? 0.7 : 1,
        }}
      >
        {register.isPending ? 'Registrando...' : 'Registrarse'}
      </button>
    </form>
  );
}
