import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InputBox from '../../src/renderer/components/chat/InputBox';

describe('InputBox', () => {
  it('renders textarea input', () => {
    render(<InputBox onSend={vi.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText(/Describe what you want to build/)).toBeDefined();
  });

  it('sends on Enter key press', async () => {
    const onSend = vi.fn();
    render(<InputBox onSend={onSend} disabled={false} />);
    const input = screen.getByPlaceholderText(/Describe what you want to build/);
    await userEvent.type(input, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hello', undefined);
  });

  it('does not send when disabled', async () => {
    const onSend = vi.fn();
    render(<InputBox onSend={onSend} disabled={true} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Hello{Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('auto-resizes textarea', async () => {
    render(<InputBox onSend={vi.fn()} disabled={false} />);
    const input = screen.getByPlaceholderText(/Describe what you want to build/);
    const initialHeight = (input as HTMLTextAreaElement).style.height;
    await userEvent.type(input, 'Line 1\nLine 2\nLine 3\nLine 4');
    // auto-resize should have set a height
    expect((input as HTMLTextAreaElement).style.height).not.toBe(initialHeight);
  });
});
