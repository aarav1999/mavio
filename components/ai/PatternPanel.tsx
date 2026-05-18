'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Users, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pattern {
  type: string;
  description: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
}

interface Props {
  onDismiss: () => void;
}

export function PatternPanel({ onDismiss }: Props) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    try {
      const res = await fetch('/api/ai/patterns', { method: 'POST' });
      const data = await res.json();
      setPatterns(data.patterns || []);
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-3 mb-3">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-violet-500/30 rounded" />
          <div className="h-4 bg-violet-500/30 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (patterns.length === 0) {
    return null;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer_mentions': return Users;
      case 'unreplied_urgent': return AlertTriangle;
      case 'team_volume': return TrendingUp;
      case 'deadline_cluster': return Clock;
      default: return TrendingUp;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'medium': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium text-foreground">Patterns Detected</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2">
        {patterns.map((pattern, index) => {
          const Icon = getIcon(pattern.type);
          return (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2 p-2 rounded-lg border',
                getSeverityColor(pattern.severity)
              )}
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{pattern.description}</p>
                <p className="text-[10px] opacity-70">{pattern.count} emails involved</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
