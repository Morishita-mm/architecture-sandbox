import { createContext } from 'react';
/** Transient playback only; not stored in edge data or undo history. */
export interface EdgePacket { edgeId: string; reverse: boolean; response: boolean; key: string; playing: boolean }
export const EdgePacketContext = createContext<EdgePacket | undefined>(undefined);
