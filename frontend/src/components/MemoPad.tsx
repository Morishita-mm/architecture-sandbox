import React from 'react';
import { BiNotepad } from 'react-icons/bi';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export const MemoPad: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <BiNotepad style={{ marginRight: '8px', color: '#5d4037' }} />
        要件メモ</div>
      <textarea
        style={textAreaStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ヒアリングした要件をここにメモしましょう&#13;&#10;・予算：〇〇&#13;&#10;・ピークタイム：〇〇"
      />
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  width: '250px', // サイドバーと同じくらいの幅
  backgroundColor: '#fff8e1', // メモっぽい色（薄い黄色）
  borderLeft: '1px solid #ddd',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const headerStyle: React.CSSProperties = {
  padding: '10px',
  fontWeight: 'bold',
  backgroundColor: '#ffecb3',
  color: '#5d4037',
  borderBottom: '1px solid #ffe082',
};

const textAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  border: 'none',
  resize: 'none',
  backgroundColor: 'transparent',
  outline: 'none',
  fontSize: '14px',
  lineHeight: '1.5',
  fontFamily: 'inherit',
};