import React, { memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import styles from './MessageBubble.module.css';

interface ToolOutputRendererProps {
  stdout?: string;
  stderr?: string;
  isImage?: boolean;
  toolName?: string;
}

/** Strip ANSI escape sequences (SGR colors, cursor movement, etc.) */
function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][0-9;]*[^\x07]*\x07/g, '');
}

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i;

/** Check if stdout looks like an image path or data URL */
function isImageOutput(text: string, isImage?: boolean): boolean {
  if (isImage) return true;
  if (text.startsWith('data:image/')) return true;
  // Single-line path to an image file
  const trimmed = text.trim();
  if (!trimmed.includes('\n') && IMAGE_EXTENSIONS.test(trimmed)) return true;
  return false;
}

/** Check if text looks like a unified diff */
function isDiffOutput(text: string): boolean {
  const lines = text.split('\n');
  let hunkCount = 0;
  let headerCount = 0;
  for (const line of lines) {
    if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)) hunkCount++;
    if (/^(---|\+\+\+) /.test(line)) headerCount++;
  }
  return hunkCount >= 1 || (headerCount >= 2);
}

/** Parse unified diff lines into typed segments */
function parseDiffLines(
  text: string,
): Array<{ type: 'add' | 'remove' | 'header' | 'same'; content: string }> {
  return text.split('\n').map((line) => {
    if (line.startsWith('@@')) return { type: 'header', content: line };
    if (line.startsWith('+')) return { type: 'add', content: line };
    if (line.startsWith('-')) return { type: 'remove', content: line };
    return { type: 'same', content: line };
  });
}

/** Heuristic language detection for code blocks */
function detectLanguage(text: string, toolName?: string): string {
  // Tool-based hints
  if (toolName === 'Bash') return 'bash';
  if (toolName === 'Read') {
    // Guess from content
    if (/\b(const|let|function|import|export|interface|type)\b/.test(text.slice(0, 500))) return 'typescript';
    if (/\b(def |class |import |from )\b/.test(text.slice(0, 500))) return 'python';
    if (/\b(fn |let |mut |impl |struct )\b/.test(text.slice(0, 500))) return 'rust';
  }
  // Content-based detection
  const head = text.slice(0, 1000);
  if (/^(import |export |const |let |function |interface |type )/m.test(head)) return 'typescript';
  if (/^(def |class |import |from |#!\/)/m.test(head)) return 'python';
  if (/^(package |import |public |private |class )/m.test(head)) return 'java';
  if (/^(use |fn |mod |pub |impl )/m.test(head)) return 'rust';
  if (/^(package |import |func |fmt\.)/m.test(head)) return 'go';
  if (/^{/.test(head) && /:\s*\{/.test(head)) return 'css';
  if (/^[<{[]/.test(head) || /^\s*"/.test(head)) return 'json';
  return 'text';
}

/** Check if text looks like structured code rather than prose */
function looksLikeCode(text: string): boolean {
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  const codeIndicators = [
    /[{};]\s*$/m,          // semicolons or braces at line end
    /^\s{2,}\S/m,          // significant indentation
    /^(import|export|const|let|var|function|class|def|package|use|fn|pub)\s/m,
    /^\s*\/[/\*]/,          // comments
    /^[\]}\)]\,?\s*$/m,     // closing brackets/parens
  ];
  return codeIndicators.some((r) => r.test(text));
}

const CODE_MAX_CHARS = 3000;

const ToolOutputRenderer: React.FC<ToolOutputRendererProps> = ({
  stdout,
  stderr,
  isImage,
  toolName,
}) => {
  if (!stdout && !stderr) return null;

  const cleanStdout = stdout ? stripAnsi(stdout) : '';
  const cleanStderr = stderr ? stripAnsi(stderr) : '';

  // --- Image rendering ---
  if (cleanStdout && isImageOutput(cleanStdout, isImage)) {
    let src = cleanStdout.trim();
    // If it looks like a base64 string without data URL prefix
    if (!src.startsWith('data:') && !src.startsWith('http') && !/^[A-Za-z]:[/\\]/.test(src) && !src.startsWith('/')) {
      src = `data:image/png;base64,${src}`;
    }
    // Convert Windows paths to file:// URLs
    if (/^[A-Za-z]:[/\\]/.test(src)) {
      src = 'file:///' + src.replace(/\\/g, '/');
    }
    return (
      <div className={styles.toolOutputImage}>
        <img
          src={src}
          alt="Tool output image"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // --- Diff rendering ---
  if (cleanStdout && isDiffOutput(cleanStdout)) {
    const diffLines = parseDiffLines(cleanStdout);
    return (
      <div className={styles.toolOutputDiff}>
        {diffLines.map((d, i) => (
          <div
            key={i}
            className={`${styles.toolOutputDiffLine} ${
              d.type === 'add'
                ? styles.toolOutputDiffAdd
                : d.type === 'remove'
                  ? styles.toolOutputDiffRemove
                  : d.type === 'header'
                    ? styles.toolOutputDiffHeader
                    : ''
            }`}
          >
            {d.content}
          </div>
        ))}
      </div>
    );
  }

  // --- Code rendering ---
  const renderCode = (code: string, label: string) => {
    const isCode = looksLikeCode(code);
    const isLong = code.length > CODE_MAX_CHARS;
    if (isCode && !isLong) {
      const lang = detectLanguage(code, toolName);
      return (
        <div className={styles.toolOutputCode}>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={lang}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: '4px',
              fontSize: '12px',
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }
    // Plain text fallback
    return (
      <div className={styles.toolOutputCode}>
        <pre className={styles.toolOutputPlain}>{code}</pre>
      </div>
    );
  };

  return (
    <>
      {cleanStdout && renderCode(cleanStdout, 'stdout')}
      {cleanStderr && (
        <div className={styles.toolStderr}>{cleanStderr}</div>
      )}
    </>
  );
};

export default memo(ToolOutputRenderer);
