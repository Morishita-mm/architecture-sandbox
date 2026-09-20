import { BiSun, BiMoon } from 'react-icons/bi';
import { setThemeMode, useThemeMode } from '../utils/theme';

const labels = { light: 'ライト', dark: 'ダーク' };
const icons = { light: BiSun, dark: BiMoon };

export function ThemeToggle() {
  const mode = useThemeMode();
  const next = mode === 'dark' ? 'light' : 'dark';
  const Icon = icons[mode];
  const label = `表示モード: ${labels[mode]}。${labels[next]}に切り替え`;
  return <button type="button" className="ui-button theme-toggle" onClick={() => setThemeMode(next)} aria-label={label} title={label}>
    <Icon size={18} aria-hidden="true" /><span>{labels[mode]}</span>
  </button>;
}
