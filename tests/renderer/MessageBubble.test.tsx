import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../../src/renderer/components/chat/MessageBubble';
import type { ChatMessage } from '../../src/renderer/types';

function makeMsg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: '1',
    role: 'user',
    content: '',
    contentBlocks: [],
    timestamp: 0,
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('renders user message', () => {
    render(<MessageBubble message={makeMsg({ role: 'user', content: 'Hello' })} />);
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('renders assistant message', () => {
    render(<MessageBubble message={makeMsg({ role: 'assistant', content: 'Hi there' })} />);
    expect(screen.getByText('Hi there')).toBeDefined();
  });

  it('renders code blocks', () => {
    render(<MessageBubble message={makeMsg({ role: 'assistant', content: 'Here is code:\n```\nconst x = 1;\n```' })} />);
    const container = document.body;
    expect(container.querySelector('pre')).toBeDefined();
    expect(container.querySelector('code')?.textContent).toContain('const x = 1');
  });

  it('renders inline code', () => {
    render(<MessageBubble message={makeMsg({ role: 'assistant', content: 'Use `const` keyword' })} />);
    const container = document.body;
    expect(container.querySelector('code')?.textContent).toBe('const');
  });

  it('renders thinking block', () => {
    const msg = makeMsg({
      role: 'assistant',
      content: '',
      contentBlocks: [
        { type: 'thinking', thinking: 'Let me think...', blockIndex: 0, complete: true },
        { type: 'text', text: 'Here is the answer', blockIndex: 1, complete: true },
      ],
    });
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.textContent).toContain('Thinking');
  });
});
