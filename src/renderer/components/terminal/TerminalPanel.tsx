import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAppStore } from '../../store/app-store';
import 'xterm/css/xterm.css';

const TerminalPanel: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon>(new FitAddon());
  const terminalId = useRef<string | null>(null);
  const projectPath = useAppStore((s) => s.projectPath);

  useEffect(() => {
    if (!terminalRef.current || !projectPath) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
      },
    });

    term.loadAddon(fitAddon.current);
    term.open(terminalRef.current);
    fitAddon.current.fit();

    terminal.current = term;

    // Create PTY session
    window.hicc.createTerminal(projectPath).then((id) => {
      terminalId.current = id;
    });

    // Forward user input to PTY
    term.onData((data) => {
      if (terminalId.current) {
        window.hicc.writeToTerminal(terminalId.current, data);
      }
    });

    // Display PTY output
    window.hicc.onTerminalData((data) => {
      if (data.id === terminalId.current) {
        term.write(data.data);
      }
    });

    const handleResize = () => {
      fitAddon.current.fit();
      if (terminalId.current && term.cols && term.rows) {
        window.hicc.resizeTerminal(terminalId.current, term.cols, term.rows);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [projectPath]);

  if (!projectPath) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}>
        Open a project to use the terminal
      </div>
    );
  }

  return <div ref={terminalRef} style={{ height: '100%' }} />;
};

export default TerminalPanel;
