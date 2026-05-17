'use client';

import { Sparkles, Zap, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EmailPreview {
  id: string;
  from: string;
  subject: string;
  preview: string;
  priorityScore: number;
  priorityLabel: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
  summary: string;
  whyItMatters: string;
  nextSteps: string[];
  latency: string;
  tokens: number;
}

const mockEmail: EmailPreview = {
  id: '1',
  from: 'Engineering Team',
  subject: 'Production Incident: API Latency Spike',
  preview: 'Team proceeds with rollback approach. Key actions: Inform finance and support teams, notify customers by 8 PM.',
  priorityScore: 92,
  priorityLabel: 'URGENT',
  urgency: 'urgent',
  confidence: 94,
  summary: 'API latency spike detected in payment service. Team executing rollback to previous stable version. Customer communication in progress.',
  whyItMatters: 'This email involves a production incident affecting payment processing, requiring immediate action and customer communication.',
  nextSteps: ['Inform finance team', 'Notify support team', 'Email customers by 8 PM', 'Monitor rollback progress'],
  latency: '1.9s',
  tokens: 56,
};

export function ProductPreview() {
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-blue-600';
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold text-white">AI-Powered Email Intelligence</span>
        </div>
      </div>

      {/* Email Content */}
      <div className="p-6 space-y-4">
        {/* Email Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">{mockEmail.from}</span>
                <span className="text-xs text-gray-500">→ you</span>
              </div>
              <h3 className="text-base font-medium text-gray-900">{mockEmail.subject}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${getUrgencyColor(mockEmail.urgency)}`}>
                {mockEmail.priorityLabel}
              </span>
              <span className={`text-lg font-bold ${getScoreColor(mockEmail.priorityScore)}`}>
                {mockEmail.priorityScore}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{mockEmail.preview}</p>
        </div>

        {/* AI Insights Panel */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-semibold text-violet-900">AI Analysis</span>
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-700">Summary</p>
            <p className="text-sm text-gray-800 leading-relaxed">{mockEmail.summary}</p>
          </div>

          {/* Why It Matters */}
          <div className="pt-2 border-t border-violet-200/50">
            <p className="text-xs font-medium text-gray-700 mb-1">Why this matters</p>
            <p className="text-sm text-gray-800 leading-relaxed">{mockEmail.whyItMatters}</p>
          </div>

          {/* Next Steps */}
          <div className="pt-2 border-t border-violet-200/50">
            <p className="text-xs font-medium text-gray-700 mb-2">Actionable Next Steps</p>
            <ul className="space-y-1">
              {mockEmail.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Observability Chips */}
        <div className="flex flex-wrap gap-2 pt-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs text-gray-600 font-medium">{mockEmail.latency}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
            <span className="text-xs text-gray-600 font-medium">{mockEmail.tokens} tokens</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-700" />
            <span className="text-xs text-green-700 font-medium">{mockEmail.confidence}% confidence</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Smart Reply:</span> 3 AI-generated drafts available
        </p>
      </div>
    </div>
  );
}
