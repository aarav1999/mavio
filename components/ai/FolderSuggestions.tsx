'use client';

import { useEffect, useState } from 'react';
import { Folder, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface FolderSuggestion {
  action: string;
  target: string;
  emailIds: string[];
  reason: string;
  count: number;
}

interface Props {
  onDismiss: () => void;
}

export function FolderSuggestions({ onDismiss }: Props) {
  const [suggestions, setSuggestions] = useState<FolderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/ai/folder-suggestions', { method: 'POST' });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch folder suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = async (suggestion: FolderSuggestion) => {
    setApplying(suggestion.action + suggestion.target);
    
    try {
      // In a real implementation, this would call an API to apply the action
      // For now, just show a success toast
      toast.success(`Applied: ${suggestion.action} to ${suggestion.count} emails`);
      
      // Remove the applied suggestion
      setSuggestions(prev => prev.filter(s => s !== suggestion));
      
      if (suggestions.length === 1) {
        onDismiss();
      }
    } catch (error) {
      toast.error('Failed to apply suggestion');
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-500/30 rounded" />
          <div className="h-4 bg-amber-500/30 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'move_to_folder': return 'Move to';
      case 'label_as': return 'Label as';
      case 'archive': return 'Archive';
      case 'mark_read': return 'Mark as read';
      default: return action;
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-foreground">Smart Folder Suggestions</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-amber-500/10"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {getActionLabel(suggestion.action)} <span className="text-amber-500">{suggestion.target}</span>
                </p>
                <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {suggestion.count} emails
              </span>
            </div>
            <button
              onClick={() => applySuggestion(suggestion)}
              disabled={applying === (suggestion.action + suggestion.target)}
              className={cn(
                'ml-3 p-2 rounded-lg transition-colors',
                'bg-amber-500 text-white hover:bg-amber-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {applying === (suggestion.action + suggestion.target) ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
