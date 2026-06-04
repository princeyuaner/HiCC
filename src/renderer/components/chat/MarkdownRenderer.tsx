import React, { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppStore } from '../../store/app-store';
import styles from './MarkdownRenderer.module.css';

interface MarkdownRendererProps {
  content: string;
  isUser: boolean;
  complete?: boolean;
}

const CodeBlock: React.FC<{ language: string; code: string; isUser: boolean }> = memo(({ language, code, isUser }) => {
  const [copied, setCopied] = useState(false);
  const activeTab = useAppStore((s) => s.activeTab);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleApply = useCallback(async () => {
    if (activeTab) {
      try {
        await window.hicc.writeFile(activeTab, code);
      } catch {
        // fallback to copy
      }
    }
    await navigator.clipboard.writeText(code);
  }, [code, activeTab]);

  return (
    <div className={styles.codeBlockWrapper}>
      {language && <div className={styles.codeLang}>{language}</div>}
      <div className={styles.codeBlockActions}>
        <button onClick={handleCopy} className={styles.codeActionBtn}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {!isUser && (
          <button onClick={handleApply} className={styles.codeActionBtn}>
            Apply
          </button>
        )}
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: language ? '0 0 4px 4px' : '4px',
          fontSize: '13px',
          background: isUser ? 'rgba(255,255,255,0.1)' : 'var(--bg-primary)',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

function isFilePath(text: string): boolean {
  return /\.(tsx?|jsx?|py|rs|go|java|html|css|json|md|yml|yaml|toml|xml)$/i.test(text)
    && /[/\\]/.test(text);
}

function getFileName(text: string): string {
  return text.split(/[/\\]/).pop() || text;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser, complete = true }) => {
  // Render plain text during streaming to avoid O(n²) markdown parsing
  if (!complete && !isUser) {
    return (
      <div className={`${styles.root} ${styles.assistant}`}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${isUser ? styles.user : styles.assistant}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeText = String(children).replace(/\n$/, '');
            const isInline = !match && !String(children).includes('\n');
            if (isInline) {
              const codeStr = String(children).trim();
              if (isFilePath(codeStr)) {
                return (
                  <span
                    className={`${styles.inlineCode} ${isUser ? styles.inlineCodeUser : styles.inlineCodeAssistant} ${styles.clickablePath}`}
                    onClick={() => {
                      const name = getFileName(codeStr);
                      useAppStore.getState().openFile(codeStr, name);
                    }}
                    title={`Open ${codeStr}`}
                  >
                    {children}
                  </span>
                );
              }
              return (
                <code className={`${styles.inlineCode} ${isUser ? styles.inlineCodeUser : styles.inlineCodeAssistant}`} {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match ? match[1] : ''} code={codeText} isUser={isUser} />;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {children}
              </a>
            );
          },
          table({ children }) {
            return <table className={styles.table}>{children}</table>;
          },
          th({ children }) {
            return <th className={styles.th}>{children}</th>;
          },
          td({ children }) {
            return <td className={styles.td}>{children}</td>;
          },
          blockquote({ children }) {
            return <blockquote className={styles.blockquote}>{children}</blockquote>;
          },
          ul({ children }) {
            return <ul className={styles.ul}>{children}</ul>;
          },
          ol({ children }) {
            return <ol className={styles.ol}>{children}</ol>;
          },
          li({ children }) {
            return <li className={styles.li}>{children}</li>;
          },
          h1({ children }) {
            return <h1 className={styles.h1}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 className={styles.h2}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 className={styles.h3}>{children}</h3>;
          },
          p({ children }) {
            return <p className={styles.p}>{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default memo(MarkdownRenderer);
