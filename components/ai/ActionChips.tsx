import { AIAction } from '@/types/email';
import { Clock, Users, CalendarCheck, MessageSquare, Info, AlertCircle } from 'lucide-react';

const typeConfig = {
  follow_up:          { icon: Clock,         classes: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  meeting_request:    { icon: CalendarCheck,  classes: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
  customer_escalation:{ icon: Users,          classes: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  requires_response:  { icon: MessageSquare,  classes: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  fyi:                { icon: Info,           classes: 'bg-muted text-muted-foreground' },
  deadline:           { icon: AlertCircle,    classes: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
} as const;

interface Props {
  actions: AIAction[];
}

export function ActionChips({ actions }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((action, i) => {
        const cfg = typeConfig[action.type] ?? typeConfig.fyi;
        const Icon = cfg.icon;
        return (
          <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.classes}`}>
            <Icon className="w-2.5 h-2.5" />
            {action.label}
          </span>
        );
      })}
    </div>
  );
}
