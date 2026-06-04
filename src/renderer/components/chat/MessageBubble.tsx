import React, { useState, memo } from 'react';
import type { ChatMessage, ContentBlock, ToolCall } from '../../types';
import { useAppStore } from '../../store/app-store';
import MarkdownRenderer from './MarkdownRenderer';
import DiffPreview from './DiffPreview';
import styles from './MessageBubble.module.css';

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getMessageText(msg: ChatMessage): string {
  if (msg.content) return msg.content;
  return msg.contentBlocks
    .filter((b) => b.type === 'text')
    .map((b) => b.type === 'text' ? b.text : '')
    .join('\n');
}

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const hasError = !!message.error;
  const isStreaming = useAppStore((s) => s.isStreaming);

  // Show streaming indicator for empty assistant messages waiting for content
  if (!isUser && !hasError && (!message.contentBlocks || message.contentBlocks.length === 0) && !message.content && isStreaming) {
    return (
      <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
        <div className={`${styles.bubbleInner} ${styles.bubbleInnerAssistant}`}>
          <span className={styles.streamingIndicator}>
            <span className="spinner" /> AI is thinking...
          </span>
        </div>
      </div>
    );
  }

  // Assistant messages: render each content block as a separate section
  if (!isUser && !hasError && message.contentBlocks && message.contentBlocks.length > 0) {
    const hasTextContent = message.contentBlocks.some(
      (b) => b.type === 'text' && b.text.trim().length > 0,
    );
    return (
      <div className={styles.assistantBlocks}>
        {message.contentBlocks.map((block, i) => (
          <div key={i} className={styles.blockWrapper}>
            <ContentBlockRenderer block={block} isUser={false} />
          </div>
        ))}
        {hasTextContent && <MessageMetaWithCopy message={message} />}
      </div>
    );
  }

  return (
    <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}>
      <div style={{ position: 'relative' }}>
        <div className={`${styles.bubbleInner} ${isUser ? styles.bubbleInnerUser : styles.bubbleInnerAssistant} ${hasError ? styles.bubbleInnerError : ''}`}>
          {message.error ? (
            <ErrorContent error={message.error} messageId={message.id} />
          ) : message.contentBlocks && message.contentBlocks.length > 0 ? (
            <div className={styles.contentBlocks}>
              {message.contentBlocks.map((block, i) => (
                <ContentBlockRenderer key={i} block={block} isUser={isUser} />
              ))}
            </div>
          ) : (
            <MessageText text={message.content} isUser={isUser} />
          )}
        </div>
      </div>
      <MessageMeta message={message} isUser={isUser} />
    </div>
  );
};

const ActionsBar: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const retryFromMessage = useAppStore((s) => s.retryFromMessage);
  const startEditing = useAppStore((s) => s.startEditing);
  const editingMessageId = useAppStore((s) => s.editingMessageId);
  const cancelEditing = useAppStore((s) => s.cancelEditing);
  const editAndRetry = useAppStore((s) => s.editAndRetry);
  const [copied, setCopied] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const isEditing = editingMessageId === message.id && message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.actionsBar}>
      <button className={styles.actionButton} onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
      {message.role === 'user' && (
        <button className={styles.actionButton} onClick={() => { setEditText(message.content); startEditing(message.id); }}>
          Edit
        </button>
      )}
      <button className={styles.actionButton} onClick={() => retryFromMessage(message.id)}>
        Retry
      </button>
      {isEditing && (
        <div className={styles.editContainer} onClick={(e) => e.stopPropagation()}>
          <textarea
            className={styles.editTextarea}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                editAndRetry(message.id, editText);
              }
            }}
            autoFocus
            rows={3}
          />
          <div className={styles.editActions}>
            <button className={styles.editCancelBtn} onClick={cancelEditing}>Cancel</button>
            <button className={styles.editSendBtn} onClick={() => editAndRetry(message.id, editText)}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

const ErrorContent: React.FC<{ error: string; messageId: string }> = ({ error, messageId }) => {
  const retryFromMessage = useAppStore((s) => s.retryFromMessage);

  return (
    <div className={styles.errorBubble}>
      <div className={styles.errorText}>Error: {error}</div>
      <button className={styles.retryButton} onClick={() => retryFromMessage(messageId)}>
        Retry
      </button>
    </div>
  );
};

const ContentBlockRenderer: React.FC<{ block: ContentBlock; isUser: boolean }> = ({ block, isUser }) => {
  switch (block.type) {
    case 'text':
      return <MessageText text={block.text} isUser={isUser} complete={block.complete} />;
    case 'thinking':
      return <ThinkingBlock thinking={block.thinking} complete={block.complete} />;
    case 'tool_use':
      return <ToolUseBlock toolCall={block.toolCall} />;
    default:
      return null;
  }
};

const ThinkingBlock: React.FC<{ thinking: string; complete: boolean }> = ({ thinking, complete }) => {
  const [expanded, setExpanded] = useState(true);

  if (!thinking) {
    return (
      <div className={styles.thinkingHeader} style={{ cursor: 'default' }}>
        <span className={`spinner ${styles.thinkingSpinner}`} />
        <span className={styles.thinkingTitle}>Thinking...</span>
      </div>
    );
  }

  return (
    <div className={styles.thinkingBlock}>
      <div className={styles.thinkingHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.thinkingArrow}>{expanded ? '▼' : '▶'}</span>
        <span className={styles.thinkingTitle}>Thinking{complete ? '' : '...'}</span>
      </div>
      {expanded && (
        <div className={styles.thinkingContent}>{thinking}</div>
      )}
    </div>
  );
};

const ToolUseBlock: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  const isPending = toolCall.status === 'pending' || toolCall.status === 'executing';
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const hasOutput = !!(toolCall.stdout || toolCall.stderr);
  const acceptedDiffIds = useAppStore((s) => s.acceptedDiffIds);
  const acceptDiff = useAppStore((s) => s.acceptDiff);
  const diffAccepted = acceptedDiffIds.has(toolCall.id);

  const statusIcon = toolCall.status === 'executed' ? '✅' :
    toolCall.status === 'rejected' ? '🚫' :
    toolCall.status === 'error' ? '❌' : null;

  const statusLabel = toolCall.status === 'executing'
    ? `running ${'-'.repeat(((toolCall.elapsedSeconds || 0) % 4) + 1)} ${toolCall.elapsedSeconds || 0}s`
    : toolCall.status === 'executed' ? 'done'
    : toolCall.status === 'rejected' ? 'rejected'
    : toolCall.status === 'error' ? 'error'
    : 'pending';

  // Show file path for Write/Edit tools
  const filePath = (toolCall.name === 'Write' || toolCall.name === 'Edit')
    ? (toolCall.input as Record<string, unknown>).file_path as string | undefined
    : undefined;

  const inputPreview = JSON.stringify(toolCall.input, null, 1).slice(0, 200);

  return (
    <div className={styles.toolBlock}>
      <div className={styles.toolHeader} onClick={() => setBodyExpanded(!bodyExpanded)}>
        <span className={styles.toolArrow}>{bodyExpanded ? '▼' : '▶'}</span>
        {isPending ? (
          <span className={`spinner ${styles.toolSpinner}`} />
        ) : (
          <span>{statusIcon}</span>
        )}
        <span className={styles.toolName}>{toolCall.name}</span>
        {filePath && (
          <span className={styles.toolFilePath}>{filePath}</span>
        )}
        {toolCall.description && (
          <span className={styles.toolDesc}>{toolCall.description}</span>
        )}
        <span className={styles.toolStatus}>{statusLabel}</span>
      </div>
      {bodyExpanded && (
        <div className={styles.toolBody}>
          <div className={styles.toolInput}>{inputPreview}</div>
          {toolCall.summary && (
            <div className={styles.toolSummary}>{toolCall.summary}</div>
          )}
          {toolCall.stdout && (
            <div className={styles.toolStdout}>{toolCall.stdout}</div>
          )}
          {toolCall.stderr && (
            <div className={styles.toolStderr}>{toolCall.stderr}</div>
          )}
        </div>
      )}
      {!bodyExpanded && hasOutput && (
        <div className={styles.toolCollapsedHint}>Output hidden — click to expand</div>
      )}
      {toolCall.status === 'executed' && toolCall.newFilePath && (toolCall.name === 'Write' || toolCall.name === 'Edit') && !diffAccepted && (
        <DiffPreview
          filePath={toolCall.newFilePath}
          newContent={toolCall.input.content as string || toolCall.input.new_text as string || toolCall.stdout || ''}
          oldContent={toolCall.originalContent || ''}
          onAccept={() => acceptDiff(toolCall.id)}
          onReject={() => {
            if (toolCall.originalContent !== undefined && toolCall.newFilePath) {
              window.hicc.writeFile(toolCall.newFilePath, toolCall.originalContent).catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
};

const MessageText: React.FC<{ text: string; isUser: boolean; complete?: boolean }> = ({ text, isUser, complete }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLen = 300;
  const shouldCollapse = isUser && text.length > maxLen;

  // Extract selection blocks for compact card display
  const selectionMatch = text.match(/^--- Selection: (.+?) ---\n([\s\S]*?)\n--- End Selection ---/);

  if (isUser) {
    // Show selection as a compact card
    if (selectionMatch && !expanded) {
      const fileName = selectionMatch[1];
      const code = selectionMatch[2];
      const lines = code.split('\n');
      const actualText = text.replace(/^--- Selection: .+? ---\n[\s\S]*?\n--- End Selection ---\n\n/, '');
      return (
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          <div
            onClick={() => setExpanded(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.08)',
              cursor: 'pointer',
              fontSize: 12,
              marginBottom: actualText ? 6 : 0,
            }}
          >
            <span>📎</span>
            <span style={{ fontWeight: 500 }}>{fileName}</span>
            <span style={{ opacity: 0.5 }}>{lines.length} lines</span>
          </div>
          {actualText && (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{actualText}</div>
          )}
        </div>
      );
    }

    if (shouldCollapse && !expanded) {
      return (
        <div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.6 }}>
            {text.slice(0, maxLen)}...
          </div>
          <button
            onClick={() => setExpanded(true)}
            style={{
              padding: '2px 8px',
              marginTop: 4,
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Show all ({text.length.toLocaleString()} chars)
          </button>
        </div>
      );
    }
    if (shouldCollapse && expanded) {
      return (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.6 }}>
          {text}
        </div>
      );
    }
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.6 }}>{text}</div>;
  }
  return <MarkdownRenderer content={text} isUser={isUser} complete={complete} />;
};

// Keep old renderContent for backward compat if needed
function renderContent(text: string, isUser: boolean): React.ReactNode {
  return <MarkdownRenderer content={text} isUser={isUser} />;
}

const MessageMeta: React.FC<{ message: ChatMessage; isUser?: boolean }> = ({ message, isUser }) => {
  const [copied, setCopied] = useState(false);
  const hasTokens = (message.inputTokens ?? 0) > 0 || (message.outputTokens ?? 0) > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getMessageText(message));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.messageMeta} style={isUser ? { justifyContent: 'flex-end' } : undefined}>
      <button
        onClick={handleCopy}
        className={styles.metaCopyBtn}
        title="Copy message"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
      {hasTokens && (
        <span className={styles.tokenInfo}>
          ↑{formatTokens(message.inputTokens ?? 0)} ↓{formatTokens(message.outputTokens ?? 0)}
        </span>
      )}
    </div>
  );
};

const MessageMetaWithCopy: React.FC<{ message: ChatMessage; isUser?: boolean }> = ({ message, isUser }) => (
  <MessageMeta message={message} isUser={isUser} />
);

export default memo(MessageBubble);
