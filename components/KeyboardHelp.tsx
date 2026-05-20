'use client';

import { X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '@/lib/hooks/useKeyboardShortcuts';

interface Props {
  onClose: () => void;
}

export function KeyboardHelp({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            {Object.entries(KEYBOARD_SHORTCUTS).map(([key, description]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{String(description)}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono text-foreground">
                  {key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Tip: Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> anytime to show this help.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
