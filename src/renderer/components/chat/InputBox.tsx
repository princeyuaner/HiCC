import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';

interface InputBoxProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

const InputBox: React.FC<InputBoxProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border-color)',
      padding: 12,
      background: 'var(--bg-secondary)',
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to build... (Enter to send, Shift+Enter for new line)"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family)',
            fontSize: 14,
            resize: 'none',
            outline: 'none',
            maxHeight: 200,
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: disabled ? 'var(--bg-tertiary)' : 'var(--accent-color)',
            color: disabled ? 'var(--text-secondary)' : 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default InputBox;
