import { useMe, useLogout } from '../../hooks/use-auth';
import { formatMoney } from '../../utils/format';
import theme from '../../styles/theme';

export default function Header() {
  const { data: user, isLoading } = useMe();
  const logout = useLogout();

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: theme.headerBg,
        color: theme.blanco,
        borderBottom: `2px solid ${theme.amarilloBet}`,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>Timberman</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {isLoading ? (
          <span style={{ fontSize: 14, color: theme.textoSecundario }}>Cargando...</span>
        ) : user ? (
          <>
            <span style={{ fontSize: 14 }}>
              {user.username}
              {user.role === 'admin' ? (
                <span style={{ marginLeft: 6, fontSize: 11, background: theme.amarilloBet, color: theme.fondo, padding: '2px 6px', borderRadius: 4 }}>
                  admin
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.amarilloBet }}>
              {formatMoney(user.balance)}
            </span>
          </>
        ) : null}
        <button
          onClick={logout}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            color: theme.blanco,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Salir
        </button>
      </div>
    </header>
  );
}
