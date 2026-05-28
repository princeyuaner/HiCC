import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/app-store';
import MessageBubble from './MessageBubble';

const MessageList: React.FC = () => {
  const messages = useAppStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      background: 'var(--bg-primary)',
    }}>
      {messages.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-secondary)',
          gap: 8,
        }}>
          <div style={{ fontSize: 32, opacity: 0.3 }}>HICC</div>
          <div style={{ fontSize: 14 }}>Start a conversation to begin coding</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Describe what you want to build, and Claude will help you write the code
          </div>
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
