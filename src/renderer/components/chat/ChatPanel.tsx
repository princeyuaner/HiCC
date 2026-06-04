import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAppStore, selectActiveProfile } from '../../store/app-store';
import MessageList from './MessageList';
import InputBox from './InputBox';
import type { InputBoxHandle } from './InputBox';
import ToolConfirmDialog from './ToolConfirmDialog';
import ContextBar from './ContextBar';
import type { Attachment } from '../../types';
import type {
  ContentBlockStartEventData,
  ThinkingDeltaEventData,
  TextDeltaEventData,
  ContentBlockStopEventData,
  ToolUseEvent,
  ToolProgressEvent,
  ToolUseSummaryEvent,
  TurnCompleteEventData,
  AiStatusEventData,
  AiInitEventData,
  ToolConfirmEventData,
} from '../../../shared/types';
import styles from './ChatPanel.module.css';

const MODEL_OPTIONS: { key: string; label: string }[] = [
  { key: 'sonnet', label: 'Sonnet' },
  { key: 'opus', label: 'Opus' },
  { key: 'haiku', label: 'Haiku' },
];

const MODE_OPTIONS: { key: string; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'acceptEdits', label: 'Accept Edits' },
  { key: 'bypassPermissions', label: 'Bypass' },
  { key: 'plan', label: 'Plan' },
];

const EFFORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
];

const ChatPanel: React.FC = () => {
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const setStreaming = useAppStore((s) => s.setStreaming);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const activeModelKey = useAppStore((s) => s.activeModelKey);
  const setActiveModelKey = useAppStore((s) => s.setActiveModelKey);
  const activeProfile = useAppStore(selectActiveProfile);
  const onContentBlockStart = useAppStore((s) => s.onContentBlockStart);
  const onThinkingDelta = useAppStore((s) => s.onThinkingDelta);
  const onTextDelta = useAppStore((s) => s.onTextDelta);
  const onContentBlockStop = useAppStore((s) => s.onContentBlockStop);
  const onToolUse = useAppStore((s) => s.onToolUse);
  const onToolProgress = useAppStore((s) => s.onToolProgress);
  const onToolUseSummary = useAppStore((s) => s.onToolUseSummary);
  const onToolResult = useAppStore((s) => s.onToolResult);
  const onTurnComplete = useAppStore((s) => s.onTurnComplete);
  const contextUsage = useAppStore((s) => s.contextUsage);
  const cumulativeCost = useAppStore((s) => s.cumulativeCost);
  const onAiStatus = useAppStore((s) => s.onAiStatus);
  const onAiInit = useAppStore((s) => s.onAiInit);
  const onToolConfirm = useAppStore((s) => s.onToolConfirm);
  const onToolDescription = useAppStore((s) => s.onToolDescription);
  const setMessageError = useAppStore((s) => s.setMessageError);
  const cancelStream = useAppStore((s) => s.cancelStream);
  const sessionError = useAppStore((s) => s.sessionError);
  const sessionStatus = useAppStore((s) => s.sessionStatus);
  const setSessionError = useAppStore((s) => s.setSessionError);
  const permissionMode = useAppStore((s) => s.permissionMode);
  const setPermissionMode = useAppStore((s) => s.setPermissionMode);
  const effortLevel = useAppStore((s) => s.effortLevel);
  const setEffortLevel = useAppStore((s) => s.setEffortLevel);
  const use1MContext = useAppStore((s) => s.use1MContext);
  const setUse1MContext = useAppStore((s) => s.setUse1MContext);
  const updateProfileInStore = useAppStore((s) => s.updateProfileInStore);
  const conversations = useAppStore((s) => s.conversations);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const loadConversations = useAppStore((s) => s.loadConversations);
  const createConversation = useAppStore((s) => s.createConversation);
  const switchConversation = useAppStore((s) => s.switchConversation);
  const deleteConversation = useAppStore((s) => s.deleteConversation);
  const availableCommands = useAppStore((s) => s.availableCommands);
  const setAvailableCommands = useAppStore((s) => s.setAvailableCommands);
  const acceptAllDiffs = useAppStore((s) => s.acceptAllDiffs);
  const acceptedDiffIds = useAppStore((s) => s.acceptedDiffIds);

  // Count pending (unaccepted) diffs
  const pendingDiffs = useMemo(() => messages.reduce((count, msg) => {
    return count + msg.contentBlocks.filter(
      (b) => b.type === 'tool_use'
        && b.toolCall.status === 'executed'
        && (b.toolCall.name === 'Write' || b.toolCall.name === 'Edit')
        && b.toolCall.newFilePath
        && !acceptedDiffIds.has(b.toolCall.id),
    ).length;
  }, 0), [messages, acceptedDiffIds]);

  // Session setup
  const startSession = useCallback(() => {
    setSessionError(null);
    window.hicc.startSession(activeModelKey, permissionMode, effortLevel).catch((err) => {
      setSessionError(err instanceof Error ? err.message : String(err));
    });
  }, [activeModelKey, permissionMode, effortLevel, setSessionError]);

  useEffect(() => {
    startSession();

    window.hicc.onContentBlockStart((data: ContentBlockStartEventData) => {
      console.log('[RENDERER IPC] content-block-start:', data);
      onContentBlockStart(data.blockIndex, data.type);
    });
    window.hicc.onThinkingDelta((data: ThinkingDeltaEventData) => {
      onThinkingDelta(data.blockIndex, data.thinking);
    });
    window.hicc.onTextDelta((data: TextDeltaEventData) => {
      onTextDelta(data.text, data.blockIndex);
    });
    window.hicc.onContentBlockStop((data: ContentBlockStopEventData) => {
      console.log('[RENDERER IPC] content-block-stop:', data);
      onContentBlockStop(data.blockIndex);
    });
    window.hicc.onToolUse((data: ToolUseEvent) => {
      console.log('[RENDERER IPC] tool-use:', { id: data.id, name: data.name, desc: (data.description || '').slice(0, 100) });
      onToolUse(data.id, data.name, data.input, data.description);
    });
    window.hicc.onToolProgress((data: ToolProgressEvent) => {
      console.log('[RENDERER IPC] tool-progress:', data);
      onToolProgress(data.toolUseId, data.toolName, data.elapsedSeconds);
    });
    window.hicc.onToolUseSummary((data: ToolUseSummaryEvent) => {
      console.log('[RENDERER IPC] tool-use-summary:', { ids: data.toolUseIds, summary: (data.summary || '').slice(0, 120) });
      onToolUseSummary(data.summary, data.toolUseIds);
    });
    window.hicc.onTurnComplete((data: TurnCompleteEventData) => {
      console.log('[RENDERER IPC] turn-complete:', data);
      onTurnComplete(
        data.usage as { input_tokens: number; output_tokens: number } | undefined,
        data.total_cost_usd,
      );
    });
    window.hicc.onAiStatus((data: AiStatusEventData) => {
      console.log('[RENDERER IPC] ai-status:', data);
      onAiStatus(data.status);
    });
    window.hicc.onAiInit((data: AiInitEventData) => {
      onAiInit(data.sessionId);
      if (data.slashCommands && data.slashCommands.length > 0) {
        const existingNames = new Set(useAppStore.getState().availableCommands.map(c => c.name));
        const newCmds = data.slashCommands
          .filter(name => !existingNames.has(name))
          .map(name => ({ name, description: '', argumentHint: '' }));
        if (newCmds.length > 0) {
          setAvailableCommands([...useAppStore.getState().availableCommands, ...newCmds]);
        }
      }
    });
    window.hicc.onAiToolConfirm((data: ToolConfirmEventData) => {
      console.log('[RENDERER IPC] tool-confirm:', { toolName: data.toolName, toolUseID: data.toolUseID });
      onToolConfirm(data);
    });
    window.hicc.onAiToolResult((data) => {
      console.log('[RENDERER IPC] tool-result:', { toolUseId: data.toolUseId, hasStdout: !!data.stdout, hasStderr: !!data.stderr });
      onToolResult(data.toolUseId, data.stdout, data.stderr);
    });
    window.hicc.onAiToolDescription((data: { toolUseId: string; description: string }) => {
      console.log('[RENDERER IPC] tool-description:', { toolUseId: data.toolUseId, desc: (data.description || '').slice(0, 100) });
      onToolDescription(data.toolUseId, data.description);
    });

    window.hicc.onAiError((errorMessage: string) => {
      setSessionError(errorMessage);
    });

    window.hicc.onCommandsLoaded((commands) => {
      setAvailableCommands(commands);
    });
  }, [activeModelKey, permissionMode]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-create conversation if none active
  useEffect(() => {
    if (!activeConversationId) {
      createConversation();
    }
  }, [activeConversationId, createConversation]);

  // Auto-save on turn complete
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && activeConversationId) {
      const activeConv = conversations.find((c) => c.id === activeConversationId);
      const title = getConversationTitle(messages);
      window.hicc.saveConversation({
        id: activeConversationId,
        title,
        messages,
        modelKey: activeModelKey,
        permissionMode,
        createdAt: activeConv?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }).then(() => loadConversations()).catch(() => {});
      // Save session state after each turn
      const s = useAppStore.getState();
      window.hicc.saveSession({
        activeConversationId: s.activeConversationId,
        openTabs: s.openTabs,
        activeTab: s.activeTab,
        activeSidebar: s.activeSidebar,
      }).catch(() => {});
    }
  }, [isStreaming]);

  const handleSend = useCallback(async (text: string, attachments?: Attachment[]) => {
    let fullText = text;

    // If there are attachments, prepend file contents
    if (attachments && attachments.length > 0) {
      const refs: string[] = [];
      for (const att of attachments) {
        if (att.type === 'selection') {
          refs.push(`--- Selection: ${att.fileName} ---\n${att.content || ''}\n--- End Selection ---`);
        } else {
          refs.push(`--- File: ${att.filePath} ---`);
        }
      }
      fullText = refs.join('\n\n') + '\n\n' + text;
    }

    console.log('[RENDERER] handleSend: user message (len=' + fullText.length + '):', fullText.slice(0, 300));

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: fullText,
      contentBlocks: [],
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const aiMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '',
      contentBlocks: [],
      timestamp: Date.now(),
    };
    addMessage(aiMsg);
    console.log('[RENDERER] handleSend: created aiMsg id=' + aiMsg.id);

    setStreaming(true);
    try {
      await window.hicc.sendMessage(fullText);
      console.log('[RENDERER] handleSend: sendMessage resolved');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[RENDERER] handleSend: sendMessage error:', msg);
      setMessageError(aiMsg.id, msg);
      setStreaming(false);
    }
  }, [addMessage, setStreaming, setMessageError]);

  const handleStop = useCallback(async () => {
    await cancelStream();
    // Restart session so next message works
    window.hicc.startSession(activeModelKey, permissionMode, effortLevel).catch(console.error);
  }, [cancelStream, activeModelKey, permissionMode, effortLevel]);

  const handleModelSwitch = useCallback(async (key: string) => {
    if (key === activeModelKey) return;
    setActiveModelKey(key);
    try {
      await window.hicc.interrupt();
    } catch {
      // ignore
    }
    window.hicc.startSession(key, permissionMode, effortLevel).catch(console.error);
  }, [activeModelKey, setActiveModelKey, permissionMode, effortLevel]);

  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [effortMenuOpen, setEffortMenuOpen] = useState(false);
  const [convMenuOpen, setConvMenuOpen] = useState(false);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [turnStartTime, setTurnStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sdkContextTotal, setSdkContextTotal] = useState(0);
  const [sdkContextMax, setSdkContextMax] = useState(200000);
  const [contextFiles, setContextFiles] = useState<Array<{ path: string; type: string; tokens: number }>>([]);
  const inputBoxRef = useRef<InputBoxHandle>(null);

  // Turn runtime timer — resets each turn
  useEffect(() => {
    if (isStreaming && !turnStartTime) {
      setTurnStartTime(Date.now());
    }
    if (!isStreaming && turnStartTime) {
      setTurnStartTime(null);
      setElapsed(0);
    }
  }, [isStreaming, turnStartTime]);

  useEffect(() => {
    if (!turnStartTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - turnStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [turnStartTime]);

  // Fetch SDK context usage after each turn
  useEffect(() => {
    if (isStreaming) return;
    const poll = async () => {
      try {
        const usage = await window.hicc.getContextUsage();
        if (usage) {
          setSdkContextTotal(usage.totalTokens);
          setSdkContextMax(usage.maxTokens);
          setContextFiles(usage.memoryFiles || []);
        }
      } catch { /* ignore */ }
    };
    poll();
  }, [isStreaming]);

  const currentModelName = activeProfile
    ? (activeModelKey === 'sonnet' ? activeProfile.sonnetModel :
       activeModelKey === 'opus' ? activeProfile.opusModel :
       activeProfile.smallFastModel) || activeProfile.model
    : '';
  const currentModelLabel = currentModelName || MODEL_OPTIONS.find((o) => o.key === activeModelKey)?.label || 'Sonnet';
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const convTitle = activeConv?.title || 'New Chat';

  return (
    <div className={styles.panel}>
      {/* Session error banner */}
      {sessionError && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(244, 67, 54, 0.1)',
          borderBottom: '1px solid rgba(244, 67, 54, 0.3)',
          color: '#f44336',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>{sessionError}</span>
          <button
            onClick={startSession}
            style={{
              padding: '2px 10px',
              borderRadius: 3,
              border: '1px solid rgba(244, 67, 54, 0.4)',
              background: 'transparent',
              color: '#f44336',
              cursor: 'pointer',
              fontSize: 12,
              marginLeft: 'auto',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Conversation header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        position: 'relative',
      }}>
        {renamingConvId === activeConversationId ? (
          <input
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const title = renameText.trim() || 'New Chat';
                window.hicc.saveConversation({
                  id: activeConversationId!,
                  title,
                  messages: useAppStore.getState().messages,
                  modelKey: activeModelKey,
                  permissionMode,
                  createdAt: activeConv?.createdAt || Date.now(),
                  updatedAt: Date.now(),
                }).then(() => loadConversations()).catch(() => {});
                setRenamingConvId(null);
              }
              if (e.key === 'Escape') {
                setRenamingConvId(null);
              }
            }}
            onBlur={() => setRenamingConvId(null)}
            autoFocus
            style={{
              flex: 1,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--accent-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => setConvMenuOpen(!convMenuOpen)}
            onDoubleClick={() => {
              setRenameText(convTitle);
              setRenamingConvId(activeConversationId);
            }}
            title="Double-click to rename"
            style={{
              flex: 1,
              textAlign: 'left',
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {convTitle} ▾
          </button>
        )}
        <button
          onClick={() => createConversation()}
          title="New Chat"
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          +
        </button>
        {convMenuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setConvMenuOpen(false)} />
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 2,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxHeight: 250,
              overflow: 'auto',
            }}>
              {conversations.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  No conversations yet
                </div>
              ) : (
                [...conversations].sort((a, b) => b.updatedAt - a.updatedAt).map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => { switchConversation(conv.id); setConvMenuOpen(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: isActive ? 'color-mix(in srgb, var(--accent-color) 15%, transparent)' : 'transparent',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--accent-color)' : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {conv.title || 'New Chat'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 14,
                          opacity: 0.5,
                        }}
                        title="Delete conversation"
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <MessageList onSuggestionClick={(text) => handleSend(text)} />
      <ToolConfirmDialog />
      <ContextBar
        inputTokens={sdkContextTotal || (contextUsage?.inputTokens ?? 0)}
        outputTokens={contextUsage?.outputTokens ?? 0}
        contextLimit={use1MContext ? 1000000 : (sdkContextMax || 200000)}
        cost={cumulativeCost}
        contextFiles={contextFiles}
      />
      <InputBox ref={inputBoxRef} onSend={handleSend} disabled={isStreaming} />
      <div className={styles.bottomBar}>
        <button
          className={styles.modelButton}
          onClick={() => setModelMenuOpen(!modelMenuOpen)}
          disabled={isStreaming}
        >
          <span>{currentModelLabel}</span>
          <span className={styles.modelButtonArrow}>{modelMenuOpen ? '▴' : '▾'}</span>
        </button>
        <button
          className={styles.modeButton}
          onClick={() => setModeMenuOpen(!modeMenuOpen)}
          disabled={isStreaming}
        >
          <span>{MODE_OPTIONS.find((m) => m.key === permissionMode)?.label || 'Default'}</span>
          <span className={styles.modelButtonArrow}>{modeMenuOpen ? '▴' : '▾'}</span>
        </button>
        {modeMenuOpen && (
          <>
            <div className={styles.modelMenuOverlay} onClick={() => setModeMenuOpen(false)} />
            <div className={styles.modelMenu}>
              {MODE_OPTIONS.map((opt) => {
                const isActive = opt.key === permissionMode;
                return (
                  <div
                    key={opt.key}
                    className={`${styles.modelMenuItem} ${isActive ? styles.modelMenuItemActive : ''} ${isStreaming ? styles.modelMenuItemDisabled : ''}`}
                    onClick={() => {
                      if (!isStreaming && opt.key !== permissionMode) {
                        setPermissionMode(opt.key);
                        setModeMenuOpen(false);
                        window.hicc.interrupt().catch(() => {});
                        window.hicc.startSession(activeModelKey, opt.key, effortLevel).catch(console.error);
                      }
                    }}
                  >
                    <div>
                      <div className={`${styles.modelMenuName} ${isActive ? styles.modelMenuNameActive : ''}`}>
                        {opt.label}
                      </div>
                    </div>
                    {isActive && (
                      <span className={styles.modelMenuCheck}>&#10003;</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <button
          className={styles.modeButton}
          onClick={() => setEffortMenuOpen(!effortMenuOpen)}
          disabled={isStreaming}
          title="Thinking depth"
        >
          {EFFORT_OPTIONS.find((e) => e.key === effortLevel)?.label || 'High'}
        </button>
        {effortMenuOpen && (
          <>
            <div className={styles.modelMenuOverlay} onClick={() => setEffortMenuOpen(false)} />
            <div className={styles.modelMenu} style={{ right: 180 }}>
              {EFFORT_OPTIONS.map((opt) => {
                const isActive = opt.key === effortLevel;
                return (
                  <div
                    key={opt.key}
                    className={`${styles.modelMenuItem} ${isActive ? styles.modelMenuItemActive : ''} ${isStreaming ? styles.modelMenuItemDisabled : ''}`}
                    onClick={() => {
                      if (!isStreaming && opt.key !== effortLevel) {
                        setEffortLevel(opt.key);
                        setEffortMenuOpen(false);
                        window.hicc.interrupt().catch(() => {});
                        window.hicc.startSession(activeModelKey, permissionMode, opt.key).catch(console.error);
                      }
                    }}
                  >
                    <div>
                      <div className={`${styles.modelMenuName} ${isActive ? styles.modelMenuNameActive : ''}`}>
                        {opt.label}
                      </div>
                    </div>
                    {isActive && (
                      <span className={styles.modelMenuCheck}>&#10003;</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <label
          className={styles.toggle}
          onClick={async () => {
            const newUse1M = !use1MContext;
            setUse1MContext(newUse1M);
            // Persist maxTokens to profile so new sessions pick it up
            if (activeProfile) {
              const updated = { ...activeProfile, maxTokens: newUse1M ? 1000000 : 200000 };
              updateProfileInStore(updated);
              try { await window.hicc.updateProfile(updated); } catch { /* ignore */ }
            }
          }}
          title="1M context window"
        >
          <div className={`${styles.toggleTrack} ${use1MContext ? styles.toggleTrackOn : ''}`}>
            <div className={styles.toggleKnob} />
          </div>
          1M
        </label>
        <div className={styles.spacer} />
        {pendingDiffs > 0 && (
          <button
            onClick={acceptAllDiffs}
            className={styles.acceptAllBtn}
          >
            Accept all ({pendingDiffs})
          </button>
        )}
        {elapsed > 0 && (
          <span className={styles.runtime}>
            {formatTime(elapsed)}
          </span>
        )}
        {isStreaming ? (
          <button className={styles.stopButton} onClick={handleStop} title="Stop generating" />
        ) : (
          <button
            className={styles.sendButton}
            onClick={() => inputBoxRef.current?.send()}
          >
            Send
          </button>
        )}
        {modelMenuOpen && (
          <>
            <div className={styles.modelMenuOverlay} onClick={() => setModelMenuOpen(false)} />
            <div className={styles.modelMenu}>
              {MODEL_OPTIONS.map((opt) => {
                const modelName = activeProfile
                  ? (opt.key === 'sonnet' ? activeProfile.sonnetModel :
                     opt.key === 'opus' ? activeProfile.opusModel :
                     activeProfile.smallFastModel) || activeProfile.model
                  : '';
                const isActive = opt.key === activeModelKey;
                return (
                  <div
                    key={opt.key}
                    className={`${styles.modelMenuItem} ${isActive ? styles.modelMenuItemActive : ''} ${isStreaming ? styles.modelMenuItemDisabled : ''}`}
                    onClick={() => {
                      if (!isStreaming) {
                        handleModelSwitch(opt.key);
                        setModelMenuOpen(false);
                      }
                    }}
                  >
                    <div>
                      <div className={`${styles.modelMenuName} ${isActive ? styles.modelMenuNameActive : ''}`}>
                        {opt.label}
                      </div>
                      {modelName && (
                        <div className={styles.modelMenuSub}>{modelName}</div>
                      )}
                    </div>
                    {isActive && (
                      <span className={styles.modelMenuCheck}>&#10003;</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function getConversationTitle(messages: { role: string; content: string }[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New Chat';
  return firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '');
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    requesting: 'Thinking...',
    idle: 'Ready',
    tool_completed_no_text: 'Tool completed',
    processing: 'Processing...',
  };
  return map[status] || status.replace(/_/g, ' ');
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default ChatPanel;
