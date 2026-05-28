import React from 'react';
import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div style={{
      padding: '8px 16px',
      display: 'flex',
      gap: 12,
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        flexShrink: 0,
        background: isUser ? 'var(--accent-color)' : '#6a9955',
        color: 'white',
        fontWeight: 600,
      }}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginBottom: 4,
          fontWeight: 600,
        }}>
          {isUser ? 'You' : 'Claude'}
        </div>
        <div style={{
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          fontFamily: 'var(--font-family)',
        }}>
          {renderContent(message.content)}
        </div>
      </div>
    </div>
  );
};

function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeContent = part.slice(3, -3);
      const newlineIdx = codeContent.indexOf('\n');
      const codeOnly = newlineIdx === -1 ? codeContent : codeContent.slice(newlineIdx + 1);
      return (
        <pre key={i} style={{
          background: 'var(--bg-tertiary)',
          padding: '8px 12px',
          borderRadius: 4,
          margin: '6px 0',
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          <code>{codeOnly}</code>
        </pre>
      );
    }
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((ip, j) =>
          ip.startsWith('`') && ip.endsWith('`') ? (
            <code key={j} style={{
              background: 'var(--bg-tertiary)',
              padding: '1px 4px',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}>
              {ip.slice(1, -1)}
            </code>
          ) : (
            <span key={j}>{ip}</span>
          )
        )}
      </span>
    );
  });
}

export default MessageBubble;
