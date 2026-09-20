import { useRef, type PointerEvent } from 'react';

export function PanelResizeHandle({ side, label, width, onResize }: {
  side: 'left' | 'right'; label: string; width: number; onResize: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const clamp = (width: number) => Math.max(200, Math.min(480, window.innerWidth * .35, width));
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className={`panel-resize-handle panel-resize-${side}`} role="separator" tabIndex={0}
    aria-label={`${label}の幅を調整`} aria-orientation="vertical"
    aria-valuemin={200} aria-valuemax={Math.min(480, window.innerWidth * .35)} aria-valuenow={clamp(width)}
    title="ドラッグまたは左右の矢印キーで幅を調整"
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus();
      drag.current = { x: event.clientX, width: event.currentTarget.parentElement!.getBoundingClientRect().width };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      onResize(clamp(drag.current.width + (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1)));
    }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const width = event.currentTarget.parentElement!.getBoundingClientRect().width;
      const delta = (event.key === 'ArrowRight' ? 20 : -20) * (side === 'left' ? 1 : -1);
      onResize(clamp(event.key === 'Home' ? 200 : event.key === 'End' ? 480 : width + delta));
    }} />;
}
