import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../store/app-store';
import MessageBubble from './MessageBubble';
import styles from './MessageList.module.css';

const MessageList: React.FC<{ onSuggestionClick?: (text: string) => void }> = ({ onSuggestionClick }) => {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isAtBottomRef = useRef(true);
  const rafRef = useRef<number>(0);

  const SUGGESTIONS = [
    { icon: '>', text: 'Create a React component for a login form' },
    { icon: '>', text: 'Explain how the codebase is organized' },
    { icon: '>', text: 'Write unit tests for the auth module' },
    { icon: '>', text: 'Refactor the state management' },
    { icon: '>', text: 'Add error handling to the API client' },
    { icon: '>', text: 'Optimize the chat rendering performance' },
  ];

  const scrollToBottom = useCallback((smooth = true) => {
    const container = containerRef.current;
    if (!container) return;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    setShowScrollButton(false);
    isAtBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const threshold = 50;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, []);

  useEffect(() => {
    if (!isAtBottomRef.current) {
      setShowScrollButton(true);
      return;
    }
    if (!isStreaming) {
      scrollToBottom(false);
      return;
    }
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const container = containerRef.current;
      if (container && isAtBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [messages, isStreaming, scrollToBottom]);

  return (
    <div className={styles.list} ref={containerRef} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>HICC</div>
          <div className={styles.emptyTitle}>Start a conversation to begin coding</div>
          <div className={styles.emptySubtitle}>
            Describe what you want to build, and Claude will help you write the code
          </div>
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                className={styles.suggestionChip}
                onClick={() => onSuggestionClick?.(s.text)}
              >
                <span className={styles.suggestionIcon}>{s.icon}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
      {showScrollButton && (
        <button className={styles.scrollButton} onClick={() => scrollToBottom(true)} title="Scroll to bottom">
          ↓
        </button>
      )}
    </div>
  );
};

export default MessageList;
