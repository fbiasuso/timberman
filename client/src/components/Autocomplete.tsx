import { useEffect, useId, useRef, useState } from 'react';
import theme from '../styles/theme';

interface AutocompleteProps<T> {
  /** Options to filter and pick from — rendered in the order provided (the
   *  registry endpoints already order by name). */
  options: T[];
  /** Stable key per option (drives option ids, dedupes the filter). */
  getKey: (item: T) => string;
  /** Display label — filter target and the text written on select. */
  getLabel: (item: T) => string;
  /** Current input value (controlled by the parent). */
  value: string;
  /** Called on every keystroke — the parent owns the text. */
  onChange: (value: string) => void;
  /** Called when an option is picked (Enter or click). */
  onSelect: (item: T) => void;
  /** Input id — pairs with a visible <label htmlFor>. */
  id?: string;
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
  placeholder?: string;
  /** Message shown when the dropdown is open but nothing matches the filter. */
  emptyText?: string;
  /** Hint rendered below the input while `value` matches no option (the
   *  unmatched-text state for legacy free-text match strings). The parent
   *  passes it only when the current value is a legacy string. */
  unmatchedText?: string;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const container: React.CSSProperties = {
  position: 'relative',
};

const inputStyle: React.CSSProperties = {
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

const listboxStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 10,
  marginTop: 4,
  background: theme.tarjeta,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  boxShadow: theme.glow,
  maxHeight: 220,
  overflowY: 'auto',
  padding: 0,
  listStyle: 'none',
};

const optionStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 14,
  background: active ? theme.amarilloBet : 'transparent',
  color: active ? theme.fondo : theme.blanco,
});

const emptyStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  color: theme.textoSecundario,
};

const unmatchedStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  fontStyle: 'italic',
  color: theme.textoSecundario,
};

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Reusable combobox (design D11): a text input with a filtered option list,
 * full keyboard navigation (up/down/enter/escape), click-outside close and
 * ARIA combobox attributes. Used by the match team selection (AddMatchForm,
 * MatchRow) — free-text team input is replaced by this picker.
 */
export default function Autocomplete<T>({
  options,
  getKey,
  getLabel,
  value,
  onChange,
  onSelect,
  id,
  ariaLabel,
  placeholder,
  emptyText = 'Sin resultados',
  unmatchedText,
}: AutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `autocomplete-listbox-${useId()}`;

  const query = value.trim().toLowerCase();
  const filtered = query
    ? options.filter((o) => getLabel(o).toLowerCase().includes(query))
    : options;

  const hasExactMatch = options.some(
    (o) => getLabel(o).trim().toLowerCase() === query,
  );

  // Typing resets the highlighted option (the filtered list changed).
  useEffect(() => {
    setActiveIndex(null);
  }, [value]);

  // Close when the user clicks outside the combobox.
  useEffect(() => {
    if (!open) return;
    const handleMousedown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, [open]);

  const select = (item: T) => {
    onSelect(item);
    setOpen(false);
    setActiveIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(filtered.length > 0 ? 0 : null);
      } else {
        setActiveIndex((prev) => {
          if (filtered.length === 0) return null;
          const next = prev === null ? 0 : (prev + 1) % filtered.length;
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(filtered.length > 0 ? filtered.length - 1 : null);
      } else {
        setActiveIndex((prev) => {
          if (filtered.length === 0) return null;
          if (prev === null) return filtered.length - 1;
          return (prev - 1 + filtered.length) % filtered.length;
        });
      }
    } else if (e.key === 'Enter') {
      if (open && filtered.length > 0) {
        e.preventDefault();
        select(filtered[activeIndex ?? 0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(null);
    }
  };

  const showUnmatched = unmatchedText && value.trim() !== '' && !hasExactMatch;

  return (
    <div ref={containerRef} style={container}>
      <input
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex !== null && filtered[activeIndex]
            ? `${listboxId}-${getKey(filtered[activeIndex])}`
            : undefined
        }
        style={inputStyle}
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {showUnmatched && <p style={unmatchedStyle}>{unmatchedText}</p>}

      {open && (
        <ul role="listbox" id={listboxId} style={listboxStyle}>
          {filtered.length === 0 && <li style={emptyStyle}>{emptyText}</li>}
          {filtered.map((item, i) => (
            <li
              key={getKey(item)}
              id={`${listboxId}-${getKey(item)}`}
              role="option"
              aria-selected={i === activeIndex}
              style={optionStyle(i === activeIndex)}
              onMouseDown={(e) => {
                e.preventDefault();
                select(item);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {getLabel(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
