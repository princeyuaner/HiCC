import React, { useState, useCallback, useRef } from 'react';

interface PanelProps {
  children: React.ReactNode;
  defaultHeight?: number;
  minHeight?: number;
}

const Panel: React.FC<PanelProps> = ({ children, defaultHeight = 300, minHeight = 100 }) => {
  const [height, setHeight] = useState(defaultHeight);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(minHeight, startHeight.current + delta);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, minHeight]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 4,
          background: 'var(--border-color)',
          cursor: 'row-resize',
          flexShrink: 0,
        }}
      />
      <div style={{ height, overflow: 'hidden', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
};

export default Panel;
