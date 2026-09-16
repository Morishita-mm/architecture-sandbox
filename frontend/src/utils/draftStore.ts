import type { ProjectSaveData } from '../types';
import { normalizeProject, serializeProject } from './projectFormat';

export interface LocalDraft { project: ProjectSaveData; evaluationKey: string | null }
const DB_NAME = 'architecture-sandbox-drafts';
const STORE = 'projects';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'project.projectId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('別のタブを閉じて保存をやり直してください。'));
  });
}

export async function saveDraft(draft: LocalDraft): Promise<void> {
  // Apply the same boundaries as file import/export; fail visibly if the browser has no space.
  const safe = { project: JSON.parse(serializeProject(draft.project)) as ProjectSaveData, evaluationKey: draft.evaluationKey };
  safe.project.timestamp = new Date().toISOString();
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(safe);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function deleteDraft(projectId: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function readDrafts(): Promise<{ drafts: LocalDraft[]; unreadable: number }> {
  const db = await open();
  try {
    const rows = await new Promise<LocalDraft[]>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const drafts: LocalDraft[] = [];
    let unreadable = 0;
    for (const row of rows) {
      try { drafts.push({ project: normalizeProject(row.project), evaluationKey: typeof row.evaluationKey === 'string' ? row.evaluationKey : null }); }
      catch { unreadable++; }
    }
    return { drafts: drafts.sort((a, b) => Date.parse(b.project.timestamp) - Date.parse(a.project.timestamp)), unreadable };
  } finally { db.close(); }
}
