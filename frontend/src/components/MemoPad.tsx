import React from 'react';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export const MemoPad: React.FC<Props> = ({ value, onChange }) => {
  return (
    <aside className="memo-pad" style={containerStyle} aria-label="要件メモ" tabIndex={-1}>
      <h2 className="side-panel-heading" style={headerStyle}>要件メモ</h2>
      <textarea
        aria-label="要件メモ"
        style={textAreaStyle}
        maxLength={100000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ヒアリングした要件をここにメモしましょう&#13;&#10;・予算：〇〇&#13;&#10;・ピークタイム：〇〇"
      />
    </aside>
  );
};

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  backgroundColor: 'var(--app-note)', // メモっぽい色（薄い黄色）
  borderLeft: '1px solid var(--app-border)',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  padding: '8px 12px 8px 16px',
  fontWeight: 'bold',
  backgroundColor: 'var(--app-note-header)',
  color: '#736344',
  borderBottom: '1px solid #e9e0c4',
};

const textAreaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  padding: '14px 16px',
  border: 'none',
  resize: 'none',
  backgroundColor: 'transparent',
  fontSize: '14px',
  lineHeight: '1.8',
  fontFamily: 'inherit',
};
