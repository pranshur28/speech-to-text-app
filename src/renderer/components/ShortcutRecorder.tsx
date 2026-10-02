import React, { useEffect, useState } from 'react';

// Map a DOM key to the name the main-process shortcut parser understands.
// Returns null for modifier-only presses.
export function toShortcutKey(domKey: string): string | null {
  const key = domKey.toUpperCase();

  if (['CONTROL', 'META', 'ALT', 'SHIFT'].includes(key)) return null;

  const map: { [key: string]: string } = {
    ' ': 'Space',
    'ARROWUP': 'Up',
    'ARROWDOWN': 'Down',
    'ARROWLEFT': 'Left',
    'ARROWRIGHT': 'Right',
    'ESCAPE': 'Esc',
    'RETURN': 'Return',
    'ENTER': 'Return',
    'BACKSPACE': 'Backspace',
    'DELETE': 'Delete',
    'TAB': 'Tab',
    'CAPSLOCK': 'CapsLock',
    'NUMLOCK': 'NumLock',
    'SCROLLLOCK': 'ScrollLock',
    'PAUSE': 'Pause',
    'INSERT': 'Insert',
    'HOME': 'Home',
    'PAGEUP': 'PageUp',
    'PAGEDOWN': 'PageDown',
    'END': 'End',
    'PRINT': 'PrintScreen',
  };

  // Letters, digits, function keys and anything else pass through uppercased
  return map[key] ?? key;
}

function heldModifiers(e: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (e.metaKey) keys.push('Command');
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  return keys;
}

interface ShortcutRecorderProps {
  label: string;
  description: string;
  value: string;
  emptyText: string;
  listeningText: string;
  /** Only one recorder listens at a time; the parent tracks which. */
  isListening: boolean;
  onListeningChange: (listening: boolean) => void;
  onChange: (shortcut: string) => void;
}

export const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({
  label,
  description,
  value,
  emptyText,
  listeningText,
  isListening,
  onListeningChange,
  onChange,
}) => {
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isListening) {
      setPressedKeys([]);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keys = heldModifiers(e);
      const triggerKey = toShortcutKey(e.key);

      if (!triggerKey) {
        setPressedKeys(keys);
        return;
      }

      if (!keys.includes(triggerKey)) keys.push(triggerKey);

      // Warn about plain letters/Space without modifiers — they are captured globally
      const hasModifiers = e.metaKey || e.ctrlKey || e.altKey || (e.shiftKey && triggerKey.length > 1);
      const isCommonKey = /^[A-Z]$/.test(triggerKey) || triggerKey === 'Space';
      setWarning(!hasModifiers && isCommonKey
        ? `Using "${triggerKey}" alone will capture it globally. This may interfere with typing in other apps.`
        : null);

      onChange(keys.join('+'));
      onListeningChange(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening, onChange, onListeningChange]);

  return (
    <div className="setting-group">
      <label className="setting-label">{label}</label>
      <div className="setting-description" style={{ marginBottom: '8px' }}>
        {description}
      </div>
      <div className="shortcut-recorder">
        <div
          className={`shortcut-display ${isListening ? 'recording' : ''}`}
          onClick={() => {
            setWarning(null);
            onListeningChange(true);
          }}
        >
          {isListening
            ? (pressedKeys.length > 0 ? pressedKeys.join('+') : listeningText)
            : (value || emptyText)}
        </div>
        {isListening ? (
          <button className="cancel-record-btn" onClick={(e) => {
            e.stopPropagation();
            onListeningChange(false);
          }}>Cancel</button>
        ) : (
          <button className="reset-btn" onClick={() => {
            setWarning(null);
            onChange('');
          }} title="Clear Shortcut">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
      {warning && (
        <div className="error-message" style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid var(--accent-warning)',
          color: 'var(--accent-warning)'
        }}>
          ⚠️ {warning}
        </div>
      )}
    </div>
  );
};
