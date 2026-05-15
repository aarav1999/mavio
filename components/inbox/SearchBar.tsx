'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onSearch: (q: string) => void;
  loading?: boolean;
}

export function SearchBar({ onSearch, loading }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(val);
    }, 400);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className={cn(
      'relative flex items-center rounded-xl border transition-all duration-150',
      focused ? 'border-primary/40 bg-background shadow-sm' : 'border-border bg-muted/50'
    )}>
      <div className="pl-3 flex-shrink-0">
        {loading
          ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          : <Search className="w-4 h-4 text-muted-foreground" />
        }
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search emails…"
        className="flex-1 bg-transparent px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
      />
      {query && (
        <button onClick={handleClear} className="pr-3">
          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      )}
    </div>
  );
}
