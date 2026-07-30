import { useState } from 'react';

type FilterValue = 'todos' | 'pendientes' | 'cerrados';

interface FiltersProps {
  /** Called whenever search query or filter pill changes */
  onChange: (search: string, filter: FilterValue) => void;
}

/**
 * Cartelera filters — search by team name and filter by prediction status.
 * Manages its own state internally, reports changes upward.
 */
export default function Filters({ onChange }: FiltersProps) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterValue>('todos');

  const handleSearch = (value: string) => {
    setSearch(value);
    onChange(value, activeFilter);
  };

  const handleFilter = (value: FilterValue) => {
    setActiveFilter(value);
    onChange(search, value);
  };

  const pills: { value: FilterValue; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'pendientes', label: 'Pendientes' },
    { value: 'cerrados', label: 'Cerrados' },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Search input */}
      <input
        type="text"
        placeholder="Buscar equipo..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          fontSize: 15,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {pills.map((pill) => (
          <button
            key={pill.value}
            onClick={() => handleFilter(pill.value)}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: activeFilter === pill.value ? 600 : 400,
              cursor: 'pointer',
              background: activeFilter === pill.value ? '#2563eb' : '#e5e7eb',
              color: activeFilter === pill.value ? '#fff' : '#374151',
              transition: 'all 0.15s',
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { FilterValue };
