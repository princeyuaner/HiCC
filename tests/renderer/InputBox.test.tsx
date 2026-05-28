import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InputBox from '../../src/renderer/components/chat/InputBox';

describe('InputBox', () => {
  it('renders input and send button', () => {
    render(<InputBox onSend={vi.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText(/Describe what you want to build/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
  });

  it('calls onSend when clicking send button', async () => {
    const onSend = vi.fn();
    render(<InputBox onSend={onSend} disabled={false} />);
    const input = screen.getByPlaceholderText(/Describe what you want to build/);
    await userEvent.type(input, 'Build a todo app');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Build a todo app');
  });

  it('disables button when input is empty', () => {
    render(<InputBox onSend={vi.fn()} disabled={false} />);
    const button = screen.getByRole('button', { name: 'Send' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends on Enter key press', async () => {
    const onSend = vi.fn();
    render(<InputBox onSend={onSend} disabled={false} />);
    const input = screen.getByPlaceholderText(/Describe what you want to build/);
    await userEvent.type(input, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
});
