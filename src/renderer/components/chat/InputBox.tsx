import React, { useState, useRef, useCallback, KeyboardEvent, forwardRef, useImperativeHandle, DragEvent, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/app-store';
import type { FileNode, Attachment } from '../../types';
import AttachmentPill from './AttachmentPill';
import FileMentionDropdown from './FileMentionDropdown';
import styles from './InputBox.module.css';

interface InputBoxProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  disabled: boolean;
}

export interface InputBoxHandle {
  send: () => void;
}

const InputBox = forwardRef<InputBoxHandle, InputBoxProps>(({ onSend, disabled }, ref) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mention, setMention] = useState<{ active: boolean; query: string; position: number; index: number }>({ active: false, query: '', position: 0, index: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileTree = useAppStore((s) => s.fileTree);
  const pendingSelectionCommand = useAppStore((s) => s.pendingSelectionCommand);
  const setPendingSelectionCommand = useAppStore((s) => s.setPendingSelectionCommand);
  const pendingAttachment = useAppStore((s) => s.pendingAttachment);
  const setPendingAttachment = useAppStore((s) => s.setPendingAttachment);
  const pendingFiles = useAppStore((s) => s.pendingFiles);
  const setPendingFiles = useAppStore((s) => s.setPendingFiles);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const chatDrafts = useAppStore((s) => s.chatDrafts);
  const setChatDraft = useAppStore((s) => s.setChatDraft);
  const clearChatDraft = useAppStore((s) => s.clearChatDraft);
  const enqueueMessage = useAppStore((s) => s.enqueueMessage);
  const queuedMessages = useAppStore((s) => s.queuedMessages);
  const removeQueuedMessage = useAppStore((s) => s.removeQueuedMessage);
  const clearQueuedMessages = useAppStore((s) => s.clearQueuedMessages);
  const [queueExpanded, setQueueExpanded] = useState(false);

  // Restore draft when switching conversations
  useEffect(() => {
    if (activeConversationId) {
      const draft = chatDrafts[activeConversationId] || '';
      setInput(draft);
      setAttachments([]);
    } else {
      setInput('');
      setAttachments([]);
    }
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for editor selection commands
  useEffect(() => {
    if (pendingSelectionCommand) {
      setInput(pendingSelectionCommand);
      setPendingSelectionCommand(null);
      textareaRef.current?.focus();
    }
  }, [pendingSelectionCommand, setPendingSelectionCommand]);

  // Watch for editor selection attachments
  useEffect(() => {
    if (pendingAttachment) {
      setAttachments((prev) => [...prev, pendingAttachment]);
      setPendingAttachment(null);
      textareaRef.current?.focus();
    }
  }, [pendingAttachment, setPendingAttachment]);

  // Watch for files from context bar
  useEffect(() => {
    if (pendingFiles.length > 0) {
      for (const filePath of pendingFiles) {
        const fileName = filePath.split(/[\\/]/).pop() || filePath;
        setAttachments((prev) => {
          if (prev.some((a) => a.filePath === filePath)) return prev;
          return [...prev, { filePath, fileName, type: 'file' as const }];
        });
      }
      setPendingFiles([]);
      textareaRef.current?.focus();
    }
  }, [pendingFiles, setPendingFiles]);

  // Input history
  const historyIndexRef = useRef(-1);
  const historyCacheRef = useRef('');
  const messages = useAppStore((s) => s.messages);
  const lastUserMessages = useMemo(() =>
    messages.filter((m) => m.role === 'user').map((m) => m.content),
  [messages]);

  // Slash commands
  const availableCommands = useAppStore((s) => s.availableCommands);
  const setAvailableCommands = useAppStore((s) => s.setAvailableCommands);
  const [slashActive, setSlashActive] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const commandsFetchedRef = useRef(false);

  // Fetch commands from SDK on first slash activation
  const fetchCommandsFromSdk = useCallback(async () => {
    if (commandsFetchedRef.current) return;
    commandsFetchedRef.current = true;
    try {
      const sdkCommands = await window.hicc.getCommands();
      if (sdkCommands && sdkCommands.length > 0) {
        setAvailableCommands(sdkCommands);
      }
    } catch {
      // keep default commands on error
    }
  }, [setAvailableCommands]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus after losing focus (keep input always active)
  // Re-focus after sending
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (disabled) {
      // Queue the message instead of dropping it
      enqueueMessage(trimmed, attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
      if (activeConversationId) clearChatDraft(activeConversationId);
      historyIndexRef.current = -1;
      historyCacheRef.current = '';
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
      return;
    }

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setInput('');
    setAttachments([]);
    if (activeConversationId) clearChatDraft(activeConversationId);
    historyIndexRef.current = -1;
    historyCacheRef.current = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [input, disabled, onSend, attachments, activeConversationId, clearChatDraft, enqueueMessage]);

  useImperativeHandle(ref, () => ({ send: handleSend }), [handleSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash command navigation
    if (slashActive) {
      const filtered = availableCommands.filter(
        (c) => c.name.startsWith(slashQuery) || (c.aliases || []).some((a) => a.startsWith(slashQuery))
      );
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashActive(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[slashIndex]) {
          setInput('/' + filtered[slashIndex].name + ' ');
          setSlashActive(false);
        }
        return;
      }
      return;
    }

    // Mention navigation
    if (mention.active) {
      const files = getFilteredFiles(mention.query);
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention({ active: false, query: '', position: 0, index: 0 });
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMention((m) => ({ ...m, index: Math.min(m.index + 1, files.length - 1) }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMention((m) => ({ ...m, index: Math.max(m.index - 1, 0) }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (files[mention.index]) {
          handleMentionSelect(files[mention.index].path, files[mention.index].name);
        }
        return;
      }
      return;
    }

    // History navigation
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && lastUserMessages.length > 0) {
      e.preventDefault();
      const currentIdx = historyIndexRef.current;
      let newIdx: number;
      if (e.key === 'ArrowUp') {
        if (currentIdx === -1) {
          historyCacheRef.current = input;
          newIdx = lastUserMessages.length - 1;
        } else {
          newIdx = Math.max(0, currentIdx - 1);
        }
      } else {
        newIdx = currentIdx === -1 ? -1 : Math.min(lastUserMessages.length - 1, currentIdx + 1);
      }
      historyIndexRef.current = newIdx;
      const text = newIdx === -1 ? historyCacheRef.current : lastUserMessages[newIdx];
      setInput(text);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = text.length;
          textareaRef.current.selectionEnd = text.length;
        }
      }, 0);
      return;
    }

    // Reset history when typing (not arrows)
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
      historyIndexRef.current = -1;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getFilteredFiles = (query: string): FileNode[] => {
    if (!fileTree) return [];
    const attachedPaths = new Set(attachments.map((a) => a.filePath));
    const q = query.toLowerCase();
    const results: FileNode[] = [];
    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (attachedPaths.has(node.path)) continue;
        if (!q || node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
          results.push(node);
        }
        if (node.children) walk(node.children);
      }
    };
    walk(fileTree);
    return q ? results : results.slice(0, 50);
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    if (activeConversationId) setChatDraft(activeConversationId, value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';

    // Check for slash command
    const slashMatch = value.match(/^\/(\S*)$/);
    if (slashMatch) {
      const query = slashMatch[1].toLowerCase();
      const filtered = availableCommands.filter(
        (c) => c.name.startsWith(query) || (c.aliases || []).some((a) => a.startsWith(query))
      );
      if (filtered.length > 0) {
        setSlashActive(true);
        setSlashQuery(query);
        setSlashIndex(0);
      } else {
        setSlashActive(false);
      }
    } else {
      setSlashActive(false);
    }

    // Trigger SDK command fetch on first slash use
    if (slashMatch && availableCommands.length <= 32) {
      fetchCommandsFromSdk();
    }

    // Check for @-mention
    const cursorPos = el.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setMention({ active: true, query: atMatch[1], position: cursorPos, index: 0 });
    } else {
      setMention({ active: false, query: '', position: 0, index: 0 });
    }
  };

  const handleMentionSelect = (filePath: string, fileName: string) => {
    const cursorPos = mention.position;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    const newText = textBefore.slice(0, atIdx) + textAfter;
    setInput(newText);
    setAttachments((prev) => [...prev, { filePath, fileName, type: 'file' as const }]);
    setMention({ active: false, query: '', position: 0, index: 0 });
    textareaRef.current?.focus();
  };

  const handleRemoveAttachment = (filePath: string) => {
    setAttachments((prev) => prev.filter((a) => a.filePath !== filePath));
  };

  const handleAttachFiles = async () => {
    const filePaths = await window.hicc.openFiles();
    for (const filePath of filePaths) {
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      if (!attachments.some((a) => a.filePath === filePath)) {
        setAttachments((prev) => [...prev, { filePath, fileName, type: 'file' as const }]);
      }
    }
  };

  // Drag and drop handlers
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          try {
            const filePath = await window.hicc.writeBinaryFile(dataUrl);
            const fileName = filePath.split(/[\\/]/).pop() || 'image.png';
            setAttachments((prev) => [...prev, { filePath, fileName, type: 'file' as const, thumbnailDataUrl: dataUrl }]);
          } catch {
            // fallback: use data URL directly
            setAttachments((prev) => [...prev, {
              filePath: dataUrl,
              fileName: `image-${Date.now()}.png`,
              type: 'file' as const,
              thumbnailDataUrl: dataUrl,
            }]);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const newAttachments: Attachment[] = [];

    const hiccFile = e.dataTransfer?.getData('application/x-hicc-file');
    if (hiccFile) {
      const fileName = hiccFile.split(/[\\/]/).pop() || hiccFile;
      newAttachments.push({ filePath: hiccFile, fileName, type: 'file' });
    }

    const files = e.dataTransfer?.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // For image files, read as data URL for thumbnail preview
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const filePath = (file as File & { path?: string }).path || dataUrl;
            setAttachments((prev) => [...prev, { filePath, fileName: file.name, type: 'file' as const, thumbnailDataUrl: dataUrl }]);
          };
          reader.readAsDataURL(file);
        } else {
          newAttachments.push({
            filePath: (file as File & { path?: string }).path || '',
            fileName: file.name,
            type: 'file',
          });
        }
      }
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const filteredFiles = mention.active ? getFilteredFiles(mention.query) : [];

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isDragOver ? styles.dropIndicator : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div style={{
          textAlign: 'center',
          padding: '4px 0 8px',
          color: 'var(--accent-color)',
          fontSize: 13,
          fontWeight: 500,
        }}>
          Drop files to reference
        </div>
      )}
      {attachments.length > 0 && (
        <div className={styles.attachmentArea}>
          {attachments.map((att) => (
            <AttachmentPill
              key={att.filePath}
              filePath={att.filePath}
              fileName={att.fileName}
              content={att.content}
              language={att.language}
              thumbnailDataUrl={att.thumbnailDataUrl}
              onRemove={() => handleRemoveAttachment(att.filePath)}
            />
          ))}
        </div>
      )}
      {disabled && queuedMessages.length > 0 && (
        <div className={styles.queuePanel}>
          <div
            className={styles.queueHeader}
            onClick={() => setQueueExpanded(!queueExpanded)}
          >
            <span className={styles.queueArrow}>{queueExpanded ? '▼' : '▶'}</span>
            <span>{queuedMessages.length} message(s) queued</span>
            <button
              className={styles.queueClearAll}
              onClick={(e) => { e.stopPropagation(); clearQueuedMessages(); setQueueExpanded(false); }}
              title="Clear all queued messages"
            >
              Clear all
            </button>
          </div>
          {queueExpanded && (
            <div className={styles.queueList}>
              {queuedMessages.map((msg, i) => (
                <div key={i} className={styles.queueItem}>
                  <span className={styles.queueIndex}>{i + 1}</span>
                  <span className={styles.queuePreview}>{msg.text.slice(0, 80)}{msg.text.length > 80 ? '…' : ''}</span>
                  <button
                    className={styles.queueRemove}
                    onClick={() => { removeQueuedMessage(i); if (queuedMessages.length <= 1) setQueueExpanded(false); }}
                    title="Remove from queue"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={disabled
            ? queuedMessages.length > 0
              ? `AI is responding... (${queuedMessages.length} message(s) queued, Enter to queue more)`
              : "AI is responding... (Enter to queue message, type to draft)"
            : "Describe what you want to build... (Enter to send, Shift+Enter for new line, @ to reference files)"}
          rows={3}
        />
        {mention.active && (
          <FileMentionDropdown
            files={filteredFiles}
            selectedIndex={mention.index}
            onSelect={handleMentionSelect}
            position={{ top: -Math.min(Math.max(filteredFiles.length, 1) * 32, 200) - 8, left: 0 }}
          />
        )}
        {slashActive && (() => {
          const filtered = availableCommands.filter(
            (c) => c.name.startsWith(slashQuery) || (c.aliases || []).some((a) => a.startsWith(slashQuery))
          );
          if (filtered.length === 0) return null;
          return (
            <div className={styles.slashDropdown}>
              {filtered.map((cmd, i) => (
                <div
                  key={cmd.name}
                  className={`${styles.slashItem} ${i === slashIndex ? styles.slashItemActive : ''}`}
                  onClick={() => {
                    setInput('/' + cmd.name + ' ');
                    setSlashActive(false);
                    textareaRef.current?.focus();
                  }}
                  onMouseEnter={() => setSlashIndex(i)}
                >
                  <span className={styles.slashCmd}>/{cmd.name}{cmd.argumentHint ? ` ${cmd.argumentHint}` : ''}</span>
                  <span className={styles.slashDesc}>{cmd.description}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
});

InputBox.displayName = 'InputBox';

export default InputBox;
