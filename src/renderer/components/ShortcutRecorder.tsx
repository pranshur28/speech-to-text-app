import React, { useEffect, useState } from 'react';
import { shortcutKeys } from '../format';

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
        ? `"${triggerKey}" on its own is captured everywhere, so it may get in the way of typing.`
        : null);

      onChange(keys.join('+'));
      onListeningChange(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening, onChange, onListeningChange]);

  const shownKeys = isListening ? pressedKeys.map((key) => shortcutKeys(key)[0]) : shortcutKeys(value);
  const placeholder = isListening ? listeningText : emptyText;

  return (
    <div className="row row--stacked">
      <div className="row-main">
        <span className="row-label">
          {label}
          <span className="row-sublabel">{description}</span>
        </span>
        <button
          type="button"
          className={`shortcut-field ${isListening ? 'is-listening' : ''}`}
          onClick={() => {
            setWarning(null);
            onListeningChange(true);
          }}
          aria-label={`${label}: ${value || emptyText}. Click to change.`}
        >
          {shownKeys.length > 0 ? (
            <span className="kbd-group">{shownKeys.map((key) => <kbd key={key}>{key}</kbd>)}</span>
          ) : (
            <span className="shortcut-placeholder">{placeholder}</span>
          )}
        </button>
        {isListening ? (
          <button type="button" className="text-btn" onClick={() => onListeningChange(false)}>
            Cancel
          </button>
        ) : value ? (
          <button
            type="button"
            className="text-btn text-btn--muted"
            onClick={() => {
              setWarning(null);
              onChange('');
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {warning && <p className="row-note row-note--warning" role="alert">{warning}</p>}
    </div>
  );
};
