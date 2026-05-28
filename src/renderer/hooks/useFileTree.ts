import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/app-store';

export function useFileTree() {
  const projectPath = useAppStore((s) => s.projectPath);
  const fileTree = useAppStore((s) => s.fileTree);
  const setFileTree = useAppStore((s) => s.setFileTree);
  const setProject = useAppStore((s) => s.setProject);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    try {
      const tree = await window.hicc.listFiles('.', 3);
      setFileTree(tree);
    } catch {
      // Ignore errors silently
    }
  }, [projectPath, setFileTree]);

  useEffect(() => {
    if (projectPath) {
      refresh();
    }
  }, [projectPath, refresh]);

  // Listen for file changes
  useEffect(() => {
    window.hicc.onFileChanged(() => {
      refresh();
    });
  }, [refresh]);

  return { fileTree, refresh, projectPath, setProject };
}
