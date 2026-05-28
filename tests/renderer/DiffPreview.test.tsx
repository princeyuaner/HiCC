import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiffPreview from '../../src/renderer/components/chat/DiffPreview';

describe('DiffPreview', () => {
  it('renders file path and line counts', () => {
    render(
      <DiffPreview
        filePath="src/app.ts"
        newContent="const x = 1;\nconst y = 2;"
        oldContent="const x = 0;"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('src/app.ts')).toBeDefined();
  });

  it('calls onAccept when Accept button is clicked', async () => {
    const onAccept = vi.fn();
    render(
      <DiffPreview
        filePath="test.ts"
        newContent="hello"
        onAccept={onAccept}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalled();
  });

  it('calls onReject when Reject button is clicked', async () => {
    const onReject = vi.fn();
    render(
      <DiffPreview
        filePath="test.ts"
        newContent="hello"
        onAccept={vi.fn()}
        onReject={onReject}
      />
    );
    await userEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalled();
  });
});
