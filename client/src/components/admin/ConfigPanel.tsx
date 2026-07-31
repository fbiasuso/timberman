import { useState, useEffect } from 'react';
import { useAdminConfig, useUpdateConfig } from '../../hooks/use-admin';
import theme from '../../styles/theme';

// ─── Styles ─────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: theme.tarjeta,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${theme.border}`,
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
  padding: '10px 14px',
  background: theme.inputBg,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.blanco,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const checkboxRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  background: theme.inputBg,
  borderRadius: 8,
};

const btn: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  border: 'none',
  borderRadius: 10,
  background: theme.amarilloBet,
  color: theme.fondo,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const btnDisabled: React.CSSProperties = {
  ...btn,
  background: theme.disabled,
  cursor: 'not-allowed',
  color: theme.textoSecundario,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConfigPanel() {
  const { data: config, isLoading, error } = useAdminConfig();
  const updateConfig = useUpdateConfig();

  // Local form state (initialised from server data)
  const [commission, setCommission] = useState('');
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [defaultBetAmount, setDefaultBetAmount] = useState('');
  const [dirty, setDirty] = useState(false);

  // Sync server data into local state once loaded
  useEffect(() => {
    if (config) {
      setCommission(String(config.commission));
      setAllowRegistration(config.allowRegistration);
      setDefaultBetAmount(String(config.defaultBetAmount));
    }
  }, [config]);

  // Track dirty state
  useEffect(() => {
    if (!config) return;
    const changed =
      commission !== String(config.commission) ||
      allowRegistration !== config.allowRegistration ||
      defaultBetAmount !== String(config.defaultBetAmount);
    setDirty(changed);
  }, [commission, allowRegistration, defaultBetAmount, config]);

  const handleSave = () => {
    // Save each changed field individually via PATCH /api/admin/config
    if (!config) return;

    const commissionNum = parseFloat(commission);
    const betAmountNum = parseFloat(defaultBetAmount);

    if (commission !== String(config.commission) && !isNaN(commissionNum)) {
      updateConfig.mutate({ key: 'commission', value: commissionNum });
    }

    if (allowRegistration !== config.allowRegistration) {
      updateConfig.mutate({ key: 'allowRegistration', value: allowRegistration });
    }

    if (defaultBetAmount !== String(config.defaultBetAmount) && !isNaN(betAmountNum)) {
      updateConfig.mutate({ key: 'defaultBetAmount', value: betAmountNum });
    }
  };

  const isPending = updateConfig.isPending;
  const isSaved = updateConfig.isSuccess && dirty === false;

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>Cargando configuración...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <p style={{ color: theme.rojo, textAlign: 'center' }}>
          Error al cargar la configuración.
        </p>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={card}>
        <p style={{ color: theme.textoSecundario, textAlign: 'center' }}>
          No se pudo obtener la configuración.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <h4 style={{ margin: '0 0 20px', fontSize: 16, color: theme.blanco }}>
        Configuración del Sistema
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Commission */}
        <div>
          <label style={label}>Comisión (%)</label>
          <input
            style={input}
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </div>

        {/* Allow registration */}
        <div>
          <div style={checkboxRow}>
            <input
              type="checkbox"
              id="allowRegistration"
              checked={allowRegistration}
              onChange={(e) => setAllowRegistration(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: theme.amarilloBet, cursor: 'pointer' }}
            />
            <label
              htmlFor="allowRegistration"
              style={{ color: theme.blanco, fontSize: 14, cursor: 'pointer' }}
            >
              Permitir registro de nuevos usuarios
            </label>
          </div>
        </div>

        {/* Default bet amount */}
        <div>
          <label style={label}>Monto de apuesta por defecto</label>
          <input
            style={input}
            type="number"
            step="0.01"
            min="0"
            value={defaultBetAmount}
            onChange={(e) => setDefaultBetAmount(e.target.value)}
          />
        </div>

        {/* Error feedback */}
        {updateConfig.error && (
          <div
            style={{
              padding: '10px 16px',
              background: theme.dangerBg,
              color: theme.rojo,
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {(updateConfig.error as any)?.response?.data?.message ?? 'Error al guardar configuración.'}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!dirty || isPending}
          style={!dirty || isPending ? btnDisabled : btn}
        >
          {isPending
            ? 'Guardando...'
            : isSaved
              ? '✓ Configuración Guardada'
              : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
