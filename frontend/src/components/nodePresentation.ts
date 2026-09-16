import { createContext } from 'react';
/** View-only overlays: never part of project data, evaluation input or edit history. */
export interface NodePresentation {
  step?: number; status?: string; fixed?: boolean;
  action?: { label: string; onClick: () => void };
  screen?: { text: string; state: 'idle' | 'waiting' | 'success' | 'blocked' };
}
export const NodePresentationContext = createContext<Record<string, NodePresentation>>({});
