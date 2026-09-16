import { useEffect, useState } from 'react';
import { saveDraft, type LocalDraft } from './draftStore';

export function useLocalDraft(draft: LocalDraft) {
  const content = JSON.stringify(draft);
  const [saved, setSaved] = useState('');
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const persist = () => saveDraft(JSON.parse(content)).then(() => {
      if (active) { setSaved(content); setFailed(''); }
    }).catch(() => { if (active) setFailed(content); });
    const timer = window.setTimeout(persist, 400);
    const onPageHide = () => { void persist(); };
    window.addEventListener('pagehide', onPageHide);
    return () => { active = false; clearTimeout(timer); window.removeEventListener('pagehide', onPageHide); };
  }, [content, attempt]);
  useEffect(() => {
    if (saved === content) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [content, saved]);
  return { status: saved === content ? 'saved' : failed === content ? 'error' : 'saving', retry: () => setAttempt(n => n + 1) };
}
