import { useState } from 'react';
import { useAdminUsers, useCreateUser, useAdjustBalance, useDeleteUser } from '../../hooks/use-admin';
import { formatMoney } from '../../utils/format';
import theme from '../../styles/theme';

// ─── Styles ─────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: theme.tarjeta,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.glow,
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: theme.textoSecundario,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: theme.inputBg,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.blanco,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 20px',
  border: 'none',
  borderRadius: 8,
  background: theme.verdeBet,
  color: theme.blanco,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 8,
  background: theme.rojo,
  color: theme.blanco,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSuccess: React.CSSProperties = {
  padding: '8px 20px',
  border: 'none',
  borderRadius: 8,
  background: theme.verdeBet,
  color: theme.blanco,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnOutline: React.CSSProperties = {
  padding: '6px 14px',
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  background: 'transparent',
  color: theme.blanco,
  fontSize: 12,
  cursor: 'pointer',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function UserManager() {
  const { data: users, isLoading, error } = useAdminUsers();
  const createUser = useCreateUser();
  const adjustBalance = useAdjustBalance();
  const deleteUser = useDeleteUser();

  // Create user form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  // Balance adjust
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Reveal password per user
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Create user ────────────────────────────────────────────────────────
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    createUser.mutate(
      {
        username: username.trim(),
        password: password.trim(),
        balance: initialBalance ? Math.round(parseFloat(initialBalance) * 100) : undefined,
      },
      {
        onSuccess: () => {
          setUsername('');
          setPassword('');
          setInitialBalance('');
        },
      },
    );
  };

  // ── Adjust balance ─────────────────────────────────────────────────────
  const handleAdjustBalance = (direction: 'cargar' | 'descargar') => {
    if (!selectedUserId || !adjustAmount) return;

    const amount = Math.round(parseFloat(adjustAmount) * 100);
    adjustBalance.mutate({
      userId: selectedUserId,
      amount: direction === 'descargar' ? -amount : amount,
      reason: adjustReason || `Ajuste manual (${direction})`,
    });
  };

  // ── Delete user ────────────────────────────────────────────────────────
  const handleDeleteUser = (userId: string) => {
    deleteUser.mutate(userId, {
      onSuccess: () => setConfirmDelete(null),
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>Cargando usuarios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>
          Error al cargar usuarios.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Create user form ─────────────────────────────────────────────── */}
      <div style={card}>
        <h4 style={{ margin: '0 0 16px', fontSize: 16, color: theme.blanco }}>
          Crear Usuario
        </h4>

        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={label}>Usuario</label>
              <input
                style={input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. nuevo_usuario"
                required
              />
            </div>

            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={label}>Contraseña</label>
              <input
                style={input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={label}>Saldo inicial</label>
              <input
                style={input}
                type="number"
                step="0.01"
                min="0"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                disabled={createUser.isPending}
                style={{
                  ...btnSuccess,
                  opacity: createUser.isPending ? 0.6 : 1,
                  cursor: createUser.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {createUser.isPending ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </div>

          {createUser.isSuccess && (
            <p style={{ color: theme.verdeBet, fontSize: 13, margin: '8px 0 0' }}>
              Usuario creado correctamente.
            </p>
          )}

          {createUser.error && (
            <p style={{ color: theme.rojo, fontSize: 13, margin: '8px 0 0' }}>
              {(createUser.error as any)?.response?.data?.message ?? 'Error al crear usuario.'}
            </p>
          )}
        </form>
      </div>

      {/* ── Users table ──────────────────────────────────────────────────── */}
      <div style={card}>
        <h4 style={{ margin: '0 0 16px', fontSize: 16, color: theme.blanco }}>
          Usuarios ({users?.length ?? 0})
        </h4>

        {(!users || users.length === 0) && (
          <p style={{ color: theme.textoSecundario, fontSize: 14, textAlign: 'center' }}>
            No hay usuarios registrados.
          </p>
        )}

        {users && users.length > 0 && (
          <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textoSecundario }}>
                  <th style={thStyle}>Usuario</th>
                  <th style={thStyle}>Contraseña</th>
                  <th style={thStyle}>Saldo</th>
                  <th style={thStyle}>Puntos</th>
                  <th style={thStyle}>Rol</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: `1px solid ${theme.border}`, color: theme.blanco }}
                  >
                    <td style={tdStyle}>{u.username}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() =>
                          setRevealed((r) => ({ ...r, [u.id]: !r[u.id] }))
                        }
                        style={btnOutline}
                      >
                        {revealed[u.id] ? u.id.slice(0, 8) : '••••••••'}
                      </button>
                    </td>
                    <td style={{ ...tdStyle, color: theme.amarilloBet, fontWeight: 600 }}>
                      {formatMoney(u.balance)}
                    </td>
                    <td style={{ ...tdStyle, color: theme.amarilloBet, fontWeight: 600 }}>
                      {u.points ?? 0}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          background: u.role === 'admin' ? theme.amarilloBet : theme.border,
                          color: u.role === 'admin' ? theme.fondo : theme.textoSecundario,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {confirmDelete === u.id ? (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={deleteUser.isPending}
                            style={{
                              ...btnDanger,
                              padding: '4px 10px',
                              fontSize: 11,
                            }}
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            style={{
                              ...btnOutline,
                              padding: '4px 10px',
                              fontSize: 11,
                            }}
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(u.id)}
                          style={{
                            ...btnDanger,
                            padding: '4px 10px',
                            fontSize: 11,
                          }}
                          disabled={u.role === 'admin'}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Balance adjust ───────────────────────────────────────────────── */}
      <div style={card}>
        <h4 style={{ margin: '0 0 16px', fontSize: 16, color: theme.blanco }}>
          Ajustar Saldo
        </h4>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={label}>Usuario</label>
            <select
              style={input}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Seleccionar usuario</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({formatMoney(u.balance)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={label}>Monto</label>
            <input
              style={input}
              type="number"
              step="0.01"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={label}>Motivo</label>
            <input
              style={input}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="ej. Recarga por promoción"
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleAdjustBalance('cargar')}
              disabled={!selectedUserId || !adjustAmount || adjustBalance.isPending}
              style={{
                ...btnSuccess,
                opacity:
                  !selectedUserId || !adjustAmount || adjustBalance.isPending
                    ? 0.5
                    : 1,
                cursor:
                  !selectedUserId || !adjustAmount || adjustBalance.isPending
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              Cargar
            </button>
            <button
              onClick={() => handleAdjustBalance('descargar')}
              disabled={!selectedUserId || !adjustAmount || adjustBalance.isPending}
              style={{
                ...btnDanger,
                opacity:
                  !selectedUserId || !adjustAmount || adjustBalance.isPending
                    ? 0.5
                    : 1,
                cursor:
                  !selectedUserId || !adjustAmount || adjustBalance.isPending
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              Descargar
            </button>
          </div>
        </div>

        {adjustBalance.isSuccess && (
          <p style={{ color: theme.verdeBet, fontSize: 13, margin: '8px 0 0' }}>
            Saldo ajustado correctamente.
          </p>
        )}

        {adjustBalance.error && (
          <p style={{ color: theme.rojo, fontSize: 13, margin: '8px 0 0' }}>
            {(adjustBalance.error as any)?.response?.data?.message ?? 'Error al ajustar saldo.'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Table cell styles ──────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  background: theme.headerBg,
  color: theme.amarilloBet,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};
