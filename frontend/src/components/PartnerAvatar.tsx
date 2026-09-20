import { BiRocket, BiCodeAlt, BiBarChartAlt2 } from 'react-icons/bi';
import type { PartnerRole } from '../types';

import { PARTNER_LABELS } from '../constants/partners';

const symbols = { ceo: BiRocket, cto: BiCodeAlt, cfo: BiBarChartAlt2 };

export function PartnerAvatar({ role }: { role: PartnerRole }) {
  const Symbol = symbols[role];
  return <span className={`partner-avatar partner-avatar-${role}`} role="img" aria-label={`${PARTNER_LABELS[role]}のアイコン`}>
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="var(--avatar-background)" />
      <path d="M10 64v-8c0-12 10-19 22-19s22 7 22 19v8" fill="var(--avatar-accent)" />
      <path d="M26 36h12v10l-6 5-6-5Z" fill="#dca987" />
      <path d="M19 24c0-11 5-16 13-16s13 5 13 16v7c0 10-6 16-13 16s-13-6-13-16Z" fill="#f1c6a5" />
      {role === 'ceo' && <>
        <path d="M18 27C12 9 26 2 37 7c11 0 13 12 8 21l-4-13c-5 7-13 9-23 12Z" fill="#453c46" />
        <path d="m23 44 9 7-6 9-6-13m21-3-9 7 6 9 6-13" fill="#fff" opacity=".9" />
      </>}
      {role === 'cto' && <>
        <path d="M18 26V15l6-1 1-7 8 3 8-2 6 10-2 10-6-10-11 3-5-2-2 8Z" fill="#293d45" />
        <g fill="none" stroke="#293d45" strokeWidth="2"><rect x="21" y="26" width="9" height="7" rx="3" /><rect x="34" y="26" width="9" height="7" rx="3" /><path d="M30 29h4" /></g>
        <path d="m23 45 9 6 9-6" fill="none" stroke="#fff" strokeWidth="3" opacity=".8" />
      </>}
      {role === 'cfo' && <>
        <path d="M18 27C13 8 26 3 36 7c11 1 15 10 9 22l-3-12c-10 3-15 1-18-2Z" fill="#514246" />
        <path d="m24 44 8 7 8-7 4 20H20Z" fill="#fff" opacity=".95" />
        <path d="m32 50 3 4-2 10h-2l-2-10Z" fill="#514246" />
      </>}
      <g fill="#453c46"><circle cx="26" cy="29" r="1.3" /><circle cx="38" cy="29" r="1.3" /></g>
      <path d="M28 37q4 3 8 0" fill="none" stroke="#a26056" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
    <span className="partner-avatar-symbol" aria-hidden="true"><Symbol /></span>
  </span>;
}
