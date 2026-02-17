/**
 * Dashboard Briefing Mock Page
 * Demonstrates daily briefing view with all states
 */

import { useState } from 'react';
import { Card } from '../components/data-display/Card';
import { Button } from '../components/forms/Button';
import { Badge } from '../components/data-display/Badge';
import { Spinner } from '../components/feedback/Spinner';

export function DashboardBriefing() {
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const mockBriefing = {
    date: new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    summary: `## What Requires Attention Today

### High Priority
- **Risk #47** - Database migration delayed by 3 days. Impact on Q4 deadline.
- **Action #123** - Security audit overdue (assigned to @john.smith)

### Recent Activity
- 3 new questions answered by AI
- 2 decisions finalized
- 5 documents processed

### Recommendations
1. Review risk mitigation for database migration
2. Follow up on overdue security audit
3. Consider adding buffer time to Q4 planning`,
  };

  const mockHistory = [
    { date: 'Yesterday', hasAlert: true },
    { date: '2 days ago', hasAlert: false },
    { date: '3 days ago', hasAlert: true },
    { date: '4 days ago', hasAlert: false },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex gap-6">
        {/* Main Briefing */}
        <div className="flex-1">
          <Card
            header={
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">Daily Briefing</h2>
                  <p className="text-sm text-text-secondary mt-1">{mockBriefing.date}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    {showHistory ? 'Hide' : 'Show'} History
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRefresh}
                    loading={loading}
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    }
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            }
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-text-secondary">Generating analysis...</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-text-primary">
                  {mockBriefing.summary}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-80">
            <Card>
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Previous Briefings
              </h3>
              <div className="space-y-2">
                {mockHistory.map((item, index) => (
                  <button
                    key={index}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors text-left"
                  >
                    <span className="text-sm text-text-primary">{item.date}</span>
                    {item.hasAlert && (
                      <Badge variant="warning" size="sm" dot>
                        Alert
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
