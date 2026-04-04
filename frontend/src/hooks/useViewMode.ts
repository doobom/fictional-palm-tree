import { useState, useEffect } from 'react';

type ViewMode = 'grid' | 'list';

export function useViewMode(storageKey: string, defaultMode: ViewMode = 'grid') {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedMode = localStorage.getItem(storageKey);
    return (savedMode === 'grid' || savedMode === 'list') ? savedMode : defaultMode;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, viewMode);
  }, [viewMode, storageKey]);

  return [viewMode, setViewMode] as const;
}