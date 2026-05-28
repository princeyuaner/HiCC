import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../../src/renderer/components/chat/MessageBubble';

describe('MessageBubble', () => {
  it('renders user message', () => {
    const msg = { id: '1', role: 'user' as const, content: 'Hello', timestamp: 0 };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('You')).toBeDefined();
  });

  it('renders assistant message', () => {
    const msg = { id: '2', role: 'assistant' as const, content: 'Hi there', timestamp: 0 };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('Hi there')).toBeDefined();
    expect(screen.getByText('Claude')).toBeDefined();
  });

  it('renders code blocks', () => {
    const msg = { id: '3', role: 'assistant' as const, content: 'Here is code:\n```\nconst x = 1;\n```', timestamp: 0 };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('pre')).toBeDefined();
    expect(container.querySelector('code')?.textContent).toContain('const x = 1');
  });

  it('renders inline code', () => {
    const msg = { id: '4', role: 'assistant' as const, content: 'Use `const` keyword', timestamp: 0 };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('code')?.textContent).toBe('const');
  });
});
