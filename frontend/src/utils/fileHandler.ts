import type { ProjectSaveData } from '../types';
import { MAX_FILE_BYTES, parseProject, serializeProject } from './projectFormat';

export function saveProjectToLocalFile(data: ProjectSaveData, filename: string): void {
  const blob = new Blob([serializeProject(data)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // Strip filesystem separators and control characters from download names.
  // eslint-disable-next-line no-control-regex
  link.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function loadProjectFromLocalFile(file: File): Promise<ProjectSaveData> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`ファイルは${MAX_FILE_BYTES / 1024 / 1024}MiB以下にしてください。`);
  try { return parseProject(await file.text()); }
  catch { throw new Error('プロジェクトファイルの形式またはサイズが不正です。'); }
}
