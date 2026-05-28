import React, { useCallback, useRef } from 'react';
import { useAppStore } from '../../store/app-store';
import MessageList from './MessageList';
import InputBox from './InputBox';

const ChatPanel: React.FC = () => {
  const addMessage = useAppStore((s) => s.addMessage);
  const appendToLastMessage = useAppStore((s) => s.appendToLastMessage);
  const setStreaming = useAppStore((s) => s.setStreaming);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const projectPath = useAppStore((s) => s.projectPath);

  // Listen for AI deltas
  const hasSetupListener = useRef(false);
  if (!hasSetupListener.current) {
    hasSetupListener.current = true;
    window.hicc.onAiDelta((delta: string) => {
      appendToLastMessage(delta);
    });
  }

  const handleSend = useCallback(async (text: string) => {
    if (!projectPath) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const aiMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now(),
    };
    addMessage(aiMsg);

    setStreaming(true);
    try {
      await window.hicc.sendMessage(text);
    } catch (error) {
      appendToLastMessage(`\n[Error: ${error}]`);
    } finally {
      setStreaming(false);
    }
  }, [projectPath, addMessage, appendToLastMessage, setStreaming]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary)',
    }}>
      <MessageList />
      <InputBox onSend={handleSend} disabled={isStreaming || !projectPath} />
    </div>
  );
};

export default ChatPanel;
