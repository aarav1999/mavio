import { PriorityLabel } from '@/types/email';
import { cn } from '@/lib/utils';

const config: Record<PriorityLabel, { label: string; classes: string }> = {
  urgent:    { label: 'Urgent',    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  important: { label: 'Important', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  normal:    { label: 'Normal',    classes: 'bg-muted text-muted-foreground' },
  low:       { label: 'Low',       classes: 'bg-muted text-muted-foreground/60' },
};

interface Props {
  label: PriorityLabel;
  score?: number | null;
  className?: string;
}

export function PriorityBadge({ label, score, className }: Props) {
  const cfg = config[label] ?? config.normal;
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide', cfg.classes, className)}>
      {cfg.label}
    </span>
  );
}
