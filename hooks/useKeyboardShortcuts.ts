'use client';

import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Check for exact matches
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export const KEYBOARD_SHORTCUTS = {
  j: 'Next email',
  k: 'Previous email',
  e: 'Archive email',
  r: 'Reply to email',
  c: 'Compose new email',
  s: 'Star/unstar email',
  x: 'Delete email',
  '/': 'Focus search',
  '?': 'Show keyboard shortcuts',
  escape: 'Close modal',
};
