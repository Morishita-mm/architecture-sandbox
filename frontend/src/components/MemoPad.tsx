import React from 'react';
import { BiNotepad, BiChevronRight } from 'react-icons/bi';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}

export const MemoPad: React.FC<Props> = ({ value, onChange, onClose }) => {
  return (
    <aside className="memo-pad" style={containerStyle} aria-label="要件メモ">
      <div className="side-panel-heading" style={headerStyle}>
        <span><BiNotepad /> 要件メモ</span>
        <button className="panel-close-button" onClick={onClose} aria-label="要件メモを閉じる" title="要件メモを閉じる"><BiChevronRight size={20} /></button>
      </div>
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
